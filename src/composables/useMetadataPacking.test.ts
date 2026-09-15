import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useMetadataPacking } from './useMetadataPacking'

/**
 * Môi trường test có Supabase thật: mỗi test dùng mã hàng duy nhất
 * và tự dọn dẹp sau khi chạy để không nhiễm DB dùng chung.
 */
describe('useMetadataPacking composable', () => {
  let meta: ReturnType<typeof useMetadataPacking>
  let uid: string
  let createdIds: string[]

  const itemCode = (prefix: string) => `${prefix}-${uid}`

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

  it('thêm / sửa / xóa 1 dòng quy cách', async () => {
    const created = await meta.createPackingSpec({
      customer: 'KH TEST',
      item_code: itemCode('MT'),
      pack_qty: 100,
      weight_per_unit: 1.5,
      carton_spec: '100*100*100',
      carton_type: 'thùng đơn',
    })
    createdIds.push(created.id)
    expect(meta.rows.value).toHaveLength(1)

    const updated = await meta.updatePackingSpec(created.id, {
      customer: 'KH TEST 2',
      item_code: itemCode('MT'),
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

  it('validate chặn thiếu khách hàng / mã hàng / số lượng sai', async () => {
    await expect(
      meta.createPackingSpec({ customer: '', item_code: 'X', pack_qty: 10, weight_per_unit: 1, carton_spec: '', carton_type: '' }),
    ).rejects.toThrow('Khách hàng')
    await expect(
      meta.createPackingSpec({ customer: 'K', item_code: '', pack_qty: 10, weight_per_unit: 1, carton_spec: '', carton_type: '' }),
    ).rejects.toThrow('Mã hàng')
    await expect(
      meta.createPackingSpec({ customer: 'K', item_code: 'X', pack_qty: 0, weight_per_unit: 1, carton_spec: '', carton_type: '' }),
    ).rejects.toThrow('Số lượng đóng gói')
  })

  it('seed 136 dòng mẫu: chỉ track đúng dòng test tạo, lần 2 trùng khóa thì bỏ qua', async () => {
    const before = new Set(meta.rows.value.map((r) => r.id))
    const first = await meta.seedSampleData()
    const freshIds = meta.rows.value.map((r) => r.id).filter((id) => !before.has(id))
    createdIds.push(...freshIds)
    expect(first.imported).toBe(freshIds.length)
    expect(first.imported + first.skipped).toBe(136)

    const second = await meta.seedSampleData()
    expect(second.imported).toBe(0)
  })

  it('lọc theo từ khóa khách hàng / mã hàng', async () => {
    const a = await meta.createPackingSpec({
      customer: 'KH LOCA',
      item_code: itemCode('LA'),
      pack_qty: 10,
      weight_per_unit: 1,
      carton_spec: 'A',
      carton_type: 'B',
    })
    const b = await meta.createPackingSpec({
      customer: 'KH LOCB',
      item_code: itemCode('LB'),
      pack_qty: 10,
      weight_per_unit: 1,
      carton_spec: 'A',
      carton_type: 'B',
    })
    createdIds.push(a.id, b.id)

    meta.searchText.value = 'loca'
    expect(meta.filteredRows.value).toHaveLength(1)
    meta.searchText.value = ''
    expect(meta.filteredRows.value.length).toBeGreaterThanOrEqual(2)
  })
})
