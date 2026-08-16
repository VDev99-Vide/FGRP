<template>
  <div class="risk-chart-container w-full h-[420px] rounded-[20px] overflow-hidden flex flex-col p-5 relative" style="background: #0A0D10;">
    <!-- Top Header Bar -->
    <div class="flex items-center justify-between pb-2 select-none">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full bg-[#F72585] animate-pulse"></div>
        <span class="text-white font-black text-xs tracking-wider uppercase">PHÂN BỔ RỦI RO LỆCH KHO</span>
      </div>
      <div class="text-[10px] font-bold text-slate-400">
        {{ ringItems.length }} Vùng Phân Tích
      </div>
    </div>

    <!-- Center Radial Rings Graphic Area mirroring the exact SVG -->
    <div class="relative flex-1 flex items-center justify-center min-h-0 py-2">
      <svg 
        class="w-full h-full max-h-[290px] select-none" 
        viewBox="0 0 360 258" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <clipPath id="chartClip">
            <rect width="360" height="258" rx="20" fill="white"/>
          </clipPath>
          <!-- Filters for active glow -->
          <filter id="glowGold" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#FFC300" flood-opacity="0.6"/>
          </filter>
          <filter id="glowPink" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#F72585" flood-opacity="0.6"/>
          </filter>
          <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#4CC9F0" flood-opacity="0.6"/>
          </filter>
          <filter id="glowLime" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#5ED500" flood-opacity="0.6"/>
          </filter>
          <filter id="glowTeal" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#005F73" flood-opacity="0.6"/>
          </filter>
        </defs>

        <g clip-path="url(#chartClip)">
          <!-- 1. Concentric Base Track Rings (#151A20) matching SVG -->
          <!-- Ring 1 (Innermost) -->
          <circle cx="180" cy="129" r="54" stroke="#151A20" stroke-width="6.5" fill="none" />
          <!-- Ring 2 -->
          <circle cx="180" cy="129" r="69" stroke="#151A20" stroke-width="7.5" fill="none" />
          <!-- Ring 3 -->
          <circle cx="180" cy="129" r="84" stroke="#151A20" stroke-width="8.5" fill="none" />
          <!-- Ring 4 -->
          <circle cx="180" cy="129" r="100" stroke="#151A20" stroke-width="10" fill="none" />
          <!-- Ring 5 (Outermost) -->
          <circle cx="180" cy="129" r="116" stroke="#151A20" stroke-width="11.5" fill="none" />

          <!-- 2. Active Progress Arc Rings with Rounded Caps -->
          <g transform="rotate(-90 180 129)">
            <!-- Ring 5: Deep Teal (#005F73) - Outermost -->
            <circle
              v-if="ringItems[4]"
              cx="180"
              cy="129"
              r="116"
              stroke="#005F73"
              stroke-width="11.5"
              stroke-linecap="round"
              fill="none"
              :stroke-dasharray="2 * Math.PI * 116"
              :stroke-dashoffset="2 * Math.PI * 116 * (1 - (ringItems[4].percent / 100))"
              class="transition-all duration-1000 ease-out cursor-pointer hover:opacity-90 hover:stroke-[13px]"
              @mouseenter="hoveredItem = ringItems[4]"
              @mouseleave="hoveredItem = null"
            />

            <!-- Ring 4: Electric Lime (#5ED500) -->
            <circle
              v-if="ringItems[3]"
              cx="180"
              cy="129"
              r="100"
              stroke="#5ED500"
              stroke-width="10"
              stroke-linecap="round"
              fill="none"
              :stroke-dasharray="2 * Math.PI * 100"
              :stroke-dashoffset="2 * Math.PI * 100 * (1 - (ringItems[3].percent / 100))"
              class="transition-all duration-1000 ease-out cursor-pointer hover:opacity-90 hover:stroke-[11.5px]"
              @mouseenter="hoveredItem = ringItems[3]"
              @mouseleave="hoveredItem = null"
            />

            <!-- Ring 3: Sky Blue (#4CC9F0) -->
            <circle
              v-if="ringItems[2]"
              cx="180"
              cy="129"
              r="84"
              stroke="#4CC9F0"
              stroke-width="8.5"
              stroke-linecap="round"
              fill="none"
              :stroke-dasharray="2 * Math.PI * 84"
              :stroke-dashoffset="2 * Math.PI * 84 * (1 - (ringItems[2].percent / 100))"
              class="transition-all duration-1000 ease-out cursor-pointer hover:opacity-90 hover:stroke-[10px]"
              @mouseenter="hoveredItem = ringItems[2]"
              @mouseleave="hoveredItem = null"
            />

            <!-- Ring 2: Hot Pink (#F72585) -->
            <circle
              v-if="ringItems[1]"
              cx="180"
              cy="129"
              r="69"
              stroke="#F72585"
              stroke-width="7.5"
              stroke-linecap="round"
              fill="none"
              :stroke-dasharray="2 * Math.PI * 69"
              :stroke-dashoffset="2 * Math.PI * 69 * (1 - (ringItems[1].percent / 100))"
              class="transition-all duration-1000 ease-out cursor-pointer hover:opacity-90 hover:stroke-[9px]"
              @mouseenter="hoveredItem = ringItems[1]"
              @mouseleave="hoveredItem = null"
            />

            <!-- Ring 1: Vivid Amber Gold (#FFC300) - Innermost -->
            <circle
              v-if="ringItems[0]"
              cx="180"
              cy="129"
              r="54"
              stroke="#FFC300"
              stroke-width="6.5"
              stroke-linecap="round"
              fill="none"
              :stroke-dasharray="2 * Math.PI * 54"
              :stroke-dashoffset="2 * Math.PI * 54 * (1 - (ringItems[0].percent / 100))"
              class="transition-all duration-1000 ease-out cursor-pointer hover:opacity-90 hover:stroke-[8px]"
              @mouseenter="hoveredItem = ringItems[0]"
              @mouseleave="hoveredItem = null"
            />
          </g>

          <!-- 3. Center Text Indicator -->
          <text 
            x="180" 
            y="125" 
            text-anchor="middle" 
            dominant-baseline="central" 
            fill="#FFFFFF" 
            font-size="20" 
            font-weight="900" 
            font-family="Plus Jakarta Sans, sans-serif"
            letter-spacing="-0.5"
          >
            {{ centerStat.mainText }}
          </text>
          <text 
            x="180" 
            y="142" 
            text-anchor="middle" 
            dominant-baseline="central" 
            fill="#64748B" 
            font-size="8.5" 
            font-weight="800" 
            font-family="Plus Jakarta Sans, sans-serif"
            letter-spacing="0.5"
          >
            {{ centerStat.subText }}
          </text>
        </g>
      </svg>

      <!-- Hover Tooltip Floating Panel -->
      <transition name="fade">
        <div 
          v-if="hoveredItem" 
          class="absolute z-20 top-2 right-2 bg-slate-950/95 backdrop-blur-md p-3 rounded-xl border border-slate-700/60 shadow-xl text-left pointer-events-none min-w-[140px]"
        >
          <div class="flex items-center gap-2 mb-1.5">
            <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: hoveredItem.color }"></span>
            <span class="text-white font-extrabold text-xs">FEAT {{ hoveredItem.feature }}</span>
          </div>
          <div class="text-[11px] text-slate-300 flex justify-between gap-3">
            <span>Lệch:</span>
            <span class="font-bold text-white">{{ formatNumber(hoveredItem.diff) }} PCS</span>
          </div>
          <div class="text-[11px] text-slate-300 flex justify-between gap-3">
            <span>Tỷ lệ:</span>
            <span class="font-bold" :style="{ color: hoveredItem.color }">{{ hoveredItem.diffPercent }}%</span>
          </div>
        </div>
      </transition>
    </div>

    <!-- Bottom Feature Ring Badges -->
    <div class="pt-2 border-t border-slate-800/80 grid grid-cols-5 gap-1.5">
      <div 
        v-for="item in ringItems" 
        :key="item.feature"
        @mouseenter="hoveredItem = item"
        @mouseleave="hoveredItem = null"
        :class="[
          'flex flex-col items-center p-1.5 rounded-lg border transition-all cursor-pointer text-center',
          hoveredItem?.feature === item.feature 
            ? 'bg-white/10 border-slate-500 scale-105' 
            : 'bg-white/5 border-white/5 hover:bg-white/10'
        ]"
      >
        <div class="flex items-center gap-1 mb-0.5">
          <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: item.color }"></span>
          <span class="text-[10px] font-black text-slate-200 truncate max-w-[45px]">{{ item.feature }}</span>
        </div>
        <span class="text-[9px] font-extrabold" :style="{ color: item.color }">
          {{ item.diffPercent }}%
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { SummaryAnalysisRow } from '@/types'
import { formatNumber } from '@/utils/format'

const props = defineProps<{
  data: SummaryAnalysisRow[]
}>()

const hoveredItem = ref<any | null>(null)

// 5 Distinct Color Palette matching the SVG concentric rings
const RING_COLORS = [
  '#FFC300', // Ring 1: Vivid Amber Gold (Innermost)
  '#F72585', // Ring 2: Neon Magenta / Hot Pink
  '#4CC9F0', // Ring 3: Sky Blue / Cyan
  '#5ED500', // Ring 4: Electric Lime Green
  '#005F73'  // Ring 5: Deep Teal (Outermost)
]

// Process top 5 discrepancy features
const ringItems = computed(() => {
  if (!props.data || props.data.length === 0) {
    // Default placeholder rings if data empty
    return [
      { feature: '1009', diff: 120, diffPercent: 18.5, percent: 85, color: '#FFC300' },
      { feature: '1010', diff: 95, diffPercent: 12.0, percent: 72, color: '#F72585' },
      { feature: '1011', diff: 60, diffPercent: 8.5, percent: 58, color: '#4CC9F0' },
      { feature: '1012', diff: 45, diffPercent: 6.2, percent: 45, color: '#5ED500' },
      { feature: '1014', diff: 30, diffPercent: 4.1, percent: 32, color: '#005F73' }
    ]
  }

  // Sort features by absolute difference in quantity
  const sorted = [...props.data]
    .filter(d => d.feature && d.feature !== 'No data')
    .sort((a, b) => Math.abs(Number(b.diff) || 0) - Math.abs(Number(a.diff) || 0))
    .slice(0, 5)

  // Maximum diff for relative arc scaling
  const maxDiff = Math.max(...sorted.map(d => Math.abs(Number(d.diff) || 0)), 1)

  return sorted.map((row, idx) => {
    const diff = Math.abs(Number(row.diff) || 0)
    const diffPercent = Math.abs(Number(row.diff_percent) || 0)
    // Scale arc length visually between 25% and 92%
    const relativePct = Math.min(92, Math.max(25, (diff / maxDiff) * 90))

    return {
      feature: row.feature,
      diff,
      diffPercent,
      percent: relativePct,
      color: RING_COLORS[idx % RING_COLORS.length]
    }
  })
})

// Central Accuracy / Consistency Metric
const centerStat = computed(() => {
  if (!props.data || props.data.length === 0) {
    return { mainText: '98.00%', subText: 'ACCURACY' }
  }

  const totalActual = props.data.reduce((sum, d) => sum + (Number(d.actual) || 0), 0)
  const totalIscala = props.data.reduce((sum, d) => sum + (Number(d.iscala) || 0), 0)

  if (totalIscala === 0) {
    return { mainText: '100.00%', subText: 'MATCH RATE' }
  }

  const absDiff = Math.abs(totalActual - totalIscala)
  const matchRate = Math.max(0, Math.min(100, (1 - (absDiff / totalIscala)) * 100))

  return {
    mainText: `${matchRate.toFixed(2)}%`,
    subText: 'MATCH RATE'
  }
})
</script>

<style scoped>
.risk-chart-container {
  border: 1px solid rgba(50, 75, 85, 0.4);
  box-shadow: 0 8px 32px -4px rgba(0, 0, 0, 0.5),
              0 0 0 1px rgba(247, 37, 133, 0.04);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.risk-chart-container:hover {
  border-color: rgba(247, 37, 133, 0.25);
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.6),
              0 0 0 1px rgba(247, 37, 133, 0.1);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
