import { ref, computed } from 'vue'
import { supabase, isSupabaseConfigured } from '@/services/supabase'
import type { PoLine, PoReceiptLog, PurchaseOrder, PurchaseOrderWithProgress } from '@/types'
import {
  buildPoLineProgress,
  buildPoProgress,
  computePoStats,
  filterPurchaseOrders,
  getEffectivePoLines,
  normalizePoNo,
  sortPoForDisplay,
  todayIsoDate,
  validateLineReceiptInput,
  validatePoInput,
  type PoLineInput,
} from '@/utils/po'
import type { PoExcelRow } from '@/services/poExcel'

export interface PoInput {
  po_no: string
  supplier: string
  item_code: string
  description?: string
  note?: string
  target_qty: number | string
  created_date: string
  /** T1: N sản phẩm/PO. Khi có lines, target_qty = sum(lines). */
  lines?: PoLineInput[] | null
}

export interface ReceiptInput {
  receipt_date: string
  qty: number
  note?: string
  /** T2: nhập cho mã nào trong PO. null/rỗng = gộp cũ (chỉ cho PO 1 mã). */
  po_line_id?: string | null
  item_code?: string
}

const genId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `po-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// State dùng chung trong session (Supabase là nguồn chính, memory là fallback khi chưa cấu hình)
const purchaseOrders = ref<PurchaseOrder[]>([])
const poLines = ref<PoLine[]>([])
const receiptLogs = ref<PoReceiptLog[]>([])
const loading = ref(false)
const searchText = ref('')
const statusFilter = ref<'open' | 'completed'>('open')
const lastSync = ref('--:--')
// false khi Supabase chưa có bảng purchase_orders (admin chưa chạy migration):
// tự rơi về memory để app vẫn chạy, đồng thời báo banner hướng dẫn migration
const backendAvailable = ref(true)

const cleanOpt = (v: unknown) => String(v ?? '').trim()

const normalizeLogRow = (l: PoReceiptLog): PoReceiptLog => ({
  ...l,
  po_line_id: (l as PoReceiptLog).po_line_id ?? null,
  item_code: String((l as PoReceiptLog).item_code ?? ''),
  qty: Number(l.qty) || 0,
})

/** Chuẩn hóa input T1: lines (nếu có) quyết định item_code/description/target_qty hiển thị. */
const normalizePoLinesInput = (
  input: PoInput,
  poId: string,
  poNo: string,
  now: string,
  existingLines: PoLine[] = [],
): { lines: PoLine[]; item_code: string; description: string; target_qty: number } => {
  const rawLines = (input.lines || []).filter((l) => String(l.item_code || '').trim() || Number(l.target_qty) > 0)
  if (rawLines.length > 0) {
    // T2: giữ lại id dòng cũ theo mã hàng để log nhập theo mã không bị mồ côi khi sửa PO.
    const byCode = new Map<string, PoLine[]>()
    existingLines.forEach((l) => {
      const k = String(l.item_code || '').trim().toUpperCase()
      if (!k) return
      if (!byCode.has(k)) byCode.set(k, [])
      byCode.get(k)!.push(l)
    })
    const usedIds = new Set<string>()
    const lines: PoLine[] = rawLines.map((l) => {
      const code = String(l.item_code).trim()
      const candidates = byCode.get(code.toUpperCase()) || []
      const reuse = candidates.find((c) => !usedIds.has(c.id))
      if (reuse) usedIds.add(reuse.id)
      return {
        id: reuse ? reuse.id : genId(),
        po_id: poId,
        po_no: poNo,
        item_code: code,
        description: cleanOpt(l.description),
        target_qty: Number(l.target_qty),
        created_at: reuse?.created_at || now,
        updated_at: now,
      }
    })
    return {
      lines,
      item_code: lines[0].item_code,
      description: lines[0].description || '',
      target_qty: lines.reduce((s, l) => s + (Number(l.target_qty) || 0), 0),
    }
  }
  return {
    lines: [],
    item_code: String(input.item_code).trim(),
    description: cleanOpt(input.description),
    target_qty: Number(input.target_qty),
  }
}

const attachLines = (list: PurchaseOrder[]): PurchaseOrder[] =>
  list.map((p) => ({ ...p, lines: poLines.value.filter((l) => l.po_id === p.id || l.po_no === p.po_no) }))

const isMemoryId = (id: string) => id.startsWith('po-seed-') || id.startsWith('log-seed-')

const isMissingTableError = (e: unknown): boolean => {
  const code = (e as { code?: string })?.code
  const message = (e as { message?: string })?.message || String(e || '')
  return code === 'PGRST205' || message.includes('Could not find the table')
}

const isRlsError = (e: unknown): boolean => {
  const message = (e as { message?: string })?.message || String(e || '')
  return message.includes('row-level security') || message.includes('violates row-level security')
}

// true khi Supabase thiếu cột description/note (chưa chạy file SQL mới):
// app vẫn chạy, tự ghi bản legacy, đồng thời báo banner chạy lại migration
const needsColumnMigration = ref(false)

const isMissingColumnError = (e: unknown): boolean => {
  const code = (e as { code?: string })?.code
  const message = (e as { message?: string })?.message || String(e || '')
  return code === 'PGRST204' || message.includes("in the schema cache")
}

/** Bỏ 2 cột mới để ghi tương thích với bảng Supabase cũ (pattern giống forecast). */
const toLegacyPoPayload = <T extends object>(payload: T): Omit<T, 'description' | 'note'> => {
  const { description: _d, note: _n, ...rest } = payload as T & { description?: unknown; note?: unknown }
  return rest
}

/** Bỏ trường lines (chỉ tồn tại ở memory) trước khi ghi Supabase — tránh lỗi PGRST204 schema cache. */
const stripPoLines = <T extends object>(payload: T): Omit<T, 'lines'> => {
  const { lines: _l, ...rest } = payload as T & { lines?: unknown }
  return rest
}

/**
 * Ghi/đọc xuống Supabase.
 * - Bảng chưa tạo (PGRST205): tự fallback memory, bật cờ needsMigration, không throw.
 * - Thiếu cột mới (PGRST204): thử lại bản legacy (bỏ description/note), bật cờ migration.
 * - Lỗi RLS: throw message hướng dẫn chạy file database/purchase_orders.sql.
 */
const callSupabase = async <T>(
  fn: () => PromiseLike<{ data: T | null; error: unknown }>,
  legacyFn?: () => PromiseLike<{ data: T | null; error: unknown }>,
): Promise<T | null> => {
  if (!isSupabaseConfigured || !backendAvailable.value) return null
  const run = async (thunk: () => PromiseLike<{ data: T | null; error: unknown }>) => {
    try {
      return { result: await thunk(), thrown: null as unknown }
    } catch (e) {
      return { result: null, thrown: e as unknown }
    }
  }

  let { result: res, thrown } = await run(fn)
  if (thrown) {
    if (isMissingTableError(thrown)) {
      backendAvailable.value = false
      warnMissingTable()
      return null
    }
    throw thrown
  }
  if (res!.error) {
    const err = res!.error
    if (isMissingTableError(err)) {
      backendAvailable.value = false
      warnMissingTable()
      return null
    }
    if (isMissingColumnError(err) && legacyFn) {
      needsColumnMigration.value = true
      console.warn('[PO] Supabase chưa có cột description/note. Hãy chạy lại database/purchase_orders.sql. Tạm ghi bản tương thích.')
      const retry = await run(legacyFn)
      if (retry.thrown) throw retry.thrown
      if (retry.result!.error) {
        if (isRlsError(retry.result!.error)) throw rlsError()
        throw retry.result!.error
      }
      return retry.result!.data
    }
    if (isRlsError(err)) throw rlsError()
    throw err
  }
  return res!.data
}

const rlsError = () =>
  new Error('Supabase chặn quyền ghi (RLS). Hãy chạy file database/purchase_orders.sql trong Supabase SQL Editor.')

const warnMissingTable = () => {
  console.warn(
    '[PO] Chưa tìm thấy bảng purchase_orders trên Supabase. Hãy chạy file database/purchase_orders.sql. Tạm dùng bộ nhớ máy.',
  )
}

export function usePurchaseOrders() {
  /** true khi cần chạy migration database/purchase_orders.sql trên Supabase. */
  const needsMigration = computed(
    () => isSupabaseConfigured && (!backendAvailable.value || needsColumnMigration.value),
  )

  /** Nạp toàn bộ PO + lines + log nhập hàng từ Supabase (rỗng 100% nếu DB chưa có gì). */
  const fetchPurchaseOrders = async () => {
    loading.value = true
    try {
      const [poData, logData, lineData] = await Promise.all([
        callSupabase<PurchaseOrder[]>(() =>
          supabase.from('purchase_orders').select('*').order('created_date', { ascending: false }),
        ),
        callSupabase<PoReceiptLog[]>(() =>
          supabase.from('po_receipt_logs').select('*').order('receipt_date', { ascending: true }),
        ),
        // T1: bảng po_lines có thể chưa migrate -> thiếu bảng thì coi như rỗng, không fail
        (async () => {
          try {
            if (!isSupabaseConfigured || !backendAvailable.value) return null
            const { data, error } = await supabase.from('po_lines').select('*')
            if (error) return null
            return (data || []) as PoLine[]
          } catch {
            return null
          }
        })(),
      ])
      if (lineData) {
        poLines.value = lineData.map((l) => ({ ...l, target_qty: Number(l.target_qty) || 0 }))
      }
      if (poData) {
        const base = poData.map((p) => ({
          ...p,
          description: cleanOpt(p.description),
          note: cleanOpt(p.note),
          target_qty: Number(p.target_qty) || 0,
        }))
        purchaseOrders.value = attachLines(base)
      } else {
        purchaseOrders.value = attachLines(purchaseOrders.value)
      }
      if (logData) {
        receiptLogs.value = logData.map(normalizeLogRow)
      }
      lastSync.value = new Date().toLocaleTimeString('vi-VN')
    } finally {
      loading.value = false
    }
  }

  /** Ghi lines xuống Supabase (best-effort: thiếu bảng thì bỏ qua, memory vẫn đủ). */
  const persistPoLines = async (lines: PoLine[]) => {
    if (!isSupabaseConfigured || !backendAvailable.value || lines.length === 0) return
    try {
      await supabase.from('po_lines').insert(lines)
    } catch {
      // Thiếu bảng po_lines (chưa chạy purchase_orders_lines.sql) -> bỏ qua
    }
  }

  const removePoLines = async (poId: string, poNo: string) => {
    poLines.value = poLines.value.filter((l) => l.po_id !== poId && l.po_no !== poNo)
    if (!isSupabaseConfigured || !backendAvailable.value || isMemoryId(poId)) return
    try {
      await supabase.from('po_lines').delete().eq('po_id', poId)
      await supabase.from('po_lines').delete().eq('po_no', poNo)
    } catch {
      // ignore khi chưa migrate
    }
  }

  /** Tạo PO mới (chống trùng số PO). */
  const createPurchaseOrder = async (input: PoInput): Promise<PurchaseOrder> => {
    const err = validatePoInput(input)
    if (err) throw new Error(err)
    const poNo = String(input.po_no).trim()
    const duplicated = purchaseOrders.value.some((p) => normalizePoNo(p.po_no) === normalizePoNo(poNo))
    if (duplicated) throw new Error(`Số PO [${poNo}] đã tồn tại trong hệ thống!`)

    const now = new Date().toISOString()
    const poId = genId()
    const norm = normalizePoLinesInput(input, poId, poNo, now)
    const po: PurchaseOrder = {
      id: poId,
      po_no: poNo,
      supplier: String(input.supplier).trim(),
      item_code: norm.item_code,
      description: norm.description,
      note: cleanOpt(input.note),
      target_qty: norm.target_qty,
      created_date: input.created_date,
      status: 'open',
      closed_at: null,
      created_at: now,
      updated_at: now,
      lines: norm.lines,
    }

    await callSupabase(
      () => supabase.from('purchase_orders').insert(stripPoLines(po)).select(),
      () => supabase.from('purchase_orders').insert(toLegacyPoPayload(stripPoLines(po))).select(),
    )
    await persistPoLines(norm.lines)
    poLines.value = [...norm.lines, ...poLines.value]
    purchaseOrders.value = [po, ...purchaseOrders.value]
    return po
  }

  /** Sửa thông tin PO (không cho trùng số PO khác, tự đóng/mở lại theo target mới). */
  const updatePurchaseOrder = async (id: string, input: PoInput): Promise<PurchaseOrder> => {
    const err = validatePoInput(input)
    if (err) throw new Error(err)
    const idx = purchaseOrders.value.findIndex((p) => p.id === id)
    if (idx === -1) throw new Error('Không tìm thấy PO cần sửa!')
    const poNo = String(input.po_no).trim()
    const duplicated = purchaseOrders.value.some(
      (p) => p.id !== id && normalizePoNo(p.po_no) === normalizePoNo(poNo),
    )
    if (duplicated) throw new Error(`Số PO [${poNo}] đã tồn tại trong hệ thống!`)

    const current = purchaseOrders.value[idx]
    const now = new Date().toISOString()
    const existingLines = poLines.value.filter((l) => l.po_id === id || l.po_no === current.po_no)
    const norm = normalizePoLinesInput(input, id, poNo, now, existingLines)
    // T2: trạng thái suy ra theo quy tắc từng mã (buildPoProgress), không dùng tổng gộp thô.
    const previewPo: PurchaseOrder = {
      ...current,
      po_no: poNo,
      supplier: String(input.supplier).trim(),
      item_code: norm.item_code,
      description: norm.description,
      note: cleanOpt(input.note),
      target_qty: norm.target_qty,
      created_date: input.created_date,
      updated_at: new Date().toISOString(),
      lines: norm.lines,
    }
    const previewProgress = buildPoProgress(previewPo, receiptLogs.value)
    const completed = previewProgress.status === 'completed'
    const updated: PurchaseOrder = {
      ...current,
      po_no: poNo,
      supplier: String(input.supplier).trim(),
      item_code: norm.item_code,
      description: norm.description,
      note: cleanOpt(input.note),
      target_qty: norm.target_qty,
      created_date: input.created_date,
      status: completed ? 'completed' : 'open',
      closed_at: completed ? current.closed_at || new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
      lines: norm.lines,
    }

    if (!isMemoryId(id)) {
      await callSupabase(
        () => supabase.from('purchase_orders').update(stripPoLines(updated)).eq('id', id).select(),
        () => supabase.from('purchase_orders').update(toLegacyPoPayload(stripPoLines(updated))).eq('id', id).select(),
      )
      await removePoLines(id, current.po_no)
      await persistPoLines(norm.lines)
    }
    poLines.value = [...poLines.value.filter((l) => l.po_id !== id && l.po_no !== current.po_no), ...norm.lines]
    purchaseOrders.value = purchaseOrders.value.map((p) => (p.id === id ? updated : p))
    return updated
  }

  /** Xóa PO + toàn bộ lines + log nhập hàng đi kèm. */
  const deletePurchaseOrder = async (id: string) => {
    const target = purchaseOrders.value.find((p) => p.id === id)
    if (!isMemoryId(id)) {
      await callSupabase(() => supabase.from('purchase_orders').delete().eq('id', id).select())
    }
    if (target) await removePoLines(id, target.po_no)
    else poLines.value = poLines.value.filter((l) => l.po_id !== id)
    purchaseOrders.value = purchaseOrders.value.filter((p) => p.id !== id)
    receiptLogs.value = receiptLogs.value.filter((l) => l.po_id !== id)
  }

  /** Đóng / mở lại PO (dùng nội bộ cho auto-close + nút thủ công). */
  const markPoCompleted = async (poId: string, completed: boolean) => {
    const idx = purchaseOrders.value.findIndex((p) => p.id === poId)
    if (idx === -1) return
    const updated: PurchaseOrder = {
      ...purchaseOrders.value[idx],
      status: completed ? 'completed' : 'open',
      closed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }
    if (!isMemoryId(poId)) {
      await callSupabase(
        () => supabase.from('purchase_orders').update(stripPoLines(updated)).eq('id', poId).select(),
        () => supabase.from('purchase_orders').update(toLegacyPoPayload(stripPoLines(updated))).eq('id', poId).select(),
      )
    }
    purchaseOrders.value = purchaseOrders.value.map((p) => (p.id === poId ? updated : p))
  }

  /** T2: Nhập hàng theo từng mã — PO chỉ tự đóng khi TẤT CẢ mã đều đủ target. */
  const addReceipt = async (poId: string, input: ReceiptInput): Promise<PoReceiptLog> => {
    const po = purchaseOrders.value.find((p) => p.id === poId)
    if (!po) throw new Error('Không tìm thấy PO để nhập hàng!')
    const withLines = attachLines([po])[0]
    const effectiveLines = getEffectivePoLines(withLines)
    const lineCount = (withLines.lines || []).filter((l) => l.item_code || Number(l.target_qty) > 0).length

    const err = validateLineReceiptInput(input, lineCount > 1 ? lineCount : effectiveLines.length > 1 ? effectiveLines.length : 1)
    if (err) throw new Error(err)

    // Chặn nhập khi PO đã đóng (theo quy tắc từng mã hiện tại)
    const before = buildPoProgress(withLines, receiptLogs.value)
    if (before.status === 'completed') throw new Error(`PO [${po.po_no}] đã giao đủ và đóng, không thể nhập thêm!`)

    // Xác định mã được nhập
    let lineId: string | null = String(input.po_line_id || '').trim() || null
    let line = lineId ? effectiveLines.find((l) => l.id === lineId) : undefined
    if (lineCount > 1) {
      if (!line) throw new Error('Mã hàng đã chọn không thuộc PO này!')
      const lineBefore = buildPoLineProgress(line, receiptLogs.value.filter((l) => l.po_id === poId))
      if (lineBefore.status === 'completed') {
        throw new Error(`Mã [${line.item_code}] đã nhập đủ ${Number(line.target_qty).toLocaleString()} PCS, không thể nhập thêm!`)
      }
    } else {
      // PO 1 mã: không gắn line (giữ tương thích log gộp cũ)
      lineId = (effectiveLines[0] && effectiveLines[0].id) || null
      if (lineId && !effectiveLines.find((l) => l.id === lineId)) lineId = null
      if (!lineId) line = effectiveLines[0]
      else line = effectiveLines.find((l) => l.id === lineId) || effectiveLines[0]
    }

    const log: PoReceiptLog = {
      id: genId(),
      po_id: poId,
      po_line_id: lineCount > 1 ? (line?.id || null) : null,
      item_code: line?.item_code || String(input.item_code || po.item_code || '').trim(),
      receipt_date: input.receipt_date,
      qty: Number(input.qty),
      note: String(input.note || '').trim(),
      created_at: new Date().toISOString(),
    }
    // PO 1 mã cũ: giữ log gộp (po_line_id null) để tương thích báo cáo cũ
    if (lineCount <= 1 && !((withLines.lines || []).length > 0)) {
      log.po_line_id = null
    }

    if (!isMemoryId(poId)) {
      try {
        await callSupabase(() => supabase.from('po_receipt_logs').insert(log).select())
      } catch (e) {
        // DB chưa migrate cột po_line_id/item_code -> ghi bản legacy (bỏ 2 cột)
        const msg = e instanceof Error ? e.message : String(e || '')
        if (msg.includes('schema cache') || (e as { code?: string })?.code === 'PGRST204') {
          const { po_line_id: _pl, item_code: _ic, ...legacy } = log
          await callSupabase(() => supabase.from('po_receipt_logs').insert(legacy).select())
          console.warn('[PO] po_receipt_logs chưa có cột po_line_id/item_code. Hãy chạy database/purchase_orders_line_receipts.sql. Tạm ghi log gộp.')
        } else {
          throw e
        }
      }
    }
    receiptLogs.value = [...receiptLogs.value, log]

    // Tự động đóng/mở lại theo quy tắc từng mã
    const after = buildPoProgress(withLines, receiptLogs.value)
    if (after.status === 'completed' && po.status !== 'completed') {
      await markPoCompleted(poId, true)
    }
    return log
  }

  /** Xóa 1 dòng log nhập hàng (PO tự mở lại nếu còn mã chưa đủ target). */
  const deleteReceipt = async (logId: string) => {
    const log = receiptLogs.value.find((l) => l.id === logId)
    if (!log) throw new Error('Không tìm thấy dòng log nhập hàng!')
    if (!isMemoryId(logId) && !isMemoryId(log.po_id)) {
      await callSupabase(() => supabase.from('po_receipt_logs').delete().eq('id', logId).select())
    }
    receiptLogs.value = receiptLogs.value.filter((l) => l.id !== logId)

    const po = purchaseOrders.value.find((p) => p.id === log.po_id)
    if (po) {
      const withLines = attachLines([po])[0]
      const after = buildPoProgress(withLines, receiptLogs.value)
      if (po.status === 'completed' && after.status !== 'completed') {
        await markPoCompleted(po.id, false)
      } else if (po.status !== 'completed' && after.status === 'completed') {
        await markPoCompleted(po.id, true)
      }
    }
  }

  /** Import hàng loạt PO từ Excel: trùng số PO thì cập nhật, mới thì thêm. T1: nhiều dòng cùng po_no -> group thành lines. */
  const importPurchaseOrders = async (rows: PoExcelRow[]) => {
    const now = new Date().toISOString()
    // Group theo po_no để hỗ trợ file Excel có nhiều dòng sản phẩm cho 1 PO
    const grouped = new Map<string, PoExcelRow[]>()
    rows.forEach((r) => {
      const key = normalizePoNo(String(r.po_no || ''))
      if (!key) return
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(r)
    })
    const prepared: PurchaseOrder[] = []
    const skipped: string[] = []
    // T1: hàng trống Số PO vẫn tính skipped (giữ tương thích test cũ)
    rows.forEach((r) => {
      if (!normalizePoNo(String(r.po_no || ''))) {
        skipped.push(`${String(r.po_no || '(trống)')} : Vui lòng nhập Số PO!`)
      }
    })

    grouped.forEach((groupRows, normKey) => {
      const first = groupRows[0]
      const poNo = String(first.po_no).trim()
      if (groupRows.length > 1) {
        const lines: PoLineInput[] = groupRows.map((r) => ({
          item_code: String(r.item_code || 'N/A'),
          description: String(r.description || ''),
          target_qty: Number(r.target_qty) || 0,
        }))
        const err = validatePoInput({
          po_no: poNo,
          supplier: String(first.supplier || 'N/A'),
          item_code: lines[0]?.item_code || 'N/A',
          target_qty: lines.reduce((s, l) => s + (Number(l.target_qty) || 0), 0),
          created_date: first.created_date || todayIsoDate(),
          lines,
        })
        if (err) {
          skipped.push(`${poNo}: ${err}`)
          return
        }
        const poId = genId()
        prepared.push({
          id: poId,
          po_no: poNo,
          supplier: String(first.supplier || 'N/A').trim(),
          item_code: String(lines[0].item_code).trim(),
          description: cleanOpt(lines[0].description),
          note: cleanOpt(first.note),
          target_qty: lines.reduce((s, l) => s + (Number(l.target_qty) || 0), 0),
          created_date: first.created_date || todayIsoDate(),
          status: 'open',
          closed_at: null,
          created_at: now,
          updated_at: now,
          lines: lines.map((l) => ({
            id: genId(),
            po_id: poId,
            po_no: poNo,
            item_code: String(l.item_code).trim(),
            description: cleanOpt(l.description),
            target_qty: Number(l.target_qty),
            created_at: now,
            updated_at: now,
          })),
        })
      } else {
        const r = first
        void normKey
        const err = validatePoInput({
          po_no: r.po_no,
          supplier: r.supplier || 'N/A',
          item_code: r.item_code || 'N/A',
          target_qty: r.target_qty,
          created_date: r.created_date || todayIsoDate(),
        })
        if (err) {
          skipped.push(`${r.po_no}: ${err}`)
          return
        }
        prepared.push({
          id: genId(),
          po_no: String(r.po_no).trim(),
          supplier: String(r.supplier || 'N/A').trim(),
          item_code: String(r.item_code || 'N/A').trim(),
          description: cleanOpt(r.description),
          note: cleanOpt(r.note),
          target_qty: Number(r.target_qty),
          created_date: r.created_date || todayIsoDate(),
          status: 'open',
          closed_at: null,
          created_at: now,
          updated_at: now,
          lines: [],
        })
      }
    })

    if (isSupabaseConfigured && backendAvailable.value) {
      let useMemoryFallback = false
      for (const po of prepared) {
        const exists = purchaseOrders.value.find((p) => normalizePoNo(p.po_no) === normalizePoNo(po.po_no))
        try {
          if (exists && !isMemoryId(exists.id)) {
            const poUpdate = {
              supplier: po.supplier,
              item_code: po.item_code,
              description: po.description,
              note: po.note,
              target_qty: po.target_qty,
              created_date: po.created_date,
              updated_at: now,
            }
            await callSupabase(
              () => supabase.from('purchase_orders').update(poUpdate).eq('id', exists.id).select(),
              () => supabase.from('purchase_orders').update(toLegacyPoPayload(poUpdate)).eq('id', exists.id).select(),
            )
          } else if (!exists) {
            await callSupabase(
      () => supabase.from('purchase_orders').insert(stripPoLines(po)).select(),
      () => supabase.from('purchase_orders').insert(toLegacyPoPayload(stripPoLines(po))).select(),
    )
          }
        } catch (e) {
          throw e
        }
        if (!backendAvailable.value) {
          useMemoryFallback = true
          break
        }
      }
      if (!useMemoryFallback) {
        await fetchPurchaseOrders()
        // Đồng bộ các PO memory (seed) trùng số PO trong đợt import
        prepared.forEach((po) => {
          const idx = purchaseOrders.value.findIndex((p) => normalizePoNo(p.po_no) === normalizePoNo(po.po_no))
          if (idx === -1) purchaseOrders.value = [po, ...purchaseOrders.value]
        })
        // T1: đồng bộ lines import vào memory + Supabase (best-effort)
        const allImportLines = prepared.flatMap((p) => p.lines || [])
        if (allImportLines.length > 0) {
          poLines.value = [...allImportLines, ...poLines.value]
          await persistPoLines(allImportLines)
        }
        return { imported: prepared.length, skipped }
      }
    }

    const merged = [...purchaseOrders.value]
    const mergedLines = [...poLines.value]
    prepared.forEach((po) => {
      const idx = merged.findIndex((p) => normalizePoNo(p.po_no) === normalizePoNo(po.po_no))
      if (idx !== -1) {
        merged[idx] = {
          ...merged[idx],
          supplier: po.supplier,
          item_code: po.item_code,
          target_qty: po.target_qty,
          created_date: po.created_date,
          updated_at: now,
          lines: po.lines && po.lines.length > 0 ? po.lines : merged[idx].lines,
        }
      } else {
        merged.unshift(po)
      }
    })
    prepared.forEach((po) => {
      ;(po.lines || []).forEach((l) => {
        if (!mergedLines.some((x) => x.id === l.id)) mergedLines.push(l)
      })
    })
    poLines.value = mergedLines
    purchaseOrders.value = merged
    return { imported: prepared.length, skipped }
  }

  /** Xóa sạch toàn bộ PO + lines + log (dùng khi reset hệ thống). */
  const clearAllPurchaseOrders = async () => {
    await callSupabase(() => supabase.from('purchase_orders').delete().neq('po_no', '__never_match_key__').select())
    try {
      if (isSupabaseConfigured && backendAvailable.value) {
        await supabase.from('po_lines').delete().neq('po_no', '__never_match_key__')
      }
    } catch {
      // ignore
    }
    purchaseOrders.value = []
    poLines.value = []
    receiptLogs.value = []
  }

  const clearMemory = () => {
    purchaseOrders.value = []
    poLines.value = []
    receiptLogs.value = []
  }

  // PO kèm tiến độ (trạng thái suy ra từ log: đủ 100% là completed)
  const ordersWithProgress = computed<PurchaseOrderWithProgress[]>(() =>
    purchaseOrders.value.map((po) => buildPoProgress(po, receiptLogs.value)),
  )

  const sortedOrders = computed(() => sortPoForDisplay(ordersWithProgress.value))

  const filteredOrders = computed(() =>
    filterPurchaseOrders(sortedOrders.value, searchText.value, statusFilter.value),
  )

  const stats = computed(() => computePoStats(ordersWithProgress.value))

  /** Log nhập hàng của 1 PO, sắp xếp cũ -> mới theo ngày nhập. */
  const getPoLogs = (poId: string): PoReceiptLog[] =>
    receiptLogs.value
      .filter((l) => l.po_id === poId)
      .sort((a, b) => String(a.receipt_date).localeCompare(String(b.receipt_date)))

  /** T2: log của 1 mã cụ thể trong PO (dùng cho lịch sử lọc theo mã). */
  const getLineLogs = (poId: string, lineId: string): PoReceiptLog[] =>
    getPoLogs(poId).filter((l) => String(l.po_line_id || '') === String(lineId))

  /** T2: log gộp cũ chưa gán mã (hiển thị giải thích ở dòng cha). */
  const getLegacyLogs = (poId: string): PoReceiptLog[] =>
    getPoLogs(poId).filter((l) => !String(l.po_line_id || '').trim())

  return {
    purchaseOrders,
    poLines,
    receiptLogs,
    loading,
    searchText,
    statusFilter,
    lastSync,
    backendAvailable,
    needsMigration,
    needsColumnMigration,
    ordersWithProgress,
    sortedOrders,
    filteredOrders,
    stats,
    getPoLogs,
    getLineLogs,
    getLegacyLogs,
    fetchPurchaseOrders,
    createPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
    addReceipt,
    deleteReceipt,
    importPurchaseOrders,
    clearAllPurchaseOrders,
    clearMemory,
  }
}
