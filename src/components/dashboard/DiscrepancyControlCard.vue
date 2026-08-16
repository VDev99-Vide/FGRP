<template>
  <section class="glass-card-dark p-6 lg:p-8 relative overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between pb-6 border-b border-white/5">
      <div class="flex items-center gap-3">
        <div class="w-2 h-6 bg-[#CB3CFF] rounded-full shadow-[0_0_8px_#CB3CFF]"></div>
        <h3 class="text-sm lg:text-base font-bold text-white uppercase tracking-wider">
          Trung Tâm Cảnh Báo Rủi Ro (Discrepancy Control)
        </h3>
      </div>
      <span class="text-xs text-[#AEB9E1] font-medium hidden sm:inline-block">
        Kiểm soát chênh lệch & cảnh báo sớm
      </span>
    </div>

    <!-- 2 Groups Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      <!-- Group 1: Ưu Tiên Xử Lý (No Data & Tồn Thấp) -->
      <div class="glass-panel-subtle p-5 border border-[#FF5A65]/20 bg-[#FF5A65]/5 rounded-xl">
        <div class="flex items-center gap-2.5 mb-5 pb-3 border-b border-[#FF5A65]/20">
          <span class="flex h-2.5 w-2.5 relative">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5A65] opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF5A65]"></span>
          </span>
          <h4 class="text-[#FF5A65] font-bold uppercase text-xs tracking-wider">
            Ưu Tiên Xử Lý (No Data & Tồn Thấp)
          </h4>
        </div>

        <div class="space-y-5">
          <!-- Tag ID Lỗi No Data -->
          <div>
            <p class="text-[11px] font-semibold text-[#AEB9E1] uppercase mb-2.5">
              Tag ID Lỗi "No Data"
            </p>
            <div class="flex flex-wrap gap-2">
              <button 
                v-for="tag in analysis.noData" 
                :key="tag"
                :title="'Bins: ' + [...new Set(inventoryData.filter(r => r.tag_id === tag).map(r => r.bin))].join(', ')"
                class="px-2.5 py-1 bg-[#FF5A65]/15 hover:bg-[#FF5A65]/25 border border-[#FF5A65]/30 rounded-[4px] text-xs font-mono font-bold text-[#FF5A65] transition cursor-help"
              >
                {{ tag }}
              </button>
              <span v-if="analysis.noData.length === 0" class="text-xs text-[#AEB9E1]/60 italic">
                Hệ thống an toàn (Không có lỗi)
              </span>
            </div>
          </div>

          <!-- Feature Tồn Thấp (< 2 Kiện) -->
          <div>
            <p class="text-[11px] font-semibold text-[#AEB9E1] uppercase mb-2.5">
              Feature Tồn Thấp (Dưới 2 Kiện)
            </p>
            <div class="flex flex-wrap gap-2">
              <span 
                v-for="item in analysis.lowStock" 
                :key="item.feat"
                :title="'Hiện có: ' + item.kien + ' Kiện'"
                class="px-2.5 py-1 bg-[#FF5A65]/15 hover:bg-[#FF5A65]/25 border border-[#FF5A65]/30 rounded-[4px] text-xs font-bold text-[#FF5A65] cursor-help transition"
              >
                Feat {{ item.feat }} ({{ item.kien }}k)
              </span>
              <span v-if="analysis.lowStock.length === 0" class="text-xs text-[#AEB9E1]/60 italic">
                Đầy đủ số lượng tồn
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Group 2: Theo Dõi Gần (Trùng Tag & Sắp Hết) -->
      <div class="glass-panel-subtle p-5 border border-[#FDB52A]/20 bg-[#FDB52A]/5 rounded-xl">
        <div class="flex items-center gap-2.5 mb-5 pb-3 border-b border-[#FDB52A]/20">
          <span class="w-2.5 h-2.5 bg-[#FDB52A] rounded-full animate-pulse"></span>
          <h4 class="text-[#FDB52A] font-bold uppercase text-xs tracking-wider">
            Theo Dõi Gần (Trùng Tag & Sắp Hết)
          </h4>
        </div>

        <div class="space-y-5">
          <!-- Tag ID Trùng -->
          <div>
            <p class="text-[11px] font-semibold text-[#AEB9E1] uppercase mb-2.5">
              Tag ID Bị Trùng trong Kho
            </p>
            <div class="flex flex-wrap gap-2">
              <button 
                v-for="tag in analysis.duplicates" 
                :key="tag"
                :title="'Bins: ' + [...new Set(inventoryData.filter(r => r.tag_id === tag).map(r => r.bin))].join(', ')"
                class="px-2.5 py-1 bg-[#FDB52A]/15 hover:bg-[#FDB52A]/25 border border-[#FDB52A]/30 rounded-[4px] text-xs font-mono font-bold text-[#FDB52A] transition cursor-help"
              >
                {{ tag }}
              </button>
              <span v-if="analysis.duplicates.length === 0" class="text-xs text-[#AEB9E1]/60 italic">
                Không phát hiện trùng lặp
              </span>
            </div>
          </div>

          <!-- Feature Sắp Hết (3 đến 5 Kiện) -->
          <div>
            <p class="text-[11px] font-semibold text-[#AEB9E1] uppercase mb-2.5">
              Feature Sắp Hết (Từ 3 đến 5 Kiện)
            </p>
            <div class="flex flex-wrap gap-2">
              <span 
                v-for="item in analysis.midStock" 
                :key="item.feat"
                :title="'Hiện có: ' + item.kien + ' Kiện'"
                class="px-2.5 py-1 bg-[#FDB52A]/15 hover:bg-[#FDB52A]/25 border border-[#FDB52A]/30 rounded-[4px] text-xs font-bold text-[#FDB52A] cursor-help transition"
              >
                Feat {{ item.feat }} ({{ item.kien }}k)
              </span>
              <span v-if="analysis.midStock.length === 0" class="text-xs text-[#AEB9E1]/60 italic">
                Không có feature sắp hết
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { AnalysisState, InventoryRow } from '@/types'

defineProps<{
  analysis: AnalysisState
  inventoryData: InventoryRow[]
}>()
</script>
