import type {
  PoLine,
  PoLineWithProgress,
  PoProgressLevel,
  PoReceiptLog,
  PoStats,
  PurchaseOrder,
  PurchaseOrderWithProgress,
} from '@/types'

// ================= NGƯỠNG MÀU ỐNG DÒNG CHẢY (AUTO 3 NGƯỠNG) =================
// danger  < 50%   : đỏ Coral   #FF5A65 (mới nạp / tiến độ thấp)
// warning 50-99%  : vàng Amber #FDB52A (đang về gần đủ)
// success >= 100% : xanh lá   #14CA74 (đạt target -> tự đóng PO)
export const PO_PROGRESS_THRESHOLDS = {
  dangerMax: 50,
  successMin: 100,
} as const

export const PO_FLOW_COLORS: Record<PoProgressLevel, { solid: string; glow: string; gradient: string }> = {
  danger: {
    solid: '#FF5A65',
    glow: 'rgba(255, 90, 101, 0.55)',
    gradient: 'linear-gradient(90deg, #FF5A65 0%, #FF8A5B 100%)',
  },
  warning: {
    solid: '#FDB52A',
    glow: 'rgba(253, 181, 42, 0.55)',
    gradient: 'linear-gradient(90deg, #FDB52A 0%, #FFE29A 100%)',
  },
  success: {
    solid: '#14CA74',
    glow: 'rgba(20, 202, 116, 0.55)',
    gradient: 'linear-gradient(90deg, #00C2FF 0%, #14CA74 100%)',
  },
}

// ================= GAM MÀU ỐNG LIÊN TỤC: XANH BIỂN NHẠT -> XANH LÁ =================
// % càng cao màu càng chuyển dần từ xanh nước biển nhạt sang xanh lá.
export const PO_FLOW_START_HEX = '#7DD3FC' // xanh nước biển nhạt (0%)
export const PO_FLOW_END_HEX = '#14CA74' // xanh lá (100%)

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

const rgbToHex = (r: number, g: number, b: number): string => {
  const to2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0').toUpperCase()
  return `#${to2(r)}${to2(g)}${to2(b)}`
}

/** Làm sáng (percent > 0) hoặc tối (percent < 0) một màu hex (-100..100). */
export function shadeHex(hex: string, percent: number): string {
  const [r, g, b] = hexToRgb(hex)
  const t = Math.min(100, Math.max(-100, Number(percent) || 0)) / 100
  const target = t < 0 ? 0 : 255
  const p = Math.abs(t)
  return rgbToHex(r + (target - r) * p, g + (target - g) * p, b + (target - b) * p)
}

/** Đổi hex sang rgba với alpha 0..1 (dùng cho lớp sóng phủ). */
export function hexWithAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  const a = Math.min(1, Math.max(0, Number(alpha)))
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`
}

/** Nội suy màu ống theo % (kẹp 0-100): 0% = xanh biển nhạt, 100% = xanh lá. */
export function interpolatePoColor(progressCapped: number): string {
  const t = Math.min(100, Math.max(0, Number(progressCapped) || 0)) / 100
  const [r1, g1, b1] = hexToRgb(PO_FLOW_START_HEX)
  const [r2, g2, b2] = hexToRgb(PO_FLOW_END_HEX)
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

/** Phân loại ngưỡng màu từ % tiến độ thực tế (cho phép > 100 khi nhập vượt). */
export function getPoProgressLevel(progress: number): PoProgressLevel {
  if (progress >= PO_PROGRESS_THRESHOLDS.successMin) return 'success'
  if (progress >= PO_PROGRESS_THRESHOLDS.dangerMax) return 'warning'
  return 'danger'
}

/** % tiến độ = đã nhập / target * 100 (target <= 0 coi như 0%). */
export function calcPoProgress(targetQty: number, receivedQty: number): number {
  const target = Number(targetQty) || 0
  const received = Number(receivedQty) || 0
  if (target <= 0) return 0
  return Math.round((received / target) * 10000) / 100
}

/** Chuẩn hóa số PO để so sánh / chống trùng (trim + uppercase). */
export function normalizePoNo(poNo: string): string {
  return String(poNo || '').trim().toUpperCase()
}

/** Ngày hôm nay dạng yyyy-mm-dd (dùng làm giá trị mặc định, không khóa cứng). */
export function todayIsoDate(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Hiển thị yyyy-mm-dd -> dd/mm/yyyy cho giao diện. */
export function formatIsoDate(iso: string): string {
  if (!iso) return ''
  const m = String(iso).trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return String(iso)
}

/** Kiểm tra chuỗi yyyy-mm-dd hợp lệ. */
export function isValidIsoDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '').trim())) return false
  const d = new Date(`${String(iso).trim()}T00:00:00`)
  return !Number.isNaN(d.getTime())
}

/** Validate dữ liệu tạo / sửa PO. Trả về message lỗi hoặc null khi hợp lệ. */
export interface PoLineInput {
  item_code: string
  description?: string
  target_qty: number | string
}

export const PO_LINES_MAX = 20

/** Tổng target = cộng dồn lines (dùng cho PO N sản phẩm). */
export function sumPoLinesTarget(lines: PoLineInput[] | undefined | null): number {
  if (!lines || lines.length === 0) return 0
  return lines.reduce((s, l) => s + (Number(l.target_qty) || 0), 0)
}

/** Validate danh sách dòng sản phẩm (mỗi dòng cần Mã hàng + Mục tiêu > 0). */
export function validatePoLines(lines: PoLineInput[] | undefined | null): string | null {
  if (!lines || lines.length === 0) return 'Vui lòng thêm ít nhất 1 sản phẩm!'
  if (lines.length > PO_LINES_MAX) return `Tối đa ${PO_LINES_MAX} sản phẩm trong 1 PO!`
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (!String(l.item_code || '').trim()) return `Dòng ${i + 1}: Vui lòng nhập Mã hàng!`
    const t = Number(l.target_qty)
    if (!Number.isFinite(t) || t <= 0) return `Dòng ${i + 1}: Mục tiêu phải là số lớn hơn 0!`
  }
  return null
}

export function validatePoInput(input: {
  po_no: string
  supplier: string
  item_code: string
  target_qty: number | string
  created_date: string
  lines?: PoLineInput[] | null
}): string | null {
  if (!String(input.po_no || '').trim()) return 'Vui lòng nhập Số PO!'
  if (!String(input.supplier || '').trim()) return 'Vui lòng nhập Nhà cung cấp!'
  // T1: nếu có lines thì validate lines, target = sum(lines); nếu không thì validate kiểu cũ 1 dòng
  if (input.lines && input.lines.length > 0) {
    const lineErr = validatePoLines(input.lines)
    if (lineErr) return lineErr
  } else {
    if (!String(input.item_code || '').trim()) return 'Vui lòng nhập Mã hàng!'
    const target = Number(input.target_qty)
    if (!Number.isFinite(target) || target <= 0) return 'Mục tiêu phải là số lớn hơn 0!'
  }
  if (!isValidIsoDate(input.created_date)) return 'Ngày tạo PO không hợp lệ (yyyy-mm-dd)!'
  return null
}

/** Validate 1 lần nhập hàng vào PO. */
export function validateReceiptInput(input: { qty: number | string; receipt_date: string }): string | null {
  const qty = Number(input.qty)
  if (!Number.isFinite(qty) || qty <= 0) return 'Số lượng nhập phải lớn hơn 0!'
  if (!isValidIsoDate(input.receipt_date)) return 'Ngày nhập hàng không hợp lệ (yyyy-mm-dd)!'
  return null
}

/** T2: validate nhập hàng theo từng mã (bắt buộc chọn mã khi PO có nhiều mã). */
export function validateLineReceiptInput(
  input: { qty: number | string; receipt_date: string; po_line_id?: string | null },
  lineCount: number,
): string | null {
  const base = validateReceiptInput(input)
  if (base) return base
  if (lineCount > 1 && !String(input.po_line_id || '').trim()) {
    return 'Vui lòng chọn mã hàng cần nhập!'
  }
  return null
}

/** Log gộp cũ ở cấp PO (chưa gán mã) — giữ tương thích ngược T2. */
export function isLegacyPoLog(log: PoReceiptLog): boolean {
  return !String((log as PoReceiptLog).po_line_id || '').trim()
}

/**
 * Dòng hiệu lực để hiển thị/nhập hàng (T2).
 * - PO có lines thật -> dùng lines.
 * - PO cũ 1 dòng (không có lines) -> suy ra 1 dòng ảo từ purchase_orders.
 */
export function getEffectivePoLines(po: PurchaseOrder): PoLine[] {
  const real = (po.lines || []).filter((l) => l.item_code || Number(l.target_qty) > 0)
  if (real.length > 0) return real
  return [
    {
      id: '',
      po_id: po.id,
      po_no: po.po_no,
      item_code: po.item_code,
      description: po.description || '',
      target_qty: Number(po.target_qty) || 0,
    },
  ]
}

/** Tiến độ của 1 mã hàng: chỉ cộng log gán đúng mã đó. */
export function buildPoLineProgress(line: PoLine, logs: PoReceiptLog[]): PoLineWithProgress {
  const isVirtual = !String(line.id || '').trim()
  const lineLogs = logs.filter((l) => {
    if (l.po_id !== line.po_id) return false
    if (isVirtual) return true // PO 1 mã cũ: toàn bộ log PO đều tính cho mã duy nhất
    return String((l as PoReceiptLog).po_line_id || '') === String(line.id)
  })
  const received_qty = lineLogs.reduce((s, l) => s + (Number(l.qty) || 0), 0)
  const target = Number(line.target_qty) || 0
  const remaining_qty = Math.max(0, target - received_qty)
  const progress = calcPoProgress(target, received_qty)
  const progressCapped = Math.min(100, Math.max(0, progress))
  return {
    ...line,
    received_qty,
    remaining_qty,
    progress,
    progressCapped,
    level: getPoProgressLevel(progress),
    status: progress >= 100 ? 'completed' : 'open',
    receipt_count: lineLogs.length,
  }
}

/**
 * Gộp PO + toàn bộ log nhập hàng thành bản ghi tiến độ.
 * T2: nhập theo từng mã — PO chỉ 'completed' khi TẤT CẢ mã đều đủ.
 * Tương thích ngược: PO chưa có log theo mã nào thì vẫn dùng tổng gộp cũ
 * (tránh bật mở lại PO đã giao đủ trước khi migrate).
 */
export function buildPoProgress(po: PurchaseOrder, logs: PoReceiptLog[]): PurchaseOrderWithProgress {
  const poLogs = logs.filter((l) => l.po_id === po.id)
  const received_qty = poLogs.reduce((s, l) => s + (Number(l.qty) || 0), 0)
  const target = Number(po.target_qty) || 0
  const remaining_qty = Math.max(0, target - received_qty)
  const progress = calcPoProgress(target, received_qty)
  const progressCapped = Math.min(100, Math.max(0, progress))
  const level = getPoProgressLevel(progress)

  const effectiveLines = getEffectivePoLines(po)
  const linesProgress = effectiveLines.map((line) => buildPoLineProgress(line, poLogs))
  const legacyLogs = poLogs.filter(isLegacyPoLog)
  const legacy_received_qty = legacyLogs.reduce((s, l) => s + (Number(l.qty) || 0), 0)
  const hasLineLogs = poLogs.some((l) => !isLegacyPoLog(l))
  const hasRealLines = (po.lines || []).filter((l) => l.item_code || Number(l.target_qty) > 0).length > 0

  // PO nhiều mã + đã có log theo mã -> đóng chỉ khi mọi mã đủ; ngược lại giữ logic tổng gộp cũ.
  const status: PurchaseOrderWithProgress['status'] =
    hasRealLines && hasLineLogs
      ? linesProgress.length > 0 && linesProgress.every((l) => l.status === 'completed')
        ? 'completed'
        : 'open'
      : progress >= 100
        ? 'completed'
        : 'open'

  return {
    ...po,
    status,
    received_qty,
    remaining_qty,
    progress,
    progressCapped,
    level,
    receipt_count: poLogs.length,
    linesProgress,
    legacy_received_qty,
    legacy_receipt_count: legacyLogs.length,
  }
}

/** Thống kê KPI tổng hợp cho thẻ hiển thị. */
export function computePoStats(orders: PurchaseOrderWithProgress[]): PoStats {
  const totalOrders = orders.length
  const completedCount = orders.filter((o) => o.status === 'completed').length
  const openCount = totalOrders - completedCount
  const totalTarget = orders.reduce((s, o) => s + (Number(o.target_qty) || 0), 0)
  const totalReceived = orders.reduce((s, o) => s + (Number(o.received_qty) || 0), 0)
  const overallPercent = calcPoProgress(totalTarget, totalReceived)

  return { totalOrders, openCount, completedCount, totalTarget, totalReceived, overallPercent }
}

/** Sắp xếp hiển thị: PO đang mở (tiến độ cao trước) lên trên, PO đã xong xuống dưới. */
export function sortPoForDisplay(orders: PurchaseOrderWithProgress[]): PurchaseOrderWithProgress[] {
  return [...orders].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1
    if (b.progress !== a.progress) return b.progress - a.progress
    return String(b.created_date || '').localeCompare(String(a.created_date || ''))
  })
}

/** Lọc PO theo từ khóa (số PO / NCC / mã hàng) + trạng thái. */
export function filterPurchaseOrders(
  orders: PurchaseOrderWithProgress[],
  searchText: string,
  status: 'all' | 'open' | 'completed',
): PurchaseOrderWithProgress[] {
  const q = String(searchText || '').toLowerCase().trim()
  return orders.filter((o) => {
    if (status !== 'all' && o.status !== status) return false
    if (!q) return true
    // T1: tìm cả trong lines (PO N sản phẩm)
    const lineCodes = (o.lines || []).map((l) => `${l.item_code} ${l.description || ''}`).join(' ')
    return [o.po_no, o.supplier, o.item_code, o.description || '', lineCodes].join(' ').toLowerCase().includes(q)
  })
}
