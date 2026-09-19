import type { MetadataPacking } from '@/types'

export interface PackingSpecInput {
  customer: string
  /** Mã hàng full chuẩn mới (VD 8101010104). */
  ma_hang?: string
  /** Feature chuẩn mới (VD 1010). */
  feature?: string
  /** Legacy: chấp nhận như alias cho ma_hang/feature để tương thích test/caller cũ. */
  item_code?: string
  pack_qty: number | string
  weight_per_unit: number | string
  carton_spec: string
  carton_type: string
}

/**
 * Chuẩn hóa Loại thùng về đúng 3 loại: thùng đơn / thùng đôi / phụ kiện.
 * - chứa 'đơn'/'don' -> thùng đơn
 * - chứa 'đôi'/'doi' -> thùng đôi
 * - chứa 'phụ kiện'/'phu kien'/'phukien'/'carton'/'plywood'/'box' -> phụ kiện
 * - còn lại: trim giữ nguyên (cho phép thêm mới, không khóa cứng).
 */
export function normalizeCartonType(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  const norm = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (norm.includes('don')) return 'thùng đơn'
  if (norm.includes('doi')) return 'thùng đôi'
  if (
    norm.includes('phu kien') ||
    norm.includes('phukien') ||
    norm.includes('phu kien') ||
    norm.includes('carton') ||
    norm.includes('plywood') ||
    norm.includes('box')
  ) {
    // 'Phụ kiện ' (thừa space) trong Sample.xlsx cũng về 'phụ kiện'
    return 'phụ kiện'
  }
  return s
}

export function isPhuKienType(cartonType: unknown): boolean {
  return normalizeCartonType(cartonType) === 'phụ kiện'
}

/** Validate 1 dòng quy cách đóng gói (chuẩn 7 cột Sample.xlsx). Trả về message lỗi hoặc null khi hợp lệ. */
export function validatePackingSpec(input: PackingSpecInput): string | null {
  if (!String(input.customer || '').trim()) return 'Vui lòng nhập Khách hàng!'
  const maHang = String((input.ma_hang ?? input.item_code) || '').trim()
  if (!maHang) return 'Vui lòng nhập Mã hàng!'
  const feat = String((input.feature ?? input.item_code) || '').trim()
  if (!feat) return 'Vui lòng nhập Feature!'
  const qty = Number(input.pack_qty)
  if (!Number.isFinite(qty) || qty <= 0) return 'Số lượng đóng gói phải lớn hơn 0!'
  const w = Number(input.weight_per_unit)
  if (input.weight_per_unit !== '' && input.weight_per_unit !== null && (!Number.isFinite(w) || w < 0)) {
    return 'Trọng lượng/Cái phải là số >= 0!'
  }
  return null
}

/** Chuẩn hóa mã hàng full về string (Excel số 8100920004 -> '8100920004', giữ leading zero). */
export function stringifyMaHang(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return ''
    return String(Math.trunc(value))
  }
  return String(value).trim().replace(/\.0+$/, '')
}

/** Chuẩn hóa 1 dòng nhập thành dữ liệu lưu (trim chuỗi, ép số, chuẩn hóa loại thùng). */
export function normalizePackingSpec(input: PackingSpecInput): Omit<MetadataPacking, 'id'> {
  const ma_hang = stringifyMaHang(input.ma_hang ?? input.item_code ?? '')
  const featureRaw = String(input.feature ?? input.item_code ?? ma_hang).trim()
  const feature = featureRaw || ma_hang
  return {
    customer: String(input.customer || '').trim(),
    ma_hang,
    feature,
    // Legacy: giữ item_code = feature để lookup cũ (feature -> spec) không vỡ.
    item_code: feature,
    pack_qty: Number(input.pack_qty) || 0,
    weight_per_unit: Number(input.weight_per_unit) || 0,
    carton_spec: String(input.carton_spec || '').trim(),
    carton_type: normalizeCartonType(input.carton_type),
  }
}

/**
 * Khóa chống trùng tự nhiên (chuẩn mới):
 * Khách hàng + Mã hàng + Feature + Quy cách thùng + Loại thùng.
 * Cho phép cùng Feature 1010 có 2 dòng đơn/đôi khác Quy cách/Loại thùng.
 */
export function packingSpecKey(p: {
  customer: string
  ma_hang?: string
  feature?: string
  item_code?: string
  carton_spec: string
  carton_type?: string
}): string {
  const maHang = String(p.ma_hang ?? p.item_code ?? '').trim().toLowerCase()
  const feat = String(p.feature ?? p.item_code ?? '').trim().toLowerCase()
  return [
    String(p.customer || '').trim().toLowerCase(),
    maHang,
    feat,
    String(p.carton_spec || '').trim().toLowerCase(),
    normalizeCartonType(p.carton_type ?? '').toLowerCase(),
  ].join('|||')
}

/** Lọc bảng quy cách theo từ khóa (khách hàng / mã hàng / feature / quy cách / loại thùng). */
export function filterPackingSpecs(rows: MetadataPacking[], searchText: string): MetadataPacking[] {
  const q = String(searchText || '').toLowerCase().trim()
  if (!q) return rows
  return rows.filter((r) =>
    [r.customer, r.ma_hang, r.feature, r.item_code, r.carton_spec, r.carton_type]
      .join(' ')
      .toLowerCase()
      .includes(q),
  )
}

/** Gợi ý dropdown (không khóa cứng): distinct customers / specs / types từ rows hiện có. */
export function distinctCustomers(rows: MetadataPacking[]): string[] {
  return Array.from(new Set(rows.map((r) => String(r.customer || '').trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'vi'),
  )
}

export function distinctCartonSpecs(rows: MetadataPacking[]): string[] {
  return Array.from(new Set(rows.map((r) => String(r.carton_spec || '').trim()).filter(Boolean))).sort()
}

export function distinctCartonTypes(rows: MetadataPacking[]): string[] {
  const base = Array.from(
    new Set(rows.map((r) => String(r.carton_type || '').trim()).filter(Boolean)),
  )
  // Luôn gợi ý đủ 3 loại chuẩn dù DB chưa có
  for (const t of ['thùng đơn', 'thùng đôi', 'phụ kiện']) {
    if (!base.includes(t)) base.push(t)
  }
  return base.sort((a, b) => a.localeCompare(b, 'vi'))
}
