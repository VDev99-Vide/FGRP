<template>
  <div class="glass-card-dark p-6 flex flex-col gap-5 flex-1 min-h-0">
    <!-- Grid Header Bar -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <p class="text-[10px] font-bold text-[#CB3CFF] uppercase tracking-widest mb-1">
          HỆ THỐNG KHO THỰC TẾ
        </p>
        <h2 class="text-xl font-bold text-white tracking-tight">
          Bảng Chi Tiết Tồn Kho Thành Phẩm
        </h2>
      </div>

      <!-- Action Buttons, Display Limit Selector & Search Bar -->
      <div class="flex flex-wrap gap-3 w-full sm:w-auto items-center">
        <!-- Display Chunk Selector -->
        <div class="flex items-center gap-1 bg-[#18202D]/90 border border-white/15 p-1 rounded-[8px] text-xs">
          <button 
            @click="setLimit(50)"
            :class="[
              'px-2.5 py-1 rounded-[5px] font-bold transition cursor-pointer',
              displayLimit === 50 && displayLimit < allDisplayItems.length
                ? 'bg-[#CB3CFF] text-white shadow-[0_0_8px_#CB3CFF]' 
                : 'text-[#AEB9E1] hover:text-white'
            ]"
          >
            50 dòng
          </button>
          <button 
            @click="setLimit(100)"
            :class="[
              'px-2.5 py-1 rounded-[5px] font-bold transition cursor-pointer',
              displayLimit === 100 && displayLimit < allDisplayItems.length
                ? 'bg-[#CB3CFF] text-white shadow-[0_0_8px_#CB3CFF]' 
                : 'text-[#AEB9E1] hover:text-white'
            ]"
          >
            100 dòng
          </button>
          <button 
            @click="setLimit(allDisplayItems.length)"
            :class="[
              'px-2.5 py-1 rounded-[5px] font-bold transition cursor-pointer',
              displayLimit >= allDisplayItems.length
                ? 'bg-[#00C2FF] text-white shadow-[0_0_8px_#00C2FF]' 
                : 'text-[#AEB9E1] hover:text-white'
            ]"
          >
            Tất cả ({{ allDisplayItems.length }})
          </button>
        </div>

        <button 
          @click="$emit('export')"
          class="h-[38px] px-4 rounded-[7px] bg-[#05C168]/20 hover:bg-[#05C168]/30 border border-[#05C168]/40 text-[#14CA74] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
        >
          <FileSpreadsheet class="w-4 h-4" />
          <span>XUẤT EXCEL</span>
        </button>

        <div class="relative flex-1 sm:w-64">
          <input 
            type="text" 
            v-model="quickFilterText"
            placeholder="Tìm Bin, Tag, Feature, Kho (62)..." 
            class="w-full h-[38px] px-3.5 pl-9 bg-[#18202D]/80 backdrop-blur-md border border-white/15 rounded-[8px] text-xs outline-none text-white placeholder-[#AEB9E1]/50 focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
          >
          <Search class="w-3.5 h-3.5 text-[#AEB9E1] absolute left-3 top-3" />
        </div>
      </div>
    </div>

    <!-- DỮ LIỆU RENDER TRỰC TIẾP TRÊN BẢNG KÍNH MỜ (THANH CUỘN DỌC CHUẨN + TỰ ĐỘNG TẢI TIẾP) -->
    <div 
      @scroll.passive="handleScroll"
      class="w-full h-[580px] max-h-[70vh] overflow-y-scroll overflow-x-auto custom-scroll rounded-[14px] border border-white/12 bg-white/[0.02] glass-table-container relative"
    >
      <table class="w-full text-left text-xs whitespace-nowrap border-collapse">
        <!-- Table Header (Sticky) -->
        <thead class="bg-[#202938]/95 backdrop-blur-md text-[#AEB9E1] font-semibold border-b border-white/15 sticky top-0 z-30 shadow-md">
          <tr>
            <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase">MÃ HÀNG (STOCK CODE)</th>
            <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-center">FEATURE</th>
            <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-right">ACTUAL (PCS)</th>
            <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-center">KHO (WH)</th>
            <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase">NGÀY NHẬP (STOCK-IN)</th>
            <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase">NGÀY TẠO (CREATE)</th>
            <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase">TAG ID</th>
            <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-center">VỊ TRÍ (BIN)</th>
            <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-center">THAO TÁC</th>
          </tr>
        </thead>

        <!-- Table Body with Feature Groups & Direct Data Rows -->
        <tbody class="divide-y divide-white/[0.06] font-medium">
          <template v-for="item in displayedRows" :key="item._id">
            <!-- 1. GROUP HEADER ROW -->
            <tr 
              v-if="item._isGroup"
              class="bg-gradient-to-r from-[#CB3CFF]/20 via-[#00C2FF]/10 to-[#283241]/60 border-y border-[#CB3CFF]/30 font-bold"
            >
              <td colspan="9" class="py-2.5 px-4">
                <div class="flex items-center gap-3">
                  <div class="w-1 h-4 bg-[#CB3CFF] rounded-full shadow-[0_0_8px_#CB3CFF]"></div>
                  <span class="text-white text-xs font-black tracking-wide">
                    FEATURE: {{ item.feature }}
                  </span>
                  <span class="text-[10px] font-bold text-[#CB3CFF] bg-[#CB3CFF]/15 border border-[#CB3CFF]/30 px-2 py-0.5 rounded-[4px]">
                    {{ item.kienLabel }}
                  </span>
                  <span class="text-[10px] font-bold text-[#14CA74] bg-[#05C168]/15 border border-[#05C168]/30 px-2 py-0.5 rounded-[4px] ml-auto">
                    Tổng: {{ formatNumber(item.totalQty) }} PCS
                  </span>
                </div>
              </td>
            </tr>

            <!-- 2. DATA ROW -->
            <tr 
              v-else
              class="transition-colors duration-150 hover:bg-white/[0.08]"
            >
              <!-- Stock Code (LP.No) -->
              <td class="py-3 px-4">
                <span 
                  v-if="!item.row.lp_no || item.row.lp_no === 'No data'" 
                  class="px-2 py-0.5 text-[10px] font-bold text-[#FF5A65] bg-[#FF5A65]/15 border border-[#FF5A65]/30 rounded-[4px]"
                >
                  No Data
                </span>
                <span v-else class="font-mono text-[#AEB9E1] font-semibold text-xs">
                  {{ item.row.lp_no }}
                </span>
              </td>

              <!-- Feature -->
              <td class="py-3 px-4 text-center">
                <span 
                  v-if="item.row.feature && item.row.feature !== 'No data'"
                  class="font-mono font-bold text-[#CB3CFF] text-xs"
                >
                  F.{{ item.row.feature }}
                </span>
                <span 
                  v-else 
                  class="px-1.5 py-0.5 text-[9px] font-bold text-[#FF5A65] bg-[#FF5A65]/15 border border-[#FF5A65]/30 rounded"
                >
                  No data
                </span>
              </td>

              <!-- Actual Qty (PCS) -->
              <td class="py-3 px-4 text-right font-bold text-white text-xs">
                <span :class="Number(item.row.qty) > 0 ? 'text-[#14CA74]' : 'text-[#AEB9E1]'">
                  {{ formatNumber(item.row.qty || 0) }}
                </span>
              </td>

              <!-- Warehouse -->
              <td class="py-3 px-4 text-center">
                <span 
                  v-if="item.row.warehouse && item.row.warehouse !== 'No data'"
                  :class="[
                    'px-2 py-0.5 rounded-[4px] text-[11px] font-bold border',
                    (item.row.warehouse === '62' || item.row.warehouse === '50')
                      ? 'bg-[#FDB52A]/15 text-[#FDB52A] border-[#FDB52A]/30'
                      : 'bg-[#00C2FF]/15 text-[#00C2FF] border-[#00C2FF]/30'
                  ]"
                >
                  WH {{ item.row.warehouse }}
                </span>
                <span 
                  v-else 
                  class="px-1.5 py-0.5 text-[9px] font-bold text-[#FF5A65] bg-[#FF5A65]/15 border border-[#FF5A65]/30 rounded"
                >
                  No Data
                </span>
              </td>

              <!-- Stock-In Date -->
              <td class="py-3 px-4 text-[#AEB9E1] text-[11px] font-mono">
                {{ formatDateTime(item.row.stock_in_date) }}
              </td>

              <!-- Create Date -->
              <td class="py-3 px-4 text-[#AEB9E1] text-[11px] font-mono">
                {{ item.row.create_date || '—' }}
              </td>

              <!-- Tag ID -->
              <td class="py-3 px-4">
                <span class="font-mono font-bold text-[#00C2FF] text-xs">
                  {{ item.row.tag_id }}
                </span>
              </td>

              <!-- Bin -->
              <td class="py-3 px-4 text-center">
                <span class="font-mono font-bold text-[#AEB9E1] text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded-[4px]">
                  {{ item.row.bin || 'N/A' }}
                </span>
              </td>

              <!-- Actions (Xuất Nhanh / Sửa Nhanh) -->
              <td class="py-3 px-4 text-center">
                <div class="flex justify-center items-center gap-1.5">
                  <button 
                    @click="$emit('quick-out', item.row)"
                    title="Xuất nhanh" 
                    class="p-1.5 bg-[#FF5A65]/15 hover:bg-[#FF5A65]/25 text-[#FF5A65] rounded-[6px] border border-[#FF5A65]/30 cursor-pointer transition"
                  >
                    <Zap class="w-3.5 h-3.5" />
                  </button>
                  <button 
                    @click="$emit('edit', item.row)"
                    title="Sửa nhanh" 
                    class="p-1.5 bg-[#FDB52A]/15 hover:bg-[#FDB52A]/25 text-[#FDB52A] rounded-[6px] border border-[#FDB52A]/30 cursor-pointer transition"
                  >
                    <Edit3 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          </template>

          <!-- Empty Search State -->
          <tr v-if="displayedRows.length === 0">
            <td colspan="9" class="text-center py-16 text-[#AEB9E1] italic text-xs">
              <div class="flex flex-col items-center justify-center gap-2">
                <Search class="w-6 h-6 text-[#AEB9E1]/40" />
                <span>Không tìm thấy dòng dữ liệu tồn kho phù hợp với điều kiện lọc!</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Progressive Scroll Bottom Bar -->
      <div 
        v-if="displayLimit < allDisplayItems.length" 
        class="py-3 px-5 flex items-center justify-between bg-[#18202D]/95 border-t border-white/15 text-xs text-[#AEB9E1] backdrop-blur-md sticky bottom-0 z-20 shadow-lg"
      >
        <span class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-[#00C2FF] animate-pulse"></span>
          Đang hiển thị <b class="text-white">{{ displayedRows.length }}</b> / <b class="text-white">{{ allDisplayItems.length }}</b> dòng (Lăn chuột xuống để tải thêm 50 dòng)
        </span>
        <button 
          @click="loadMore" 
          class="px-3.5 py-1 bg-[#CB3CFF]/20 hover:bg-[#CB3CFF]/30 border border-[#CB3CFF]/40 text-[#CB3CFF] hover:text-white rounded-[6px] text-xs font-bold transition cursor-pointer shadow-sm"
        >
          + TẢI THÊM 50 DÒNG
        </button>
      </div>
    </div>

    <!-- Summary footer stats -->
    <div class="flex flex-wrap items-center justify-between gap-y-2 pt-1 text-xs border-t border-white/[0.08]">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span class="text-[#AEB9E1]">
          Tổng cộng: <span class="font-bold text-white">{{ filteredData.length }}</span> / <span class="text-[#AEB9E1]">{{ props.data.length }}</span> dòng tồn kho
        </span>
        <span class="text-[#AEB9E1]/40">|</span>
        <span class="text-[#AEB9E1]">
          <span class="font-bold text-[#CB3CFF]">{{ uniqueFeatureCount }}</span> Feature
        </span>
        <span class="text-[#AEB9E1]/40">|</span>
        <span class="text-[#AEB9E1]">
          Tổng Actual: <span class="font-bold text-[#14CA74]">{{ formatNumber(totalActual) }}</span> PCS
        </span>
      </div>

      <div class="text-[11px] text-[#AEB9E1]/70 font-mono">
        Bảng chi tiết kết nối trực tiếp vw_kho_thanh_pham
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { FileSpreadsheet, Search, Zap, Edit3 } from 'lucide-vue-next'
import type { InventoryRow } from '@/types'
import { formatNumber, formatDateTime } from '@/utils/format'

const props = defineProps<{ data: InventoryRow[] }>()
defineEmits<{
  (e: 'quick-out', row: InventoryRow): void
  (e: 'edit', row: InventoryRow): void
  (e: 'export'): void
}>()

const quickFilterText = ref('')
const displayLimit = ref(50)

const setLimit = (val: number) => {
  displayLimit.value = val
}

// Reset display limit when filter or data length changes
watch(quickFilterText, () => {
  displayLimit.value = 50
})

watch(() => props.data.length, () => {
  displayLimit.value = 50
})

// Lọc dữ liệu theo từ khóa tìm kiếm (Bin, Tag, Feature, Warehouse, Stock Code)
const filteredData = computed(() => {
  if (!quickFilterText.value.trim()) return props.data

  const query = quickFilterText.value.toLowerCase().trim()
  let whQuery = ''
  let generalQuery = query

  if (query.startsWith('w00')) {
    whQuery = query.replace('w00', '').trim()
  }

  return props.data.filter(row => {
    if (whQuery && row.warehouse) {
      return row.warehouse.toLowerCase().includes(whQuery)
    }

    const text = [
      row.feature,
      row.bin,
      row.tag_id,
      row.lp_no,
      row.warehouse
    ].filter(Boolean).join(' ').toLowerCase()

    return text.includes(generalQuery)
  })
})

// Tính số kiện theo feature: kien = sum(qty) / 2 / max(qty)
const featureMetrics = computed(() => {
  const metrics: Record<string, { sum: number; max: number }> = {}
  filteredData.value.forEach(row => {
    const feat = row.feature
    if (!feat || feat === 'No data') return
    if (!metrics[feat]) metrics[feat] = { sum: 0, max: 0 }
    const qty = Number(row.qty) || 0
    metrics[feat].sum += qty
    if (qty > metrics[feat].max) metrics[feat].max = qty
  })
  return metrics
})

const uniqueFeatureCount = computed(() => Object.keys(featureMetrics.value).length)
const totalActual = computed(() => filteredData.value.reduce((s, r) => s + (Number(r.qty) || 0), 0))

// Gom nhóm dữ liệu theo Feature để hiển thị trên bảng
interface DisplayItem {
  _id: string
  _isGroup: boolean
  feature?: string
  kienLabel?: string
  totalQty?: number
  row?: any
}

const allDisplayItems = computed((): DisplayItem[] => {
  const groups: Record<string, InventoryRow[]> = {}
  const noFeatureRows: InventoryRow[] = []

  filteredData.value.forEach(row => {
    const feat = row.feature
    if (!feat || feat === 'No data') {
      noFeatureRows.push(row)
      return
    }
    if (!groups[feat]) groups[feat] = []
    groups[feat].push(row)
  })

  const result: DisplayItem[] = []
  const sortedFeatures = Object.keys(groups).sort()

  sortedFeatures.forEach(feat => {
    const rows = groups[feat]
    const m = featureMetrics.value[feat] || { sum: 0, max: 0 }
    const kienNum = m.max > 0 ? (m.sum / 2) / m.max : 0

    // Group Header
    result.push({
      _id: `group-${feat}`,
      _isGroup: true,
      feature: feat,
      kienLabel: `${kienNum.toFixed(2)} Kiện`,
      totalQty: m.sum
    })

    // Data rows in group
    rows.forEach((row, idx) => {
      result.push({
        _id: `data-${row.inventory_id || row.tag_id || idx}-${feat}`,
        _isGroup: false,
        row
      })
    })
  })

  // Dòng không có Feature (No Data)
  noFeatureRows.forEach((row, idx) => {
    result.push({
      _id: `data-noFeat-${row.inventory_id || row.tag_id || idx}`,
      _isGroup: false,
      row
    })
  })

  return result
})

// Progressive chunk rendering
const displayedRows = computed(() => {
  return allDisplayItems.value.slice(0, displayLimit.value)
})

// Infinite scroll listener
const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement
  if (!target) return
  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 60) {
    if (displayLimit.value < allDisplayItems.value.length) {
      displayLimit.value += 50
    }
  }
}

const loadMore = () => {
  if (displayLimit.value < allDisplayItems.value.length) {
    displayLimit.value += 50
  }
}
</script>
