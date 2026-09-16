import { ref, reactive } from 'vue'
import { supabase, isSupabaseConfigured } from '@/services/supabase'
import { 
  getMockInventory, 
  saveMockInventory, 
  generateMockSummary 
} from '@/services/mockData'
import { InventoryRow, SummaryAnalysisRow, KpiState, AnalysisState } from '@/types'
// T3: dùng module feature trung tâm (hard-code 1220), giữ re-export để không vỡ import cũ
import { extractFeatureFromStockCode as extractFeatureCentral } from '@/utils/feature'

// Hàm trích xuất Feature (re-export centralize — giữ tên cũ cho tương thích):
// - Mã 1220: lấy 4 số đầu '1220' (hard-code toàn hệ thống)
// - Còn lại: MID(text,2,4) = substring(1,5)
export const extractFeatureFromStockCode = extractFeatureCentral

// Khử trùng dòng view theo inventory_id: mỗi tag vật lý chỉ có 1 dòng trong inventory,
// nhưng LEFT JOIN với master_data có thể nhân bản dòng khi nhiều dòng master_data trùng tag_id
const dedupeByInventoryId = (rows: InventoryRow[]): InventoryRow[] => {
  const seen = new Set<string>()
  const result: InventoryRow[] = []
  rows.forEach(row => {
    const key = row.inventory_id || `${row.tag_id}-${row.bin}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push(row)
    }
  })
  return result
}

export function useInventory() {
  const loading = ref(false)
  const isDemoMode = ref(!isSupabaseConfigured)
  const inventoryData = ref<InventoryRow[]>([])
  const summaryData = ref<SummaryAnalysisRow[]>([])
  const lastSync = ref('--:--')
  /** T4: override metadata feature -> pack (do App/view set sau khi load metadata). */
  const inventoryPackSpecs = ref<Record<string, { pack_qty: number; carton_type: string }>>({})
  const setInventoryPackSpecs = (m: Record<string, { pack_qty: number; carton_type: string }>) => {
    inventoryPackSpecs.value = m || {}
  }
  
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

  // Hàm tải toàn bộ dữ liệu từ View Supabase (vượt qua giới hạn 1,000 dòng mặc định)
  // orderColumn giữ thứ tự dòng ổn định giữa các trang .range() (tránh trùng/sót dòng khi phân trang)
  const fetchAllFromSupabase = async <T>(viewName: string, orderColumn: string): Promise<T[]> => {
    let allRows: T[] = []
    let from = 0
    const step = 1000
    let keepGoing = true

    while (keepGoing) {
      const { data, error } = await supabase
        .from(viewName)
        .select('*')
        .order(orderColumn, { ascending: true })
        .range(from, from + step - 1)

      if (error) throw error
      if (data && data.length > 0) {
        allRows = allRows.concat(data as T[])
        if (data.length < step) {
          keepGoing = false
        } else {
          from += step
        }
      } else {
        keepGoing = false
      }
    }
    return allRows
  }

  const fetchInventory = async () => {
    loading.value = true
    try {
      // Live Supabase - Tải toàn bộ dữ liệu từ Views không giới hạn 1,000 dòng
      const [detailRows, sumRows] = await Promise.all([
        fetchAllFromSupabase<InventoryRow>('vw_kho_thanh_pham', 'inventory_id'),
        fetchAllFromSupabase<SummaryAnalysisRow>('vw_summary_analysis', 'feature')
      ])

      isDemoMode.value = false
      // Khử fan-out từ view: nhiều dòng master_data trùng tag_id chỉ giữ 1 dòng cho mỗi tag vật lý
      inventoryData.value = dedupeByInventoryId(detailRows || [])
      
      if (sumRows && sumRows.length > 0) {
        summaryData.value = sumRows
      } else {
        summaryData.value = generateMockSummary(inventoryData.value)
      }

      lastSync.value = new Date().toLocaleTimeString('vi-VN')
      updateMetrics()
    } catch (err: any) {
      console.error('Lỗi kết nối Supabase tồn kho:', err)
      lastSync.value = new Date().toLocaleTimeString('vi-VN')
      updateMetrics()
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateMetrics = () => {
    let totalAct = 0
    let totalIsc = 0
    let diff = 0
    let noDataCount = 0
    let moveCount = 0
    const tagFreq: Record<string, number> = {}

    // 1. Thống kê từ bảng tồn kho chi tiết
    inventoryData.value.forEach(row => {
      if (!row.lp_no || row.lp_no === 'No data' || !row.feature || row.feature === 'No data') {
        noDataCount++
      }
      
      if (row.warehouse === '62' || row.warehouse === '50') {
        moveCount++
      }
      
      if (row.tag_id) {
        tagFreq[row.tag_id] = (tagFreq[row.tag_id] || 0) + 1
      }
    })

    // 2. Tính Tổng Tồn Thực Tế & Chênh Lệch Hệ Thống chuẩn theo Summary Analysis
    if (summaryData.value && summaryData.value.length > 0) {
      summaryData.value.forEach(row => {
        totalAct += Number(row.actual) || 0
        totalIsc += Number(row.iscala) || 0
        diff += Number(row.diff) || 0
      })
    } else {
      inventoryData.value.forEach(row => {
        totalAct += Number(row.qty) || 0
      })
      diff = totalAct - totalIsc
    }

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

    // 3. Phân tích rủi ro (dùng Set để mỗi Tag ID chỉ xuất hiện 1 lần dù có nhiều dòng)
    analysis.noData = Array.from(new Set(
      inventoryData.value
        .filter(r => !r.lp_no || r.lp_no === 'No data' || !r.feature || r.feature === 'No data')
        .map(r => r.tag_id)
    ))

    analysis.duplicates = duplicateTags

    // Nhóm tồn kho theo Feature để tính số kiện — T4 chuẩn metadata (có fallback cũ khi chưa wiring)
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
      // T4: ưu tiên metadata khi có override, fallback (sum/2)/max khi chưa có
      const spec = inventoryPackSpecs.value[feat]
      let kien: number
      if (spec && Number(spec.pack_qty) > 0) {
        const single = /thùng đơn/i.test(String(spec.carton_type || ''))
        const raw = single ? g.sum / Number(spec.pack_qty) : (g.sum / 2) / Number(spec.pack_qty)
        kien = Math.round(raw * 100) / 100
      } else {
        kien = g.max > 0 ? Math.round(((g.sum / 2) / g.max) * 100) / 100 : 0
      }
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
              feature: extractFeatureFromStockCode('8101010104'),
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
            feature: extractFeatureFromStockCode('8101010104'),
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
          feature: extractFeatureFromStockCode('8101010104'),
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
          const feat = extractFeatureFromStockCode(lp)
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
    inventoryPackSpecs,
    setInventoryPackSpecs,
    fetchInventory,
    inbound,
    importCsvData,
    deleteInventoryItem,
    editInventoryItem,
    replaceMasterData
  }
}
