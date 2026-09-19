import { describe, it, expect } from 'vitest'
import {
  extractFeatureFromItemCode,
  isSpecialStockCode,
  parseLoadingDate,
  formatLoadingDate,
  calculateFeaturePkg,
  isContainerExpired,
  getRemainingHoursBeforeDelete,
  filterOutExpiredItems,
  groupAndSortForecastData,
  ForecastRawItem
} from './forecast'

describe('extractFeatureFromItemCode & isSpecialStockCode', () => {
  it('mã đặc biệt 1220 (1220190004, 1220200004): lấy 4 số đầu "1220"', () => {
    expect(isSpecialStockCode('1220190004')).toBe(true)
    expect(isSpecialStockCode('1220200004')).toBe(true)
    expect(extractFeatureFromItemCode('1220190004')).toBe('1220')
    expect(extractFeatureFromItemCode('1220200004')).toBe('1220')
  })

  it('hàng phụ kiện (Accessories): giữ nguyên mã hàng không tách MID(2,4)', () => {
    expect(extractFeatureFromItemCode('1455350001', true)).toBe('1455350001')
    expect(extractFeatureFromItemCode('1325730001', true)).toBe('1325730001')
  })

  it('mã thông thường: tách MID(2, 4) bỏ số đầu lấy 4 số tiếp theo', () => {
    expect(extractFeatureFromItemCode('8163210604')).toBe('1632')
    expect(extractFeatureFromItemCode('8163220604')).toBe('1632')
    expect(extractFeatureFromItemCode('8515210204')).toBe('5152')
    expect(extractFeatureFromItemCode('8515220204')).toBe('5152')
  })

  it('xử lý chuỗi rỗng hoặc ngắn hơn 5 ký tự', () => {
    expect(extractFeatureFromItemCode('')).toBe('No data')
    expect(extractFeatureFromItemCode('123')).toBe('123')
  })
})

describe('parseLoadingDate & formatLoadingDate', () => {
  it('parse và format đúng dd/mm/yyyy', () => {
    const d1 = parseLoadingDate('15/09/2026')
    expect(d1).not.toBeNull()
    expect(d1?.getDate()).toBe(15)
    expect(d1?.getMonth()).toBe(8) // 0-indexed: 8 = Sep
    expect(d1?.getFullYear()).toBe(2026)
    expect(formatLoadingDate('15/09/2026')).toBe('15/09/2026')
  })

  it('parse đúng định dạng số serial của Excel (như trong file thực tế 46279)', () => {
    const d2 = parseLoadingDate(46279)
    expect(d2).not.toBeNull()
    expect(d2?.getFullYear()).toBe(2026)
  })
})

describe('calculateFeaturePkg (Công thức tính Kiện & Thùng)', () => {
  it('hàng phụ kiện (Accessories): không chia 2, số thùng = Tổng Qty / (Pcs/pkg)', () => {
    // 1455350001: Qty = 1700, Pcs/pkg = 50 -> 1700 / 50 = 34 Thùng
    const accItem = [{ qty: 1700, pcs_per_pkg: 50, is_accessory: true }]
    const boxes = calculateFeaturePkg(accItem, true)
    expect(boxes).toBe(34)

    // 1325730001: Qty = 1750, Pcs/pkg = 25 -> 1750 / 25 = 70 Thùng
    const accItem2 = [{ qty: 1750, pcs_per_pkg: 25, is_accessory: true }]
    const boxes2 = calculateFeaturePkg(accItem2, true)
    expect(boxes2).toBe(70)
  })

  it('mã đặc biệt 1220 hoặc hàng đánh dấu Box: không chia đôi, tính giống phụ kiện: số lượng 1 LPVN ITEM CODE / quy cách = số kiện', () => {
    // 1220190004 & 1220200004: mỗi mã Qty = 4400, Pcs/pkg = 200
    // Không gộp chia đôi: (4400 / 200) + (4400 / 200) = 22 + 22 = 44 Kiện
    const items = [
      { qty: 4400, pcs_per_pkg: 200, is_box: true },
      { qty: 4400, pcs_per_pkg: 200, is_box: true }
    ]
    const pkg = calculateFeaturePkg(items, false, true)
    expect(pkg).toBe(44)
  })

  it('thành phẩm thông thường có cặp: (Tổng Qty / 2) / (Pcs/pkg)', () => {
    const items = [
      { qty: 480, pcs_per_pkg: 240 },
      { qty: 480, pcs_per_pkg: 240 }
    ]
    const pkg = calculateFeaturePkg(items, false)
    expect(pkg).toBe(2)
  })

  it('thành phẩm chỉ có 1 mã đơn lẻ: không chia 2', () => {
    const items = [
      { qty: 480, pcs_per_pkg: 240 }
    ]
    const pkg = calculateFeaturePkg(items, false)
    expect(pkg).toBe(2)
  })
})

describe('isContainerExpired & filterOutExpiredItems [ĐÃ BỎ auto-xóa 3 ngày — xóa thủ công]', () => {
  it('đơn đã chuẩn bị xong quá 72h thì hết hạn (hàm giữ tương thích, không dùng để filter)', () => {
    const seventyThreeHoursAgo = new Date(Date.now() - 73 * 60 * 60 * 1000).toISOString()
    expect(isContainerExpired('ready', seventyThreeHoursAgo)).toBe(true)
  })

  it('đơn 71h59m chưa hết hạn, 72h01m hết hạn (boundary 72h)', () => {
    const almost72 = new Date(Date.now() - (72 * 60 - 1) * 60 * 1000).toISOString()
    const justOver72 = new Date(Date.now() - (72 * 60 + 1) * 60 * 1000).toISOString()
    expect(isContainerExpired('ready', almost72)).toBe(false)
    expect(isContainerExpired('ready', justOver72)).toBe(true)
  })

  it('đơn đã chuẩn bị xong chưa tới 72h thì không hết hạn', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    expect(isContainerExpired('ready', twoHoursAgo)).toBe(false)
    expect(getRemainingHoursBeforeDelete(twoHoursAgo)).toBe(70)
  })

  it('filterOutExpiredItems đã bỏ auto-xóa: giữ nguyên toàn bộ (xóa thủ công)', () => {
    const seventyThreeHoursAgo = new Date(Date.now() - 73 * 60 * 60 * 1000).toISOString()
    const items: ForecastRawItem[] = [
      { po: 'PO1', so: 'SO1', item_code: '8163210604', loading_date: '10/09/2026', qty: 100, pcs_per_pkg: 50, status: 'ready', status_changed_at: seventyThreeHoursAgo },
      { po: 'PO2', so: 'SO2', item_code: '8163220604', loading_date: '10/09/2026', qty: 100, pcs_per_pkg: 50, status: 'pending', status_changed_at: null }
    ]
    const filtered = filterOutExpiredItems(items)
    expect(filtered.length).toBe(2)
  })
})

describe('metadata-first: resolve 1010 ước tính + duplicate PO-SO', () => {
  it('1010 mặc định thùng đôi + ước tính, chọn đơn thì không ước tính', async () => {
    const { groupAndSortForecastData } = await import('./forecast')
    const items: ForecastRawItem[] = [
      { po: 'P', so: 'S', item_code: '8101010104', loading_date: '10/09/2026', qty: 500, pcs_per_pkg: 0 },
      { po: 'P', so: 'S', item_code: '8101020104', loading_date: '10/09/2026', qty: 500, pcs_per_pkg: 0 },
    ]
    const specs = [
      { ma_hang: '8101010104', feature: '1010', pack_qty: 250, carton_type: 'thùng đôi', carton_spec: '1470*1135*925' },
      { ma_hang: '8101010104', feature: '1010', pack_qty: 250, carton_type: 'thùng đơn', carton_spec: '1150*1140*460' },
      { ma_hang: '8101020104', feature: '1010', pack_qty: 250, carton_type: 'thùng đôi', carton_spec: '1470*1135*925' },
      { ma_hang: '8101020104', feature: '1010', pack_qty: 250, carton_type: 'thùng đơn', carton_spec: '1150*1140*460' },
    ]
    const gDbl = groupAndSortForecastData(items, null, { metadataSpecs: specs, preferred1010Type: 'thùng đôi' })
    const fgDbl = gDbl[0].featureGroups.find((x) => x.feature === '1010')!
    expect(fgDbl.pkgCount).toBe(2) // (1000/2)/250
    expect(fgDbl.isEstimated).toBe(true)

    const gSgl = groupAndSortForecastData(items, null, { metadataSpecs: specs, preferred1010Type: 'thùng đơn' })
    const fgSgl = gSgl[0].featureGroups.find((x) => x.feature === '1010')!
    expect(fgSgl.pkgCount).toBe(4) // 1000/250
    expect(fgSgl.isEstimated).toBeFalsy()
  })

  it('findDuplicateContainerKeys cảnh báo PO-SO đã có', async () => {
    const { findDuplicateContainerKeys } = await import('./forecast')
    const dups = findDuplicateContainerKeys(
      [{ po: 'A', so: '1' }, { po: 'B', so: '2' }],
      [{ po: 'A', so: '1' }],
    )
    expect(dups).toEqual(['A - 1'])
  })
})

describe('groupAndSortForecastData (Phân nhóm PO-SO, Phụ kiện thùng và Mã 1220)', () => {
  it('phân nhóm chính xác Container có cả thành phẩm lẫn phụ kiện', () => {
    const rawItems: ForecastRawItem[] = [
      // Đơn hàng PO 64853, SO 2610000112 (Ngày 14/09/2026)
      // Cặp thành phẩm 5152
      {
        po: '64853',
        so: '2610000112',
        item_code: '8515210204',
        loading_date: '14/09/2026',
        qty: 1750,
        pcs_per_pkg: 70
      },
      {
        po: '64853',
        so: '2610000112',
        item_code: '8515220204',
        loading_date: '14/09/2026',
        qty: 1750,
        pcs_per_pkg: 70
      },
      // Phụ kiện Accessories: 1750 / 25 = 70 Thùng
      {
        po: '64853',
        so: '2610000112',
        item_code: '1325730001',
        loading_date: '14/09/2026',
        qty: 1750,
        pcs_per_pkg: 25,
        is_accessory: true
      },
      // Đơn hàng khác: Mã đặc biệt 1220 (Ngày 17/09/2026)
      {
        po: '0N64',
        so: '2610',
        item_code: '1220190004',
        loading_date: '17/09/2026',
        qty: 4400,
        pcs_per_pkg: 200
      },
      {
        po: '0N64',
        so: '2610',
        item_code: '1220200004',
        loading_date: '17/09/2026',
        qty: 4400,
        pcs_per_pkg: 200
      }
    ]

    const groups = groupAndSortForecastData(rawItems)
    expect(groups.length).toBe(2)

    // Container 1 (14/09)
    const cont1 = groups[0]
    expect(cont1.po).toBe('64853')
    expect(cont1.hasAccessories).toBe(true)
    expect(cont1.totalPkg).toBe(25) // (3500 / 2) / 70 = 25 Kiện
    expect(cont1.totalBoxes).toBe(70) // 1750 / 25 = 70 Thùng
    expect(cont1.summaryPkgLabel).toBe('25 Kiện + 70 Thùng')

    // Container 2 (17/09): Mã đặc biệt 1220
    const cont2 = groups[1]
    expect(cont2.po).toBe('0N64')
    expect(cont2.featureGroups[0].feature).toBe('1220')
    expect(cont2.featureGroups[0].is_special).toBe(true)
    expect(cont2.totalPkg).toBe(44) // (4400 / 200) + (4400 / 200) = 44 Kiện (tính giống phụ kiện, không gộp chia đôi)
  })
})
