import { describe, it, expect } from 'vitest'
import {
  validatePackingSpec,
  normalizePackingSpec,
  packingSpecKey,
  filterPackingSpecs,
} from './metadata'
import { PACKING_SPEC_SEED } from '@/services/metadataSeed'
import type { MetadataPacking } from '@/types'

describe('PACKING_SPEC_SEED (trích từ Sample.xlsx)', () => {
  it('đủ 136 dòng Quy cách, đúng 6 trường chuẩn', () => {
    expect(PACKING_SPEC_SEED.length).toBe(136)
    for (const r of PACKING_SPEC_SEED) {
      expect(r.customer).toBeTruthy()
      expect(r.item_code).toBeTruthy()
      expect(r.pack_qty).toBeGreaterThan(0)
    }
  })

  it('giữ đúng dòng đầu và dòng cuối của file gốc', () => {
    expect(PACKING_SPEC_SEED[0]).toMatchObject({ customer: 'Best Chair', pack_qty: 220 })
    expect(PACKING_SPEC_SEED[135]).toMatchObject({ customer: 'England', carton_type: 'carton box' })
  })
})

describe('validatePackingSpec', () => {
  const valid = {
    customer: 'Best Chair',
    item_code: '1009',
    pack_qty: 220,
    weight_per_unit: 1.48,
    carton_spec: '1470*1135*925',
    carton_type: 'thùng đôi',
  }

  it('dòng hợp lệ cho qua', () => {
    expect(validatePackingSpec(valid)).toBeNull()
  })

  it('bắt lỗi thiếu khách hàng / mã hàng / số lượng sai', () => {
    expect(validatePackingSpec({ ...valid, customer: '' })).toContain('Khách hàng')
    expect(validatePackingSpec({ ...valid, item_code: '' })).toContain('Mã hàng')
    expect(validatePackingSpec({ ...valid, pack_qty: 0 })).toContain('Số lượng đóng gói')
    expect(validatePackingSpec({ ...valid, weight_per_unit: -1 })).toContain('Trọng lượng')
  })
})

describe('normalizePackingSpec & packingSpecKey & filterPackingSpecs', () => {
  it('trim chuỗi và ép số', () => {
    const n = normalizePackingSpec({
      customer: '  Best Chair ',
      item_code: '1009',
      pack_qty: '220',
      weight_per_unit: '1.48',
      carton_spec: '',
      carton_type: '',
    })
    expect(n.customer).toBe('Best Chair')
    expect(n.pack_qty).toBe(220)
    expect(n.weight_per_unit).toBe(1.48)
  })

  it('khóa chống trùng không phân biệt hoa thường / khoảng trắng', () => {
    expect(
      packingSpecKey({ customer: 'Best Chair', item_code: '1009', carton_spec: 'A' }),
    ).toBe(packingSpecKey({ customer: '  best chair ', item_code: '1009', carton_spec: 'A' }))
  })

  it('lọc theo từ khóa trên 4 trường', () => {
    const rows: MetadataPacking[] = [
      { id: '1', customer: 'Best Chair', item_code: '1009', pack_qty: 220, weight_per_unit: 1, carton_spec: 'X', carton_type: 'thùng đôi' },
      { id: '2', customer: 'England', item_code: '7201940001', pack_qty: 60, weight_per_unit: 0.165, carton_spec: 'Y', carton_type: 'carton box' },
    ]
    expect(filterPackingSpecs(rows, 'england')).toHaveLength(1)
    expect(filterPackingSpecs(rows, 'thùng đôi')).toHaveLength(1)
    expect(filterPackingSpecs(rows, '')).toHaveLength(2)
    expect(filterPackingSpecs(rows, 'khong-co')).toHaveLength(0)
  })
})
