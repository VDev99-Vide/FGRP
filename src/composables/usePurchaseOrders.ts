import { ref, computed } from 'vue'
import { supabase, isSupabaseConfigured } from '@/services/supabase'
import type { PoReceiptLog, PurchaseOrder, PurchaseOrderWithProgress } from '@/types'
import {
  buildPoProgress,
  computePoStats,
  filterPurchaseOrders,
  normalizePoNo,
  sortPoForDisplay,
  todayIsoDate,
  validatePoInput,
  validateReceiptInput,
} from '@/utils/po'
import type { PoExcelRow } from '@/services/poExcel'

export interface PoInput {
  po_no: string
  supplier: string
  item_code: string
  target_qty: number
  created_date: string
}

export interface ReceiptInput {
  receipt_date: string
  qty: number
  note?: string
}

const genId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `po-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// State dùng chung trong session (Supabase là nguồn chính, memory là fallback khi chưa cấu hình)
const purchaseOrders = ref<PurchaseOrder[]>([])
const receiptLogs = ref<PoReceiptLog[]>([])
const loading = ref(false)
const searchText = ref('')
const statusFilter = ref<'all' | 'open' | 'completed'>('all')
const lastSync = ref('--:--')
// false khi Supabase chưa có bảng purchase_orders (admin chưa chạy migration):
// tự rơi về memory để app vẫn chạy, đồng thời báo banner hướng dẫn migration
const backendAvailable = ref(true)

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

/**
 * Ghi/đọc xuống Supabase.
 * - Bảng chưa tạo (PGRST205): tự fallback memory, bật cờ needsMigration, không throw.
 * - Lỗi RLS: throw message hướng dẫn chạy file database/purchase_orders.sql.
 */
const callSupabase = async <T>(fn: () => PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> => {
  if (!isSupabaseConfigured || !backendAvailable.value) return null
  let res: { data: T | null; error: unknown }
  try {
    res = await fn()
  } catch (e) {
    if (isMissingTableError(e)) {
      backendAvailable.value = false
      warnMissingTable()
      return null
    }
    throw e
  }
  if (res.error) {
    if (isMissingTableError(res.error)) {
      backendAvailable.value = false
      warnMissingTable()
      return null
    }
    if (isRlsError(res.error)) {
      throw new Error('Supabase chặn quyền ghi (RLS). Hãy chạy file database/purchase_orders.sql trong Supabase SQL Editor.')
    }
    throw res.error
  }
  return res.data
}

const warnMissingTable = () => {
  console.warn(
    '[PO] Chưa tìm thấy bảng purchase_orders trên Supabase. Hãy chạy file database/purchase_orders.sql. Tạm dùng bộ nhớ máy.',
  )
}

export function usePurchaseOrders() {
  /** true khi cần chạy migration database/purchase_orders.sql trên Supabase. */
  const needsMigration = computed(() => isSupabaseConfigured && !backendAvailable.value)

  /** Nạp toàn bộ PO + log nhập hàng từ Supabase (rỗng 100% nếu DB chưa có gì). */
  const fetchPurchaseOrders = async () => {
    loading.value = true
    try {
      const [poData, logData] = await Promise.all([
        callSupabase<PurchaseOrder[]>(() =>
          supabase.from('purchase_orders').select('*').order('created_date', { ascending: false }),
        ),
        callSupabase<PoReceiptLog[]>(() =>
          supabase.from('po_receipt_logs').select('*').order('receipt_date', { ascending: true }),
        ),
      ])
      if (poData) {
        purchaseOrders.value = poData.map((p) => ({ ...p, target_qty: Number(p.target_qty) || 0 }))
      }
      if (logData) {
        receiptLogs.value = logData.map((l) => ({ ...l, qty: Number(l.qty) || 0 }))
      }
      lastSync.value = new Date().toLocaleTimeString('vi-VN')
    } finally {
      loading.value = false
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
    const po: PurchaseOrder = {
      id: genId(),
      po_no: poNo,
      supplier: String(input.supplier).trim(),
      item_code: String(input.item_code).trim(),
      target_qty: Number(input.target_qty),
      created_date: input.created_date,
      status: 'open',
      closed_at: null,
      created_at: now,
      updated_at: now,
    }

    await callSupabase(() => supabase.from('purchase_orders').insert(po).select())
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
    const received = receiptLogs.value.filter((l) => l.po_id === id).reduce((s, l) => s + (Number(l.qty) || 0), 0)
    const completed = received >= Number(input.target_qty)
    const updated: PurchaseOrder = {
      ...current,
      po_no: poNo,
      supplier: String(input.supplier).trim(),
      item_code: String(input.item_code).trim(),
      target_qty: Number(input.target_qty),
      created_date: input.created_date,
      status: completed ? 'completed' : 'open',
      closed_at: completed ? current.closed_at || new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }

    if (!isMemoryId(id)) {
      await callSupabase(() => supabase.from('purchase_orders').update(updated).eq('id', id).select())
    }
    purchaseOrders.value = purchaseOrders.value.map((p) => (p.id === id ? updated : p))
    return updated
  }

  /** Xóa PO + toàn bộ log nhập hàng đi kèm. */
  const deletePurchaseOrder = async (id: string) => {
    if (!isMemoryId(id)) {
      await callSupabase(() => supabase.from('purchase_orders').delete().eq('id', id).select())
    }
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
      await callSupabase(() => supabase.from('purchase_orders').update(updated).eq('id', poId).select())
    }
    purchaseOrders.value = purchaseOrders.value.map((p) => (p.id === poId ? updated : p))
  }

  /** Nhập hàng vào PO: cộng dồn theo ngày, đạt 100% target thì tự đóng PO. */
  const addReceipt = async (poId: string, input: ReceiptInput): Promise<PoReceiptLog> => {
    const err = validateReceiptInput(input)
    if (err) throw new Error(err)
    const po = purchaseOrders.value.find((p) => p.id === poId)
    if (!po) throw new Error('Không tìm thấy PO để nhập hàng!')
    if (po.status === 'completed') throw new Error(`PO [${po.po_no}] đã giao đủ và đóng, không thể nhập thêm!`)

    const log: PoReceiptLog = {
      id: genId(),
      po_id: poId,
      receipt_date: input.receipt_date,
      qty: Number(input.qty),
      note: String(input.note || '').trim(),
      created_at: new Date().toISOString(),
    }

    if (!isMemoryId(poId)) {
      await callSupabase(() => supabase.from('po_receipt_logs').insert(log).select())
    }
    receiptLogs.value = [...receiptLogs.value, log]

    // Tự động đóng PO khi chạm target
    const received = receiptLogs.value.filter((l) => l.po_id === poId).reduce((s, l) => s + (Number(l.qty) || 0), 0)
    if (received >= Number(po.target_qty)) {
      await markPoCompleted(poId, true)
    }
    return log
  }

  /** Xóa 1 dòng log nhập hàng (PO tự mở lại nếu rớt xuống dưới target). */
  const deleteReceipt = async (logId: string) => {
    const log = receiptLogs.value.find((l) => l.id === logId)
    if (!log) throw new Error('Không tìm thấy dòng log nhập hàng!')
    if (!isMemoryId(logId) && !isMemoryId(log.po_id)) {
      await callSupabase(() => supabase.from('po_receipt_logs').delete().eq('id', logId).select())
    }
    receiptLogs.value = receiptLogs.value.filter((l) => l.id !== logId)

    const po = purchaseOrders.value.find((p) => p.id === log.po_id)
    if (po) {
      const received = receiptLogs.value.filter((l) => l.po_id === po.id).reduce((s, l) => s + (Number(l.qty) || 0), 0)
      if (po.status === 'completed' && received < Number(po.target_qty)) {
        await markPoCompleted(po.id, false)
      }
    }
  }

  /** Import hàng loạt PO từ Excel: trùng số PO thì cập nhật, mới thì thêm. */
  const importPurchaseOrders = async (rows: PoExcelRow[]) => {
    const now = new Date().toISOString()
    const prepared: PurchaseOrder[] = []
    const skipped: string[] = []

    rows.forEach((r) => {
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
        target_qty: Number(r.target_qty),
        created_date: r.created_date || todayIsoDate(),
        status: 'open',
        closed_at: null,
        created_at: now,
        updated_at: now,
      })
    })

    if (isSupabaseConfigured && backendAvailable.value) {
      let useMemoryFallback = false
      for (const po of prepared) {
        const exists = purchaseOrders.value.find((p) => normalizePoNo(p.po_no) === normalizePoNo(po.po_no))
        try {
          if (exists && !isMemoryId(exists.id)) {
            await callSupabase(() =>
              supabase
                .from('purchase_orders')
                .update({
                  supplier: po.supplier,
                  item_code: po.item_code,
                  target_qty: po.target_qty,
                  created_date: po.created_date,
                  updated_at: now,
                })
                .eq('id', exists.id)
                .select(),
            )
          } else if (!exists) {
            await callSupabase(() => supabase.from('purchase_orders').insert(po).select())
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
        return { imported: prepared.length, skipped }
      }
    }

    const merged = [...purchaseOrders.value]
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
        }
      } else {
        merged.unshift(po)
      }
    })
    purchaseOrders.value = merged
    return { imported: prepared.length, skipped }
  }

  /** Xóa sạch toàn bộ PO + log (dùng khi reset hệ thống). */
  const clearAllPurchaseOrders = async () => {
    await callSupabase(() => supabase.from('purchase_orders').delete().neq('po_no', '__never_match_key__').select())
    purchaseOrders.value = []
    receiptLogs.value = []
  }

  /** Nạp dữ liệu demo phục vụ unit test / trải nghiệm thử. */
  const seedDemoData = () => {
    const demoPo: PurchaseOrder = {
      id: 'po-seed-01',
      po_no: 'PO-DEMO-10000',
      supplier: 'NCC DEMO',
      item_code: '8101010104',
      target_qty: 10000,
      created_date: todayIsoDate(),
      status: 'open',
      closed_at: null,
      created_at: new Date().toISOString(),
    }
    purchaseOrders.value = [demoPo]
    receiptLogs.value = [
      {
        id: 'log-seed-01',
        po_id: 'po-seed-01',
        receipt_date: todayIsoDate(),
        qty: 2500,
        note: 'Đợt 1',
        created_at: new Date().toISOString(),
      },
    ]
  }

  const clearMemory = () => {
    purchaseOrders.value = []
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

  return {
    purchaseOrders,
    receiptLogs,
    loading,
    searchText,
    statusFilter,
    lastSync,
    backendAvailable,
    needsMigration,
    ordersWithProgress,
    sortedOrders,
    filteredOrders,
    stats,
    getPoLogs,
    fetchPurchaseOrders,
    createPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
    addReceipt,
    deleteReceipt,
    markPoCompleted,
    importPurchaseOrders,
    clearAllPurchaseOrders,
    seedDemoData,
    clearMemory,
  }
}
