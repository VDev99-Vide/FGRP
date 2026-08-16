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
          <p class="text-[11px] text-[#AEB9E1]">Top 5 Mã hàng chênh lệch lớn nhất kho</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-[11px] font-bold px-2 py-0.5 rounded-[4px] bg-[#CB3CFF]/15 border border-[#CB3CFF]/30 text-[#CB3CFF]">
          Actual vs iScala
        </span>
      </div>
    </div>

    <!-- Center Radial Rings Graphic Area -->
    <div class="relative flex-1 flex items-center justify-center min-h-[260px] py-4">
      <svg class="w-full max-w-[340px] h-[250px] select-none" viewBox="0 0 340 250" fill="none">
        <defs>
          <filter id="glowCenter" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#CB3CFF" flood-opacity="0.5"/>
          </filter>
        </defs>

        <!-- Background Track Rings -->
        <circle cx="170" cy="125" r="108" stroke="rgba(255,255,255,0.06)" stroke-width="7.5" fill="none" />
        <circle cx="170" cy="125" r="92" stroke="rgba(255,255,255,0.06)" stroke-width="7.5" fill="none" />
        <circle cx="170" cy="125" r="76" stroke="rgba(255,255,255,0.06)" stroke-width="7.5" fill="none" />
        <circle cx="170" cy="125" r="60" stroke="rgba(255,255,255,0.06)" stroke-width="7.5" fill="none" />
        <circle cx="170" cy="125" r="44" stroke="rgba(255,255,255,0.06)" stroke-width="7.5" fill="none" />

        <!-- Progress Arcs for Top 5 items with Neon Colors -->
        <g transform="rotate(-90 170 125)">
          <!-- Ring 1: Outermost (Radius 108) -->
          <circle
            v-if="top5Items[0]"
            cx="170"
            cy="125"
            r="108"
            :stroke="top5Items[0].color"
            stroke-width="7.5"
            stroke-linecap="round"
            fill="none"
            :stroke-dasharray="2 * Math.PI * 108"
            :stroke-dashoffset="2 * Math.PI * 108 * (1 - top5Items[0].ringRatio)"
            class="transition-all duration-1000 ease-out"
          />

          <!-- Ring 2: Radius 92 -->
          <circle
            v-if="top5Items[1]"
            cx="170"
            cy="125"
            r="92"
            :stroke="top5Items[1].color"
            stroke-width="7.5"
            stroke-linecap="round"
            fill="none"
            :stroke-dasharray="2 * Math.PI * 92"
            :stroke-dashoffset="2 * Math.PI * 92 * (1 - top5Items[1].ringRatio)"
            class="transition-all duration-1000 ease-out"
          />

          <!-- Ring 3: Radius 76 -->
          <circle
            v-if="top5Items[2]"
            cx="170"
            cy="125"
            r="76"
            :stroke="top5Items[2].color"
            stroke-width="7.5"
            stroke-linecap="round"
            fill="none"
            :stroke-dasharray="2 * Math.PI * 76"
            :stroke-dashoffset="2 * Math.PI * 76 * (1 - top5Items[2].ringRatio)"
            class="transition-all duration-1000 ease-out"
          />

          <!-- Ring 4: Radius 60 -->
          <circle
            v-if="top5Items[3]"
            cx="170"
            cy="125"
            r="60"
            :stroke="top5Items[3].color"
            stroke-width="7.5"
            stroke-linecap="round"
            fill="none"
            :stroke-dasharray="2 * Math.PI * 60"
            :stroke-dashoffset="2 * Math.PI * 60 * (1 - top5Items[3].ringRatio)"
            class="transition-all duration-1000 ease-out"
          />

          <!-- Ring 5: Innermost (Radius 44) -->
          <circle
            v-if="top5Items[4]"
            cx="170"
            cy="125"
            r="44"
            :stroke="top5Items[4].color"
            stroke-width="7.5"
            stroke-linecap="round"
            fill="none"
            :stroke-dasharray="2 * Math.PI * 44"
            :stroke-dashoffset="2 * Math.PI * 44 * (1 - top5Items[4].ringRatio)"
            class="transition-all duration-1000 ease-out"
          />
        </g>

        <!-- Center Value Label Fitted cleanly inside innermost ring -->
        <text 
          x="170" 
          y="121" 
          text-anchor="middle" 
          fill="#FFFFFF" 
          font-size="14" 
          font-weight="bold" 
          font-family="Plus Jakarta Sans, sans-serif"
          letter-spacing="0.5"
        >
          TOP 5
        </text>
        <text 
          x="170" 
          y="134" 
          text-anchor="middle" 
          fill="#AEB9E1" 
          font-size="8.5" 
          font-weight="600" 
          font-family="Plus Jakarta Sans, sans-serif"
          letter-spacing="0.8"
        >
          LỆCH KHO
        </text>
      </svg>
    </div>

    <!-- Bottom Legends: Top 5 Items Breakdown -->
    <div class="pt-4 border-t border-white/[0.08] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
      <div 
        v-for="item in top5Items" 
        :key="item.feature"
        class="flex flex-col p-2 rounded-[8px] bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition"
      >
        <div class="flex items-center gap-1.5 mb-1">
          <span 
            class="w-2 h-2 rounded-full shrink-0 shadow-sm"
            :style="{ backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}` }"
          ></span>
          <span class="text-xs font-bold text-white font-mono truncate">{{ item.feature }}</span>
        </div>
        <div class="flex items-baseline justify-between text-[11px]">
          <span class="text-[#AEB9E1] font-mono">{{ item.diffSign }}{{ formatNumber(Math.abs(item.diff)) }}</span>
          <span 
            :class="[
              'font-bold text-[10px]',
              item.diff < 0 ? 'text-[#FF5A65]' : 'text-[#14CA74]'
            ]"
          >
            {{ item.diffPercentStr }}
          </span>
        </div>
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

// Compute Top 5 items with largest absolute discrepancy
const top5Items = computed(() => {
  const neonColors = ['#CB3CFF', '#00C2FF', '#2F6FED', '#FDB52A', '#14CA74']

  if (!props.summaryData || props.summaryData.length === 0) {
    const defaultData = [
      { feature: '5151', diff: 3000, percent: 96.8 },
      { feature: '3569', diff: 1300, percent: 72.2 },
      { feature: '1009', diff: 1000, percent: 26.3 },
      { feature: '1010', diff: 1000, percent: 23.8 },
      { feature: '2072', diff: -500, percent: -9.8 }
    ]
    return defaultData.map((d, idx) => ({
      feature: d.feature,
      diff: d.diff,
      diffSign: d.diff > 0 ? '+' : (d.diff < 0 ? '-' : ''),
      diffPercentStr: (d.diff > 0 ? '+' : '') + d.percent.toFixed(1) + '%',
      ringRatio: Math.min(0.95, Math.max(0.2, (5 - idx) * 0.18)),
      color: neonColors[idx % neonColors.length]
    }))
  }

  const valid = props.summaryData.filter(d => d.feature && d.feature !== 'No data')
  const sorted = [...valid].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 5)

  // Max diff for calculating relative ring stroke
  const maxDiff = Math.max(...sorted.map(d => Math.abs(d.diff)), 1)

  return sorted.map((d, idx) => {
    const diff = Number(d.diff) || 0
    const percent = Number(d.diff_percent) || 0
    const ratio = Math.min(0.95, Math.max(0.25, Math.abs(diff) / maxDiff))

    return {
      feature: d.feature,
      diff,
      diffSign: diff > 0 ? '+' : (diff < 0 ? '-' : ''),
      diffPercentStr: (percent > 0 ? '+' : '') + percent.toFixed(1) + '%',
      ringRatio: ratio,
      color: neonColors[idx % neonColors.length]
    }
  })
})
</script>
