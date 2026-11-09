import { describe, it, expect, beforeEach } from 'vitest'
import { supabase } from '@/services/supabase'
import { useShippingForecast } from './useShippingForecast'
import type { ForecastRawItem } from '@/utils/forecast'

/**
 * Fixture riêng của test (không dùng dữ liệu mẫu frontend — đã xóa).
 * Supabase rỗng => hiển thị rỗng; test tự nạp fixture vào memory và tự dọn dòng đã thêm.
 */
const fixtureRows = (): ForecastRawItem[] => [
  {
    id: '00000000-0000-0000-0000-000000000001',
    po: 'PO-T-FC-A',
    so: 'SO-T-01',
    container_no: 'CONT-A',
    item_code: '1220190004',
    feature: '1220',
    loading_date: '17/09/2026',
    qty: 4400,
    pcs_per_pkg: 200,
    pkg: 22,
    is_accessory: false,
    is_special: true,
    unit_type: 'kien',
    status: 'pending',
    status_changed_at: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    po: 'PO-T-FC-A',
    so: 'SO-T-01',
    container_no: 'CONT-A',
    item_code: '1220200004',
    feature: '1220',
    loading_date: '17/09/2026',
    qty: 4400,
    pcs_per_pkg: 200,
    pkg: 22,
    is_accessory: false,
    is_special: true,
    unit_type: 'kien',
    status: 'pending',
    status_changed_at: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    po: 'PO-T-FC-B',
    so: 'SO-T-02',
    container_no: 'CONT-B',
    item_code: '8515210204',
    feature: '5152',
    loading_date: '14/09/2026',
    qty: 1750,
    pcs_per_pkg: 70,
    pkg: 25,
    is_accessory: false,
    is_special: false,
    unit_type: 'kien',
    status: 'pending',
    status_changed_at: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    po: 'PO-T-FC-B',
    so: 'SO-T-02',
    container_no: 'CONT-B',
    item_code: '1325730001',
    feature: '1325730001',
    loading_date: '14/09/2026',
    qty: 1750,
    pcs_per_pkg: 25,
    pkg: 70,
    is_accessory: true,
    is_special: false,
    unit_type: 'thung',
    status: 'pending',
    status_changed_at: null,
  },
]

describe('useShippingForecast composable (chuẩn mới: 2 tab, cộng dồn, xóa thủ công)', () => {
  let composable: ReturnType<typeof useShippingForecast>

  beforeEach(async () => {
    // Dọn dòng tồn đọng từ bản test cũ (PO-NEW/SO-NEW) để không nhiễm DB dùng chung
    try {
      await supabase.from('shipping_forecast').delete().eq('po', 'PO-NEW').eq('so', 'SO-NEW')
    } catch {
      // bỏ qua lỗi dọn dẹp
    }
    composable = useShippingForecast()
    composable.clearAllData()
    composable.forecastItems.value = fixtureRows()
    composable.quickFilterText.value = ''
    composable.statusFilter.value = 'pending'
  })

  it('khởi tạo dữ liệu và tính toán phân nhóm container chính xác', () => {
    expect(composable.allGroupedContainers.value.length).toBe(2)
    const stats = composable.stats.value
    expect(stats.totalContainers).toBe(composable.allGroupedContainers.value.length)
    expect(stats.totalPkg).toBeGreaterThan(0)
    expect(stats.totalQty).toBeGreaterThan(0)
  })

  it('chỉ còn 2 tab pending/ready (bỏ Tất cả), mặc định pending', () => {
    expect(composable.statusFilter.value).toBe('pending')
    // Fixture đều pending -> filtered = all
    expect(composable.filteredContainers.value.length).toBe(composable.allGroupedContainers.value.length)
    composable.statusFilter.value = 'ready'
    expect(composable.filteredContainers.value.length).toBe(0)
  })

  it('lọc dữ liệu bằng quickFilterText và statusFilter', () => {
    composable.quickFilterText.value = 'PO-T-FC-A'
    expect(composable.filteredContainers.value.length).toBe(1)
    expect(composable.filteredContainers.value[0].po).toBe('PO-T-FC-A')

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

  it('cộng dồn khi thêm mới (không ghi đè cũ) và tự dọn dòng đã thêm', async () => {
    const uid = Math.random().toString(36).slice(2, 8).toUpperCase()
    const before = composable.forecastItems.value.length
    await composable.addForecastItems([
      { po: `PO-T-ADD-${uid}`, so: `SO-T-ADD-${uid}`, item_code: '8100920004', loading_date: '20/09/2026', qty: 100, pcs_per_pkg: 10 } as never,
    ])
    expect(composable.forecastItems.value.length).toBe(before + 1)
    await composable.deleteContainer(`PO-T-ADD-${uid}`, `SO-T-ADD-${uid}`)
    expect(composable.forecastItems.value.length).toBe(before)
  })

  it('xóa hàng loạt theo ids', async () => {
    const ids = composable.forecastItems.value.slice(0, 2).map((it) => String(it.id))
    await composable.deleteForecastItems(ids)
    ids.forEach((id) => {
      expect(composable.forecastItems.value.find((it) => it.id === id)).toBeUndefined()
    })
  })

  it('hoàn thành linh hoạt theo từng line (markItemsReady) và hoàn tác (revertItemsPending) đồng bộ cùng group', async () => {
    composable.forecastItems.value = [
      { id: 'demo-line-1', po: '437647', so: '2610000172', item_code: '8838210104', feature: '8382', loading_date: '15/09/2026', qty: 1000, warehouse: '60', pcs_per_pkg: 100, status: 'pending' },
      { id: 'demo-line-2', po: '437647', so: '2610000172', item_code: '8838310104', feature: '8383', loading_date: '15/09/2026', qty: 1000, warehouse: '60', pcs_per_pkg: 100, status: 'pending' },
      { id: 'demo-line-3', po: '437647', so: '2610000172', item_code: '8839310104', feature: '8393', loading_date: '15/09/2026', qty: 1000, warehouse: '1=01;43=60', pcs_per_pkg: 100, status: 'pending' },
    ]

    // Tích chọn chuẩn bị xong 1 mã 8393
    await composable.markItemsReady(['demo-line-3'])

    // Ở tab Chờ chuẩn bị: vẫn giữ group với 2 line (8382, 8383)
    composable.statusFilter.value = 'pending'
    expect(composable.filteredContainers.value.length).toBe(1)
    expect(composable.filteredContainers.value[0].featureGroups.map((f) => f.feature)).toEqual(['8382', '8383'])

    // Ở tab Đã xong: xuất hiện group với 1 line (8393) và hiển thị kho xuất tách đúng
    composable.statusFilter.value = 'ready'
    expect(composable.filteredContainers.value.length).toBe(1)
    expect(composable.filteredContainers.value[0].featureGroups.map((f) => f.feature)).toEqual(['8393'])
    expect(composable.filteredContainers.value[0].featureGroups[0].warehouseLabel).toBe('(1 kiện 01 - 43 kiện 60)')

    // Chuyển tiếp 2 mã còn lại sang Đã xong -> tự đồng bộ gộp vào group ở Đã xong, xóa group ở Chờ chuẩn bị
    await composable.markItemsReady(['demo-line-1', 'demo-line-2'])
    composable.statusFilter.value = 'pending'
    expect(composable.filteredContainers.value.length).toBe(0)
    composable.statusFilter.value = 'ready'
    expect(composable.filteredContainers.value.length).toBe(1)
    expect(composable.filteredContainers.value[0].featureGroups.map((f) => f.feature)).toEqual(['8382', '8383', '8393'])

    // Hoàn tác 1 line 8382 về Chờ chuẩn bị
    await composable.revertItemsPending(['demo-line-1'])
    composable.statusFilter.value = 'pending'
    expect(composable.filteredContainers.value.length).toBe(1)
    expect(composable.filteredContainers.value[0].featureGroups.map((f) => f.feature)).toEqual(['8382'])
    composable.statusFilter.value = 'ready'
    expect(composable.filteredContainers.value.length).toBe(1)
    expect(composable.filteredContainers.value[0].featureGroups.map((f) => f.feature)).toEqual(['8383', '8393'])
  })
})
