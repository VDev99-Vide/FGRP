import { ref, reactive } from 'vue'
import { supabase, isSupabaseConfigured } from '@/services/supabase'
import { 
  getMockInventory, 
  saveMockInventory, 
  generateMockSummary 
} from '@/services/mockData'
import { InventoryRow, SummaryAnalysisRow, KpiState, AnalysisState } from '@/types'

export function useInventory() {
  const loading = ref(false)
  const isDemoMode = ref(!isSupabaseConfigured)
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
      if (!isSupabaseConfigured) {
        // Dùng dữ liệu mẫu (Mock Data)
        isDemoMode.value = true
        const localData = getMockInventory()
        inventoryData.value = localData
        summaryData.value = generateMockSummary(localData)
        lastSync.value = new Date().toLocaleTimeString('vi-VN')
        updateMetrics()
        return
      }

      // Live Supabase
      const { data: detailData, error: detailErr } = await supabase
        .from('vw_kho_thanh_pham')
        .select('*')
      
      const { data: sumData } = await supabase
        .from('vw_summary_analysis')
        .select('*')

      if (detailErr) {
        console.warn('Supabase query failed, falling back to mock data:', detailErr)
        isDemoMode.value = true
        const localData = getMockInventory()
        inventoryData.value = localData
        summaryData.value = generateMockSummary(localData)
      } else {
        isDemoMode.value = false
        inventoryData.value = (detailData || []) as InventoryRow[]
        if (sumData && sumData.length > 0) {
          summaryData.value = sumData as SummaryAnalysisRow[]
        } else {
          summaryData.value = generateMockSummary(inventoryData.value)
        }
      }

      lastSync.value = new Date().toLocaleTimeString('vi-VN')
      updateMetrics()
    } catch (e: any) {
      console.warn('Lỗi kết nối Supabase, tự động chuyển sang chế độ dữ liệu mẫu:', e)
      isDemoMode.value = true
      const localData = getMockInventory()
      inventoryData.value = localData
      summaryData.value = generateMockSummary(localData)
      lastSync.value = new Date().toLocaleTimeString('vi-VN')
      updateMetrics()
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
      if (isDemoMode.value || !isSupabaseConfigured) {
        const local = getMockInventory()
        if (option === 'update') {
          const idx = local.findIndex(r => r.tag_id === tagId)
          if (idx !== -1) {
            local[idx].bin = bin
          } else {
            local.unshift({
              inventory_id: 'mock-inv-' + Date.now(),
              tag_id: tagId,
              bin,
              lp_no: '8101010104',
              feature: '1010',
              qty: 250,
              warehouse: '62',
              create_date: new Date().toLocaleDateString('vi-VN'),
              stock_in_date: new Date().toISOString()
            })
          }
        } else {
          local.unshift({
            inventory_id: 'mock-inv-' + Date.now(),
            tag_id: tagId,
            bin,
            lp_no: '8101010104',
            feature: '1010',
            qty: 250,
            warehouse: '62',
            create_date: new Date().toLocaleDateString('vi-VN'),
            stock_in_date: new Date().toISOString()
          })
        }
        saveMockInventory(local)
        inventoryData.value = local
        summaryData.value = generateMockSummary(local)
        updateMetrics()
        return
      }

      // Live Supabase
      if (option === 'update') {
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
      if (isDemoMode.value || !isSupabaseConfigured) {
        const local = getMockInventory()
        const newRows: InventoryRow[] = rows.map((r, i) => ({
          inventory_id: `mock-import-${Date.now()}-${i}`,
          tag_id: r.tag_id,
          bin: r.bin,
          lp_no: '8101010104',
          feature: '1010',
          qty: 250,
          warehouse: '62',
          create_date: new Date().toLocaleDateString('vi-VN'),
          stock_in_date: new Date().toISOString()
        }))
        const merged = [...newRows, ...local]
        saveMockInventory(merged)
        inventoryData.value = merged
        summaryData.value = generateMockSummary(merged)
        updateMetrics()
        return
      }

      // Live Supabase
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
      if (isDemoMode.value || !isSupabaseConfigured) {
        const local = getMockInventory()
        const filtered = local.filter(r => r.inventory_id !== inventoryId)
        saveMockInventory(filtered)
        inventoryData.value = filtered
        summaryData.value = generateMockSummary(filtered)
        updateMetrics()
        return
      }

      // Live Supabase
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
      if (isDemoMode.value || !isSupabaseConfigured) {
        const local = getMockInventory()
        const idx = local.findIndex(r => r.inventory_id === inventoryId)
        if (idx !== -1) {
          local[idx].tag_id = tagId
          local[idx].bin = bin
          saveMockInventory(local)
          inventoryData.value = local
          summaryData.value = generateMockSummary(local)
          updateMetrics()
        }
        return
      }

      // Live Supabase
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
      if (isDemoMode.value || !isSupabaseConfigured) {
        // Build mock inventory based on master data payload
        const local: InventoryRow[] = payload.map((p, i) => {
          const lp = p.stock_code || p.lp_no || '8101010104'
          let feat = 'No data'
          if (lp && lp.length >= 5) {
            feat = lp.substring(1, 5)
          }
          return {
            inventory_id: `mock-master-${Date.now()}-${i}`,
            tag_id: p.batch || p.tag_id || `TAG-${i + 1000}`,
            bin: `BIN-M-${i % 20 + 1}`,
            lp_no: lp,
            feature: feat,
            qty: Number(p.qty) || 0,
            warehouse: p.warehouse || p.wh_location || '62',
            create_date: p.create_date || new Date().toLocaleDateString('vi-VN'),
            stock_in_date: new Date().toISOString()
          }
        })
        saveMockInventory(local)
        inventoryData.value = local
        summaryData.value = generateMockSummary(local)
        updateMetrics()
        return
      }

      // Live Supabase RPC or Fallback
      const { error } = await supabase.rpc('replace_master_data', { payload })
      if (error) {
        console.warn('RPC replace_master_data failed, falling back to manual delete & insert', error)
        const { error: delErr } = await supabase.from('master_data').delete().neq('batch', 'dummy')
        if (delErr) throw delErr
        
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
    isDemoMode,
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
