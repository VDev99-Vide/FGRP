/**
 * T4 + mở rộng: class module metadata — nguồn duy nhất cho pack_qty / carton_type toàn hệ thống.
 * Chuẩn mới 7 cột Sample.xlsx: tra cứu ưu tiên theo Mã hàng full (ma_hang),
 * fallback theo Feature. Hỗ trợ 1010 có 2 loại thùng (đơn/đôi).
 */
export interface PackSpecSource {
  /** Legacy (= feature) — giữ để tương thích. */
  item_code: string
  /** Mã hàng full chuẩn mới (optional). */
  ma_hang?: string
  /** Feature chuẩn mới (optional). */
  feature?: string
  pack_qty: number
  carton_type: string
  carton_spec?: string
}

export interface PackSpecResolved {
  pack_qty: number
  carton_type: string
  carton_spec?: string
  missing: boolean
  /** true khi thùng đơn (không chia 2), false khi thùng đôi (chia 2). */
  isSingle: boolean
  /** Feature đã resolve (từ ma_hang hoặc trực tiếp). */
  feature?: string
  /** true khi mã 1010 tính theo thùng đôi cần gắn 'ước tính'. */
  isEstimated?: boolean
}

export const CODE_1010_LIST = ['8101010104', '8101020104']

export function isCode1010(code: string): boolean {
  return CODE_1010_LIST.includes(String(code || '').trim())
}

export function isSingleBoxType(cartonType: string): boolean {
  // normalize nhanh: chứa 'đơn'/'don' (không dấu) -> đơn
  const n = String(cartonType || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (n.includes('don')) return true
  return /thùng đơn/i.test(String(cartonType || ''))
}

export function isDoubleBoxType(cartonType: string): boolean {
  const n = String(cartonType || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (n.includes('doi')) return true
  return /thùng đôi/i.test(String(cartonType || ''))
}

export function isPhuKienBoxType(cartonType: string): boolean {
  const n = String(cartonType || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return n.includes('phu kien') || n.includes('phukien') || n.includes('carton') || n.includes('plywood') || n.includes('box')
}

/** Lấy feature chuẩn của 1 mã hàng từ metadata (ưu tiên ma_hang exact). Fallback '' để caller dùng MID cũ + warn. */
export function getFeatureByMaHang(
  itemCode: string,
  specs: PackSpecSource[] | undefined | null,
): string {
  const code = String(itemCode || '').trim()
  if (!code || !specs || specs.length === 0) return ''
  const hit = specs.find(
    (s) => String(s.ma_hang || '').trim() === code,
  )
  if (hit) {
    const f = String(hit.feature || hit.item_code || '').trim()
    if (f) return f
  }
  return ''
}

/**
 * Tra cứu 1 feature trong metadata (chuẩn cũ: theo feature).
 * - Trùng nhiều dòng (VD 1010 có đơn+đôi): ưu tiên theo preferredType ('thùng đơn'/'thùng đôi') nếu truyền,
 *   mặc định lấy thùng đôi (kèm isEstimated=true cho 1010).
 * - Thiếu: { missing:true, pack_qty:0 } để caller bật cảnh báo header, không fallback số bịa.
 */
export function getPackSpecByFeature(
  feature: string,
  specs: PackSpecSource[] | undefined | null,
  preferredType?: string,
): PackSpecResolved {
  const feat = String(feature || '').trim()
  if (!feat || !specs || specs.length === 0) {
    return { pack_qty: 0, carton_type: '', missing: true, isSingle: false }
  }
  const hits = specs.filter((s) => {
    const f = String(s.feature || s.item_code || '').trim()
    return f === feat
  })
  if (hits.length === 0) {
    return { pack_qty: 0, carton_type: '', missing: true, isSingle: false, feature: feat }
  }
  let hit = hits[0]
  if (hits.length > 1 && preferredType) {
    const pref = String(preferredType).toLowerCase()
    const wantSingle = pref.includes('đơn') || pref.includes('don')
    const wantDouble = pref.includes('đôi') || pref.includes('doi')
    const found = hits.find((h) => {
      const single = isSingleBoxType(String(h.carton_type || ''))
      if (wantSingle && single) return true
      if (wantDouble && !single) return true
      return false
    })
    if (found) hit = found
  } else if (hits.length > 1 && feat === '1010') {
    // Mặc định 1010 -> thùng đôi (nếu có) + ước tính
    const dbl = hits.find((h) => !isSingleBoxType(String(h.carton_type || '')))
    if (dbl) hit = dbl
  }
  if (!hit || !(Number(hit.pack_qty) > 0)) {
    return {
      pack_qty: 0,
      carton_type: String(hit?.carton_type || ''),
      carton_spec: String((hit as { carton_spec?: string })?.carton_spec || ''),
      missing: true,
      isSingle: isSingleBoxType(String(hit?.carton_type || '')),
      feature: feat,
    }
  }
  const single = isSingleBoxType(String(hit.carton_type || ''))
  const estimated = feat === '1010' && !single
  return {
    pack_qty: Number(hit.pack_qty),
    carton_type: String(hit.carton_type || ''),
    carton_spec: String((hit as { carton_spec?: string })?.carton_spec || ''),
    missing: false,
    isSingle: single,
    feature: feat,
    isEstimated: estimated,
  }
}

/**
 * Tra cứu theo Mã hàng full (chuẩn mới, ưu tiên):
 * - Tìm rows có ma_hang == itemCode. Nếu nhiều (1010 2 dòng), lọc theo preferredType, mặc định đôi + ước tính.
 * - Không thấy -> fallback tra theo feature (caller truyền feature đã resolve hoặc tự tách MID) + missing=true nếu vẫn thiếu.
 */
export function getPackSpecByMaHang(
  itemCode: string,
  specs: PackSpecSource[] | undefined | null,
  preferredType?: string,
  fallbackFeature?: string,
): PackSpecResolved {
  const code = String(itemCode || '').trim()
  if (!specs || specs.length === 0) {
    return { pack_qty: 0, carton_type: '', missing: true, isSingle: false }
  }
  if (code) {
    const hits = specs.filter((s) => String(s.ma_hang || '').trim() === code)
    if (hits.length > 0) {
      let hit = hits[0]
      if (hits.length > 1 && preferredType) {
        const pref = String(preferredType).toLowerCase()
        const wantSingle = pref.includes('đơn') || pref.includes('don')
        const wantDouble = pref.includes('đôi') || pref.includes('doi')
        const found = hits.find((h) => {
          const single = isSingleBoxType(String(h.carton_type || ''))
          if (wantSingle && single) return true
          if (wantDouble && !single) return true
          return false
        })
        if (found) hit = found
      } else if (hits.length > 1 && isCode1010(code)) {
        const dbl = hits.find((h) => !isSingleBoxType(String(h.carton_type || '')))
        if (dbl) hit = dbl
      }
      if (hit && Number(hit.pack_qty) > 0) {
        const single = isSingleBoxType(String(hit.carton_type || ''))
        return {
          pack_qty: Number(hit.pack_qty),
          carton_type: String(hit.carton_type || ''),
          carton_spec: String((hit as { carton_spec?: string })?.carton_spec || ''),
          missing: false,
          isSingle: single,
          feature: String(hit.feature || hit.item_code || fallbackFeature || '').trim() || fallbackFeature,
          isEstimated: isCode1010(code) && !single,
        }
      }
    }
  }
  // Fallback theo feature
  if (fallbackFeature) return getPackSpecByFeature(fallbackFeature, specs, preferredType)
  return { pack_qty: 0, carton_type: '', missing: true, isSingle: false }
}

/** Build map tra cứu nhanh feature -> spec (giữ tương thích; 1010 trùng -> giữ dòng đôi đầu). */
export function buildPackSpecMap(specs: PackSpecSource[] | undefined | null): Map<string, PackSpecResolved> {
  const m = new Map<string, PackSpecResolved>()
  if (!specs) return m
  const seen = new Set<string>()
  specs.forEach((s) => {
    const k = String(s.feature || s.item_code || '').trim()
    if (!k || seen.has(k)) return
    seen.add(k)
    m.set(k, getPackSpecByFeature(k, specs))
  })
  return m
}

/**
 * Công thức chuẩn (đơn vị đều là Kiện):
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
