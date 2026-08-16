<template>
  <Dialog 
    :visible="visible" 
    @update:visible="$emit('update:visible', $event)" 
    modal 
    header="Nhập Kho Phụ Kiện" 
    :style="{ width: '90vw', maxWidth: '440px' }"
    @hide="onHide"
  >
    <div class="space-y-4 pt-2">
      <div>
        <label class="text-[10px] font-bold text-[#AEB9E1] uppercase">Mã Phụ Kiện (Code)</label>
        <AutoComplete
          v-model="code"
          :suggestions="filteredCodes"
          @complete="searchCodes"
          placeholder="Nhập hoặc chọn mã phụ kiện..."
          dropdown
          class="w-full mt-1 font-bold text-sm"
          inputClass="w-full p-2.5 bg-white/[0.06] border border-white/15 rounded-[7px] text-white outline-none font-bold placeholder-[#AEB9E1]/40 focus:border-[#CB3CFF]"
        />
      </div>
      
      <div>
        <label class="text-[10px] font-bold text-[#AEB9E1] uppercase">Số lượng (Qty)</label>
        <InputText 
          v-model="qtyStr" 
          type="number"
          placeholder="Nhập số lượng..."
          class="w-full mt-1 p-2.5 font-bold text-sm bg-white/[0.06] border border-white/15 rounded-[7px] text-white placeholder-[#AEB9E1]/40 focus:border-[#CB3CFF]"
        />
      </div>

      <div>
        <label class="text-[10px] font-bold text-[#AEB9E1] uppercase">Vị trí (Bin)</label>
        <InputText 
          v-model="bin" 
          placeholder="Nhập vị trí..."
          class="w-full mt-1 p-2.5 font-mono font-bold text-sm bg-white/[0.06] border border-white/15 rounded-[7px] text-white placeholder-[#AEB9E1]/40 focus:border-[#CB3CFF]"
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
          class="flex-1 btn-neon-purple font-bold py-2.5 rounded-[7px] text-xs transition shadow-lg cursor-pointer disabled:opacity-50"
        >
          LƯU THÔNG TIN
        </button>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Dialog from 'primevue/dialog'
import AutoComplete from 'primevue/autocomplete'
import InputText from 'primevue/inputtext'

const props = defineProps<{
  visible: boolean
  uniqueCodes: string[]
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'save', payload: { code: string; qty: number; bin: string }): void
  (e: 'cancel'): void
}>()

const code = ref('')
const qtyStr = ref('')
const bin = ref('')
const msg = ref('')
const filteredCodes = ref<string[]>([])

const searchCodes = (event: any) => {
  const query = event.query.trim().toLowerCase()
  if (!query) {
    filteredCodes.value = [...props.uniqueCodes]
  } else {
    filteredCodes.value = props.uniqueCodes.filter(c => c.toLowerCase().includes(query))
  }
}

const save = () => {
  const cleanCode = code.value.trim()
  const cleanBin = bin.value.trim()
  const numQty = Number(qtyStr.value)

  if (!cleanCode) {
    msg.value = 'Mã phụ kiện không được để trống!'
    return
  }
  if (!qtyStr.value || numQty <= 0) {
    msg.value = 'Số lượng phải lớn hơn 0!'
    return
  }
  if (!cleanBin) {
    msg.value = 'Vị trí (Bin) không được để trống!'
    return
  }

  emit('save', {
    code: cleanCode,
    qty: numQty,
    bin: cleanBin
  })
  msg.value = 'Đang lưu...'
}

const onHide = () => {
  code.value = ''
  qtyStr.value = ''
  bin.value = ''
  msg.value = ''
}
</script>
