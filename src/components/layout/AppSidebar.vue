<template>
  <!-- Mobile Header (hiển thị trên mobile / tablet) -->
  <header class="lg:hidden flex justify-between items-center glass-header p-4 sticky top-0 z-30">
    <div class="flex items-center gap-3">
      <!-- Logo Dashdark V -->
      <div class="relative w-8 h-8 flex items-center justify-center">
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 drop-shadow-[0_0_10px_rgba(203,60,255,0.4)]">
          <path d="M6 10C6 7.79086 7.79086 6 10 6H16V16H6V10Z" fill="#00C2FF"/>
          <path d="M16 16H26V22C26 24.2091 24.2091 26 22 26H16V16Z" fill="#00C2FF"/>
          <path d="M16 6H22C24.2091 6 26 7.79086 26 10V16H16V6Z" fill="#CB3CFF"/>
          <path d="M6 16H16V26H10C7.79086 26 6 24.2091 6 22V16Z" fill="#CB3CFF"/>
        </svg>
      </div>
      <div>
        <h1 class="text-lg font-bold text-white tracking-wide">Dashdark V</h1>
      </div>
    </div>
    <button 
      @click="isOpen = !isOpen" 
      class="p-2 text-[#AEB9E1] hover:text-white hover:bg-white/10 rounded-lg focus:outline-none transition cursor-pointer"
    >
      <Menu v-if="!isOpen" class="w-6 h-6" />
      <X v-else class="w-6 h-6" />
    </button>
  </header>

  <!-- Mobile Sidebar Backdrop Overlay -->
  <div 
    v-if="isOpen" 
    @click="isOpen = false" 
    class="lg:hidden fixed inset-0 bg-[#081028]/80 backdrop-blur-md z-40"
  ></div>

  <!-- Main Sidebar Container -->
  <aside 
    :class="[
      'fixed top-0 bottom-0 left-0 z-40 flex flex-col justify-between w-[280px] lg:w-[290px] glass-sidebar transition-transform lg:translate-x-0',
      isOpen ? 'translate-x-0' : '-translate-x-full',
      'lg:sticky lg:h-screen shrink-0'
    ]"
  >
    <!-- Top Brand / Logo Unit -->
    <div class="p-6">
      <div class="flex items-center gap-3.5 pb-6 border-b border-white/10">
        <!-- Dashdark V Logo Icon -->
        <div class="relative w-9 h-9 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-9 h-9 drop-shadow-[0_0_12px_rgba(203,60,255,0.4)]">
            <path d="M6 10C6 7.79086 7.79086 6 10 6H16V16H6V10Z" fill="#00C2FF"/>
            <path d="M16 16H26V22C26 24.2091 24.2091 26 22 26H16V16Z" fill="#00C2FF"/>
            <path d="M16 6H22C24.2091 6 26 7.79086 26 10V16H16V6Z" fill="#CB3CFF"/>
            <path d="M6 16H16V26H10C7.79086 26 6 24.2091 6 22V16Z" fill="#CB3CFF"/>
          </svg>
        </div>
        <div>
          <h1 class="text-xl font-bold text-white tracking-wide">
            Dashdark V
          </h1>
          <p class="text-[10px] font-semibold text-[#AEB9E1]/70 tracking-wider uppercase">WMS Inventory Pro</p>
        </div>
      </div>

      <!-- Navigation Menu Items -->
      <nav class="mt-6 flex flex-col gap-2">
        <button 
          v-for="item in menuItems" 
          :key="item.value"
          @click="selectTab(item.value)"
          :class="[
            'w-full h-[44px] flex items-center gap-3.5 px-4 rounded-[10px] text-sm font-medium transition-all cursor-pointer',
            modelValue === item.value 
              ? 'bg-[#18202D]/90 text-[#CB3CFF] border border-[#CB3CFF]/40 shadow-[0_0_16px_rgba(203,60,255,0.2)] font-semibold backdrop-blur-md' 
              : 'text-[#AEB9E1] hover:bg-white/10 hover:text-white border border-transparent'
          ]"
        >
          <component 
            :is="item.icon" 
            :class="[
              'w-[18px] h-[18px] shrink-0',
              modelValue === item.value ? 'text-[#CB3CFF]' : 'text-[#AEB9E1]'
            ]" 
          />
          <span class="truncate">{{ item.label }}</span>
          
          <span 
            v-if="item.badge" 
            class="ml-auto text-[10px] px-2 py-0.5 rounded-[4px] bg-[#CB3CFF]/20 text-[#CB3CFF] font-bold border border-[#CB3CFF]/30"
          >
            {{ item.badge }}
          </span>
        </button>
      </nav>
    </div>

    <!-- Bottom Info & Data Actions -->
    <div class="p-6 border-t border-white/10 bg-white/[0.02] backdrop-blur-sm">
      <!-- Sync Button with Spinner -->
      <button 
        @click="$emit('refresh')"
        :disabled="loading"
        class="w-full h-[42px] flex items-center justify-center gap-2 px-4 rounded-[10px] bg-white/5 hover:bg-[#CB3CFF]/20 border border-white/15 text-[#AEB9E1] hover:text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 shadow-sm"
      >
        <RefreshCw :class="['w-4 h-4 text-[#00C2FF]', loading ? 'animate-spin' : '']" />
        <span>LÀM MỚI DỮ LIỆU</span>
      </button>

      <div class="mt-4 flex flex-col gap-1.5 text-[10px] text-[#AEB9E1]/80 font-medium">
        <div class="flex justify-between items-center">
          <span>Đồng bộ cuối:</span>
          <span class="text-white font-mono font-bold">{{ lastSync }}</span>
        </div>
        <div class="text-center mt-3 pt-3 border-t border-white/10 text-[#AEB9E1]/50 text-[9px] tracking-widest uppercase">
          Dashdark V &copy; 2026
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { 
  Menu, 
  X, 
  RefreshCw,
  Home, 
  Star, 
  Users
} from 'lucide-vue-next'

defineProps<{
  modelValue: string
  lastSync: string
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'update:modelValue', val: string): void
  (e: 'refresh'): void
}>()

const isOpen = ref(false)

const menuItems = [
  { label: 'Dashboard', value: 'dashboard', icon: Home, badge: 'Active' },
  { label: 'Tồn Kho Thành Phẩm', value: 'inventory', icon: Star },
  { label: 'Quản Lý Phụ Kiện', value: 'accessories', icon: Users }
]

const selectTab = (tab: string) => {
  emit('update:modelValue', tab)
  isOpen.value = false
}
</script>
