import { describe, it, expect } from 'vitest'
import {
  validatePackingSpec,
  normalizePackingSpec,
  packingSpecKey,
  filterPackingSpecs,
  normalizeCartonType,
  stringifyMaHang,
} from './metadata'
import type { MetadataPacking } from '@/types'

describe('normalizeCartonType (chuẩn hóa 3 loại)', () => {
  it('thùng đơn / thùng đôi giữ chuẩn', () => {
    expect(normalizeCartonType('thùng đôi')).toBe('thùng đôi')
    expect(normalizeCartonType('thùng đơn')).toBe('thùng đơn')
  })
  it('Phụ kiện (thừa space), carton box, Plywood box -> phụ kiện', () => {
    expect(normalizeCartonType('Phụ kiện ')).toBe('phụ kiện')
    expect(normalizeCartonType('carton box')).toBe('phụ kiện')
    expect(normalizeCartonType('Plywood box')).toBe('phụ kiện')
  })
  it('loại mới không khóa cứng, giữ nguyên trim', () => {
    expect(normalizeCartonType('  thùng gỗ mới ')).toBe('thùng gỗ mới')
  })
})

describe('stringifyMaHang', () => {
  it('số Excel -> string không mất số', () => {
    expect(stringifyMaHang(8100920004)).toBe('8100920004')
    expect(stringifyMaHang(' 8101010104 ')).toBe('8101010104')
  })
})

describe('validatePackingSpec (chuẩn 7 cột)', () => {
  const valid = {
    customer: 'Best Chair',
    ma_hang: '8100920004',
    feature: '1009',
    pack_qty: 220,
    weight_per_unit: 1.48,
    carton_spec: '1470*1135*925',
    carton_type: 'thùng đôi',
  }

  it('dòng hợp lệ cho qua', () => {
    expect(validatePackingSpec(valid)).toBeNull()
  })

  it('tương thích input cũ chỉ có item_code', () => {
    expect(validatePackingSpec({ customer: 'K', item_code: '1009', pack_qty: 10, weight_per_unit: 0, carton_spec: '', carton_type: '' })).toBeNull()
  })

  it('bắt lỗi thiếu khách hàng / mã hàng / feature / số lượng sai', () => {
    expect(validatePackingSpec({ ...valid, customer: '' })).toContain('Khách hàng')
    expect(validatePackingSpec({ ...valid, ma_hang: '', feature: '', item_code: '' })).toContain('Mã hàng')
    expect(validatePackingSpec({ customer: 'K', ma_hang: 'X', feature: '', item_code: '', pack_qty: 10, weight_per_unit: 0, carton_spec: '', carton_type: '' })).toContain('Feature')
    expect(validatePackingSpec({ ...valid, pack_qty: 0 })).toContain('Số lượng đóng gói')
    expect(validatePackingSpec({ ...valid, weight_per_unit: -1 })).toContain('Trọng lượng')
  })
})

describe('normalizePackingSpec & packingSpecKey & filterPackingSpecs', () => {
  it('trim chuỗi, ép số, chuẩn hóa loại thùng, giữ item_code = feature', () => {
    const n = normalizePackingSpec({
      customer: '  Best Chair ',
      ma_hang: 8100920004 as unknown as string,
      feature: '1009',
      pack_qty: '220',
      weight_per_unit: '1.48',
      carton_spec: '',
      carton_type: 'Phụ kiện ',
    })
    expect(n.customer).toBe('Best Chair')
    expect(n.ma_hang).toBe('8100920004')
    expect(n.feature).toBe('1009')
    expect(n.item_code).toBe('1009')
    expect(n.pack_qty).toBe(220)
    expect(n.weight_per_unit).toBe(1.48)
    expect(n.carton_type).toBe('phụ kiện')
  })

  it('khóa chống trùng gồm KH + Mã hàng + Feature + Quy cách + Loại (1010 đơn/đôi khác nhau)', () => {
    const base = { customer: 'S', ma_hang: '8101010104', feature: '1010', carton_spec: 'A', carton_type: 'thùng đôi' }
    const same = { customer: '  s ', ma_hang: '8101010104', feature: '1010', carton_spec: 'A', carton_type: 'thùng đôi' }
    const diffType = { ...base, carton_type: 'thùng đơn', carton_spec: 'B' }
    expect(packingSpecKey(base)).toBe(packingSpecKey(same))
    expect(packingSpecKey(base)).not.toBe(packingSpecKey(diffType))
  })

  it('lọc theo từ khóa trên 6 trường (KH / mã / feature / quy cách / loại)', () => {
    const rows: MetadataPacking[] = [
      { id: '1', customer: 'Best Chair', ma_hang: '8100920004', feature: '1009', item_code: '1009', pack_qty: 220, weight_per_unit: 1, carton_spec: 'X', carton_type: 'thùng đôi' },
      { id: '2', customer: 'Southern Motion', ma_hang: '1326810101', feature: '1326810101', item_code: '1326810101', pack_qty: 40, weight_per_unit: 0.666, carton_spec: 'Y', carton_type: 'phụ kiện' },
    ]
    expect(filterPackingSpecs(rows, '8100920004')).toHaveLength(1)
    expect(filterPackingSpecs(rows, '1009')).toHaveLength(1)
    expect(filterPackingSpecs(rows, 'phụ kiện')).toHaveLength(1)
    expect(filterPackingSpecs(rows, '')).toHaveLength(2)
    expect(filterPackingSpecs(rows, 'khong-co')).toHaveLength(0)
  })
})
