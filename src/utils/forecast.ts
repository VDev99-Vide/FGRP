/**
 * Utility functions for Planned Shipment List (Danh sách xuất hàng dự kiến)
 */

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
  totalPkg: number
  featureGroups: ForecastFeatureGroup[]
  allItems: ForecastRawItem[]
}

/**
 * Trích xuất Feature từ LPVN Item Code: MID(2, 4)
 * Bỏ số đầu, lấy 4 số tiếp theo.
 * Ví dụ: "8163210604" -> "1632", "1220190004" -> "2201", "8515210204" -> "5152"
 */
export function extractFeatureFromItemCode(itemCode: string): string {
  if (!itemCode || typeof itemCode !== 'string') return 'No data'
  const clean = itemCode.trim()
  if (clean.length >= 5) {
    return clean.substring(1, 5)
  }
  return clean || 'No data'
}

/**
 * Parse chuỗi ngày tháng đa định dạng (dd/mm/yyyy, yyyy-mm-dd, Excel date serial number)
 */
export function parseLoadingDate(dateInput: any): Date | null {
  if (!dateInput) return null

  // Nếu là Date object hợp lệ
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    return dateInput
  }

  // Nếu là số serial của Excel (ví dụ 45549)
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
 * Tính số kiện (#pkg) cho một nhóm Feature theo quy tắc:
 * - Nếu nhóm có từ 2 mã hàng trở lên: (Tổng Qty / 2) / (Pcs/pkg)
 * - Nếu nhóm chỉ có 1 mã đơn lẻ: Tổng Qty / (Pcs/pkg) (không chia 2)
 */
export function calculateFeaturePkg(items: { qty: number; pcs_per_pkg: number }[]): number {
  if (!items || items.length === 0) return 0

  const totalQty = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0)
  // Lấy quy cách đóng gói (nếu các mã có quy cách khác nhau, lấy giá trị > 0 đầu tiên hoặc lớn nhất)
  const pcsPerPkg = items.reduce((max, item) => {
    const val = Number(item.pcs_per_pkg) || 0
    return val > max ? val : max
  }, 0)

  if (pcsPerPkg <= 0) return 0

  if (items.length >= 2) {
    // Có từ 2 mã trở lên: chia 2 rồi chia tiếp cho pcs_per_pkg
    return (totalQty / 2) / pcsPerPkg
  } else {
    // Chỉ có 1 mã đơn lẻ: không chia 2
    return totalQty / pcsPerPkg
  }
}

/**
 * Kiểm tra xem đơn hàng container đã chuẩn bị xong quá 1 ngày (24 giờ) chưa để tự động xóa
 */
export function isContainerExpired(status?: string, statusChangedAt?: string | null, expireHours: number = 24): boolean {
  if (status !== 'ready' || !statusChangedAt) return false
  const changedDate = new Date(statusChangedAt)
  if (isNaN(changedDate.getTime())) return false

  const elapsedMs = Date.now() - changedDate.getTime()
  return elapsedMs >= expireHours * 60 * 60 * 1000
}

/**
 * Tính số giờ còn lại trước khi đơn hàng trạng thái 'ready' bị tự động xóa sau 24h
 */
export function getRemainingHoursBeforeDelete(statusChangedAt?: string | null, expireHours: number = 24): number {
  if (!statusChangedAt) return expireHours
  const changedDate = new Date(statusChangedAt)
  if (isNaN(changedDate.getTime())) return expireHours

  const elapsedMs = Date.now() - changedDate.getTime()
  const remainingMs = (expireHours * 60 * 60 * 1000) - elapsedMs
  const remainingHours = Math.max(0, Math.ceil(remainingMs / (60 * 60 * 1000)))
  return remainingHours
}

/**
 * Lọc bỏ các dòng đã hết hạn (> 24 giờ sau khi chuyển trạng thái Chuẩn bị xong)
 */
export function filterOutExpiredItems(items: ForecastRawItem[]): ForecastRawItem[] {
  return items.filter(item => !isContainerExpired(item.status, item.status_changed_at))
}

/**
 * Phân nhóm và sắp xếp dữ liệu xuất hàng dự kiến:
 * - Nhóm cấp 1: Container / Đơn hàng theo PO và SO
 * - Sắp xếp theo Loading Date từ nhỏ tới lớn (earliest date first)
 * - Nhóm cấp 2: Trong mỗi Container, gom nhóm theo Feature = MID(item_code, 2, 4)
 * - Tính #pkg cho từng Feature và tổng #pkg cho từng Container
 */
export function groupAndSortForecastData(items: ForecastRawItem[]): ForecastContainerGroup[] {
  // Loại bỏ các dòng đã hết hạn
  const validItems = filterOutExpiredItems(items)

  // Nhóm cấp 1 theo PO và SO
  const containerMap = new Map<string, ForecastRawItem[]>()

  validItems.forEach(item => {
    const po = (item.po || 'UNKNOWN_PO').trim()
    const so = (item.so || 'UNKNOWN_SO').trim()
    const containerKey = `${po}___${so}`

    if (!containerMap.has(containerKey)) {
      containerMap.set(containerKey, [])
    }
    containerMap.get(containerKey)!.push({
      ...item,
      feature: item.feature || extractFeatureFromItemCode(item.item_code)
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

    // Trạng thái container: nếu tất cả items đều 'ready' hoặc container được đánh dấu 'ready'
    const isAllReady = cItems.every(it => it.status === 'ready')
    const status: 'pending' | 'ready' = isAllReady ? 'ready' : 'pending'
    const statusChangedAt = cItems.find(it => it.status_changed_at)?.status_changed_at || null

    // Nhóm cấp 2: Theo Feature trong Container
    const featureMap = new Map<string, ForecastRawItem[]>()
    cItems.forEach(it => {
      const feat = it.feature || extractFeatureFromItemCode(it.item_code)
      if (!featureMap.has(feat)) {
        featureMap.set(feat, [])
      }
      featureMap.get(feat)!.push(it)
    })

    const featureGroups: ForecastFeatureGroup[] = []
    let totalContainerQty = 0
    let totalContainerPkg = 0

    // Sắp xếp feature A-Z
    const sortedFeatures = Array.from(featureMap.keys()).sort((a, b) => 
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    )

    sortedFeatures.forEach(feat => {
      const fItems = featureMap.get(feat)!
      const featQty = fItems.reduce((s, it) => s + (Number(it.qty) || 0), 0)
      const featPkg = calculateFeaturePkg(fItems)
      const pcsPerPkg = fItems[0]?.pcs_per_pkg || 0

      totalContainerQty += featQty
      totalContainerPkg += featPkg

      // Cập nhật #pkg tính toán vào từng item
      fItems.forEach(it => {
        it.pkg = featPkg
      })

      featureGroups.push({
        feature: feat,
        items: fItems,
        totalQty: featQty,
        pcs_per_pkg: pcsPerPkg,
        pkgCount: featPkg
      })
    })

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
      totalPkg: Math.round(totalContainerPkg * 100) / 100,
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
