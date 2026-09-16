/**
 * Utility functions for Planned Shipment List (Danh sách xuất hàng dự kiến)
 * T3: tách Feature centralize tại @/utils/feature (không định nghĩa lại ở đây).
 */

export { extractFeatureFromItemCode, isSpecialStockCode } from './feature'
import { extractFeatureFromItemCode, isSpecialStockCode } from './feature'

export interface ForecastRawItem {
  id?: string
  po: string
  so: string
  container_no?: string
  item_code: string
  feature?: string
  loading_date: string // dd/mm/yyyy or ISO
  qty: number
  pcs_per_pkg: number
  pkg?: number
  is_accessory?: boolean
  is_special?: boolean
  is_box?: boolean
  unit_type?: 'kien' | 'thung'
  status?: 'pending' | 'ready'
  status_changed_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface ForecastFeatureGroup {
  feature: string
  items: ForecastRawItem[]
  totalQty: number
  pcs_per_pkg: number
  pkgCount: number
  is_accessory: boolean
  is_special: boolean
  is_box?: boolean
  unit_type: 'kien' | 'thung'
  /** T4: cờ thiếu metadata + pack chuẩn đang dùng (để cảnh báo header). */
  missingSpec?: boolean
  packQtyUsed?: number
  cartonTypeUsed?: string
}

export interface ForecastContainerGroup {
  containerKey: string // "PO - SO"
  po: string
  so: string
  container_no: string
  loading_date: string // display dd/mm/yyyy
  loadingDateObj: Date | null
  status: 'pending' | 'ready'
  status_changed_at?: string | null
  isExpired: boolean
  remainingHours?: number
  totalQty: number
  totalPkg: number // Tổng số kiện thành phẩm
  totalBoxes: number // Tổng số thùng phụ kiện
  summaryPkgLabel: string // "X Kiện + Y Thùng" hoặc "X Kiện"
  hasAccessories: boolean
  featureGroups: ForecastFeatureGroup[]
  allItems: ForecastRawItem[]
}

/* T3: isSpecialStockCode + extractFeatureFromItemCode đã re-export từ ./feature ở đầu file. */

/**
 * Parse chuỗi ngày tháng đa định dạng (dd/mm/yyyy, yyyy-mm-dd, Excel date serial number)
 */
export function parseLoadingDate(dateInput: any): Date | null {
  if (!dateInput) return null

  // Nếu là Date object hợp lệ
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    return dateInput
  }

  // Nếu là số serial của Excel (ví dụ 45549, 46279)
  if (typeof dateInput === 'number' && !isNaN(dateInput)) {
    // Excel base date: 1899-12-30 (due to Excel leap year bug in 1900)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const jsDate = new Date(excelEpoch.getTime() + dateInput * 86400000)
    return isNaN(jsDate.getTime()) ? null : jsDate
  }

  const str = String(dateInput).trim()
  if (!str) return null

  // Định dạng dd/mm/yyyy hoặc dd-mm-yyyy
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10)
    const month = parseInt(dmyMatch[2], 10) - 1
    const year = parseInt(dmyMatch[3], 10)
    const d = new Date(year, month, day)
    return isNaN(d.getTime()) ? null : d
  }

  // Định dạng yyyy-mm-dd hoặc yyyy/mm/dd
  const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10)
    const month = parseInt(ymdMatch[2], 10) - 1
    const day = parseInt(ymdMatch[3], 10)
    const d = new Date(year, month, day)
    return isNaN(d.getTime()) ? null : d
  }

  // Fallback chuẩn ISO Date
  const parsed = new Date(str)
  return isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Định dạng ngày sang dd/mm/yyyy
 */
export function formatLoadingDate(dateInput: any): string {
  const d = parseLoadingDate(dateInput)
  if (!d) return typeof dateInput === 'string' && dateInput.trim() ? dateInput : '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Tính số kiện (#pkg) — T4 chuẩn metadata (class module chính):
 * - Phụ kiện: total / pack (không /2).
 * - Thùng đơn (metadata carton_type chứa 'thùng đơn'): total / pack (không /2), đơn vị Kiện.
 * - Thùng đôi (mặc định): total / 2 / pack, đơn vị Kiện.
 * - packSpec là nguồn duy nhất khi được truyền; không có -> fallback logic cũ (max pcs_per_pkg)
 *   để tương thích test/caller chưa wiring metadata.
 */
export function calculateFeaturePkg(
  items: { qty: number; pcs_per_pkg: number; is_accessory?: boolean; is_box?: boolean }[],
  isAccessoryGroup: boolean = false,
  isBoxGroup: boolean = false,
  packSpec?: { pack_qty: number; carton_type: string; isSingle?: boolean } | null,
): number {
  if (!items || items.length === 0) return 0

  const totalQty = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0)
  const pcsPerPkg = items.reduce((max, item) => {
    const val = Number(item.pcs_per_pkg) || 0
    return val > max ? val : max
  }, 0)

  // T4: có pack chuẩn metadata -> dùng đúng công thức đơn/đôi
  if (packSpec && Number(packSpec.pack_qty) > 0) {
    const pack = Number(packSpec.pack_qty)
    if (isAccessoryGroup) {
      return Math.round((totalQty / pack) * 100) / 100
    }
    const single = packSpec.isSingle ?? /thùng đơn/i.test(String(packSpec.carton_type || ''))
    if (single) {
      return Math.round((totalQty / pack) * 100) / 100
    }
    return Math.round((totalQty / 2 / pack) * 100) / 100
  }

  if (pcsPerPkg <= 0) return 0

  // Fallback cũ (khi chưa có metadata): giữ để không vỡ caller/test cũ
  // 1. Phụ kiện: số thùng = Qty / (Pcs/pkg)
  if (isAccessoryGroup) {
    return Math.round((totalQty / pcsPerPkg) * 100) / 100
  }

  // 2. Nhóm đánh dấu Box (áp dụng cho mã đặc biệt 1220 hoặc mã có feature ghi 'Box'):
  if (isBoxGroup || items.some(it => it.is_box)) {
    const totalBoxPkg = items.reduce((sum, it) => {
      const itPcs = Number(it.pcs_per_pkg) || pcsPerPkg
      return sum + (itPcs > 0 ? (Number(it.qty) || 0) / itPcs : 0)
    }, 0)
    return Math.round(totalBoxPkg * 100) / 100
  }

  // 3. Thành phẩm thông thường:
  if (items.length >= 2) {
    return Math.round(((totalQty / 2) / pcsPerPkg) * 100) / 100
  } else {
    return Math.round((totalQty / pcsPerPkg) * 100) / 100
  }
}

/**
 * Kiểm tra xem đơn hàng container đã chuẩn bị xong quá 3 ngày (72 giờ) chưa để tự động xóa — T2
 */
export function isContainerExpired(status?: string, statusChangedAt?: string | null, expireHours: number = 72): boolean {
  if (status !== 'ready' || !statusChangedAt) return false
  const changedDate = new Date(statusChangedAt)
  if (isNaN(changedDate.getTime())) return false

  const elapsedMs = Date.now() - changedDate.getTime()
  return elapsedMs >= expireHours * 60 * 60 * 1000
}

/**
 * Tính số giờ còn lại trước khi đơn hàng trạng thái 'ready' bị tự động xóa sau 3 ngày (72h) — T2
 */
export function getRemainingHoursBeforeDelete(statusChangedAt?: string | null, expireHours: number = 72): number {
  if (!statusChangedAt) return expireHours
  const changedDate = new Date(statusChangedAt)
  if (isNaN(changedDate.getTime())) return expireHours

  const elapsedMs = Date.now() - changedDate.getTime()
  const remainingMs = (expireHours * 60 * 60 * 1000) - elapsedMs
  const remainingHours = Math.max(0, Math.ceil(remainingMs / (60 * 60 * 1000)))
  return remainingHours
}

/**
 * Lọc bỏ các dòng đã hết hạn (> 72 giờ / 3 ngày sau khi chuyển trạng thái Chuẩn bị xong) — T2
 */
export function filterOutExpiredItems(items: ForecastRawItem[]): ForecastRawItem[] {
  return items.filter(item => !isContainerExpired(item.status, item.status_changed_at))
}

/**
 * Phân nhóm và sắp xếp dữ liệu xuất hàng dự kiến:
 * - Nhóm cấp 1: Container / Đơn hàng theo PO và SO
 * - Sắp xếp theo Loading Date từ nhỏ tới lớn (earliest date first)
 * - Nhóm cấp 2: Trong mỗi Container, gom nhóm theo Feature:
 *   + Hàng Accessories: giữ nguyên mã hàng, tính ra số THÙNG (không / 2)
 *   + Hàng đặc biệt (1220): lấy 4 số đầu "1220", tính số KIỆN theo quy tắc cặp
 *   + Hàng thông thường: tách MID(2, 4), tính số KIỆN theo quy tắc cặp
 * - Tính tổng số kiện FG và tổng số thùng phụ kiện cho từng Container
 */
export function groupAndSortForecastData(
  items: ForecastRawItem[],
  packSpecsByFeature?: Map<string, { pack_qty: number; carton_type: string; isSingle?: boolean; missing?: boolean }> | Record<string, { pack_qty: number; carton_type: string; isSingle?: boolean; missing?: boolean }>,
): ForecastContainerGroup[] {
  // Loại bỏ các dòng đã hết hạn
  const validItems = filterOutExpiredItems(items)

  // Nhóm cấp 1 theo PO và SO
  const containerMap = new Map<string, ForecastRawItem[]>()

  validItems.forEach(item => {
    const po = (item.po || 'UNKNOWN_PO').trim()
    const so = (item.so || 'UNKNOWN_SO').trim()
    const containerKey = `${po}___${so}`

    const isAcc = Boolean(item.is_accessory)
    const isSpec = isSpecialStockCode(item.item_code) || Boolean(item.is_special) || (typeof item.feature === 'string' && item.feature.includes('1220'))
    const isBox = Boolean(item.is_box) || (typeof item.feature === 'string' && item.feature.toLowerCase().includes('box'))

    // Nếu item.feature là 'Box' hoặc 'box' hoặc trống: trích xuất feature từ item_code
    let feat = item.feature
    if (!feat || feat.toLowerCase() === 'box' || feat === 'No data') {
      feat = extractFeatureFromItemCode(item.item_code, isAcc)
    }
    const unitType = isAcc ? 'thung' : 'kien'

    if (!containerMap.has(containerKey)) {
      containerMap.set(containerKey, [])
    }
    containerMap.get(containerKey)!.push({
      ...item,
      feature: feat,
      is_accessory: isAcc,
      is_special: isSpec,
      is_box: isBox,
      unit_type: unitType
    })
  })

  const containerGroups: ForecastContainerGroup[] = []

  containerMap.forEach((cItems) => {
    const firstItem = cItems[0]
    const po = (firstItem.po || '').trim()
    const so = (firstItem.so || '').trim()
    const containerNo = firstItem.container_no || ''
    const loadingDateStr = formatLoadingDate(firstItem.loading_date)
    const loadingDateObj = parseLoadingDate(firstItem.loading_date)

    // Trạng thái container: nếu tất cả items đều 'ready'
    const isAllReady = cItems.every(it => it.status === 'ready')
    const status: 'pending' | 'ready' = isAllReady ? 'ready' : 'pending'
    const statusChangedAt = cItems.find(it => it.status_changed_at)?.status_changed_at || null

    // Nhóm cấp 2: Theo Feature trong Container
    const featureMap = new Map<string, ForecastRawItem[]>()
    cItems.forEach(it => {
      let feat = it.feature || extractFeatureFromItemCode(it.item_code, Boolean(it.is_accessory))
      if (!feat || feat.toLowerCase() === 'box' || feat === 'No data') {
        feat = extractFeatureFromItemCode(it.item_code, Boolean(it.is_accessory))
      }
      if (!featureMap.has(feat)) {
        featureMap.set(feat, [])
      }
      featureMap.get(feat)!.push(it)
    })

    const featureGroups: ForecastFeatureGroup[] = []
    let totalContainerQty = 0
    let totalContainerPkg = 0 // Tổng số kiện thành phẩm
    let totalContainerBoxes = 0 // Tổng số thùng phụ kiện
    let hasAccessories = false

    // Sắp xếp feature A-Z (đưa thành phẩm lên trước, phụ kiện xuống sau)
    const sortedFeatures = Array.from(featureMap.keys()).sort((a, b) => {
      const isAccA = featureMap.get(a)![0]?.is_accessory
      const isAccB = featureMap.get(b)![0]?.is_accessory
      if (isAccA !== isAccB) {
        return isAccA ? 1 : -1
      }
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    })

    sortedFeatures.forEach(feat => {
      const fItems = featureMap.get(feat)!
      const isAccGroup = Boolean(fItems[0]?.is_accessory)
      const isSpecGroup = Boolean(fItems.some(it => it.is_special) || isSpecialStockCode(fItems[0]?.item_code) || feat === '1220')
      const isBoxGroup = Boolean(fItems.some(it => it.is_box) || isSpecGroup || feat.toLowerCase().includes('box') || feat === '1220')
      const unitType: 'kien' | 'thung' = isAccGroup ? 'thung' : 'kien'

      if (isAccGroup) {
        hasAccessories = true
      }

      const featQty = fItems.reduce((s, it) => s + (Number(it.qty) || 0), 0)
      // T4: tra pack chuẩn metadata theo feature (nếu caller truyền specs)
      let packSpec: { pack_qty: number; carton_type: string; isSingle?: boolean } | undefined
      let missingSpec = false
      if (packSpecsByFeature) {
        const hit = packSpecsByFeature instanceof Map
          ? packSpecsByFeature.get(feat)
          : (packSpecsByFeature as Record<string, { pack_qty: number; carton_type: string; isSingle?: boolean; missing?: boolean }>)[feat]
        if (hit && Number(hit.pack_qty) > 0) {
          packSpec = hit
          missingSpec = Boolean((hit as { missing?: boolean }).missing)
        } else if (packSpecsByFeature instanceof Map ? (packSpecsByFeature as Map<string, unknown>).size > 0 : Object.keys(packSpecsByFeature).length > 0) {
          // Đã có metadata nhưng thiếu feature này -> cảnh báo header
          missingSpec = true
        }
      }
      const featPkg = calculateFeaturePkg(fItems, isAccGroup, isBoxGroup, packSpec)
      const pcsPerPkg = packSpec && Number(packSpec.pack_qty) > 0 ? Number(packSpec.pack_qty) : (fItems[0]?.pcs_per_pkg || 0)

      totalContainerQty += featQty
      if (isAccGroup) {
        totalContainerBoxes += featPkg
      } else {
        totalContainerPkg += featPkg
      }

      // Cập nhật #pkg và đơn vị tính vào từng item
      fItems.forEach(it => {
        it.pkg = featPkg
        it.unit_type = unitType
        it.is_accessory = isAccGroup
        it.is_special = isSpecGroup
        it.is_box = isBoxGroup
      })

      featureGroups.push({
        feature: feat,
        items: fItems,
        totalQty: featQty,
        pcs_per_pkg: pcsPerPkg,
        pkgCount: featPkg,
        is_accessory: isAccGroup,
        is_special: isSpecGroup,
        is_box: isBoxGroup,
        unit_type: unitType,
        missingSpec,
        packQtyUsed: packSpec ? Number(packSpec.pack_qty) : pcsPerPkg,
        cartonTypeUsed: packSpec?.carton_type || ''
      })
    })

    const roundedPkg = Math.round(totalContainerPkg * 100) / 100
    const roundedBoxes = Math.round(totalContainerBoxes * 100) / 100

    let summaryPkgLabel = ''
    if (roundedPkg > 0 && roundedBoxes > 0) {
      summaryPkgLabel = `${roundedPkg} Kiện + ${roundedBoxes} Thùng`
    } else if (roundedPkg > 0) {
      summaryPkgLabel = `${roundedPkg} Kiện`
    } else if (roundedBoxes > 0) {
      summaryPkgLabel = `${roundedBoxes} Thùng`
    } else {
      summaryPkgLabel = '0 Kiện'
    }

    const remainingHours = status === 'ready' ? getRemainingHoursBeforeDelete(statusChangedAt) : undefined

    containerGroups.push({
      containerKey: `${po} - ${so}`,
      po,
      so,
      container_no: containerNo,
      loading_date: loadingDateStr,
      loadingDateObj,
      status,
      status_changed_at: statusChangedAt,
      isExpired: isContainerExpired(status, statusChangedAt),
      remainingHours,
      totalQty: totalContainerQty,
      totalPkg: roundedPkg,
      totalBoxes: roundedBoxes,
      summaryPkgLabel,
      hasAccessories,
      featureGroups,
      allItems: cItems
    })
  })

  // Sắp xếp theo thứ tự Loading Date từ nhỏ tới lớn (earliest first)
  containerGroups.sort((a, b) => {
    const timeA = a.loadingDateObj ? a.loadingDateObj.getTime() : Infinity
    const timeB = b.loadingDateObj ? b.loadingDateObj.getTime() : Infinity
    if (timeA !== timeB) {
      return timeA - timeB
    }
    // Nếu cùng ngày thì sắp xếp theo PO - SO A-Z
    return a.containerKey.localeCompare(b.containerKey)
  })

  return containerGroups
}
