/**
 * T5: Bộ lọc gợi ý phụ kiện từ metadata.
 * Metadata item_code có 3 loại:
 *  (1) mã đã tách 4 số (VD '1009') -> LOẠI
 *  (2) mã bắt đầu bằng '8' (VD '8101010104') -> LOẠI
 *  (3) mã phụ kiện còn lại (VD '7157150001') -> GIỮ
 * Gộp với uniqueCodes phụ kiện đã có, dedupe, ưu tiên metadata.
 */

export function isExcludedAccessoryCode(code: string): boolean {
  const c = String(code || '').trim()
  if (!c) return true
  if (/^\d{4}$/.test(c)) return true // loại (1)
  if (c.startsWith('8')) return true // loại (2)
  return false
}

export function filterAccessorySuggestCodes(metadataCodes: string[] | undefined | null): string[] {
  if (!metadataCodes) return []
  const seen = new Set<string>()
  const out: string[] = []
  metadataCodes.forEach((raw) => {
    const c = String(raw || '').trim()
    if (!c || seen.has(c)) return
    if (isExcludedAccessoryCode(c)) return
    seen.add(c)
    out.push(c)
  })
  return out.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
}

/** Gộp metadata (đã lọc) + codes phụ kiện hiện có. */
export function mergeAccessorySuggestCodes(metadataCodes: string[] | undefined | null, existingCodes: string[] | undefined | null): string[] {
  const filtered = filterAccessorySuggestCodes(metadataCodes)
  const seen = new Set(filtered)
  ;(existingCodes || []).forEach((raw) => {
    const c = String(raw || '').trim()
    if (!c || seen.has(c)) return
    seen.add(c)
    filtered.push(c)
  })
  return filtered.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
}
