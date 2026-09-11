import { ref, computed } from 'vue'
import { supabase, isSupabaseConfigured } from '@/services/supabase'
import { 
  ForecastRawItem, 
  ForecastContainerGroup,
  groupAndSortForecastData, 
  filterOutExpiredItems,
  extractFeatureFromItemCode
} from '@/utils/forecast'

// Dữ liệu mẫu ban đầu trong bộ nhớ (In-memory Demo Data) khi chưa cấu hình Supabase
// TUYỆT ĐỐI KHÔNG DÙNG LOCALSTORAGE theo đúng yêu cầu người dùng: "đồng bộ trực tiếp supabase không lưu localstorage tránh cache"
const DEFAULT_IN_MEMORY_FORECAST: ForecastRawItem[] = [
  // Container 1: PO-9001, SO-4001, Ngày 15/09/2026. Cặp mã hàng Feature 1632
  {
    id: 'demo-fc-01',
    po: 'PO-9001',
    so: 'SO-4001',
    container_no: 'TGHU-882103',
    item_code: '8163210604',
    feature: '1632',
    loading_date: '15/09/2026',
    qty: 480,
    pcs_per_pkg: 240,
    pkg: 2,
    status: 'pending',
    status_changed_at: null,
    created_at: new Date().toISOString()
  },
  {
    id: 'demo-fc-02',
    po: 'PO-9001',
    so: 'SO-4001',
    container_no: 'TGHU-882103',
    item_code: '8163220604',
    feature: '1632',
    loading_date: '15/09/2026',
    qty: 480,
    pcs_per_pkg: 240,
    pkg: 2,
    status: 'pending',
    status_changed_at: null,
    created_at: new Date().toISOString()
  },

  // Container 2: PO-9002, SO-4002, Ngày 18/09/2026. Cặp mã hàng Feature 5152
  {
    id: 'demo-fc-03',
    po: 'PO-9002',
    so: 'SO-4002',
    container_no: 'MSKU-551920',
    item_code: '8515210204',
    feature: '5152',
    loading_date: '18/09/2026',
    qty: 500,
    pcs_per_pkg: 250,
    pkg: 2,
    status: 'pending',
    status_changed_at: null,
    created_at: new Date().toISOString()
  },
  {
    id: 'demo-fc-04',
    po: 'PO-9002',
    so: 'SO-4002',
    container_no: 'MSKU-551920',
    item_code: '8515220204',
    feature: '5152',
    loading_date: '18/09/2026',
    qty: 500,
    pcs_per_pkg: 250,
    pkg: 2,
    status: 'pending',
    status_changed_at: null,
    created_at: new Date().toISOString()
  },

  // Container 3: PO-9003, SO-4003, Ngày 22/09/2026. Mã hàng 1220190004 & 1220200004
  {
    id: 'demo-fc-05',
    po: 'PO-9003',
    so: 'SO-4003',
    container_no: 'CMAU-112098',
    item_code: '1220190004',
    feature: '2201',
    loading_date: '22/09/2026',
    qty: 360,
    pcs_per_pkg: 180,
    pkg: 2,
    status: 'pending',
    status_changed_at: null,
    created_at: new Date().toISOString()
  },
  {
    id: 'demo-fc-06',
    po: 'PO-9003',
    so: 'SO-4003',
    container_no: 'CMAU-112098',
    item_code: '1220200004',
    feature: '2202',
    loading_date: '22/09/2026',
    qty: 360,
    pcs_per_pkg: 180,
    pkg: 2,
    status: 'pending',
    status_changed_at: null,
    created_at: new Date().toISOString()
  }
]

// State lưu trữ dữ liệu trong session
const forecastItems = ref<ForecastRawItem[]>([...DEFAULT_IN_MEMORY_FORECAST])
const loading = ref(false)
const quickFilterText = ref('')
const statusFilter = ref<'all' | 'pending' | 'ready'>('all')
const lastSync = ref('--:--')

export function useShippingForecast() {
  const isDemoMode = ref(!isSupabaseConfigured)

  /**
   * Tự động xóa các đơn hàng 'ready' quá 1 ngày (24 giờ)
   */
  const cleanupExpiredItems = async () => {
    // 1. Dọn dẹp trong bộ nhớ frontend
    forecastItems.value = filterOutExpiredItems(forecastItems.value)

    // 2. Dọn dẹp trên Supabase nếu đã kết nối
    if (isSupabaseConfigured) {
      try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        await supabase
          .from('shipping_forecast')
          .delete()
          .eq('status', 'ready')
          .not('status_changed_at', 'is', null)
          .lt('status_changed_at', oneDayAgo)
      } catch (e) {
        console.warn('Không thể tự động xóa đơn quá hạn trên Supabase:', e)
      }
    }
  }

  /**
   * Tải toàn bộ danh sách xuất hàng dự kiến từ Supabase
   */
  const fetchForecast = async () => {
    loading.value = true
    try {
      await cleanupExpiredItems()

      if (!isSupabaseConfigured) {
        isDemoMode.value = true
        lastSync.value = new Date().toLocaleTimeString('vi-VN')
        return
      }

      // Live Supabase
      const { data, error } = await supabase
        .from('shipping_forecast')
        .select('*')
        .order('loading_date', { ascending: true })

      if (error) throw error

      if (data && data.length > 0) {
        forecastItems.value = filterOutExpiredItems(data as ForecastRawItem[])
        isDemoMode.value = false
      } else {
        // Nếu bảng trống, giữ dữ liệu mẫu trong ram
        forecastItems.value = filterOutExpiredItems(forecastItems.value)
      }

      lastSync.value = new Date().toLocaleTimeString('vi-VN')
    } catch (err: any) {
      console.warn('Lỗi kết nối Supabase cho shipping_forecast, sử dụng dữ liệu bộ nhớ:', err)
      isDemoMode.value = true
      forecastItems.value = filterOutExpiredItems(forecastItems.value)
      lastSync.value = new Date().toLocaleTimeString('vi-VN')
    } finally {
      loading.value = false
    }
  }

  /**
   * Thêm mới / Nạp dữ liệu danh sách xuất hàng từ Excel
   */
  const addForecastItems = async (items: ForecastRawItem[]) => {
    loading.value = true
    try {
      const preparedItems = items.map(it => {
        const feature = it.feature || extractFeatureFromItemCode(it.item_code)
        return {
          id: it.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `fc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`),
          po: (it.po || '').trim(),
          so: (it.so || '').trim(),
          container_no: (it.container_no || '').trim(),
          item_code: (it.item_code || '').trim(),
          feature,
          loading_date: (it.loading_date || '').trim(),
          qty: Number(it.qty) || 0,
          pcs_per_pkg: Number(it.pcs_per_pkg) || 0,
          pkg: Number(it.pkg) || 0,
          status: (it.status || 'pending') as 'pending' | 'ready',
          status_changed_at: it.status_changed_at || null,
          created_at: it.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      })

      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('shipping_forecast')
          .insert(preparedItems)

        if (error) throw error
      }

      // Cập nhật bộ nhớ frontend
      forecastItems.value = [...preparedItems, ...forecastItems.value]
      lastSync.value = new Date().toLocaleTimeString('vi-VN')
      return true
    } catch (err: any) {
      console.error('Lỗi thêm dữ liệu xuất hàng dự kiến:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Chỉnh sửa thông tin 1 dòng trong danh sách
   */
  const editForecastItem = async (updatedItem: ForecastRawItem) => {
    loading.value = true
    try {
      const feature = extractFeatureFromItemCode(updatedItem.item_code)
      const payload = {
        ...updatedItem,
        feature,
        updated_at: new Date().toISOString()
      }

      if (isSupabaseConfigured && updatedItem.id && !updatedItem.id.startsWith('demo-')) {
        const { error } = await supabase
          .from('shipping_forecast')
          .update(payload)
          .eq('id', updatedItem.id)

        if (error) throw error
      }

      // Cập nhật in-memory
      const idx = forecastItems.value.findIndex(it => it.id === updatedItem.id)
      if (idx !== -1) {
        forecastItems.value[idx] = payload
        forecastItems.value = [...forecastItems.value]
      }
      return true
    } catch (err: any) {
      console.error('Lỗi cập nhật dòng xuất hàng:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Xóa 1 dòng khỏi danh sách
   */
  const deleteForecastItem = async (id: string) => {
    loading.value = true
    try {
      if (isSupabaseConfigured && id && !id.startsWith('demo-')) {
        const { error } = await supabase
          .from('shipping_forecast')
          .delete()
          .eq('id', id)

        if (error) throw error
      }

      forecastItems.value = forecastItems.value.filter(it => it.id !== id)
      return true
    } catch (err: any) {
      console.error('Lỗi xóa dòng xuất hàng:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Đánh dấu Container "Chuẩn bị xong"
   * Chuyển trạng thái sang 'ready', ghi nhận status_changed_at và bắt đầu đếm ngược 1 ngày tự xóa
   */
  const markContainerReady = async (po: string, so: string) => {
    const nowIso = new Date().toISOString()
    const targetItems = forecastItems.value.filter(it => it.po === po && it.so === so)
    if (targetItems.length === 0) return

    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('shipping_forecast')
        .update({
          status: 'ready',
          status_changed_at: nowIso,
          updated_at: nowIso
        })
        .eq('po', po)
        .eq('so', so)

      if (error) throw error
    }

    targetItems.forEach(it => {
      it.status = 'ready'
      it.status_changed_at = nowIso
    })
    forecastItems.value = [...forecastItems.value]
  }

  /**
   * Khôi phục trạng thái Container về "Chờ chuẩn bị" (pending)
   */
  const revertContainerPending = async (po: string, so: string) => {
    const targetItems = forecastItems.value.filter(it => it.po === po && it.so === so)
    if (targetItems.length === 0) return

    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('shipping_forecast')
        .update({
          status: 'pending',
          status_changed_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('po', po)
        .eq('so', so)

      if (error) throw error
    }

    targetItems.forEach(it => {
      it.status = 'pending'
      it.status_changed_at = null
    })
    forecastItems.value = [...forecastItems.value]
  }

  // Phân nhóm và sắp xếp toàn bộ dữ liệu
  const allGroupedContainers = computed<ForecastContainerGroup[]>(() => {
    return groupAndSortForecastData(forecastItems.value)
  })

  // Dữ liệu lọc thông minh
  const filteredContainers = computed<ForecastContainerGroup[]>(() => {
    const q = quickFilterText.value.toLowerCase().trim()
    const status = statusFilter.value

    return allGroupedContainers.value.filter(container => {
      // Lọc theo trạng thái
      if (status !== 'all' && container.status !== status) {
        return false
      }

      // Lọc theo từ khóa tìm kiếm
      if (!q) return true

      const containerSearchStr = [
        container.po,
        container.so,
        container.container_no,
        container.loading_date,
        container.status === 'ready' ? 'chuẩn bị xong ready' : 'chờ chuẩn bị pending'
      ].join(' ').toLowerCase()

      if (containerSearchStr.includes(q)) return true

      // Kiểm tra xem có mã hàng hay feature con nào khớp không
      const hasMatchingChild = container.allItems.some(item => {
        const itemStr = [
          item.item_code,
          item.feature,
          item.po,
          item.so
        ].join(' ').toLowerCase()
        return itemStr.includes(q)
      })

      return hasMatchingChild
    })
  })

  // Thống kê tổng hợp
  const stats = computed(() => {
    const containers = allGroupedContainers.value
    const totalContainers = containers.length
    const totalPkg = containers.reduce((s, c) => s + c.totalPkg, 0)
    const totalQty = containers.reduce((s, c) => s + c.totalQty, 0)
    const pendingCount = containers.filter(c => c.status === 'pending').length
    const readyCount = containers.filter(c => c.status === 'ready').length

    return {
      totalContainers,
      totalPkg: Math.round(totalPkg * 100) / 100,
      totalQty,
      pendingCount,
      readyCount
    }
  })

  return {
    forecastItems,
    loading,
    isDemoMode,
    lastSync,
    quickFilterText,
    statusFilter,
    stats,
    allGroupedContainers,
    filteredContainers,
    fetchForecast,
    cleanupExpiredItems,
    addForecastItems,
    editForecastItem,
    deleteForecastItem,
    markContainerReady,
    revertContainerPending
  }
}
