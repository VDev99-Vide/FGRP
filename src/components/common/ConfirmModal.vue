<template>
  <div 
    v-if="visible" 
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081028]/80 backdrop-blur-md animate-fade-in"
  >
    <div 
      class="relative w-full max-w-sm glass-card-dark border border-white/20 p-6 rounded-[18px] shadow-[0_15px_40px_rgba(0,0,0,0.6)] overflow-hidden animate-scale-up"
    >
      <!-- Top Accent Bar -->
      <div 
        :class="[
          'absolute top-0 left-0 right-0 h-[3px]',
          severity === 'danger' ? 'bg-gradient-to-r from-red-500 to-rose-600' : 'bg-gradient-to-r from-[#CB3CFF] to-[#00C2FF]'
        ]"
      ></div>

      <!-- Icon & Title -->
      <div class="flex items-start gap-3.5 mb-3">
        <div 
          :class="[
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm',
            severity === 'danger' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-[#CB3CFF]/20 text-[#CB3CFF] border border-[#CB3CFF]/40'
          ]"
        >
          <AlertTriangle v-if="severity === 'danger'" class="w-5 h-5" />
          <HelpCircle v-else class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-base font-bold text-white tracking-tight">{{ title }}</h3>
          <p class="text-xs text-[#AEB9E1] mt-1 leading-relaxed">{{ message }}</p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center justify-end gap-2.5 mt-6 pt-3 border-t border-white/10">
        <button 
          type="button" 
          @click="handleCancel"
          class="px-4 py-2 rounded-[8px] bg-white/5 hover:bg-white/10 text-xs text-[#AEB9E1] hover:text-white font-semibold transition cursor-pointer border border-white/10 active:scale-95"
        >
          {{ cancelText || 'Hủy bỏ' }}
        </button>

        <button 
          type="button" 
          @click="handleConfirm"
          :class="[
            'px-4 py-2 rounded-[8px] text-xs font-bold transition cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5',
            severity === 'danger' 
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]' 
              : 'btn-neon-purple'
          ]"
        >
          <Trash2 v-if="severity === 'danger'" class="w-3.5 h-3.5" />
          <Check v-else class="w-3.5 h-3.5" />
          <span>{{ confirmText || 'Xác nhận' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AlertTriangle, HelpCircle, Trash2, Check } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  visible: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  severity?: 'danger' | 'warning' | 'info'
}>(), {
  severity: 'danger',
  confirmText: 'Xác nhận',
  cancelText: 'Hủy bỏ'
})

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const handleConfirm = () => {
  emit('confirm')
  emit('update:visible', false)
}

const handleCancel = () => {
  emit('cancel')
  emit('update:visible', false)
}
</script>

<style scoped>
@keyframes scaleUp {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.animate-scale-up {
  animation: scaleUp 0.15s ease-out forwards;
}
</style>
