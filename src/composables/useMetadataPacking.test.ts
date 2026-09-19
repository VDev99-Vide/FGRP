import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useMetadataPacking } from './useMetadataPacking'

/**
 * Môi trường test có Supabase thật: mỗi test dùng mã hàng duy nhất
 * và tự dọn dẹp sau khi chạy để không nhiễm DB dùng chung.
 */
describe('useMetadataPacking composable (chuẩn 7 cột, lưu trực tiếp Supabase)', () => {
  let meta: ReturnType<typeof useMetadataPacking>
  let uid: string
  let createdIds: string[]

  const maHang = (prefix: string) => `${prefix}${uid}01`

  beforeEach(() => {
    meta = useMetadataPacking()
    meta.clearMemory()
    meta.searchText.value = ''
    uid = Math.random().toString(36).slice(2, 8).toUpperCase()
    createdIds = []
  })

  afterEach(async () => {
    for (const id of createdIds) {
      try {
        await meta.deletePackingSpec(id)
      } catch {
        // bỏ qua lỗi dọn dẹp
      }
    }
    meta.clearMemory()
  })

  it('thêm / sửa / xóa 1 dòng quy cách chuẩn mới (Mã hàng + Feature)', async () => {
    const created = await meta.createPackingSpec({
      customer: 'KH TEST',
      ma_hang: maHang('MT'),
      feature: 'FT1010',
      pack_qty: 100,
      weight_per_unit: 1.5,
      carton_spec: '100*100*100',
      carton_type: 'thùng đơn',
    })
    createdIds.push(created.id)
    expect(meta.rows.value).toHaveLength(1)
    expect(created.ma_hang).toBe(maHang('MT'))
    expect(created.feature).toBe('FT1010')

    const updated = await meta.updatePackingSpec(created.id, {
      customer: 'KH TEST 2',
      ma_hang: maHang('MT'),
      feature: 'FT1010',
      pack_qty: 200,
      weight_per_unit: 2,
      carton_spec: '200*200*200',
      carton_type: 'thùng đôi',
    })
    expect(updated.customer).toBe('KH TEST 2')
    expect(updated.pack_qty).toBe(200)

    await meta.deletePackingSpec(created.id)
    createdIds = createdIds.filter((id) => id !== created.id)
    expect(meta.rows.value).toHaveLength(0)
  })

  it('validate chặn thiếu khách hàng / mã hàng / feature / số lượng sai', async () => {
    await expect(
      meta.createPackingSpec({ customer: '', ma_hang: 'X', feature: 'F', pack_qty: 10, weight_per_unit: 1, carton_spec: '', carton_type: '' }),
    ).rejects.toThrow('Khách hàng')
    await expect(
      meta.createPackingSpec({ customer: 'K', ma_hang: '', feature: '', item_code: '', pack_qty: 10, weight_per_unit: 1, carton_spec: '', carton_type: '' }),
    ).rejects.toThrow('Mã hàng')
    await expect(
      meta.createPackingSpec({ customer: 'K', ma_hang: 'X', feature: '', item_code: '', pack_qty: 10, weight_per_unit: 1, carton_spec: '', carton_type: '' }),
    ).rejects.toThrow('Feature')
    await expect(
      meta.createPackingSpec({ customer: 'K', ma_hang: 'X', feature: 'F', pack_qty: 0, weight_per_unit: 1, carton_spec: '', carton_type: '' }),
    ).rejects.toThrow('Số lượng đóng gói')
  })

  it('import Excel: dòng mới thì thêm, trùng khóa và sai thì bỏ qua (1010 đơn/đôi khác khóa)', async () => {
    const first = await meta.createPackingSpec({
      customer: 'KH IMP',
      ma_hang: maHang('IM1'),
      feature: 'FIM1',
      pack_qty: 50,
      weight_per_unit: 1,
      carton_spec: 'S1',
      carton_type: 'thùng đôi',
    })
    createdIds.push(first.id)

    const res = await meta.importPackingSpecs([
      { customer: 'KH IMP', ma_hang: maHang('IM1'), feature: 'FIM1', item_code: 'FIM1', pack_qty: 50, weight_per_unit: 1, carton_spec: 'S1', carton_type: 'thùng đôi' },
      { customer: 'KH IMP', ma_hang: maHang('IM2'), feature: 'FIM2', item_code: 'FIM2', pack_qty: 70, weight_per_unit: 2, carton_spec: 'S2', carton_type: 'thùng đơn' },
      { customer: '', ma_hang: maHang('IM3'), feature: 'F', item_code: 'F', pack_qty: 10, weight_per_unit: 1, carton_spec: '', carton_type: '' },
    ])
    const imp2 = meta.rows.value.find((r) => r.ma_hang === maHang('IM2'))
    if (imp2) createdIds.push(imp2.id)
    expect(res.imported).toBe(1)
    expect(res.skipped).toHaveLength(2)
    expect(imp2?.pack_qty).toBe(70)
  })

  it('lọc theo từ khóa khách hàng / mã hàng / feature', async () => {
    const a = await meta.createPackingSpec({
      customer: 'KH LOCA',
      ma_hang: maHang('LA'),
      feature: 'FEATA',
      pack_qty: 10,
      weight_per_unit: 1,
      carton_spec: 'A',
      carton_type: 'B',
    })
    const b = await meta.createPackingSpec({
      customer: 'KH LOCB',
      ma_hang: maHang('LB'),
      feature: 'FEATB',
      pack_qty: 10,
      weight_per_unit: 1,
      carton_spec: 'A',
      carton_type: 'B',
    })
    createdIds.push(a.id, b.id)

    meta.searchText.value = 'loca'
    expect(meta.filteredRows.value).toHaveLength(1)
    meta.searchText.value = maHang('LA').toLowerCase()
    expect(meta.filteredRows.value).toHaveLength(1)
    meta.searchText.value = ''
    expect(meta.filteredRows.value.length).toBeGreaterThanOrEqual(2)
  })
})
