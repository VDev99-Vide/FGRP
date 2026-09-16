/**
 * T3: Module trung tâm tách FEATURE — nguồn duy nhất toàn hệ thống.
 * - Mã 1220 (1220190004, 1220200004): hard-code lấy 4 số đầu '1220' TRƯỚC mọi MID.
 * - Phụ kiện: giữ nguyên mã (không tách).
 * - Còn lại: MID(2,4) = bỏ ký tự đầu, lấy 4 ký tự tiếp (JS substring(1,5)).
 */
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
  // Hard-code 1220 trước MID — áp dụng toàn hệ thống
  if (clean.startsWith('1220')) {
    return '1220'
  }
  if (clean.length >= 5) {
    return clean.substring(1, 5)
  }
  return clean || 'No data'
}

/** Alias cho module tồn kho (STOCK CODE = ITEM CODE, cùng quy tắc). */
export function extractFeatureFromStockCode(stockCode: string): string {
  if (!stockCode || stockCode.trim() === '' || stockCode === 'No data') return 'No data'
  return extractFeatureFromItemCode(stockCode.trim(), false)
}
