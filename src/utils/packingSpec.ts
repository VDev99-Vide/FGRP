/**
 * T4: Class module metadata — nguồn duy nhất cho pack_qty / carton_type toàn hệ thống.
 * Khớp theo FEATURE (metadata.item_code == feature đã tách, VD '1009', '1220').
 */
export interface PackSpecSource {
  item_code: string
  pack_qty: number
  carton_type: string
}

export interface PackSpecResolved {
  pack_qty: number
  carton_type: string
  missing: boolean
  /** true khi thùng đơn (không chia 2), false khi thùng đôi (chia 2). */
  isSingle: boolean
}

export function isSingleBoxType(cartonType: string): boolean {
  return /thùng đơn/i.test(String(cartonType || ''))
}

export function isDoubleBoxType(cartonType: string): boolean {
  return /thùng đôi/i.test(String(cartonType || ''))
}

/**
 * Tra cứu 1 feature trong metadata.
 * - Trùng nhiều dòng: lấy dòng đầu + coi như warn (caller log), không bịa trung bình.
 * - Thiếu: { missing:true, pack_qty:0 } để caller bật cảnh báo header, không fallback số bịa.
 */
export function getPackSpecByFeature(
  feature: string,
  specs: PackSpecSource[] | undefined | null,
): PackSpecResolved {
  const feat = String(feature || '').trim()
  if (!feat || !specs || specs.length === 0) {
    return { pack_qty: 0, carton_type: '', missing: true, isSingle: false }
  }
  const hit = specs.find((s) => String(s.item_code || '').trim() === feat)
  if (!hit || !(Number(hit.pack_qty) > 0)) {
    return { pack_qty: 0, carton_type: String(hit?.carton_type || ''), missing: true, isSingle: isSingleBoxType(String(hit?.carton_type || '')) }
  }
  return {
    pack_qty: Number(hit.pack_qty),
    carton_type: String(hit.carton_type || ''),
    missing: false,
    isSingle: isSingleBoxType(String(hit.carton_type || '')),
  }
}

/** Build map tra cứu nhanh feature -> spec. */
export function buildPackSpecMap(specs: PackSpecSource[] | undefined | null): Map<string, PackSpecResolved> {
  const m = new Map<string, PackSpecResolved>()
  if (!specs) return m
  const seen = new Set<string>()
  specs.forEach((s) => {
    const k = String(s.item_code || '').trim()
    if (!k || seen.has(k)) return
    seen.add(k)
    m.set(k, getPackSpecByFeature(k, specs))
  })
  return m
}

/**
 * Công thức chuẩn T4 (đơn vị đều là Kiện):
 * - Phụ kiện: total / pack (không /2) -> Thùng (caller tự gán unit).
 * - Thùng đơn: total / pack (không /2).
 * - Thùng đôi: total / 2 / pack.
 * Round 2 decimals. pack<=0 -> 0 (kèm missing ở tầng trên).
 */
export function calcPkgByPackSpec(totalQty: number, packQty: number, isSingle: boolean): number {
  const total = Number(totalQty) || 0
  const pack = Number(packQty) || 0
  if (pack <= 0 || total <= 0) return 0
  const raw = isSingle ? total / pack : total / 2 / pack
  return Math.round(raw * 100) / 100
}
