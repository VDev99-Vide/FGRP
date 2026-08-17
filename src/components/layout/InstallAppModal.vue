<template>
  <Dialog 
    :visible="visible" 
    @update:visible="$emit('update:visible', $event)"
    modal 
    header=" "
    :closable="true"
    :dismissableMask="true"
    class="dashdark-pwa-modal w-[95vw] max-w-[540px] border border-white/15 bg-[#081028]/95 backdrop-blur-2xl text-white rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(203,60,255,0.2)]"
  >
    <div class="p-6 pt-0 space-y-6">
      <!-- Header with Glowing Logo -->
      <div class="flex items-center gap-4 pb-5 border-b border-white/10">
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#00C2FF] via-[#CB3CFF] to-[#7e14ff] p-[1.5px] shadow-[0_0_24px_rgba(203,60,255,0.45)] shrink-0 flex items-center justify-center">
          <div class="w-full h-full bg-[#18202D] rounded-[14.5px] flex items-center justify-center">
            <svg viewBox="0 0 32 32" fill="none" class="w-8 h-8">
              <path d="M6 10C6 7.79086 7.79086 6 10 6H16V16H6V10Z" fill="#00C2FF"/>
              <path d="M16 16H26V22C26 24.2091 24.2091 26 22 26H16V16Z" fill="#00C2FF"/>
              <path d="M16 6H22C24.2091 6 26 7.79086 26 10V16H16V6Z" fill="#CB3CFF"/>
              <path d="M6 16H16V26H10C7.79086 26 6 24.2091 6 22V16Z" fill="#CB3CFF"/>
              <circle cx="16" cy="16" r="2.5" fill="#FFFFFF"/>
            </svg>
          </div>
        </div>

        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-bold text-white tracking-wide">Dashdark V</h2>
            <span class="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#00C2FF]/20 text-[#00C2FF] border border-[#00C2FF]/40">PWA App</span>
          </div>
          <p class="text-xs text-[#AEB9E1] mt-0.5">Cài đặt ứng dụng trực tiếp về máy tính &amp; điện thoại</p>
        </div>
      </div>

      <!-- Main Action or Status -->
      <div v-if="isInstalled" class="p-4 rounded-2xl bg-[#05C168]/10 border border-[#05C168]/30 flex items-center gap-3">
        <CheckCircle2 class="w-6 h-6 text-[#14CA74] shrink-0" />
        <div class="text-xs">
          <p class="font-bold text-[#14CA74]">Ứng dụng đã được cài đặt trên thiết bị</p>
          <p class="text-[#AEB9E1]/80 mt-0.5">Bạn đang chạy Dashdark V dưới dạng ứng dụng độc lập (Standalone App).</p>
        </div>
      </div>

      <div v-else class="space-y-4">
        <!-- Direct Install Button if supported -->
        <button 
          v-if="canInstall"
          @click="handleDirectInstall"
          class="w-full h-12 rounded-xl bg-gradient-to-r from-[#00C2FF] via-[#CB3CFF] to-[#7e14ff] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(203,60,255,0.4)] hover:brightness-110 active:scale-[0.99] transition cursor-pointer"
        >
          <Download class="w-5 h-5" />
          <span>CÀI ĐẶT ỨNG DỤNG NGAY</span>
        </button>

        <!-- Instructions Accordion / Guide -->
        <div class="space-y-3">
          <p class="text-xs font-semibold text-[#AEB9E1] uppercase tracking-wider">Hướng dẫn tải về từng thiết bị:</p>

          <!-- Chrome / Edge (Desktop & Android) -->
          <div class="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-1.5">
            <div class="flex items-center gap-2 text-xs font-bold text-[#00C2FF]">
              <Monitor class="w-4 h-4" />
              <span>Máy tính (Chrome / MS Edge / Cốc Cốc) &amp; Android:</span>
            </div>
            <p class="text-[11px] text-[#AEB9E1] leading-relaxed">
              Nhấn vào biểu tượng <strong>Cài đặt (⊕ hoặc Download)</strong> trên thanh địa chỉ URL của trình duyệt, hoặc bấm menu <strong>⋮ -> Cài đặt Dashdark V</strong>.
            </p>
          </div>

          <!-- iOS Safari (iPhone / iPad) -->
          <div class="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-1.5">
            <div class="flex items-center gap-2 text-xs font-bold text-[#CB3CFF]">
              <Smartphone class="w-4 h-4" />
              <span>iPhone / iPad (Trình duyệt Safari):</span>
            </div>
            <p class="text-[11px] text-[#AEB9E1] leading-relaxed">
              Nhấn biểu tượng <strong>Chia sẻ (Share icon ⎋)</strong> ở thanh dưới cùng -> Chọn <strong>"Thêm vào MH chính" (Add to Home Screen)</strong> -> Bấm <strong>Thêm</strong>.
            </p>
          </div>
        </div>
      </div>

      <!-- Cache Anti-Stale Guarantee & Refresh Tool -->
      <div class="p-4 rounded-2xl bg-[#18202D]/90 border border-white/10 space-y-2">
        <div class="flex items-center gap-2 text-xs font-bold text-[#FDB52A]">
          <ShieldAlert class="w-4 h-4 text-[#FDB52A]" />
          <span>Cơ Chế Chống Cache Dữ Liệu (100% Realtime)</span>
        </div>
        <p class="text-[11px] text-[#AEB9E1] leading-relaxed">
          Ứng dụng được cấu hình chuẩn <strong>Network-First &amp; NetworkOnly cho toàn bộ API Supabase</strong>. Khi cập nhật kho, nhập/xuất hoặc làm mới, hệ thống luôn lấy dữ liệu mới nhất từ máy chủ mà không bị kẹt cache.
        </p>

        <div class="pt-2 flex justify-end">
          <button 
            @click="handleForceClean"
            :disabled="cleaning"
            class="px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-[#AEB9E1] hover:text-white font-medium flex items-center gap-2 transition cursor-pointer"
          >
            <RefreshCw :class="['w-3.5 h-3.5 text-[#00C2FF]', cleaning ? 'animate-spin' : '']" />
            <span>{{ cleaning ? 'Đang làm sạch...' : 'Xóa sạch Cache & Tải lại App' }}</span>
          </button>
        </div>
      </div>

      <!-- Close Action -->
      <div class="pt-2 flex justify-end">
        <button 
          @click="$emit('update:visible', false)"
          class="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition cursor-pointer"
        >
          Đóng
        </button>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Dialog from 'primevue/dialog'
import { 
  Download, 
  Monitor, 
  Smartphone, 
  CheckCircle2, 
  ShieldAlert, 
  RefreshCw 
} from 'lucide-vue-next'

const props = defineProps<{
  visible: boolean
  canInstall: boolean
  isInstalled: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'install'): void
  (e: 'clear-cache'): void
}>()

const cleaning = ref(false)

const handleDirectInstall = () => {
  emit('install')
}

const handleForceClean = async () => {
  cleaning.value = true
  emit('clear-cache')
}
</script>

<style>
.dashdark-pwa-modal .p-dialog-header {
  background: transparent !important;
  border-bottom: none !important;
  padding: 1rem 1.5rem 0.25rem 1.5rem !important;
}
.dashdark-pwa-modal .p-dialog-content {
  background: transparent !important;
  padding: 0 !important;
}
.dashdark-pwa-modal .p-dialog-header-close {
  color: #AEB9E1 !important;
  border-radius: 8px !important;
}
.dashdark-pwa-modal .p-dialog-header-close:hover {
  background: rgba(255, 255, 255, 0.1) !important;
  color: #ffffff !important;
}
</style>
