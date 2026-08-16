import { ref, computed } from 'vue'
import { supabase, isSupabaseConfigured } from '@/services/supabase'
import { 
  getMockAccessories, 
  saveMockAccessories 
} from '@/services/mockData'
import { HangPhuKienRow } from '@/types'

export function useAccessories() {
  const loading = ref(false)
  const isDemoMode = ref(!isSupabaseConfigured)
  const accessoriesData = ref<HangPhuKienRow[]>([])
  const pkFilter = ref('')

  // Danh sách các mã phụ kiện không trùng để phục vụ dropdown autocomplete gợi ý
  const uniqueCodes = computed(() => {
    const codes = accessoriesData.value.map(a => a.code).filter(Boolean)
    return Array.from(new Set(codes))
  })

  const filteredPkData = computed(() => {
    if (!pkFilter.value) return accessoriesData.value
    const kw = pkFilter.value.toLowerCase()
    return accessoriesData.value.filter(
      r =>
        r.code.toLowerCase().includes(kw) ||
        (r.bin && r.bin.toLowerCase().includes(kw))
    )
  })

  const fetchAccessories = async () => {
    loading.value = true
    try {
      if (!isSupabaseConfigured) {
        isDemoMode.value = true
        accessoriesData.value = getMockAccessories()
        return
      }

      const { data, error } = await supabase
        .from('hang_phu_kien')
        .select('*')
        .order('code', { ascending: true })

      if (error) {
        console.warn('Supabase hang_phu_kien query failed, falling back to mock data:', error)
        isDemoMode.value = true
        accessoriesData.value = getMockAccessories()
      } else {
        isDemoMode.value = false
        accessoriesData.value = (data || []) as HangPhuKienRow[]
      }
    } catch (e: any) {
      console.warn('Lỗi kết nối Supabase phụ kiện, sử dụng dữ liệu mẫu:', e)
      isDemoMode.value = true
      accessoriesData.value = getMockAccessories()
    } finally {
      loading.value = false
    }
  }

  // Nhập kho phụ kiện
  const inboundAccessory = async (code: string, qty: number, bin: string) => {
    loading.value = true
    try {
      if (isDemoMode.value || !isSupabaseConfigured) {
        const local = getMockAccessories()
        const existing = local.find(
          a => a.code.toLowerCase() === code.trim().toLowerCase() && 
               a.bin.toLowerCase() === bin.trim().toLowerCase()
        )
        if (existing) {
          existing.qty = Number(existing.qty) + qty
          existing.updated_at = new Date().toISOString()
        } else {
          local.unshift({
            id: 'mock-acc-' + Date.now(),
            code: code.trim().toUpperCase(),
            qty,
            bin: bin.trim().toUpperCase(),
            created_at: new Date().toISOString()
          })
        }
        saveMockAccessories(local)
        accessoriesData.value = local
        return
      }

      // Live Supabase
      const { data: exist, error: fetchErr } = await supabase
        .from('hang_phu_kien')
        .select('*')
        .eq('code', code)
        .eq('bin', bin)
        .maybeSingle()

      if (fetchErr) throw fetchErr

      if (exist) {
        const { error: updateErr } = await supabase
          .from('hang_phu_kien')
          .update({ qty: Number(exist.qty) + qty })
          .eq('id', exist.id)
        if (updateErr) throw updateErr
      } else {
        const { error: insertErr } = await supabase
          .from('hang_phu_kien')
          .insert([{ code, qty, bin }])
        if (insertErr) throw insertErr
      }
      await fetchAccessories()
    } catch (e: any) {
      console.error(e)
      throw new Error(e.message || 'Lỗi nhập phụ kiện')
    } finally {
      loading.value = false
    }
  }

  // Chỉnh sửa phụ kiện
  const editAccessory = async (id: string, code: string, qty: number, bin: string) => {
    loading.value = true
    try {
      if (isDemoMode.value || !isSupabaseConfigured) {
        const local = getMockAccessories()
        const target = local.find(a => a.id === id)
        if (target) {
          target.code = code.trim().toUpperCase()
          target.qty = qty
          target.bin = bin.trim().toUpperCase()
          target.updated_at = new Date().toISOString()
          saveMockAccessories(local)
          accessoriesData.value = local
        }
        return
      }

      // Live Supabase
      const { error } = await supabase
        .from('hang_phu_kien')
        .update({ code, qty, bin })
        .eq('id', id)
      if (error) throw error
      await fetchAccessories()
    } catch (e: any) {
      console.error(e)
      throw new Error(e.message || 'Lỗi cập nhật phụ kiện')
    } finally {
      loading.value = false
    }
  }

  // Xuất kho phụ kiện (Toàn bộ)
  const deleteAccessory = async (id: string) => {
    loading.value = true
    try {
      if (isDemoMode.value || !isSupabaseConfigured) {
        const local = getMockAccessories()
        const filtered = local.filter(a => a.id !== id)
        saveMockAccessories(filtered)
        accessoriesData.value = filtered
        return
      }

      // Live Supabase
      const { error } = await supabase
        .from('hang_phu_kien')
        .delete()
        .eq('id', id)
      if (error) throw error
      await fetchAccessories()
    } catch (e: any) {
      console.error(e)
      throw new Error(e.message || 'Lỗi xuất phụ kiện')
    } finally {
      loading.value = false
    }
  }

  // Xuất một phần phụ kiện
  const outboundAccessoryPartial = async (id: string, currentQty: number, outQty: number) => {
    loading.value = true
    try {
      const remaining = currentQty - outQty
      if (remaining < 0) {
        throw new Error('Số lượng xuất vượt quá tồn kho hiện tại!')
      }

      if (isDemoMode.value || !isSupabaseConfigured) {
        const local = getMockAccessories()
        if (remaining === 0) {
          const filtered = local.filter(a => a.id !== id)
          saveMockAccessories(filtered)
          accessoriesData.value = filtered
        } else {
          const target = local.find(a => a.id === id)
          if (target) {
            target.qty = remaining
            target.updated_at = new Date().toISOString()
            saveMockAccessories(local)
            accessoriesData.value = local
          }
        }
        return
      }

      // Live Supabase
      if (remaining === 0) {
        const { error } = await supabase
          .from('hang_phu_kien')
          .delete()
          .eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('hang_phu_kien')
          .update({ qty: remaining })
          .eq('id', id)
        if (error) throw error
      }
      await fetchAccessories()
    } catch (e: any) {
      console.error(e)
      throw new Error(e.message || 'Lỗi xuất một phần phụ kiện')
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    isDemoMode,
    accessoriesData,
    pkFilter,
    uniqueCodes,
    filteredPkData,
    fetchAccessories,
    inboundAccessory,
    editAccessory,
    deleteAccessory,
    outboundAccessoryPartial
  }
}
