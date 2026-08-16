<template>
  <Dialog 
    :visible="visible" 
    @update:visible="$emit('update:visible', $event)" 
    modal 
    header="Sửa Nhanh Tồn Kho" 
    :style="{ width: '90vw', maxWidth: '400px' }"
    @hide="onHide"
  >
    <div class="space-y-4 pt-2" v-if="target">
      <div>
        <label class="text-[10px] font-bold text-[#AEB9E1] uppercase">Mã Tag ID</label>
        <InputText 
          v-model="tagId" 
          class="w-full mt-1 p-2.5 font-mono font-bold text-sm"
        />
      </div>
      <div>
        <label class="text-[10px] font-bold text-[#AEB9E1] uppercase">Vị trí (Bin)</label>
        <InputText 
          v-model="bin" 
          class="w-full mt-1 p-2.5 font-mono font-bold text-sm"
        />
      </div>

      <p v-if="msg" class="text-xs font-bold text-center h-4 text-[#14CA74]">{{ msg }}</p>

      <div class="flex gap-3 pt-2">
        <button 
          @click="$emit('cancel')" 
          class="flex-1 bg-white/10 hover:bg-white/20 text-[#AEB9E1] font-bold py-2.5 rounded-[7px] text-xs transition cursor-pointer"
        >
          HỦY
        </button>
        <button 
          @click="save" 
          :disabled="loading"
          class="flex-1 bg-[#FDB52A] hover:bg-[#FDB52A]/90 text-[#081028] font-bold py-2.5 rounded-[7px] text-xs transition shadow-md cursor-pointer disabled:opacity-50"
        >
          LƯU THAY ĐỔI
        </button>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { InventoryRow } from '@/types'

const props = defineProps<{
  visible: boolean
  target: InventoryRow | null
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'save', payload: { inventoryId: string; tagId: string; bin: string }): void
  (e: 'cancel'): void
}>()

const tagId = ref('')
const bin = ref('')
const msg = ref('')

watch(() => props.target, (newTarget) => {
  if (newTarget) {
    tagId.value = newTarget.tag_id || ''
    bin.value = newTarget.bin || ''
    msg.value = ''
  }
}, { immediate: true })

const save = () => {
  if (!props.target) return
  
  const cleanTag = tagId.value.trim()
  const cleanBin = bin.value.trim()

  if (!cleanTag) {
    msg.value = 'Mã Tag ID không được để trống!'
    return
  }

  emit('save', {
    inventoryId: props.target.inventory_id,
    tagId: cleanTag,
    bin: cleanBin
  })
  msg.value = 'Đang lưu...'
}

const onHide = () => {
  msg.value = ''
}
</script>
