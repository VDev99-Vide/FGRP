import { describe, it, expect, beforeEach } from 'vitest'
import { useShippingForecast } from './useShippingForecast'

describe('useShippingForecast composable (chuẩn mới: 2 tab, cộng dồn, xóa thủ công)', () => {
  let composable: ReturnType<typeof useShippingForecast>

  beforeEach(() => {
    composable = useShippingForecast()
    composable.clearAllData()
    composable.seedDemoData()
    composable.quickFilterText.value = ''
    composable.statusFilter.value = 'pending'
  })

  it('khởi tạo dữ liệu và tính toán phân nhóm container chính xác', () => {
    expect(composable.allGroupedContainers.value.length).toBeGreaterThan(0)
    const stats = composable.stats.value
    expect(stats.totalContainers).toBe(composable.allGroupedContainers.value.length)
    expect(stats.totalPkg).toBeGreaterThan(0)
    expect(stats.totalQty).toBeGreaterThan(0)
  })

  it('chỉ còn 2 tab pending/ready (bỏ Tất cả), mặc định pending', () => {
    expect(composable.statusFilter.value).toBe('pending')
    // Demo data đều pending -> filtered = all
    expect(composable.filteredContainers.value.length).toBe(composable.allGroupedContainers.value.length)
    composable.statusFilter.value = 'ready'
    expect(composable.filteredContainers.value.length).toBe(0)
  })

  it('lọc dữ liệu bằng quickFilterText và statusFilter', () => {
    composable.quickFilterText.value = '0N64-0003004870'
    expect(composable.filteredContainers.value.length).toBe(1)
    expect(composable.filteredContainers.value[0].po).toBe('0N64-0003004870')

    composable.quickFilterText.value = 'khong-ton-tai-123'
    expect(composable.filteredContainers.value.length).toBe(0)

    composable.quickFilterText.value = ''
    composable.statusFilter.value = 'ready'
    expect(composable.filteredContainers.value.length).toBe(0) // ban đầu đều là pending
  })

  it('đánh dấu container Chuẩn bị xong tự nhảy qua tab Đã xong và khôi phục pending', async () => {
    const container = composable.allGroupedContainers.value[0]
    await composable.markContainerReady(container.po, container.so)

    const updated = composable.allGroupedContainers.value.find(c => c.po === container.po && c.so === container.so)
    expect(updated?.status).toBe('ready')
    expect(updated?.status_changed_at).not.toBeNull()
    // Tự nhảy qua tab Đã xong để tránh render lag
    expect(composable.statusFilter.value).toBe('ready')

    // Khôi phục lại pending
    await composable.revertContainerPending(container.po, container.so)
    const reverted = composable.allGroupedContainers.value.find(c => c.po === container.po && c.so === container.so)
    expect(reverted?.status).toBe('pending')
  })

  it('chỉnh sửa 1 dòng item trong forecast', async () => {
    const item = composable.forecastItems.value[0]
    const originalQty = item.qty
    await composable.editForecastItem({
      ...item,
      qty: originalQty + 100
    })

    const edited = composable.forecastItems.value.find(it => it.id === item.id)
    expect(edited?.qty).toBe(originalQty + 100)
  })

  it('cộng dồn khi thêm mới (không ghi đè cũ)', async () => {
    const before = composable.forecastItems.value.length
    await composable.addForecastItems([
      { po: 'PO-NEW', so: 'SO-NEW', item_code: '8100920004', loading_date: '20/09/2026', qty: 100, pcs_per_pkg: 10 } as never,
    ])
    expect(composable.forecastItems.value.length).toBe(before + 1)
  })

  it('xóa hàng loạt theo ids', async () => {
    const ids = composable.forecastItems.value.slice(0, 2).map((it) => String(it.id))
    await composable.deleteForecastItems(ids)
    ids.forEach((id) => {
      expect(composable.forecastItems.value.find((it) => it.id === id)).toBeUndefined()
    })
  })
})
