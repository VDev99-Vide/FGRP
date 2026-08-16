<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
    <!-- Card 1: Tổng Tồn Thực Tế - PCS (Actual) -->
    <div class="glass-card-dark p-5 flex flex-col justify-between relative overflow-hidden group">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-md bg-[#CB3CFF]/15 border border-[#CB3CFF]/30 flex items-center justify-center text-[#CB3CFF] shadow-[0_0_8px_rgba(203,60,255,0.25)]">
            <Package class="w-3.5 h-3.5 text-[#CB3CFF]" />
          </div>
          <span class="text-xs font-semibold text-[#AEB9E1]">Tổng Tồn Thực Tế</span>
        </div>
        <span class="text-[10px] font-semibold text-[#AEB9E1]/70 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-[4px]">
          PCS (Actual)
        </span>
      </div>

      <div class="mt-4 flex items-baseline justify-between gap-2">
        <span class="text-2xl lg:text-3xl font-bold text-white tracking-tight">
          {{ formattedTotalActual }}
        </span>
        <span class="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#14CA74] bg-[#05C168]/20 border border-[#05C168]/30 px-1.5 py-0.5 rounded-[2px]">
          Thực tế
          <ArrowUpRight class="w-3 h-3 stroke-[2.5]" />
        </span>
      </div>
    </div>

    <!-- Card 2: Chênh Lệch Hệ Thống - vs iScala -->
    <div class="glass-card-dark p-5 flex flex-col justify-between relative overflow-hidden group">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-md bg-[#00C2FF]/15 border border-[#00C2FF]/30 flex items-center justify-center text-[#00C2FF] shadow-[0_0_8px_rgba(0,194,255,0.25)]">
            <Scale class="w-3.5 h-3.5 text-[#00C2FF]" />
          </div>
          <span class="text-xs font-semibold text-[#AEB9E1]">Chênh Lệch Hệ Thống</span>
        </div>
        <span class="text-[10px] font-semibold text-[#AEB9E1]/70 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-[4px]">
          vs iScala
        </span>
      </div>

      <div class="mt-4 flex items-baseline justify-between gap-2">
        <span :class="[
          'text-2xl lg:text-3xl font-bold tracking-tight',
          isDiffNegative ? 'text-[#FF5A65]' : 'text-white'
        ]">
          {{ formattedDiff }}
        </span>
        <span :class="[
          'inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-[2px] border',
          isDiffNegative
            ? 'text-[#FF5A65] bg-[#FF5A65]/20 border-[#FF5A65]/30'
            : 'text-[#14CA74] bg-[#05C168]/20 border-[#05C168]/30'
        ]">
          {{ kpi.diffPercent || '0%' }}
          <ArrowDownRight v-if="isDiffNegative" class="w-3 h-3 stroke-[2.5]" />
          <ArrowUpRight v-else class="w-3 h-3 stroke-[2.5]" />
        </span>
      </div>
    </div>

    <!-- Card 3: TagID Không khớp - No Data in System -->
    <div class="glass-card-dark p-5 flex flex-col justify-between relative overflow-hidden group">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-md bg-[#FF5A65]/15 border border-[#FF5A65]/30 flex items-center justify-center text-[#FF5A65] shadow-[0_0_8px_rgba(255,90,101,0.25)]">
            <Search class="w-3.5 h-3.5 text-[#FF5A65]" />
          </div>
          <span class="text-xs font-semibold text-[#AEB9E1]">TagID Không khớp</span>
        </div>
        <span class="text-[10px] font-semibold text-[#AEB9E1]/70 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-[4px]">
          No Data
        </span>
      </div>

      <div class="mt-4 flex items-baseline justify-between gap-2">
        <span :class="[
          'text-2xl lg:text-3xl font-bold tracking-tight',
          kpi.noData > 0 ? 'text-[#FF5A65]' : 'text-white'
        ]">
          {{ kpi.noData }}
        </span>
        <span :class="[
          'inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-[2px] border',
          kpi.noData > 0
            ? 'text-[#FF5A65] bg-[#FF5A65]/20 border-[#FF5A65]/30'
            : 'text-[#14CA74] bg-[#05C168]/20 border-[#05C168]/30'
        ]">
          {{ kpi.noData > 0 ? 'Lỗi hệ thống' : 'An toàn' }}
        </span>
      </div>
    </div>

    <!-- Card 4: Cần Chuyển Kho - (WH 50 & 62) -->
    <div class="glass-card-dark p-5 flex flex-col justify-between relative overflow-hidden group">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-md bg-[#2F6FED]/15 border border-[#2F6FED]/30 flex items-center justify-center text-[#2F6FED] shadow-[0_0_8px_rgba(47,111,237,0.25)]">
            <Truck class="w-3.5 h-3.5 text-[#2F6FED]" />
          </div>
          <span class="text-xs font-semibold text-[#AEB9E1]">Cần Chuyển Kho</span>
        </div>
        <span class="text-[10px] font-semibold text-[#AEB9E1]/70 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-[4px]">
          WH 50 &amp; 62
        </span>
      </div>

      <div class="mt-4 flex items-baseline justify-between gap-2">
        <span class="text-2xl lg:text-3xl font-bold text-white tracking-tight">
          {{ kpi.move }}
        </span>
        <span class="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#2F6FED] bg-[#2F6FED]/20 border border-[#2F6FED]/30 px-1.5 py-0.5 rounded-[2px]">
          Kiện cần chuyển
        </span>
      </div>
    </div>

    <!-- Card 5: Trùng TagID - Verify required -->
    <div class="glass-card-dark p-5 flex flex-col justify-between relative overflow-hidden group">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-md bg-[#FDB52A]/15 border border-[#FDB52A]/30 flex items-center justify-center text-[#FDB52A] shadow-[0_0_8px_rgba(253,181,42,0.25)]">
            <Siren class="w-3.5 h-3.5 text-[#FDB52A]" />
          </div>
          <span class="text-xs font-semibold text-[#AEB9E1]">Trùng TagID</span>
        </div>
        <span class="text-[10px] font-semibold text-[#FDB52A] bg-[#FDB52A]/10 border border-[#FDB52A]/30 px-1.5 py-0.5 rounded-[4px]">
          Verify required
        </span>
      </div>

      <div class="mt-4 flex items-baseline justify-between gap-2">
        <span :class="[
          'text-2xl lg:text-3xl font-bold tracking-tight',
          kpi.duplicates > 0 ? 'text-[#FDB52A]' : 'text-white'
        ]">
          {{ kpi.duplicates }}
        </span>
        <span :class="[
          'inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-[2px] border',
          kpi.duplicates > 0
            ? 'text-[#FDB52A] bg-[#FDB52A]/20 border-[#FDB52A]/30'
            : 'text-[#14CA74] bg-[#05C168]/20 border-[#05C168]/30'
        ]">
          {{ kpi.duplicates > 0 ? 'Cần đối soát' : 'Đạt chuẩn' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { 
  Package, 
  Scale, 
  Search, 
  Truck, 
  Siren,
  ArrowUpRight, 
  ArrowDownRight 
} from 'lucide-vue-next'
import { KpiState } from '@/types'
import { formatNumber } from '@/utils/format'

const props = defineProps<{
  kpi: KpiState
}>()

const isDiffNegative = computed(() => {
  return props.kpi.diff < 0
})

const formattedTotalActual = computed(() => {
  if (props.kpi.totalActual >= 1000) {
    return (props.kpi.totalActual / 1000).toFixed(1) + 'K'
  }
  return props.kpi.totalActual > 0 ? formatNumber(props.kpi.totalActual) : '0'
})

const formattedDiff = computed(() => {
  const diff = props.kpi.diff
  const sign = diff > 0 ? '+' : ''
  if (Math.abs(diff) >= 1000) {
    return sign + (diff / 1000).toFixed(1) + 'K'
  }
  return sign + formatNumber(diff)
})
</script>
