import { describe, it, expect } from 'vitest'
import {
  detectMetadataColumnMapping,
  mapRowsToPackingSpecs,
  normalizeMetadataNumber,
  type MetadataColumnMapping,
} from './metadataExcel'

describe('detectMetadataColumnMapping (7 cột chuẩn Sample.xlsx mới)', () => {
  it('nhận diện đúng file mẫu chuẩn 7 cột', () => {
    const m = detectMetadataColumnMapping([
      'Khách Hàng',
      'Mã hàng',
      'Feature',
      'Số lượng đóng gói',
      'Trọng trượng/Cái',
      'Quy cách thùng',
      'Loại thùng',
    ])
    expect(m.customer).toBe('Khách Hàng')
    expect(m.ma_hang).toBe('Mã hàng')
    expect(m.feature).toBe('Feature')
    expect(m.pack_qty).toBe('Số lượng đóng gói')
    expect(m.weight_per_unit).toBe('Trọng trượng/Cái')
    expect(m.carton_spec).toBe('Quy cách thùng')
    expect(m.carton_type).toBe('Loại thùng')
  })

  it('nhận diện tiêu đề viết kiểu khác (không dấu / tiếng Anh)', () => {
    const m = detectMetadataColumnMapping(['CUSTOMER', 'MA HANG', 'FEATURE', 'QTY', 'WEIGHT', 'SPEC', 'TYPE'])
    expect(m.customer).toBe('CUSTOMER')
    expect(m.ma_hang).toBe('MA HANG')
    expect(m.feature).toBe('FEATURE')
    expect(m.pack_qty).toBe('QTY')
    expect(m.weight_per_unit).toBe('WEIGHT')
    expect(m.carton_spec).toBe('SPEC')
    expect(m.carton_type).toBe('TYPE')
  })

  it('tương thích file cũ 6 cột (chỉ có Mã hàng, không có Feature) -> feature để trống để fallback', () => {
    const m = detectMetadataColumnMapping([
      'Khách Hàng',
      'Mã hàng',
      'Số lượng đóng gói',
      'Trọng trượng/Cái',
      'Quy cách thùng',
      'Loại thùng',
    ])
    expect(m.ma_hang).toBe('Mã hàng')
    // feature trống -> mapRows fallback = ma_hang
    expect(m.pack_qty).toBe('Số lượng đóng gói')
  })
})

describe('normalizeMetadataNumber', () => {
  it('ép số và chuỗi số, chuỗi nghìn có dấu phẩy', () => {
    expect(normalizeMetadataNumber(220)).toBe(220)
    expect(normalizeMetadataNumber('1.48')).toBe(1.48)
    expect(normalizeMetadataNumber('1,480')).toBe(1480)
    expect(normalizeMetadataNumber('')).toBe(0)
    expect(normalizeMetadataNumber('abc')).toBe(0)
  })
})

describe('mapRowsToPackingSpecs (chuẩn 7 cột)', () => {
  const mapping: MetadataColumnMapping = {
    customer: 'Khách Hàng',
    ma_hang: 'Mã hàng',
    feature: 'Feature',
    pack_qty: 'Số lượng đóng gói',
    weight_per_unit: 'Trọng trượng/Cái',
    carton_spec: 'Quy cách thùng',
    carton_type: 'Loại thùng',
  }

  it('ánh xạ đúng và lọc dòng thiếu Khách hàng / Mã hàng / Feature / Số lượng', () => {
    const rows = mapRowsToPackingSpecs(
      [
        { 'Khách Hàng': 'Best Chair', 'Mã hàng': 8100920004, 'Feature': 1009, 'Số lượng đóng gói': 220, 'Trọng trượng/Cái': 1.48, 'Quy cách thùng': '1470*1135*925', 'Loại thùng': 'thùng đôi' },
        { 'Khách Hàng': '', 'Mã hàng': 'X', 'Feature': 'F', 'Số lượng đóng gói': 50 },
        { 'Khách Hàng': 'K', 'Mã hàng': '', 'Feature': 'F', 'Số lượng đóng gói': 50 },
        { 'Khách Hàng': 'K', 'Mã hàng': 'Y', 'Feature': 'G', 'Số lượng đóng gói': 0 },
      ],
      mapping,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      customer: 'Best Chair',
      ma_hang: '8100920004',
      feature: '1009',
      item_code: '1009',
      pack_qty: 220,
      weight_per_unit: 1.48,
      carton_spec: '1470*1135*925',
      carton_type: 'thùng đôi',
    })
  })

  it('chuẩn hóa Loại thùng Phụ kiện / carton box -> phụ kiện', () => {
    const rows = mapRowsToPackingSpecs(
      [
        { 'Khách Hàng': 'SM', 'Mã hàng': '1326810101', 'Feature': '1326810101', 'Số lượng đóng gói': 40, 'Trọng trượng/Cái': 0.666, 'Quy cách thùng': '475*230*140', 'Loại thùng': 'Phụ kiện ' },
        { 'Khách Hàng': 'SM', 'Mã hàng': 'X2', 'Feature': 'X2', 'Số lượng đóng gói': 10, 'Trọng trượng/Cái': 0, 'Quy cách thùng': 'A', 'Loại thùng': 'carton box' },
      ],
      mapping,
    )
    expect(rows[0].carton_type).toBe('phụ kiện')
    expect(rows[1].carton_type).toBe('phụ kiện')
  })

  it('fallback file cũ: thiếu Feature -> feature = ma_hang', () => {
    const oldMapping: MetadataColumnMapping = {
      customer: 'Khách Hàng',
      ma_hang: 'Mã hàng',
      feature: '',
      pack_qty: 'Số lượng đóng gói',
      weight_per_unit: '',
      carton_spec: '',
      carton_type: '',
    }
    const rows = mapRowsToPackingSpecs(
      [{ 'Khách Hàng': 'K', 'Mã hàng': '1009', 'Số lượng đóng gói': 50 }],
      oldMapping,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].feature).toBe('1009')
    expect(rows[0].ma_hang).toBe('1009')
  })
})
