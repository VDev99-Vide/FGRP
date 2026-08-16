<template>
  <Dialog 
    :visible="visible" 
    @update:visible="$emit('update:visible', $event)" 
    modal 
    header="Xác Nhận Xuất Nhanh" 
    :style="{ width: '90vw', maxWidth: '400px' }"
  >
    <div class="space-y-4 pt-2 text-center" v-if="target">
      <div class="w-12 h-12 bg-[#FF5A65]/20 border border-[#FF5A65]/40 rounded-full flex items-center justify-center mx-auto text-[#FF5A65]">
        <AlertTriangle class="w-6 h-6" />
      </div>
      
      <p class="text-xs text-[#AEB9E1] leading-relaxed">
        Bạn có chắc chắn muốn xuất nhanh sản phẩm này khỏi kho?
      </p>

      <div class="bg-white/[0.04] backdrop-blur-md p-4 rounded-xl text-left text-xs font-semibold text-white space-y-2 border border-white/12 shadow-sm">
        <div class="flex justify-between">
          <span class="text-[#AEB9E1]">Tag ID:</span>
          <span class="font-mono text-[#00C2FF] font-bold">{{ target.tag_id }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-[#AEB9E1]">Vị trí (Bin):</span>
          <span class="font-mono text-[#CB3CFF] font-bold">{{ target.bin || 'N/A' }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-[#AEB9E1]">Stock Code:</span>
          <span class="font-mono text-white">{{ target.lp_no }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-[#AEB9E1]">Số lượng:</span>
          <span class="text-[#14CA74] font-bold">{{ target.qty }} PCS</span>
        </div>
      </div>

      <div class="flex gap-3 pt-2">
        <button 
          @click="$emit('cancel')" 
          class="flex-1 bg-white/10 hover:bg-white/20 text-[#AEB9E1] font-bold py-2.5 rounded-[7px] text-xs transition cursor-pointer"
        >
          HỦY
        </button>
        <button 
          @click="$emit('confirm', target)" 
          class="flex-1 bg-[#FF5A65] hover:bg-[#FF5A65]/90 text-white font-bold py-2.5 rounded-[7px] text-xs transition shadow-lg cursor-pointer"
        >
          XÁC NHẬN XUẤT
        </button>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from 'primevue/dialog'
import { AlertTriangle } from 'lucide-vue-next'
import { InventoryRow } from '@/types'

defineProps<{
  visible: boolean
  target: InventoryRow | null
}>()

defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'confirm', row: InventoryRow): void
  (e: 'cancel'): void
}>()
</script>
