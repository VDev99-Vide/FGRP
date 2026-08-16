<template>
  <div class="glass-card-dark p-6 lg:p-8 flex flex-col justify-between relative overflow-hidden">
    <!-- Header Block with Title & Right Legend -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
      <!-- Left Metric Info + Header Actual vs iScala & Tỷ Lệ Chênh Lệch -->
      <div class="flex flex-col sm:flex-row sm:items-baseline gap-4 sm:gap-8">
        <div>
          <div class="flex items-center gap-2 mb-1.5">
            <span class="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#14CA74] bg-[#05C168]/20 border border-[#05C168]/30 px-2 py-0.5 rounded-[2px]">
              {{ totalDiffPercent }}
              <ArrowUpRight class="w-3 h-3 stroke-[2.5]" />
            </span>
          </div>
          <p class="text-xs text-[#AEB9E1] font-medium">Tổng số lượng PCS</p>
          <h2 class="text-2xl lg:text-3xl font-bold text-white tracking-tight mt-0.5">
            {{ formattedTotalPcs }}(PCS)
          </h2>
        </div>

        <div class="sm:pl-8 sm:border-l border-white/10 flex flex-col justify-end">
          <p class="text-xs font-bold text-[#AEB9E1] uppercase tracking-wider">Actual vs iScala &amp; Tỷ Lệ Chênh Lệch</p>
          <p class="text-[11px] text-[#AEB9E1]/70 mt-0.5">So sánh chi tiết dữ liệu thực tế và hệ thống iScala theo từng Feature</p>
        </div>
      </div>

      <!-- Right Legends (ISCALA & ACTUAL) -->
      <div class="flex items-center gap-6">
        <!-- ISCALA Legend -->
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-[#CB3CFF] shadow-[0_0_8px_#CB3CFF]"></span>
          <span class="text-xs font-bold text-white tracking-wider">ISCALA</span>
        </div>

        <!-- ACTUAL Legend -->
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-[#00C2FF] shadow-[0_0_8px_#00C2FF]"></span>
          <span class="text-xs font-bold text-white tracking-wider">ACTUAL</span>
        </div>
      </div>
    </div>

    <!-- ECharts Wave Chart Canvas -->
    <div class="w-full h-[340px] sm:h-[380px] min-h-[300px]">
      <v-chart class="w-full h-full" :option="chartOption" :autoresize="true" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUpRight } from 'lucide-vue-next'
import { SummaryAnalysisRow } from '@/types'
import { formatNumber } from '@/utils/format'

const props = defineProps<{
  data: SummaryAnalysisRow[]
}>()

// Format total PCS dynamically
const formattedTotalPcs = computed(() => {
  if (!props.data || props.data.length === 0) return '55.000'
  const total = props.data.reduce((sum, d) => sum + (Number(d.actual) || 0), 0)
  return total > 0 ? formatNumber(total) : '55.000'
})

// Calculate total diff percent
const totalDiffPercent = computed(() => {
  if (!props.data || props.data.length === 0) return '28.4%'
  const totalActual = props.data.reduce((sum, d) => sum + (Number(d.actual) || 0), 0)
  const totalIscala = props.data.reduce((sum, d) => sum + (Number(d.iscala) || 0), 0)

  if (totalIscala === 0) return '+100%'
  const diff = totalActual - totalIscala
  const pct = (diff / totalIscala) * 100
  return (pct > 0 ? '+' : '') + pct.toFixed(1) + '%'
})

// ECharts Neon Wave Options matching image.png
const chartOption = computed(() => {
  // Use real data features or default design sample sequence
  let features = ['1009', '1010', '2072', '2032', '3569', '3565', '3695', '4151', '4152', '4183', '5151', '5152', '5183', '6026', '6072', '8634', '8695']
  let actuals = [450, 680, 1100, 1850, 3100, 4200, 4800, 4700, 4600, 4900, 5200, 5600, 6100, 6500, 6900, 7400, 7800]
  let iscalas = [1500, 1750, 1600, 1200, 1800, 2600, 3800, 4800, 5100, 4800, 4200, 3600, 3100, 2700, 2500, 2600, 2900]

  if (props.data && props.data.length > 0) {
    const validData = [...props.data].filter(d => d.feature && d.feature !== 'No data')
    if (validData.length > 0) {
      features = validData.map(d => d.feature)
      actuals = validData.map(d => Number(d.actual) || 0)
      iscalas = validData.map(d => Number(d.iscala) || 0)
    }
  }

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(24, 32, 45, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.15)',
      borderWidth: 1,
      padding: [14, 18],
      extraCssText: 'backdrop-filter: blur(16px); border-radius: 12px; box-shadow: 0 16px 36px rgba(0,0,0,0.55); min-width: 220px;',
      textStyle: {
        color: '#FFFFFF',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: 12
      },
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: 'rgba(203, 60, 255, 0.4)',
          type: 'dashed'
        }
      },
      formatter: (params: any[]) => {
        const feat = params[0]?.axisValue || ''
        let actualVal = 0
        let iscalaVal = 0

        params.forEach(p => {
          if (p.seriesName === 'ACTUAL') actualVal = Number(p.value) || 0
          if (p.seriesName === 'ISCALA') iscalaVal = Number(p.value) || 0
        })

        const diff = actualVal - iscalaVal
        const diffPercent = iscalaVal > 0 
          ? ((diff / iscalaVal) * 100) 
          : (actualVal > 0 ? 100 : 0)
        
        const diffPercentFormatted = (diffPercent > 0 ? '+' : '') + diffPercent.toFixed(1) + '%'
        const diffFormatted = (diff > 0 ? '+' : '') + formatNumber(diff) + ' PCS'
        const diffColor = diff > 0 ? '#14CA74' : (diff < 0 ? '#FF5A65' : '#AEB9E1')

        let res = `
          <div style="font-weight:700;margin-bottom:8px;color:#FFFFFF;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:5px">
            FEATURE: ${feat}
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin:4px 0">
            <span style="width:8px;height:8px;border-radius:50%;background:#00C2FF;box-shadow:0 0 6px #00C2FF"></span>
            <span style="color:#AEB9E1;font-size:11px">ACTUAL:</span>
            <span style="font-weight:700;color:#FFFFFF;margin-left:auto">${formatNumber(actualVal)} PCS</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin:4px 0">
            <span style="width:8px;height:8px;border-radius:50%;background:#CB3CFF;box-shadow:0 0 6px #CB3CFF"></span>
            <span style="color:#AEB9E1;font-size:11px">ISCALA:</span>
            <span style="font-weight:700;color:#FFFFFF;margin-left:auto">${formatNumber(iscalaVal)} PCS</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px;padding-top:6px;border-top:1px dashed rgba(255,255,255,0.12)">
            <span style="color:#AEB9E1;font-size:11px;font-weight:600">Tỷ Lệ Chênh Lệch:</span>
            <span style="font-weight:700;color:${diffColor};font-size:11px">${diffFormatted} (${diffPercentFormatted})</span>
          </div>
        `
        return res
      }
    },
    grid: {
      left: '2%',
      right: '2%',
      top: '6%',
      bottom: '8%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: features,
      boundaryGap: false,
      axisLine: {
        lineStyle: { color: 'rgba(255, 255, 255, 0.08)' }
      },
      axisTick: { show: false },
      axisLabel: {
        color: '#AEB9E1',
        fontSize: 11,
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        margin: 14
      }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.04)',
          type: 'solid'
        }
      },
      axisLabel: {
        color: '#AEB9E1',
        fontSize: 11,
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        formatter: (val: number) => val >= 1000 ? `${val / 1000}k` : val
      }
    },
    series: [
      // 1. ISCALA (Smooth Neon Purple Wave with Glow)
      {
        name: 'ISCALA',
        type: 'line',
        data: iscalas,
        smooth: 0.5,
        showSymbol: false,
        symbolSize: 6,
        lineStyle: {
          width: 3,
          color: '#CB3CFF',
          shadowColor: 'rgba(203, 60, 255, 0.55)',
          shadowBlur: 14
        },
        itemStyle: {
          color: '#CB3CFF',
          borderColor: '#FFFFFF',
          borderWidth: 1.5
        },
        emphasis: {
          scale: 1.8,
          itemStyle: {
            color: '#CB3CFF',
            borderColor: '#FFFFFF',
            borderWidth: 2
          }
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(203, 60, 255, 0.18)' },
              { offset: 1, color: 'rgba(203, 60, 255, 0.00)' }
            ]
          }
        }
      },
      // 2. ACTUAL (Smooth Neon Cyan Wave with Glow)
      {
        name: 'ACTUAL',
        type: 'line',
        data: actuals,
        smooth: 0.5,
        showSymbol: false,
        symbolSize: 6,
        lineStyle: {
          width: 3,
          color: '#00C2FF',
          shadowColor: 'rgba(0, 194, 255, 0.55)',
          shadowBlur: 14
        },
        itemStyle: {
          color: '#00C2FF',
          borderColor: '#FFFFFF',
          borderWidth: 1.5
        },
        emphasis: {
          scale: 1.8,
          itemStyle: {
            color: '#00C2FF',
            borderColor: '#FFFFFF',
            borderWidth: 2
          }
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(0, 194, 255, 0.16)' },
              { offset: 1, color: 'rgba(0, 194, 255, 0.00)' }
            ]
          }
        }
      }
    ]
  }
})
</script>
