import type { InventoryRow } from '@/types'

/**
 * Chuyển đổi chuỗi ngày tháng (DD/MM/YYYY, YYYY-MM-DD, ISO string, etc.) sang timestamp
 * Giúp so sánh chính xác theo trình tự thời gian tăng dần A-Z
 */
export function parseDateToTimestamp(dateStr?: string | null): number {
  if (!dateStr) return Infinity
  const str = String(dateStr).trim()
  if (!str || str === 'No data' || str === '—' || str === '-') return Infinity

  // 1. Kiểm tra định dạng DD/MM/YYYY hoặc DD-MM-YYYY (kèm giờ phút giây nếu có)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/)
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10)
    const month = parseInt(dmyMatch[2], 10) - 1
    const year = parseInt(dmyMatch[3], 10)
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0
    const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0
    const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0
    const d = new Date(year, month, day, hour, min, sec)
    if (!isNaN(d.getTime())) return d.getTime()
  }

  // 2. Kiểm tra định dạng YYYY-MM-DD hoặc YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
  if (ymdMatch) {
    const d = new Date(str)
    if (!isNaN(d.getTime())) return d.getTime()
  }

  // 3. Fallback parse chuẩn Date
  const parsed = Date.parse(str)
  if (!isNaN(parsed)) return parsed

  return Infinity
}

/**
 * So sánh NGÀY TẠO (CREATE) A-Z (tăng dần theo thời gian/chuỗi)
 */
export function compareCreateDate(dateA?: string | null, dateB?: string | null): number {
  const strA = (dateA || '').trim()
  const strB = (dateB || '').trim()

  const isInvalidA = !strA || strA === 'No data' || strA === '—' || strA === '-'
  const isInvalidB = !strB || strB === 'No data' || strB === '—' || strB === '-'

  if (isInvalidA && isInvalidB) return 0
  if (isInvalidA) return 1
  if (isInvalidB) return -1

  const timeA = parseDateToTimestamp(strA)
  const timeB = parseDateToTimestamp(strB)

  if (timeA !== Infinity && timeB !== Infinity) {
    if (timeA !== timeB) return timeA - timeB
  } else if (timeA !== Infinity) {
    return -1
  } else if (timeB !== Infinity) {
    return 1
  }

  return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' })
}

/**
 * So sánh VỊ TRÍ (BIN) A-Z
 */
export function compareBin(binA?: string | null, binB?: string | null): number {
  const strA = (binA || '').trim()
  const strB = (binB || '').trim()

  const isInvalidA = !strA || strA === 'No data' || strA === 'N/A' || strA === '—' || strA === '-'
  const isInvalidB = !strB || strB === 'No data' || strB === 'N/A' || strB === '—' || strB === '-'

  if (isInvalidA && isInvalidB) return 0
  if (isInvalidA) return 1
  if (isInvalidB) return -1

  return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' })
}

/**
 * Sắp xếp các dòng tồn kho trong cùng 1 nhóm:
 * 1. NGÀY TẠO (CREATE) A-Z
 * 2. VỊ TRÍ (BIN) A-Z
 * 3. TAG ID A-Z (đảm bảo tính ổn định)
 */
export function sortInventoryRows(rows: InventoryRow[]): InventoryRow[] {
  return [...rows].sort((a, b) => {
    // 1. NGÀY TẠO (CREATE) A-Z
    const dateDiff = compareCreateDate(a.create_date, b.create_date)
    if (dateDiff !== 0) return dateDiff

    // 2. VỊ TRÍ (BIN) A-Z
    const binDiff = compareBin(a.bin, b.bin)
    if (binDiff !== 0) return binDiff

    // 3. TAG ID A-Z
    return (a.tag_id || '').localeCompare(b.tag_id || '', undefined, { numeric: true, sensitivity: 'base' })
  })
}

/**
 * Sắp xếp toàn bộ dữ liệu tồn kho:
 * 1. FEATURE A-Z (nhóm No data ở cuối)
 * 2. NGÀY TẠO (CREATE) A-Z
 * 3. VỊ TRÍ (BIN) A-Z
 * 4. TAG ID A-Z
 */
export function sortInventoryAll(inventory: InventoryRow[]): InventoryRow[] {
  return [...inventory].sort((a, b) => {
    // 1. FEATURE A-Z
    const featA = (a.feature || '').trim()
    const featB = (b.feature || '').trim()
    const isNoFeatA = !featA || featA === 'No data'
    const isNoFeatB = !featB || featB === 'No data'

    if (isNoFeatA && !isNoFeatB) return 1
    if (!isNoFeatA && isNoFeatB) return -1
    if (!isNoFeatA && !isNoFeatB) {
      const featDiff = featA.localeCompare(featB, undefined, { numeric: true, sensitivity: 'base' })
      if (featDiff !== 0) return featDiff
    }

    // 2. NGÀY TẠO (CREATE) A-Z
    const dateDiff = compareCreateDate(a.create_date, b.create_date)
    if (dateDiff !== 0) return dateDiff

    // 3. VỊ TRÍ (BIN) A-Z
    const binDiff = compareBin(a.bin, b.bin)
    if (binDiff !== 0) return binDiff

    // 4. TAG ID A-Z
    return (a.tag_id || '').localeCompare(b.tag_id || '', undefined, { numeric: true, sensitivity: 'base' })
  })
}
