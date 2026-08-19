<template>
  <div class="glass-card-dark p-6 lg:p-8 flex flex-col justify-between relative overflow-hidden h-full">
    <!-- Card Header -->
    <div class="flex items-center justify-between pb-3 border-b border-white/[0.08]">
      <div class="flex items-center gap-2.5">
        <div class="w-2 h-5 bg-[#00C2FF] rounded-full shadow-[0_0_8px_#00C2FF]"></div>
        <div>
          <h3 class="text-base lg:text-lg font-bold text-white tracking-wide">
            Phân Tích Rủi Ro Lệch Kho
          </h3>
          <p class="text-[11px] text-[#AEB9E1]">
            <span v-if="topDiscrepancyItems.length === 0">
              Hệ thống không ghi nhận mã hàng chênh lệch
            </span>
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-[4px] bg-[#CB3CFF]/15 border border-[#CB3CFF]/30 text-[#CB3CFF]">
          Actual vs iScala
        </span>
      </div>
    </div>

    <!-- Center Radial Rings Graphic Area (Tăng 10% kích thước, tỷ lệ lấp đầy % trực quan) -->
    <div class="relative flex-1 flex items-center justify-center min-h-[290px] py-4">
      <svg class="w-full max-w-[380px] h-[280px] select-none" viewBox="0 0 380 280" fill="none">
        <defs>
          <filter id="glowCenter" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#CB3CFF" flood-opacity="0.6"/>
          </filter>
        </defs>

        <!-- Background Track Rings (Chỉ hiện các vòng có mã bị lệch) -->
        <template v-if="topDiscrepancyItems.length > 0">
          <circle 
            v-for="item in topDiscrepancyItems" 
            :key="'track-' + item.feature"
            cx="190" 
            cy="140" 
            :r="item.radius" 
            stroke="rgba(255,255,255,0.06)" 
            stroke-width="8.5" 
            fill="none" 
          />
        </template>
        <template v-else>
          <!-- Safe ring when 0 discrepancy -->
          <circle cx="190" cy="140" r="100" stroke="#14CA74" stroke-opacity="0.3" stroke-width="8" fill="none" />
        </template>

        <!-- Progress Arcs for Top discrepancy items (Lấp đầy chính xác theo % lệch) -->
        <g transform="rotate(-90 190 140)">
          <circle
            v-for="item in topDiscrepancyItems"
            :key="'arc-' + item.feature"
            cx="190"
            cy="140"
            :r="item.radius"
            :stroke="item.color"
            stroke-width="8.5"
            stroke-linecap="round"
            fill="none"
            :stroke-dasharray="2 * Math.PI * item.radius"
            :stroke-dashoffset="2 * Math.PI * item.radius * (1 - item.ringRatio)"
            class="transition-all duration-1000 ease-out"
            :style="{ filter: `drop-shadow(0 0 6px ${item.color})` }"
          />
        </g>

        <!-- Center Value Label -->
        <template v-if="topDiscrepancyItems.length > 0">
          <text 
            x="190" 
            y="136" 
            text-anchor="middle" 
            fill="#FFFFFF" 
            font-size="15" 
            font-weight="bold" 
            font-family="Plus Jakarta Sans, sans-serif"
            letter-spacing="0.5"
          >
            TOP {{ topDiscrepancyItems.length }}
          </text>
          <text 
            x="190" 
            y="150" 
            text-anchor="middle" 
            fill="#AEB9E1" 
            font-size="9.5" 
            font-weight="600" 
            font-family="Plus Jakarta Sans, sans-serif"
            letter-spacing="0.8"
          >
            LỆCH KHO
          </text>
        </template>
        <template v-else>
          <text x="190" y="136" text-anchor="middle" fill="#14CA74" font-size="15" font-weight="bold">100%</text>
          <text x="190" y="150" text-anchor="middle" fill="#AEB9E1" font-size="9.5" font-weight="600">KHỚP KHO</text>
        </template>
      </svg>
    </div>

    <!-- Bottom Legends: Chỉ hiển thị các mã có chênh lệch thực tế -->
    <div class="pt-4 border-t border-white/[0.08]">
      <div v-if="topDiscrepancyItems.length > 0" class="flex flex-wrap items-center justify-center gap-3">
        <div 
          v-for="item in topDiscrepancyItems" 
          :key="item.feature"
          class="flex flex-col p-2.5 px-3 rounded-[10px] bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition min-w-[135px]"
        >
          <div class="flex items-center gap-2 mb-1">
            <span 
              class="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
              :style="{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}` }"
            ></span>
            <span class="text-xs font-bold text-white font-mono">{{ item.feature }}</span>
            <span 
              :class="[
                'font-bold text-[10px] ml-auto px-1.5 py-0.2 rounded',
                item.diff < 0 ? 'text-[#FF5A65] bg-[#FF5A65]/15' : 'text-[#14CA74] bg-[#05C168]/15'
              ]"
            >
              {{ item.diffPercentStr }}
            </span>
          </div>
          <div class="flex items-baseline justify-between text-[11px] mt-0.5">
            <span class="text-[#AEB9E1]">Lệch:</span>
            <span class="text-white font-mono font-bold">{{ item.diffSign }}{{ formatNumber(Math.abs(item.diff)) }} PCS</span>
          </div>
        </div>
      </div>

      <!-- Khi không có mã nào lệch (100% khớp) -->
      <div v-else class="text-center py-2 text-xs text-[#14CA74] font-semibold flex items-center justify-center gap-2">
        <span class="w-2 h-2 rounded-full bg-[#14CA74] animate-pulse"></span>
        <span>Toàn bộ mã hàng khớp 100% với hệ thống iScala</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SummaryAnalysisRow } from '@/types'
import { formatNumber } from '@/utils/format'

const props = defineProps<{
  summaryData?: SummaryAnalysisRow[]
}>()

interface DiscrepancyItem {
  feature: string
  diff: number
  diffSign: string
  percentVal: number
  diffPercentStr: string
  ringRatio: number
  radius: number
  color: string
}

// Bán kính cho các vòng tròn lồng nhau (tăng 10% kích thước)
const ringRadii = [120, 102, 84, 66, 48]
const neonColors = ['#CB3CFF', '#00C2FF', '#2F6FED', '#FDB52A', '#FF5A65']

// Tính toán danh sách Top các mã có chênh lệch thực tế (diff !== 0)
const topDiscrepancyItems = computed<DiscrepancyItem[]>(() => {
  if (!props.summaryData || props.summaryData.length === 0) {
    return []
  }

  // 1. Chỉ lọc các mã có chênh lệch thực tế (diff khác 0)
  const validDiscrepancies = props.summaryData.filter(d => {
    return d.feature && d.feature !== 'No data' && Math.abs(Number(d.diff) || 0) > 0
  })

  // 2. Sắp xếp theo độ lệch tuyệt đối giảm dần (lấy tối đa top 5 mã)
  const sorted = [...validDiscrepancies]
    .sort((a, b) => Math.abs(Number(b.diff) || 0) - Math.abs(Number(a.diff) || 0))
    .slice(0, 5)

  return sorted.map((d, idx) => {
    const diff = Number(d.diff) || 0
    const percent = Math.abs(Number(d.diff_percent) || 0)
    
    // Tỷ lệ lấp đầy vòng tròn theo % lệch: 50% -> 0.50, 5% -> 0.05
    const ratio = Math.min(1, Math.max(0.02, percent / 100))

    return {
      feature: d.feature,
      diff,
      diffSign: diff > 0 ? '+' : (diff < 0 ? '-' : ''),
      percentVal: percent,
      diffPercentStr: (diff > 0 ? '+' : '-') + percent.toFixed(1) + '%',
      ringRatio: ratio,
      radius: ringRadii[idx] || (120 - idx * 18),
      color: neonColors[idx % neonColors.length]
    }
  })
})
</script>
