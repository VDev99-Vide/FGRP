import { ref, reactive } from 'vue'
import { supabase } from '@/services/supabase'
import { InventoryRow, SummaryAnalysisRow, KpiState, AnalysisState } from '@/types'

export function useInventory() {
  const loading = ref(false)
  const inventoryData = ref<InventoryRow[]>([])
  const summaryData = ref<SummaryAnalysisRow[]>([])
  const lastSync = ref('--:--')
  
  const kpi = reactive<KpiState>({
    totalActual: 0,
    diff: 0,
    diffPercent: '0%',
    noData: 0,
    move: 0,
    duplicates: 0
  })

  const analysis = reactive<AnalysisState>({
    noData: [],
    lowStock: [],
    duplicates: [],
    midStock: []
  })

  const fetchInventory = async () => {
    loading.value = true
    try {
      const { data: detailData, error: detailErr } = await supabase
        .from('vw_kho_thanh_pham')
        .select('*')
      
      const { data: sumData, error: sumErr } = await supabase
        .from('vw_summary_analysis')
        .select('*')

      if (detailErr) throw detailErr
      if (sumErr) throw sumErr

      inventoryData.value = detailData as InventoryRow[]
      summaryData.value = sumData as SummaryAnalysisRow[]
      lastSync.value = new Date().toLocaleTimeString('vi-VN')
      
      updateMetrics()
    } catch (e: any) {
      console.error(e)
      throw new Error(e.message || 'Lỗi tải dữ liệu tồn kho')
    } finally {
      loading.value = false
    }
  }

  const updateMetrics = () => {
    let totalAct = 0
    let totalIsc = 0
    let noDataCount = 0
    let moveCount = 0
    const tagFreq: Record<string, number> = {}

    // 1. Tính KPI & thống kê từ danh sách chi tiết
    inventoryData.value.forEach(row => {
      totalAct += Number(row.qty) || 0
      
      if (row.lp_no === 'No data' || row.warehouse === 'No data') {
        noDataCount++
      }
      
      if (row.warehouse === '62' || row.warehouse === '50') {
        moveCount++
      }
      
      if (row.tag_id) {
        tagFreq[row.tag_id] = (tagFreq[row.tag_id] || 0) + 1
      }
    })

    // 2. Tính iScala tổng từ view summary
    summaryData.value.forEach(row => {
      totalIsc += Number(row.iscala) || 0
    })

    const diff = totalAct - totalIsc
    let diffPercentFormatted = '0%'
    if (totalIsc > 0) {
      const pct = (diff / totalIsc) * 100
      diffPercentFormatted = (pct > 0 ? '+' : '') + pct.toFixed(2) + '%'
    } else if (totalAct > 0) {
      diffPercentFormatted = '+100%'
    } else {
      diffPercentFormatted = '0%'
    }

    kpi.totalActual = totalAct
    kpi.diff = diff
    kpi.diffPercent = diffPercentFormatted
    kpi.noData = noDataCount
    kpi.move = moveCount
    
    const duplicateTags = Object.keys(tagFreq).filter(t => tagFreq[t] > 1)
    kpi.duplicates = duplicateTags.length

    // 3. Phân tích rủi ro
    analysis.noData = inventoryData.value
      .filter(r => r.lp_no === 'No data')
      .map(r => r.tag_id)
    
    analysis.duplicates = duplicateTags

    // Nhóm tồn kho theo Feature để tính số kiện
    const featureGroups: Record<string, { sum: number; max: number }> = {}
    inventoryData.value.forEach(row => {
      const feat = row.feature
      if (!feat || feat === 'No data') return
      
      if (!featureGroups[feat]) {
        featureGroups[feat] = { sum: 0, max: 0 }
      }
      const qty = Number(row.qty) || 0
      featureGroups[feat].sum += qty
      if (qty > featureGroups[feat].max) {
        featureGroups[feat].max = qty
      }
    })

    const low: any[] = []
    const mid: any[] = []

    Object.entries(featureGroups).forEach(([feat, g]) => {
      const kien = g.max > 0 ? (g.sum / 2) / g.max : 0
      if (kien < 2) {
        low.push({ feat, kien: kien.toFixed(2) })
      } else if (kien >= 3 && kien <= 5) {
        mid.push({ feat, kien: kien.toFixed(2) })
      }
    })

    analysis.lowStock = low
    analysis.midStock = mid
  }

  // Nhập kho thủ công / quét
  const inbound = async (tagId: string, bin: string, option: 'update' | 'insert') => {
    loading.value = true
    try {
      if (option === 'update') {
        // Đổi vị trí: Cập nhật dòng trùng tag_id có sẵn
        const { error } = await supabase
          .from('inventory')
          .update({ bin })
          .eq('tag_id', tagId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('inventory')
          .insert([{ tag_id: tagId, bin }])
        if (error) throw error
      }
      await fetchInventory()
    } catch (e: any) {
      console.error(e)
      throw new Error(e.message || 'Lỗi nhập kho')
    } finally {
      loading.value = false
    }
  }

  // Nhập kho qua CSV (hỗ trợ import batch lớn)
  const importCsvData = async (rows: { tag_id: string; bin: string }[]) => {
    loading.value = true
    try {
      // Chunk inserts to avoid Supabase API limits or slowdowns
      const chunkSize = 200
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize).map(r => ({
          tag_id: r.tag_id,
          bin: r.bin
        }))
        const { error } = await supabase.from('inventory').insert(chunk)
        if (error) throw error
      }
      await fetchInventory()
    } catch (e: any) {
      console.error(e)
      throw new Error(e.message || 'Lỗi import CSV')
    } finally {
      loading.value = false
    }
  }

  // Xuất kho nhanh bằng ID ảo (an toàn không trùng)
  const deleteInventoryItem = async (inventoryId: string) => {
    loading.value = true
    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', inventoryId)
      if (error) throw error
      await fetchInventory()
    } catch (e: any) {
      console.error(e)
      throw new Error(e.message || 'Lỗi xuất kho nhanh')
    } finally {
      loading.value = false
    }
  }

  // Sửa nhanh dòng tồn kho
  const editInventoryItem = async (inventoryId: string, tagId: string, bin: string) => {
    loading.value = true
    try {
      const { error } = await supabase
        .from('inventory')
        .update({ tag_id: tagId, bin })
        .eq('id', inventoryId)
      if (error) throw error
      await fetchInventory()
    } catch (e: any) {
      console.error(e)
      throw new Error(e.message || 'Lỗi cập nhật dòng tồn kho')
    } finally {
      loading.value = false
    }
  }

  // Upload Master Data
  const replaceMasterData = async (payload: any[]) => {
    loading.value = true
    try {
      // Sử dụng RPC replace_master_data để transaction an toàn
      const { error } = await supabase.rpc('replace_master_data', { payload })
      if (error) {
        console.warn('RPC replace_master_data failed, falling back to manual delete & insert', error)
        // Fallback nếu RPC chưa được tạo trong DB
        const { error: delErr } = await supabase.from('master_data').delete().neq('batch', 'dummy')
        if (delErr) throw delErr
        
        // Insert từng chunk
        const chunkSize = 200
        for (let i = 0; i < payload.length; i += chunkSize) {
          const chunk = payload.slice(i, i + chunkSize)
          const { error: insErr } = await supabase.from('master_data').insert(chunk)
          if (insErr) throw insErr
        }
      }
      await fetchInventory()
    } catch (e: any) {
      console.error(e)
      throw new Error(e.message || 'Lỗi cập nhật dữ liệu nguồn')
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    inventoryData,
    summaryData,
    kpi,
    analysis,
    lastSync,
    fetchInventory,
    inbound,
    importCsvData,
    deleteInventoryItem,
    editInventoryItem,
    replaceMasterData
  }
}
