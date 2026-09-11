import { describe, it, expect } from 'vitest'
import {
  extractFeatureFromItemCode,
  parseLoadingDate,
  formatLoadingDate,
  calculateFeaturePkg,
  isContainerExpired,
  getRemainingHoursBeforeDelete,
  filterOutExpiredItems,
  groupAndSortForecastData,
  ForecastRawItem
} from './forecast'

describe('extractFeatureFromItemCode', () => {
  it('tách MID(2, 4): bỏ số đầu lấy 4 số tiếp theo', () => {
    expect(extractFeatureFromItemCode('8163210604')).toBe('1632')
    expect(extractFeatureFromItemCode('8163220604')).toBe('1632')
    expect(extractFeatureFromItemCode('1220190004')).toBe('2201')
    expect(extractFeatureFromItemCode('1220200004')).toBe('2202')
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

  it('parse đúng định dạng ISO yyyy-mm-dd', () => {
    const d2 = parseLoadingDate('2026-09-20')
    expect(d2).not.toBeNull()
    expect(formatLoadingDate('2026-09-20')).toBe('20/09/2026')
  })
})

describe('calculateFeaturePkg (Công thức tính số kiện #pkg)', () => {
  it('nhóm có từ 2 mã hàng trở lên: (Tổng Qty / 2) / (Pcs/pkg)', () => {
    // Ví dụ từ người dùng: 8163210604 và 8163220604
    // Mỗi mã có Qty = 480, Pcs/pkg = 240
    // Tổng Qty = 960
    // Số kiện = (960 / 2) / 240 = 480 / 240 = 2 kiện
    const items = [
      { qty: 480, pcs_per_pkg: 240 },
      { qty: 480, pcs_per_pkg: 240 }
    ]
    const pkg = calculateFeaturePkg(items)
    expect(pkg).toBe(2)
  })

  it('nhóm chỉ có 1 mã đơn lẻ: Tổng Qty / (Pcs/pkg) (không chia 2)', () => {
    // 1 mã đơn lẻ có Qty = 480, Pcs/pkg = 240 -> 480 / 240 = 2 kiện
    const items = [
      { qty: 480, pcs_per_pkg: 240 }
    ]
    const pkg = calculateFeaturePkg(items)
    expect(pkg).toBe(2)
  })

  it('trả về 0 khi pcs_per_pkg = 0 hoặc rỗng', () => {
    expect(calculateFeaturePkg([{ qty: 100, pcs_per_pkg: 0 }])).toBe(0)
    expect(calculateFeaturePkg([])).toBe(0)
  })
})

describe('isContainerExpired & filterOutExpiredItems (Tự xóa sau 1 ngày)', () => {
  it('đơn đã chuẩn bị xong quá 24h thì hết hạn', () => {
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    expect(isContainerExpired('ready', twentyFiveHoursAgo)).toBe(true)
  })

  it('đơn đã chuẩn bị xong chưa tới 24h thì không hết hạn', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    expect(isContainerExpired('ready', twoHoursAgo)).toBe(false)
    expect(getRemainingHoursBeforeDelete(twoHoursAgo)).toBe(22)
  })

  it('đơn pending thì không bao giờ hết hạn', () => {
    const oldDate = new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString()
    expect(isContainerExpired('pending', oldDate)).toBe(false)
  })

  it('filterOutExpiredItems loại bỏ chính xác các đơn quá hạn', () => {
    const items: ForecastRawItem[] = [
      {
        po: 'PO-01',
        so: 'SO-01',
        item_code: '8163210604',
        loading_date: '15/09/2026',
        qty: 480,
        pcs_per_pkg: 240,
        status: 'ready',
        status_changed_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString() // Hết hạn
      },
      {
        po: 'PO-02',
        so: 'SO-02',
        item_code: '8163220604',
        loading_date: '16/09/2026',
        qty: 480,
        pcs_per_pkg: 240,
        status: 'pending' // Còn hiệu lực
      }
    ]

    const filtered = filterOutExpiredItems(items)
    expect(filtered.length).toBe(1)
    expect(filtered[0].po).toBe('PO-02')
  })
})

describe('groupAndSortForecastData (Phân nhóm PO-SO, gom Feature, sắp xếp Loading Date)', () => {
  it('nhóm các dòng theo PO và SO, gom theo Feature và sắp xếp ngày từ nhỏ tới lớn', () => {
    const rawItems: ForecastRawItem[] = [
      // Container 2 (Ngày 20/09/2026)
      {
        po: 'PO-B',
        so: 'SO-B',
        item_code: '8515210204',
        loading_date: '20/09/2026',
        qty: 500,
        pcs_per_pkg: 250
      },
      // Container 1 (Ngày 12/09/2026) - Có 2 mã Feature 1632
      {
        po: 'PO-A',
        so: 'SO-A',
        item_code: '8163210604',
        loading_date: '12/09/2026',
        qty: 480,
        pcs_per_pkg: 240
      },
      {
        po: 'PO-A',
        so: 'SO-A',
        item_code: '8163220604',
        loading_date: '12/09/2026',
        qty: 480,
        pcs_per_pkg: 240
      }
    ]

    const groups = groupAndSortForecastData(rawItems)
    expect(groups.length).toBe(2)

    // Kiểm tra thứ tự sắp xếp: Container 1 (12/09) phải trước Container 2 (20/09)
    expect(groups[0].po).toBe('PO-A')
    expect(groups[0].loading_date).toBe('12/09/2026')
    expect(groups[1].po).toBe('PO-B')
    expect(groups[1].loading_date).toBe('20/09/2026')

    // Container 1: Feature 1632 có 2 mã -> (960 / 2) / 240 = 2 kiện
    expect(groups[0].featureGroups.length).toBe(1)
    expect(groups[0].featureGroups[0].feature).toBe('1632')
    expect(groups[0].featureGroups[0].pkgCount).toBe(2)
    expect(groups[0].totalPkg).toBe(2)
    expect(groups[0].totalQty).toBe(960)

    // Container 2: Feature 5152 có 1 mã -> 500 / 250 = 2 kiện
    expect(groups[1].featureGroups.length).toBe(1)
    expect(groups[1].featureGroups[0].feature).toBe('5152')
    expect(groups[1].featureGroups[0].pkgCount).toBe(2)
    expect(groups[1].totalPkg).toBe(2)
    expect(groups[1].totalQty).toBe(500)
  })
})
