<template>
  <div class="glass-card-dark p-6 lg:p-8 flex flex-col justify-between relative overflow-hidden h-full">
    <!-- Header with Title & Filter Pills -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
      <div class="flex items-center gap-2.5">
        <div class="w-2 h-5 bg-[#CB3CFF] rounded-full shadow-[0_0_8px_#CB3CFF]"></div>
        <div>
          <h3 class="text-base lg:text-lg font-bold text-white tracking-wide">
            Bảng dữ liệu Tag ID lỗi
          </h3>
          <p class="text-[11px] text-[#AEB9E1]">Danh sách toàn bộ Tag ID lỗi &amp; trùng lặp trong hệ thống</p>
        </div>
      </div>

      <!-- Quick Filter Pills -->
      <div class="flex items-center gap-1.5 bg-white/[0.06] border border-white/10 p-1 rounded-[8px] self-start sm:self-auto backdrop-blur-md">
        <button
          @click="activeFilter = 'all'"
          :class="[
            'px-2.5 py-1 text-[11px] font-bold rounded-[6px] transition cursor-pointer',
            activeFilter === 'all'
              ? 'bg-[#CB3CFF] text-white shadow-[0_0_10px_rgba(203,60,255,0.4)]'
              : 'text-[#AEB9E1] hover:text-white hover:bg-white/5'
          ]"
        >
          Tất cả ({{ allRiskRows.length }})
        </button>
        <button
          @click="activeFilter = 'error'"
          :class="[
            'px-2.5 py-1 text-[11px] font-bold rounded-[6px] transition cursor-pointer',
            activeFilter === 'error'
              ? 'bg-[#FF5A65] text-white shadow-[0_0_10px_rgba(255,90,101,0.4)]'
              : 'text-[#AEB9E1] hover:text-white hover:bg-white/5'
          ]"
        >
          Lỗi No Data ({{ errorCount }})
        </button>
        <button
          @click="activeFilter = 'duplicate'"
          :class="[
            'px-2.5 py-1 text-[11px] font-bold rounded-[6px] transition cursor-pointer',
            activeFilter === 'duplicate'
              ? 'bg-[#FDB52A] text-[#081028] shadow-[0_0_10px_rgba(253,181,42,0.4)]'
              : 'text-[#AEB9E1] hover:text-white hover:bg-white/5'
          ]"
        >
          Trùng Tag ({{ duplicateCount }})
        </button>
      </div>
    </div>

    <!-- DỮ LIỆU BẢNG NẰM TRỰC TIẾP TRÊN CARD KÍNH MỜ TIÊU CHUẨN (KHÔNG CÓ BẢNG TỐI LỒNG NHAU) -->
    <div class="overflow-x-auto overflow-y-auto flex-1 my-3 max-h-[300px] custom-scroll">
      <table class="w-full text-left text-xs whitespace-nowrap border-collapse">
        <!-- Sticky Thead directly on glass card -->
        <thead class="bg-[#283241]/75 backdrop-blur-md text-[#AEB9E1] font-semibold border-b border-white/10 sticky top-0 z-10">
          <tr>
            <th class="py-2.5 px-3 font-semibold">
              <span>MÃ TAG ID</span>
            </th>
            <th class="py-2.5 px-3 font-semibold">
              <div class="flex items-center gap-1.5">
                <MapPin class="w-3.5 h-3.5 text-[#AEB9E1]" />
                <span>VỊ TRÍ (BIN)</span>
              </div>
            </th>
            <th class="py-2.5 px-3 font-semibold">
              <div class="flex items-center gap-1.5">
                <AlertTriangle class="w-3.5 h-3.5 text-[#AEB9E1]" />
                <span>PHÂN LOẠI</span>
              </div>
            </th>
            <th class="py-2.5 px-3 font-semibold">STOCK CODE</th>
            <th class="py-2.5 px-3 text-right font-semibold">SỐ LƯỢNG</th>
            <th class="py-2.5 px-3 text-center font-semibold">KHO</th>
          </tr>
        </thead>

        <!-- Rows on pure glassmorphism backdrop -->
        <tbody class="divide-y divide-white/[0.06] font-medium">
          <tr 
            v-for="(row, idx) in filteredRiskRows" 
            :key="row.id + '-' + idx"
            class="transition-colors duration-150 hover:bg-white/[0.08]"
          >
            <!-- 1. Tag ID -->
            <td class="py-3 px-3">
              <span class="font-mono font-bold text-white tracking-wide">{{ row.tag_id }}</span>
            </td>

            <!-- 2. Vị trí Bin -->
            <td class="py-3 px-3 font-mono text-[#00C2FF] font-semibold">
              {{ row.bin || 'Chưa gán Bin' }}
            </td>

            <!-- 3. Phân loại Badge -->
            <td class="py-3 px-3">
              <span :class="[
                'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[10px] font-bold border backdrop-blur-sm',
                row.type === 'error'
                  ? 'bg-[#FF5A65]/20 border-[#FF5A65]/35 text-[#FF5A65]'
                  : 'bg-[#FDB52A]/20 border-[#FDB52A]/35 text-[#FDB52A]'
              ]">
                <span :class="[
                  'w-1.5 h-1.5 rounded-full',
                  row.type === 'error' ? 'bg-[#FF5A65]' : 'bg-[#FDB52A] animate-pulse'
                ]"></span>
                {{ row.statusLabel }}
              </span>
            </td>

            <!-- 4. Stock Code -->
            <td class="py-3 px-3 font-mono text-xs text-[#AEB9E1]">
              <span v-if="row.stock_code === 'No data'" class="text-[#FF5A65]/80 italic text-[11px]">No Data</span>
              <span v-else>{{ row.stock_code }}</span>
            </td>

            <!-- 5. Số lượng Qty -->
            <td class="py-3 px-3 text-right font-bold text-white font-mono">
              {{ row.qty > 0 ? row.qty.toLocaleString() : '0' }} <span class="text-[10px] text-[#AEB9E1] font-sans font-normal">PCS</span>
            </td>

            <!-- 6. Kho Warehouse -->
            <td class="py-3 px-3 text-center">
              <span class="px-2 py-0.5 rounded-[4px] bg-white/5 border border-white/10 text-[10px] font-mono text-[#AEB9E1]">
                {{ row.warehouse || '62' }}
              </span>
            </td>
          </tr>

          <!-- Empty State -->
          <tr v-if="filteredRiskRows.length === 0">
            <td colspan="6" class="text-center py-10 text-[#14CA74] text-xs font-semibold">
              <div class="flex flex-col items-center justify-center gap-2">
                <CheckCircle2 class="w-6 h-6 text-[#14CA74]" />
                <span>Không có Tag nào thuộc danh mục này! Hệ thống an toàn.</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Bottom Status Bar -->
    <div class="pt-3 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-[#AEB9E1] shrink-0">
      <div>
        <span>Hiển thị <span class="font-bold text-white">{{ filteredRiskRows.length }}</span> / {{ allRiskRows.length }} Tag cảnh báo</span>
      </div>
      <div class="flex items-center gap-3 font-bold">
        <span class="text-[#FF5A65]">{{ errorCount }} Lỗi</span>
        <span class="text-white/20 font-normal">|</span>
        <span class="text-[#FDB52A]">{{ duplicateCount }} Trùng</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { MapPin, AlertTriangle, CheckCircle2 } from 'lucide-vue-next'
import { InventoryRow, AnalysisState } from '@/types'

const props = defineProps<{
  inventoryData?: InventoryRow[]
  analysis?: AnalysisState
}>()

interface RiskItem {
  id: string
  tag_id: string
  bin: string
  stock_code: string
  type: 'error' | 'duplicate'
  statusLabel: string
  qty: number
  warehouse: string
}

const activeFilter = ref<'all' | 'error' | 'duplicate'>('all')

// Compute all risk rows combining all error tags and duplicate tags
const allRiskRows = computed<RiskItem[]>(() => {
  const inv = props.inventoryData || []
  const noDataTags = props.analysis?.noData || []
  const duplicateTags = props.analysis?.duplicates || []

  const items: RiskItem[] = []

  // 1. Error tags (No Data)
  inv.forEach(r => {
    if (r.lp_no === 'No data' || noDataTags.includes(r.tag_id)) {
      items.push({
        id: r.inventory_id || `err-${r.tag_id}`,
        tag_id: r.tag_id,
        bin: r.bin || 'N/A',
        stock_code: r.lp_no || 'No data',
        type: 'error',
        statusLabel: 'No Data Lỗi',
        qty: Number(r.qty) || 0,
        warehouse: r.warehouse || 'N/A'
      })
    }
  })

  // 2. Duplicate tags
  inv.forEach(r => {
    if (duplicateTags.includes(r.tag_id) && r.lp_no !== 'No data') {
      items.push({
        id: r.inventory_id || `dup-${r.tag_id}`,
        tag_id: r.tag_id,
        bin: r.bin || 'N/A',
        stock_code: r.lp_no || 'N/A',
        type: 'duplicate',
        statusLabel: 'Trùng Tag ID',
        qty: Number(r.qty) || 0,
        warehouse: r.warehouse || '62'
      })
    }
  })

  // Realistic sample sequence fallback if empty initial state
  if (items.length === 0 && (!props.inventoryData || props.inventoryData.length === 0)) {
    return [
      { id: '1', tag_id: 'TAG-ERR-999901', bin: 'ERR-ZONE-01', stock_code: 'No data', type: 'error', statusLabel: 'No Data Lỗi', qty: 0, warehouse: 'No data' },
      { id: '2', tag_id: '199900015028', bin: 'B2-TEMP-DUP', stock_code: '1009-L4', type: 'duplicate', statusLabel: 'Trùng Tag ID', qty: 250, warehouse: '62' },
      { id: '3', tag_id: 'TAG-ERR-999902', bin: 'ERR-ZONE-02', stock_code: 'No data', type: 'error', statusLabel: 'No Data Lỗi', qty: 0, warehouse: 'No data' },
      { id: '4', tag_id: '199900015028', bin: 'B2-01', stock_code: '1009-L4', type: 'duplicate', statusLabel: 'Trùng Tag ID', qty: 250, warehouse: '62' },
      { id: '5', tag_id: '199900023412', bin: 'B3-04', stock_code: '2072-A1', type: 'duplicate', statusLabel: 'Trùng Tag ID', qty: 500, warehouse: '62' },
      { id: '6', tag_id: 'TAG-ERR-999903', bin: 'ERR-ZONE-03', stock_code: 'No data', type: 'error', statusLabel: 'No Data Lỗi', qty: 0, warehouse: 'No data' },
    ]
  }

  return items
})

const errorCount = computed(() => allRiskRows.value.filter(r => r.type === 'error').length)
const duplicateCount = computed(() => allRiskRows.value.filter(r => r.type === 'duplicate').length)

// Filtered list based on active filter tab
const filteredRiskRows = computed(() => {
  if (activeFilter.value === 'error') {
    return allRiskRows.value.filter(r => r.type === 'error')
  }
  if (activeFilter.value === 'duplicate') {
    return allRiskRows.value.filter(r => r.type === 'duplicate')
  }
  return allRiskRows.value
})
</script>

<style scoped>
.custom-scroll::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
.custom-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}
.custom-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(203, 60, 255, 0.4);
}
</style>


