import type { MetadataPacking } from '@/types'

export interface PackingSpecInput {
  customer: string
  item_code: string
  pack_qty: number | string
  weight_per_unit: number | string
  carton_spec: string
  carton_type: string
}

/** Validate 1 dòng quy cách đóng gói. Trả về message lỗi hoặc null khi hợp lệ. */
export function validatePackingSpec(input: PackingSpecInput): string | null {
  if (!String(input.customer || '').trim()) return 'Vui lòng nhập Khách hàng!'
  if (!String(input.item_code || '').trim()) return 'Vui lòng nhập Mã hàng!'
  const qty = Number(input.pack_qty)
  if (!Number.isFinite(qty) || qty <= 0) return 'Số lượng đóng gói phải lớn hơn 0!'
  const w = Number(input.weight_per_unit)
  if (input.weight_per_unit !== '' && input.weight_per_unit !== null && (!Number.isFinite(w) || w < 0)) {
    return 'Trọng lượng/Cái phải là số >= 0!'
  }
  return null
}

/** Chuẩn hóa 1 dòng nhập thành dữ liệu lưu (trim chuỗi, ép số). */
export function normalizePackingSpec(input: PackingSpecInput): Omit<MetadataPacking, 'id'> {
  return {
    customer: String(input.customer || '').trim(),
    item_code: String(input.item_code || '').trim(),
    pack_qty: Number(input.pack_qty) || 0,
    weight_per_unit: Number(input.weight_per_unit) || 0,
    carton_spec: String(input.carton_spec || '').trim(),
    carton_type: String(input.carton_type || '').trim(),
  }
}

/** Khóa chống trùng tự nhiên: Khách hàng + Mã hàng + Quy cách thùng. */
export function packingSpecKey(p: { customer: string; item_code: string; carton_spec: string }): string {
  return [p.customer, p.item_code, p.carton_spec].map((s) => String(s || '').trim().toLowerCase()).join('|||')
}

/** Lọc bảng quy cách theo từ khóa (khách hàng / mã hàng / quy cách / loại thùng). */
export function filterPackingSpecs(rows: MetadataPacking[], searchText: string): MetadataPacking[] {
  const q = String(searchText || '').toLowerCase().trim()
  if (!q) return rows
  return rows.filter((r) =>
    [r.customer, r.item_code, r.carton_spec, r.carton_type].join(' ').toLowerCase().includes(q),
  )
}
