import { describe, it, expect } from 'vitest'
import {
  detectMetadataColumnMapping,
  mapRowsToPackingSpecs,
  normalizeMetadataNumber,
  type MetadataColumnMapping,
} from './metadataExcel'

describe('detectMetadataColumnMapping (6 cột chuẩn Sample.xlsx)', () => {
  it('nhận diện đúng file mẫu chuẩn', () => {
    const m = detectMetadataColumnMapping([
      'Khách Hàng',
      'Mã hàng',
      'Số lượng đóng gói',
      'Trọng trượng/Cái',
      'Quy cách thùng',
      'Loại thùng',
    ])
    expect(m.customer).toBe('Khách Hàng')
    expect(m.item_code).toBe('Mã hàng')
    expect(m.pack_qty).toBe('Số lượng đóng gói')
    expect(m.weight_per_unit).toBe('Trọng trượng/Cái')
    expect(m.carton_spec).toBe('Quy cách thùng')
    expect(m.carton_type).toBe('Loại thùng')
  })

  it('nhận diện tiêu đề viết kiểu khác (không dấu / tiếng Anh)', () => {
    const m = detectMetadataColumnMapping(['CUSTOMER', 'ITEM CODE', 'QTY', 'WEIGHT', 'SPEC', 'TYPE'])
    expect(m.customer).toBe('CUSTOMER')
    expect(m.item_code).toBe('ITEM CODE')
    expect(m.pack_qty).toBe('QTY')
    expect(m.weight_per_unit).toBe('WEIGHT')
    expect(m.carton_spec).toBe('SPEC')
    expect(m.carton_type).toBe('TYPE')
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

describe('mapRowsToPackingSpecs', () => {
  const mapping: MetadataColumnMapping = {
    customer: 'Khách Hàng',
    item_code: 'Mã hàng',
    pack_qty: 'Số lượng đóng gói',
    weight_per_unit: 'Trọng trượng/Cái',
    carton_spec: 'Quy cách thùng',
    carton_type: 'Loại thùng',
  }

  it('ánh xạ đúng và lọc dòng thiếu Khách hàng / Mã hàng / Số lượng', () => {
    const rows = mapRowsToPackingSpecs(
      [
        { 'Khách Hàng': 'Best Chair', 'Mã hàng': 1009, 'Số lượng đóng gói': 220, 'Trọng trượng/Cái': 1.48, 'Quy cách thùng': '1470*1135*925', 'Loại thùng': 'thùng đôi' },
        { 'Khách Hàng': '', 'Mã hàng': 'X', 'Số lượng đóng gói': 50 },
        { 'Khách Hàng': 'K', 'Mã hàng': '', 'Số lượng đóng gói': 50 },
        { 'Khách Hàng': 'K', 'Mã hàng': 'Y', 'Số lượng đóng gói': 0 },
      ],
      mapping,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      customer: 'Best Chair',
      item_code: '1009',
      pack_qty: 220,
      weight_per_unit: 1.48,
      carton_spec: '1470*1135*925',
      carton_type: 'thùng đôi',
    })
  })
})
