<template>
  <div class="glass-card-dark p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 relative overflow-hidden">
    <!-- Left Column: Phân tích Tỷ lệ Tag ID Lỗi & Trùng Lặp -->
    <div class="lg:col-span-5 flex flex-col justify-between gap-6">
      <!-- Title & Big Stat Block -->
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="relative flex h-2.5 w-2.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5A65] opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF5A65]"></span>
          </span>
          <h3 class="text-base lg:text-lg font-bold text-white tracking-wide">
            Kiểm Soát Tag ID Lỗi &amp; Trùng
          </h3>
        </div>
        <p class="text-xs text-[#AEB9E1]">Tỷ lệ chênh lệch &amp; trạng thái rủi ro trên toàn kho</p>

        <div class="flex items-center gap-3 mt-3">
          <span class="text-3xl lg:text-4xl font-bold text-white tracking-tight">
            {{ totalRiskCount }} <span class="text-sm font-normal text-[#AEB9E1]">Tag Rủi Ro</span>
          </span>
          <span :class="[
            'inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-[4px] border backdrop-blur-md',
            totalRiskCount > 0 
              ? 'text-[#FF5A65] bg-[#FF5A65]/20 border-[#FF5A65]/35'
              : 'text-[#14CA74] bg-[#05C168]/20 border-[#05C168]/35'
          ]">
            {{ riskRate }}%
            <AlertCircle class="w-3 h-3 stroke-[2.5]" />
          </span>
        </div>
      </div>

      <!-- Risk Metrics Progress List -->
      <div class="flex flex-col gap-3.5">
        <!-- 1. Tag ID Lỗi (No Data) -->
        <div class="flex flex-col gap-1.5">
          <div class="flex justify-between items-center text-xs">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-[#FF5A65] shadow-[0_0_8px_#FF5A65]"></span>
              <span class="font-bold text-white">Tag ID Lỗi (No Data - Vùng Tâm)</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-[#FF5A65]">{{ errorTagCount }} Tag</span>
              <span class="text-[#AEB9E1] font-mono">({{ errorTagPercent }}%)</span>
            </div>
          </div>
          <div class="w-full h-[6px] rounded-[3px] bg-white/[0.08] overflow-hidden border border-white/5">
            <div 
              class="h-full rounded-[3px] bg-gradient-to-r from-[#FF5A65] to-[#FF8088] shadow-[0_0_10px_#FF5A65] transition-all duration-1000 ease-out" 
              :style="{ width: `${Math.min(100, Math.max(parseFloat(errorTagPercent) * 3, errorTagCount > 0 ? 10 : 0))}%` }"
            />
          </div>
        </div>

        <!-- 2. Tag ID Bị Trùng Lặp -->
        <div class="flex flex-col gap-1.5">
          <div class="flex justify-between items-center text-xs">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-[#FDB52A] shadow-[0_0_8px_#FDB52A]"></span>
              <span class="font-bold text-white">Tag ID Trùng Lặp (Vùng Rìa)</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-[#FDB52A]">{{ duplicateTagCount }} Tag</span>
              <span class="text-[#AEB9E1] font-mono">({{ duplicateTagPercent }}%)</span>
            </div>
          </div>
          <div class="w-full h-[6px] rounded-[3px] bg-white/[0.08] overflow-hidden border border-white/5">
            <div 
              class="h-full rounded-[3px] bg-gradient-to-r from-[#FDB52A] to-[#FDD068] shadow-[0_0_10px_#FDB52A] transition-all duration-1000 ease-out" 
              :style="{ width: `${Math.min(100, Math.max(parseFloat(duplicateTagPercent) * 3, duplicateTagCount > 0 ? 10 : 0))}%` }"
            />
          </div>
        </div>

        <!-- 3. Feature Tồn Thấp (< 2 Kiện) -->
        <div class="flex flex-col gap-1.5">
          <div class="flex justify-between items-center text-xs">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-[#CB3CFF]"></span>
              <span class="text-slate-300 font-medium">Feature Tồn Thấp (&lt; 2k)</span>
            </div>
            <span class="font-bold text-[#CB3CFF]">{{ analysis.lowStock.length }} Feature</span>
          </div>
          <div class="w-full h-[5px] rounded-[2px] bg-white/[0.08] overflow-hidden border border-white/5">
            <div 
              class="h-full rounded-[2px] bg-[#CB3CFF] transition-all duration-1000 ease-out" 
              :style="{ width: `${Math.min(100, analysis.lowStock.length * 20)}%` }"
            />
          </div>
        </div>

        <!-- 4. Feature Sắp Hết (3 - 5 Kiện) -->
        <div class="flex flex-col gap-1.5">
          <div class="flex justify-between items-center text-xs">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-[#00C2FF]"></span>
              <span class="text-slate-300 font-medium">Feature Sắp Hết (3 - 5k)</span>
            </div>
            <span class="font-bold text-[#00C2FF]">{{ analysis.midStock.length }} Feature</span>
          </div>
          <div class="w-full h-[5px] rounded-[2px] bg-white/[0.08] overflow-hidden border border-white/5">
            <div 
              class="h-full rounded-[2px] bg-[#00C2FF] transition-all duration-1000 ease-out" 
              :style="{ width: `${Math.min(100, analysis.midStock.length * 15)}%` }"
            />
          </div>
        </div>

        <!-- 5. Tag Hợp Lệ & An Toàn -->
        <div class="flex flex-col gap-1.5">
          <div class="flex justify-between items-center text-xs">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-[#14CA74]"></span>
              <span class="text-slate-300 font-medium">Tag Hợp Lệ &amp; An Toàn</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-[#14CA74]">{{ safeTagCount }} Tag</span>
              <span class="text-[#AEB9E1] font-mono">({{ safePercent }}%)</span>
            </div>
          </div>
          <div class="w-full h-[5px] rounded-[2px] bg-white/[0.08] overflow-hidden border border-white/5">
            <div 
              class="h-full rounded-[2px] bg-[#14CA74] transition-all duration-1000 ease-out" 
              :style="{ width: `${safePercent}%` }"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Right Column: Khoanh Vùng Lưới Mờ Tọa Độ (Đỏ ở Tâm, Vàng ở Rìa, Hiệu ứng Ping Đồng Bộ 100%) -->
    <div class="lg:col-span-7 border-t lg:border-t-0 lg:border-l border-white/10 lg:pl-8 flex flex-col justify-between min-h-[340px] relative">
      
      <!-- Top Zone Status Bar -->
      <div class="flex items-center justify-between pb-3">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-white tracking-wider uppercase">Radar Grid Matrix</span>
        </div>
        <div class="text-[10px] text-[#AEB9E1] font-mono">
          TRUNG TÂM: <span class="text-[#FF5A65] font-bold">LỖI (RED)</span> | RÌA: <span class="text-[#FDB52A] font-bold">TRÙNG (AMBER)</span>
        </div>
      </div>

      <!-- Frosted Mesh Grid Canvas Container -->
      <div class="relative w-full flex-1 rounded-[16px] border border-white/12 bg-white/[0.03] backdrop-blur-md overflow-hidden p-3 flex items-center justify-center min-h-[280px] shadow-inner select-none">
        
        <!-- Background Coordinate Grid Pattern & Subtle Ambient Glow -->
        <svg class="absolute inset-0 w-full h-full pointer-events-none select-none" viewBox="0 0 600 300" preserveAspectRatio="none" fill="none">
          <defs>
            <!-- Matrix Mesh pattern -->
            <pattern id="radarGridPattern" width="25" height="25" patternUnits="userSpaceOnUse">
              <circle cx="12.5" cy="12.5" r="0.9" fill="#AEB9E1" fill-opacity="0.20" />
            </pattern>
            <!-- Soft center radial gradient -->
            <radialGradient id="centerSoftGlow" cx="50%" cy="50%" r="45%">
              <stop offset="0%" stop-color="#FF5A65" stop-opacity="0.10"/>
              <stop offset="100%" stop-color="#FF5A65" stop-opacity="0.00"/>
            </radialGradient>
          </defs>

          <!-- Grid dot background -->
          <rect width="100%" height="100%" fill="url(#radarGridPattern)" />
          
          <!-- Center ambient color tint -->
          <rect width="100%" height="100%" fill="url(#centerSoftGlow)" />

          <!-- Coordinate Axis Lines (very subtle) -->
          <line x1="300" y1="15" x2="300" y2="285" stroke="rgba(255,255,255,0.06)" stroke-width="1" stroke-dasharray="2 4"/>
          <line x1="30" y1="150" x2="570" y2="150" stroke="rgba(255,255,255,0.06)" stroke-width="1" stroke-dasharray="2 4"/>
        </svg>

        <!-- ------------------------------------------------------------- -->
        <!-- CÁC CHẤM TỌA ĐỘ TRẢI ĐỀU 5% TỪ TÂM RA NGOÀI                    -->
        <!-- ------------------------------------------------------------- -->
        <div class="absolute inset-0 pointer-events-auto">

          <!-- ================= 1. CÁC CHẤM ĐỎ (TAG ID LỖI - TẬP TRUNG TẠI VÙNG TÂM) ================= -->
          
          <!-- Red Dot 1: Tâm chính diện (50%, 50%) -->
          <div class="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <span class="relative flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5A65] opacity-75"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FF5A65] shadow-[0_0_10px_#FF5A65]"></span>
            </span>
          </div>

          <!-- Red Dot 2: Tâm - Bắc 5% (45%, 50%) -->
          <div class="absolute top-[45%] left-[50%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <span class="relative flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5A65] opacity-75" style="animation-delay: 200ms;"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FF5A65] shadow-[0_0_8px_#FF5A65]"></span>
            </span>
          </div>

          <!-- Red Dot 3: Tâm - Nam 5% (55%, 50%) -->
          <div class="absolute top-[55%] left-[50%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <span class="relative flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5A65] opacity-75" style="animation-delay: 400ms;"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FF5A65] shadow-[0_0_8px_#FF5A65]"></span>
            </span>
          </div>

          <!-- Red Dot 4: Tâm - Tây 5% (50%, 45%) -->
          <div class="absolute top-[50%] left-[45%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <span class="relative flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5A65] opacity-75" style="animation-delay: 600ms;"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FF5A65] shadow-[0_0_8px_#FF5A65]"></span>
            </span>
          </div>

          <!-- Red Dot 5: Tâm - Đông 5% (50%, 55%) -->
          <div class="absolute top-[50%] left-[55%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <span class="relative flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5A65] opacity-75" style="animation-delay: 800ms;"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FF5A65] shadow-[0_0_8px_#FF5A65]"></span>
            </span>
          </div>

          <!-- Red Dot 6: Tâm - Tây Bắc 5% (45%, 45%) -->
          <div class="absolute top-[45%] left-[45%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <span class="relative flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5A65] opacity-75" style="animation-delay: 300ms;"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FF5A65] shadow-[0_0_8px_#FF5A65]"></span>
            </span>
          </div>

          <!-- Red Dot 7: Tâm - Đông Nam 5% (55%, 55%) -->
          <div class="absolute top-[55%] left-[55%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <span class="relative flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5A65] opacity-75" style="animation-delay: 500ms;"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FF5A65] shadow-[0_0_8px_#FF5A65]"></span>
            </span>
          </div>


          <!-- ================= 2. CÁC CHẤM VÀNG (TAG ID TRÙNG - TRẢI ĐỀU RA NGOÀI THEO BƯỚC 5%) ================= -->

          <!-- Amber Dot 1: Vòng 1 - Bắc (38%, 50%) -->
          <div class="absolute top-[38%] left-[50%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <span class="relative flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FDB52A] opacity-75" style="animation-delay: 150ms;"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FDB52A] shadow-[0_0_10px_#FDB52A]"></span>
            </span>
          </div>

          <!-- Amber Dot 2: Vòng 1 - Nam (62%, 50%) -->
          <div class="absolute top-[62%] left-[50%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <span class="relative flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FDB52A] opacity-75" style="animation-delay: 350ms;"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FDB52A] shadow-[0_0_10px_#FDB52A]"></span>
            </span>
          </div>

          <!-- Amber Dot 3: Vòng 1 - Tây (50%, 38%) -->
          <div class="absolute top-[50%] left-[38%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <span class="relative flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FDB52A] opacity-75" style="animation-delay: 550ms;"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FDB52A] shadow-[0_0_10px_#FDB52A]"></span>
            </span>
          </div>

          <!-- Amber Dot 4: Vòng 1 - Đông (50%, 62%) -->
          <div class="absolute top-[50%] left-[62%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <span class="relative flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FDB52A] opacity-75" style="animation-delay: 750ms;"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FDB52A] shadow-[0_0_10px_#FDB52A]"></span>
            </span>
          </div>

          <!-- Amber Dot 5: Vòng 2 - Tây Bắc (38%, 38%) -->
          <div class="absolute top-[38%] left-[38%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <span class="relative flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FDB52A] opacity-75" style="animation-delay: 250ms;"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FDB52A] shadow-[0_0_10px_#FDB52A]"></span>
            </span>
          </div>

          <!-- Amber Dot 6: Vòng 2 - Đông Bắc (38%, 62%) -->
          <div class="absolute top-[38%] left-[62%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <span class="relative flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FDB52A] opacity-75" style="animation-delay: 450ms;"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FDB52A] shadow-[0_0_10px_#FDB52A]"></span>
            </span>
          </div>

          <!-- Amber Dot 7: Vòng 2 - Tây Nam (62%, 38%) -->
          <div class="absolute top-[62%] left-[38%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <span class="relative flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FDB52A] opacity-75" style="animation-delay: 650ms;"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FDB52A] shadow-[0_0_10px_#FDB52A]"></span>
            </span>
          </div>

          <!-- Amber Dot 8: Vòng 2 - Đông Nam (62%, 62%) -->
          <div class="absolute top-[62%] left-[62%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <span class="relative flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FDB52A] opacity-75" style="animation-delay: 850ms;"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FDB52A] shadow-[0_0_10px_#FDB52A]"></span>
            </span>
          </div>

          <!-- Amber Dot 9: Vòng 3 - Xa Tây (50%, 26%) -->
          <div class="absolute top-[50%] left-[26%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <span class="relative flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FDB52A] opacity-75" style="animation-delay: 950ms;"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FDB52A] shadow-[0_0_10px_#FDB52A]"></span>
            </span>
          </div>

          <!-- Amber Dot 10: Vòng 3 - Xa Đông (50%, 74%) -->
          <div class="absolute top-[50%] left-[74%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <span class="relative flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FDB52A] opacity-75" style="animation-delay: 1050ms;"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FDB52A] shadow-[0_0_10px_#FDB52A]"></span>
            </span>
          </div>

          <!-- Amber Dot 11: Vòng 3 - Xa Tây Bắc (26%, 26%) -->
          <div class="absolute top-[26%] left-[26%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <span class="relative flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FDB52A] opacity-75" style="animation-delay: 1150ms;"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FDB52A] shadow-[0_0_10px_#FDB52A]"></span>
            </span>
          </div>

          <!-- Amber Dot 12: Vòng 3 - Xa Đông Bắc (26%, 74%) -->
          <div class="absolute top-[26%] left-[74%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <span class="relative flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FDB52A] opacity-75" style="animation-delay: 1250ms;"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FDB52A] shadow-[0_0_10px_#FDB52A]"></span>
            </span>
          </div>

          <!-- Amber Dot 13: Vòng 3 - Xa Tây Nam (74%, 26%) -->
          <div class="absolute top-[74%] left-[26%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <span class="relative flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FDB52A] opacity-75" style="animation-delay: 1350ms;"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FDB52A] shadow-[0_0_10px_#FDB52A]"></span>
            </span>
          </div>

          <!-- Amber Dot 14: Vòng 3 - Xa Đông Nam (74%, 74%) -->
          <div class="absolute top-[74%] left-[74%] -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <span class="relative flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FDB52A] opacity-75" style="animation-delay: 1450ms;"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FDB52A] shadow-[0_0_10px_#FDB52A]"></span>
            </span>
          </div>

        </div>

        <!-- Coordinate Legend Guide Pill -->
        <div class="absolute bottom-2.5 right-3 flex items-center gap-3.5 glass-panel-subtle px-3 py-1.5 rounded-full text-[10px] shadow-lg backdrop-blur-md z-10">
          <div class="flex items-center gap-1.5">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5A65] opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-[#FF5A65]"></span>
            </span>
            <span class="text-[#FF5A65] font-bold">Tâm: Tag Lỗi</span>
          </div>
          <div class="w-[1px] h-3 bg-white/20"></div>
          <div class="flex items-center gap-1.5">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FDB52A] opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-[#FDB52A]"></span>
            </span>
            <span class="text-[#FDB52A] font-bold">Rìa: Tag Trùng</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { AlertCircle } from 'lucide-vue-next'
import { AnalysisState, InventoryRow, KpiState } from '@/types'

const props = defineProps<{
  analysis: AnalysisState
  inventoryData: InventoryRow[]
  kpi?: KpiState
}>()

// Total inventory count
const totalTags = computed(() => props.inventoryData.length)

// Error tags count and percent
const errorTagCount = computed(() => props.analysis.noData.length)
const errorTagPercent = computed(() => {
  if (totalTags.value === 0) return '0.0'
  return ((errorTagCount.value / totalTags.value) * 100).toFixed(1)
})

// Duplicate tags count and percent
const duplicateTagCount = computed(() => props.analysis.duplicates.length)
const duplicateTagPercent = computed(() => {
  if (totalTags.value === 0) return '0.0'
  return ((duplicateTagCount.value / totalTags.value) * 100).toFixed(1)
})

// Total risk count (errors + duplicates)
const totalRiskCount = computed(() => errorTagCount.value + duplicateTagCount.value)
const riskRate = computed(() => {
  if (totalTags.value === 0) return '0.0'
  return ((totalRiskCount.value / totalTags.value) * 100).toFixed(1)
})

// Safe tags count and percent
const safeTagCount = computed(() => Math.max(0, totalTags.value - totalRiskCount.value))
const safePercent = computed(() => {
  if (totalTags.value === 0) return '100.0'
  const pct = 100 - parseFloat(errorTagPercent.value) - parseFloat(duplicateTagPercent.value)
  return Math.max(0, pct).toFixed(1)
})
</script>


