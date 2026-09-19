/**
 * Utility functions for Planned Shipment List (Danh sách xuất hàng dự kiến)
 * Chuẩn mới: Feature + PCS/pkg tham chiếu trực tiếp metadata (ma_hang -> feature/pack),
 * không còn tự tách MID(2,4) cứng. Fallback MID chỉ khi thiếu metadata (kèm tag 'Thiếu Meta-data').
 */

export { extractFeatureFromItemCode, isSpecialStockCode, resolveFeatureFromMetadata } from './feature'
import { extractFeatureFromItemCode, isSpecialStockCode, resolveFeatureFromMetadata } from './feature'
import { getPackSpecByMaHang, isCode1010 } from './packingSpec'

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
  /** Gắn khi thiếu metadata (hiển thị tag). */
  missingSpec?: boolean
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
  cartonSpecUsed?: string
  /** true khi 1010 tính theo thùng đôi -> hiển thị 'ước tính' trước số kiện. */
  isEstimated?: boolean
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

export type PackSpecMapLike =
  | Map<string, { pack_qty: number; carton_type: string; isSingle?: boolean; missing?: boolean; carton_spec?: string }>
  | Record<string, { pack_qty: number; carton_type: string; isSingle?: boolean; missing?: boolean; carton_spec?: string }>

export interface MetadataSpecSource {
  ma_hang?: string
  feature?: string
  item_code?: string
  pack_qty: number
  carton_type: string
  carton_spec?: string
}

export interface GroupSortOptions {
  /** Danh sách metadata full (chuẩn mới) để resolve ma_hang -> feature/pack. */
  metadataSpecs?: MetadataSpecSource[] | null
  /** Lựa chọn của user cho mã 1010 trong preview: 'thùng đơn' | 'thùng đôi'. Mặc định 'thùng đôi' + ước tính. */
  preferred1010Type?: string | null
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
 * Tính số kiện (#pkg) — chuẩn metadata (class module chính):
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

  // Có pack chuẩn metadata -> dùng đúng công thức đơn/đôi
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
 * [DEPRECATED — giữ để tương thích test cũ, KHÔNG còn tự động xóa]
 * Kiểm tra xem đơn hàng container đã chuẩn bị xong quá 3 ngày (72 giờ) chưa.
 * Hiện tại hệ thống đã bỏ cơ chế tự động xóa sau 3 ngày -> xóa thủ công.
 * Hàm giữ lại để test cũ không vỡ, luôn trả về false khi không truyền expireHours? 
 * Giữ logic cũ để test boundary vẫn pass, nhưng caller mới KHÔNG dùng để filter.
 */
export function isContainerExpired(status?: string, statusChangedAt?: string | null, expireHours: number = 72): boolean {
  if (status !== 'ready' || !statusChangedAt) return false
  const changedDate = new Date(statusChangedAt)
  if (isNaN(changedDate.getTime())) return false

  const elapsedMs = Date.now() - changedDate.getTime()
  return elapsedMs >= expireHours * 60 * 60 * 1000
}

/**
 * [DEPRECATED — giữ tương thích] Tính số giờ còn lại trước khi xóa (không còn dùng).
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
 * [DEPRECATED — đã bỏ auto-xóa] Hiện trả về nguyên danh sách (không lọc).
 * Giữ tên hàm để caller/test cũ không vỡ.
 */
export function filterOutExpiredItems(items: ForecastRawItem[]): ForecastRawItem[] {
  return items || []
}

/** Chuẩn hóa key PO+SO để cảnh báo trùng khi import cộng dồn (PO+SO là duy nhất). */
export function containerKeyOf(po: string, so: string): string {
  return `${String(po || '').trim().toLowerCase()}___${String(so || '').trim().toLowerCase()}`
}

/** Tìm các PO+SO trong rows mới đã tồn tại trong kế hoạch hiện tại (để preview cảnh báo, case-insensitive). */
export function findDuplicateContainerKeys(
  newRows: Pick<ForecastRawItem, 'po' | 'so'>[],
  existingItems: Pick<ForecastRawItem, 'po' | 'so'>[],
): string[] {
  const existing = new Set(existingItems.map((it) => containerKeyOf(it.po, it.so)))
  const dups = new Set<string>()
  newRows.forEach((r) => {
    const k = containerKeyOf(r.po, r.so)
    if (existing.has(k)) dups.add(`${String(r.po).trim()} - ${String(r.so).trim()}`)
  })
  return Array.from(dups)
}

/**
 * Phân nhóm và sắp xếp dữ liệu xuất hàng dự kiến (chuẩn mới metadata-first):
 * - Nhóm cấp 1: Container / Đơn hàng theo PO và SO
 * - Sắp xếp theo Loading Date từ nhỏ tới lớn (earliest date first)
 * - Nhóm cấp 2: Trong mỗi Container, gom nhóm theo Feature:
 *   + Resolve feature ưu tiên metadata (ma_hang -> feature), fallback MID + missingSpec=true.
 *   + Pack (pcs/pkg) ưu tiên metadata (ma_hang -> pack/type, 1010 theo preferred1010Type, mặc định đôi + ước tính).
 *   + Hàng Accessories: giữ nguyên mã hàng, tính ra số THÙNG (không / 2)
 *   + Thùng đơn: MÃ HÀNG / pack (không /2). Thùng đôi: tổng feature /2/pack.
 * - KHÔNG lọc hết hạn (đã bỏ auto-xóa 3 ngày, xóa thủ công).
 */
export function groupAndSortForecastData(
  items: ForecastRawItem[],
  packSpecsByFeature?: PackSpecMapLike | null,
  options?: GroupSortOptions,
): ForecastContainerGroup[] {
  // Đã bỏ auto-xóa: giữ toàn bộ items
  const validItems = items || []
  const metadataSpecs = (options?.metadataSpecs || null) as MetadataSpecSource[] | null
  const preferred1010Type = options?.preferred1010Type || 'thùng đôi'

  // Helper tra pack: ưu tiên metadataSpecs (ma_hang), fallback map cũ (feature)
  const resolvePack = (
    itemCode: string,
    feature: string,
    _isAccessory: boolean,
  ): { pack_qty: number; carton_type: string; carton_spec: string; isSingle: boolean; missing: boolean; isEstimated: boolean } => {
    // 1. Ưu tiên metadata full (ma_hang exact)
    if (metadataSpecs && metadataSpecs.length > 0) {
      const r = getPackSpecByMaHang(itemCode, metadataSpecs as unknown as Parameters<typeof getPackSpecByMaHang>[1], isCode1010(itemCode) ? preferred1010Type : undefined, feature)
      if (r && !r.missing) {
        return {
          pack_qty: r.pack_qty,
          carton_type: r.carton_type,
          carton_spec: r.carton_spec || '',
          isSingle: r.isSingle,
          missing: false,
          isEstimated: Boolean(r.isEstimated),
        }
      }
      // Có metadata nhưng thiếu mã này -> missing (để tag)
      if (!r || r.missing) {
        // Thử fallback map cũ theo feature (nếu có)
        if (packSpecsByFeature) {
          const hit = packSpecsByFeature instanceof Map
            ? packSpecsByFeature.get(feature)
            : (packSpecsByFeature as Record<string, { pack_qty: number; carton_type: string; isSingle?: boolean; missing?: boolean; carton_spec?: string }>)[feature]
          if (hit && Number(hit.pack_qty) > 0) {
            const single = hit.isSingle ?? /thùng đơn/i.test(String(hit.carton_type || ''))
            const estimated = feature === '1010' && !single
            return { pack_qty: Number(hit.pack_qty), carton_type: String(hit.carton_type || ''), carton_spec: String(hit.carton_spec || ''), isSingle: single, missing: Boolean((hit as { missing?: boolean }).missing), isEstimated: estimated }
          }
        }
        return { pack_qty: 0, carton_type: '', carton_spec: '', isSingle: false, missing: true, isEstimated: false }
      }
    }
    // 2. Map cũ theo feature (tương thích)
    if (packSpecsByFeature) {
      const hit = packSpecsByFeature instanceof Map
        ? packSpecsByFeature.get(feature)
        : (packSpecsByFeature as Record<string, { pack_qty: number; carton_type: string; isSingle?: boolean; missing?: boolean; carton_spec?: string }>)[feature]
      if (hit && Number(hit.pack_qty) > 0) {
        const single = hit.isSingle ?? /thùng đơn/i.test(String(hit.carton_type || ''))
        const estimated = feature === '1010' && !single
        return { pack_qty: Number(hit.pack_qty), carton_type: String(hit.carton_type || ''), carton_spec: String(hit.carton_spec || ''), isSingle: single, missing: Boolean((hit as { missing?: boolean }).missing), isEstimated: estimated }
      } else if (packSpecsByFeature instanceof Map ? (packSpecsByFeature as Map<string, unknown>).size > 0 : Object.keys(packSpecsByFeature).length > 0) {
        // Đã có metadata nhưng thiếu feature này -> cảnh báo
        // Nếu item đã có pcs_per_pkg từ Excel cũ, vẫn dùng fallback ở tầng dưới nhưng missing=true
        const hasMap = true
        if (hasMap) {
          // Sẽ fallback pcs_per_pkg ở dưới, nhưng đánh dấu missing
          return { pack_qty: 0, carton_type: '', carton_spec: '', isSingle: false, missing: true, isEstimated: false }
        }
      }
    }
    return { pack_qty: 0, carton_type: '', carton_spec: '', isSingle: false, missing: false, isEstimated: false }
  }

  // Nhóm cấp 1 theo PO và SO
  const containerMap = new Map<string, ForecastRawItem[]>()

  validItems.forEach(item => {
    const po = (item.po || 'UNKNOWN_PO').trim()
    const so = (item.so || 'UNKNOWN_SO').trim()
    const containerKey = `${po}___${so}`

    // Resolve accessory: nếu metadata nói phụ kiện (theo ma_hang) thì ưu tiên
    let isAcc = Boolean(item.is_accessory)
    if (metadataSpecs && metadataSpecs.length > 0) {
      const code = String(item.item_code || '').trim()
      const metaHit = metadataSpecs.find((s) => String(s.ma_hang || '').trim() === code)
      if (metaHit) {
        const ct = String(metaHit.carton_type || '').toLowerCase()
        const norm = ct.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        if (norm.includes('phu kien') || norm.includes('phukien') || norm.includes('carton') || norm.includes('plywood') || norm.includes('box')) {
          isAcc = true
        } else {
          // Metadata FG (đơn/đôi) -> không phải phụ kiện (ghi đè flag cũ sai)
          // Nhưng nếu item đã đánh dấu phụ kiện thủ công mà metadata là FG, giữ phụ kiện? Ưu tiên metadata.
          if (!isAcc) isAcc = false
          else {
            // Nếu Excel cũ đánh dấu phụ kiện nhưng metadata là FG -> coi là FG (metadata chuẩn hơn)
            isAcc = false
          }
        }
      }
    }
    const isSpec = isSpecialStockCode(item.item_code) || Boolean(item.is_special) || (typeof item.feature === 'string' && item.feature.includes('1220'))
    const isBox = Boolean(item.is_box) || (typeof item.feature === 'string' && item.feature.toLowerCase().includes('box'))

    // Resolve feature ưu tiên metadata (ma_hang -> feature)
    let feat = item.feature
    let featFromMeta = false
    let featMissing = false
    if (!feat || feat.toLowerCase() === 'box' || feat === 'No data') {
      if (metadataSpecs && metadataSpecs.length > 0) {
        const resolved = resolveFeatureFromMetadata(item.item_code, metadataSpecs as unknown as Parameters<typeof resolveFeatureFromMetadata>[1], isAcc)
        feat = resolved.feature
        featFromMeta = resolved.fromMetadata
        featMissing = !resolved.fromMetadata
      } else {
        feat = extractFeatureFromItemCode(item.item_code, isAcc)
      }
    } else {
      // Đã có feature từ Excel/import: kiểm tra có khớp metadata không để gắn missing
      if (metadataSpecs && metadataSpecs.length > 0) {
        const code = String(item.item_code || '').trim()
        const hit = metadataSpecs.find((s) => String(s.ma_hang || '').trim() === code)
        if (hit) {
          const mf = String(hit.feature || (hit as { item_code?: string }).item_code || '').trim()
          if (mf && mf !== feat) {
            // Metadata chuẩn hơn -> dùng metadata
            feat = mf
          }
          featFromMeta = true
        } else {
          featMissing = true
        }
      }
    }
    void featFromMeta
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
      unit_type: unitType,
      missingSpec: featMissing || undefined,
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
      let feat = it.feature
      if (!feat || feat.toLowerCase() === 'box' || feat === 'No data') {
        if (metadataSpecs && metadataSpecs.length > 0) {
          feat = resolveFeatureFromMetadata(it.item_code, metadataSpecs as unknown as Parameters<typeof resolveFeatureFromMetadata>[1], Boolean(it.is_accessory)).feature
        } else {
          feat = extractFeatureFromItemCode(it.item_code, Boolean(it.is_accessory))
        }
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
      // Tra pack chuẩn: ưu tiên ma_hang của item đầu (chuẩn mới), fallback feature
      const firstCode = String(fItems[0]?.item_code || '').trim()
      const packInfo = resolvePack(firstCode, feat, isAccGroup)
      // Nếu group 1010 có nhiều mã, preferredType đã xử lý trong resolvePack
      let packSpecForCalc: { pack_qty: number; carton_type: string; isSingle?: boolean } | undefined
      let missingSpec = packInfo.missing
      let isEstimated = packInfo.isEstimated
      // Nếu thiếu metadata nhưng item có pcs_per_pkg (file cũ) -> fallback tính cũ, vẫn missing=true để tag
      if (packInfo.pack_qty > 0) {
        packSpecForCalc = { pack_qty: packInfo.pack_qty, carton_type: packInfo.carton_type, isSingle: packInfo.isSingle }
      } else {
        packSpecForCalc = undefined
        // Nếu có metadataSpecs mà thiếu -> missing=true (đã set). Nếu chưa wiring specs -> missing=false (không warn sai)
        if (metadataSpecs && metadataSpecs.length > 0) missingSpec = true
        else if (packSpecsByFeature && (packSpecsByFeature instanceof Map ? packSpecsByFeature.size > 0 : Object.keys(packSpecsByFeature).length > 0)) missingSpec = true
        else missingSpec = fItems.some((it) => Boolean((it as { missingSpec?: boolean }).missingSpec)) ? true : false
      }
      // Trường hợp Tồn kho 1010 luôn ước tính theo đôi (kể cả khi resolve ra đơn? caller inventory luôn truyền đôi)
      if (feat === '1010' && !isAccGroup) {
        // Nếu pack là đơn nhưng caller là tồn kho (preferred đôi) -> đã resolve đôi ở trên.
        // Giữ isEstimated khi đôi.
      }
      const featPkg = calculateFeaturePkg(fItems, isAccGroup, isBoxGroup, packSpecForCalc)
      const pcsPerPkg = packInfo.pack_qty > 0 ? Number(packInfo.pack_qty) : (fItems[0]?.pcs_per_pkg || 0)

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
        if (missingSpec) (it as { missingSpec?: boolean }).missingSpec = true
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
        packQtyUsed: packInfo.pack_qty > 0 ? Number(packInfo.pack_qty) : pcsPerPkg,
        cartonTypeUsed: packInfo.carton_type || '',
        cartonSpecUsed: packInfo.carton_spec || '',
        isEstimated,
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

    containerGroups.push({
      containerKey: `${po} - ${so}`,
      po,
      so,
      container_no: containerNo,
      loading_date: loadingDateStr,
      loadingDateObj,
      status,
      status_changed_at: statusChangedAt,
      isExpired: false,
      remainingHours: undefined,
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
