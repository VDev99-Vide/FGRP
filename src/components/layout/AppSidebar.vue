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
    
    <div class="flex items-center gap-2">
      <!-- Nút làm mới trên Mobile Header (sidebar đã bỏ nút này) -->
      <button 
        @click="$emit('refresh')"
        :disabled="loading"
        class="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-[#AEB9E1] hover:text-white transition cursor-pointer disabled:opacity-50 active:scale-95"
        title="Làm mới dữ liệu từ Database"
      >
        <RefreshCw :class="['w-3.5 h-3.5 text-[#00C2FF]', loading ? 'animate-spin' : '']" />
      </button>

      <!-- Nút tải trên Mobile Header -->
      <button 
        @click="$emit('install')"
        class="px-2.5 py-1.5 rounded-lg bg-[#CB3CFF]/15 hover:bg-[#CB3CFF]/25 border border-[#CB3CFF]/40 text-[#CB3CFF] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition active:scale-95"
        title="Tải App Dashdark V về máy"
      >
        <Download class="w-3.5 h-3.5 text-[#00C2FF]" />
        <span>Tải App</span>
      </button>

      <button 
        @click="isOpen = !isOpen" 
        class="p-2 text-[#AEB9E1] hover:text-white hover:bg-white/10 rounded-lg focus:outline-none transition cursor-pointer"
      >
        <Menu v-if="!isOpen" class="w-6 h-6" />
        <X v-else class="w-6 h-6" />
      </button>
    </div>
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
      'fixed top-0 bottom-0 left-0 z-40 flex flex-col justify-between w-[280px] lg:w-[304px] glass-sidebar transition-transform lg:translate-x-0',
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

      <!-- Navigation Menu Items (Nghiệp vụ + Meta-data) -->
      <nav class="mt-6 flex flex-col gap-2">
        <template v-for="section in navSections" :key="section.header ?? 'core'">
          <p v-if="section.header" class="text-[10px] font-bold text-[#AEB9E1]/60 tracking-[0.2em] uppercase px-4 pt-3">
            {{ section.header }}
          </p>
          <button 
            v-for="item in section.items" 
            :key="item.value"
            @click="selectTab(item.value)"
            :title="item.label"
            :class="[
              'w-full h-[44px] flex items-center gap-3 px-3.5 rounded-[10px] text-[13px] font-medium transition-all cursor-pointer',
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
              class="ml-auto text-[10px] px-2 py-0.5 rounded-[4px] bg-[#CB3CFF]/20 text-[#CB3CFF] font-bold border border-[#CB3CFF]/30 shrink-0"
            >
              {{ item.badge }}
            </span>
          </button>
        </template>
      </nav>
    </div>

    <!-- Bottom Info & Data Actions -->
    <div class="p-6 border-t border-white/10 bg-white/[0.02] backdrop-blur-sm">
      <div class="flex flex-col gap-1.5 text-[10px] text-[#AEB9E1]/80 font-medium">
        <div class="flex justify-between items-center">
          <span>Đồng bộ cuối:</span>
          <span class="text-white font-mono font-bold">{{ lastSync }}</span>
        </div>
        <div class="text-center mt-3 pt-3 border-t border-white/10 text-[#AEB9E1]/50 text-[9px] tracking-widest uppercase flex flex-col items-center gap-1.5">
          <span>Dashdark V &copy; 2026</span>
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#00FF29]/10 border border-[#00FF29]/30 text-[#00FF29] font-mono text-[9px] font-bold tracking-normal normal-case shadow-[0_0_10px_rgba(0,255,41,0.15)]">
            <span class="w-1.5 h-1.5 rounded-full bg-[#00FF29] animate-pulse"></span>
            v2.2.0 (2026.09.16)
          </span>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { 
  Menu, 
  X, 
  RefreshCw,
  Download,
  Home, 
  Star, 
  Users,
  Truck,
  ShoppingCart,
  Package
} from 'lucide-vue-next'

defineProps<{
  modelValue: string
  lastSync: string
  loading: boolean
  isInstalled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'update:modelValue', val: string): void
  (e: 'refresh'): void
  (e: 'install'): void
}>()

const isOpen = ref(false)

const menuItems = [
  { label: 'Dashboard', value: 'dashboard', icon: Home, badge: 'Active' },
  { label: 'Tồn Kho Thành Phẩm', value: 'inventory', icon: Star },
  { label: 'Kế Hoạch Xuất Hàng', value: 'forecast', icon: Truck, badge: 'Mới' },
  { label: 'Quản Lý Đơn Đặt Hàng', value: 'purchase', icon: ShoppingCart, badge: 'Mới' },
  { label: 'Quản Lý Phụ Kiện', value: 'accessories', icon: Users }
]

const metaMenuItems = [
  { label: 'Quy Cách Đóng Gói', value: 'metadata', icon: Package, badge: 'Mới' }
]

const navSections = computed(() => [
  { header: null as string | null, items: menuItems },
  { header: 'Meta-data', items: metaMenuItems }
])

const selectTab = (tab: string) => {
  emit('update:modelValue', tab)
  isOpen.value = false
}
</script>
