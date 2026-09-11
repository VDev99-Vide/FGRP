import { describe, it, expect, beforeEach } from 'vitest'
import { useShippingForecast } from './useShippingForecast'

describe('useShippingForecast composable', () => {
  let composable: ReturnType<typeof useShippingForecast>

  beforeEach(() => {
    composable = useShippingForecast()
    composable.quickFilterText.value = ''
    composable.statusFilter.value = 'all'
  })

  it('khởi tạo dữ liệu và tính toán phân nhóm container chính xác', () => {
    expect(composable.allGroupedContainers.value.length).toBeGreaterThan(0)
    const stats = composable.stats.value
    expect(stats.totalContainers).toBe(composable.allGroupedContainers.value.length)
    expect(stats.totalPkg).toBeGreaterThan(0)
    expect(stats.totalQty).toBeGreaterThan(0)
  })

  it('lọc dữ liệu bằng quickFilterText và statusFilter', () => {
    composable.quickFilterText.value = 'PO-9001'
    expect(composable.filteredContainers.value.length).toBe(1)
    expect(composable.filteredContainers.value[0].po).toBe('PO-9001')

    composable.quickFilterText.value = 'khong-ton-tai-123'
    expect(composable.filteredContainers.value.length).toBe(0)

    composable.quickFilterText.value = ''
    composable.statusFilter.value = 'ready'
    expect(composable.filteredContainers.value.length).toBe(0) // ban đầu đều là pending
  })

  it('đánh dấu container Chuẩn bị xong và khôi phục pending', async () => {
    const container = composable.allGroupedContainers.value[0]
    await composable.markContainerReady(container.po, container.so)

    const updated = composable.allGroupedContainers.value.find(c => c.po === container.po && c.so === container.so)
    expect(updated?.status).toBe('ready')
    expect(updated?.status_changed_at).not.toBeNull()

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
})
