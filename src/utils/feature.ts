/**
 * Module trung tâm tách FEATURE.
 * Chuẩn mới: ưu tiên tham chiếu trực tiếp metadata (ma_hang -> feature) để scale
 * khi nhiều dữ liệu tách theo quy tắc khác nhau.
 * Fallback MID(2,4) chỉ dùng khi metadata thiếu (kèm tag 'Thiếu Meta-data' ở tầng trên).
 * - Mã 1220 (1220190004, 1220200004): hard-code lấy 4 số đầu '1220' TRƯỚC mọi MID (fallback).
 * - Phụ kiện: giữ nguyên mã (không tách).
 * - Còn lại: MID(2,4) = bỏ ký tự đầu, lấy 4 ký tự tiếp (JS substring(1,5)) — fallback.
 */

export interface FeatureMetaSource {
  ma_hang?: string
  feature?: string
  item_code?: string
}

export function isSpecialStockCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false
  const clean = code.trim()
  return clean.startsWith('1220') || (clean.length >= 5 && clean.substring(1, 5) === '1220')
}

export function extractFeatureFromItemCode(itemCode: string, isAccessory: boolean = false): string {
  if (!itemCode || typeof itemCode !== 'string') return 'No data'
  const clean = itemCode.trim()
  if (isAccessory) {
    return clean || 'Accessories'
  }
  // Hard-code 1220 trước MID — áp dụng cho fallback khi thiếu metadata
  if (clean.startsWith('1220')) {
    return '1220'
  }
  if (clean.length >= 5) {
    return clean.substring(1, 5)
  }
  return clean || 'No data'
}

/**
 * Resolve feature ưu tiên metadata (chuẩn mới, scale được):
 * - Tìm row có ma_hang == itemCode -> trả feature của row đó.
 * - Không thấy -> fallback extractFeatureFromItemCode (MID) để vẫn group được,
 *   caller tự gắn missing=true / tag 'Thiếu Meta-data'.
 */
export function resolveFeatureFromMetadata(
  itemCode: string,
  specs: FeatureMetaSource[] | undefined | null,
  isAccessory: boolean = false,
): { feature: string; fromMetadata: boolean } {
  const clean = String(itemCode || '').trim()
  if (!clean) return { feature: 'No data', fromMetadata: false }
  if (specs && specs.length > 0) {
    const hit = specs.find((s) => String(s.ma_hang || '').trim() === clean)
    if (hit) {
      const f = String(hit.feature || (hit as { item_code?: string }).item_code || '').trim()
      if (f) return { feature: f, fromMetadata: true }
    }
    // Phụ kiện trong metadata có feature == full code: cũng match ma_hang ở trên.
    // Nếu isAccessory mà metadata có row feature==code (dạng cũ), vẫn ưu tiên.
    if (isAccessory) {
      const hitFeat = specs.find((s) => String(s.feature || (s as { item_code?: string }).item_code || '').trim() === clean)
      if (hitFeat) return { feature: clean, fromMetadata: true }
    }
  }
  return { feature: extractFeatureFromItemCode(clean, isAccessory), fromMetadata: false }
}

/** Alias cho module tồn kho (STOCK CODE = ITEM CODE, cùng quy tắc). */
export function extractFeatureFromStockCode(stockCode: string): string {
  if (!stockCode || stockCode.trim() === '' || stockCode === 'No data') return 'No data'
  return extractFeatureFromItemCode(stockCode.trim(), false)
}
