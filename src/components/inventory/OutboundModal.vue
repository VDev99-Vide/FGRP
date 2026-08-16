<template>
  <Dialog 
    :visible="visible" 
    @update:visible="$emit('update:visible', $event)" 
    modal 
    header="Xuất Kho Thành Phẩm (OUTBOUND)" 
    :style="{ width: '90vw', maxWidth: '450px' }"
    @hide="onHide"
  >
    <div class="space-y-5 pt-2">
      <div>
        <label class="text-[10px] font-bold text-[#AEB9E1] uppercase">Mã Tag ID Cần Xuất</label>
        <InputText 
          v-model="tagId" 
          placeholder="Quét Tag ID (Nhấn Enter)..." 
          class="w-full mt-1.5 p-2.5 font-mono font-bold text-sm bg-white/[0.06] border border-[#FF5A65]/50 rounded-[7px] text-white placeholder-[#AEB9E1]/40 focus:border-[#FF5A65]"
          @keydown.enter="handleOutbound"
          :disabled="loading"
        />
      </div>

      <!-- Hiển thị tin nhắn thông báo -->
      <p v-if="msg" :class="['text-xs font-bold text-center h-4', msgClass]">{{ msg }}</p>

      <!-- Trường hợp trùng Tag ở nhiều Bin -->
      <div v-if="duplicateBins.length > 0" class="border border-[#FF5A65]/25 rounded-xl bg-white/[0.04] backdrop-blur-md p-4 space-y-3">
        <p class="text-[10px] font-bold text-[#FF5A65] uppercase tracking-wider">
          LỰA CHỌN VỊ TRÍ XUẤT
        </p>
        <p class="text-xs text-[#AEB9E1]">
          Tag ID này hiện có tại nhiều vị trí. Vui lòng chọn chính xác vị trí muốn xuất:
        </p>
        <div class="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scroll">
          <button 
            v-for="item in duplicateBins" 
            :key="item.inventory_id"
            @click="exportItem(item.inventory_id, item.bin)"
            class="w-full flex justify-between items-center p-3 bg-white/[0.06] hover:bg-[#FF5A65] hover:text-white border border-white/10 text-white rounded-[8px] text-xs font-bold transition cursor-pointer backdrop-blur-sm"
          >
            <span>Vị trí (Bin): <span class="font-mono text-[#00C2FF]">{{ item.bin || 'Không xác định' }}</span></span>
            <span class="text-[10px] text-[#AEB9E1]">ID: {{ item.inventory_id.substring(0, 8) }}...</span>
          </button>
        </div>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { InventoryRow } from '@/types'

const props = defineProps<{
  visible: boolean
  inventoryData: InventoryRow[]
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'outbound', inventoryId: string, tagId: string, bin: string): void
}>()

const tagId = ref('')
const msg = ref('')
const isError = ref(false)
const duplicateBins = ref<InventoryRow[]>([])

const msgClass = computed(() => isError.value ? 'text-[#FF5A65]' : 'text-[#14CA74]')

const handleOutbound = () => {
  const cleanTag = tagId.value.trim()
  if (!cleanTag) return

  msg.value = 'Đang tìm kiếm...'
  isError.value = false
  duplicateBins.value = []

  const matches = props.inventoryData.filter(item => item.tag_id === cleanTag)

  if (matches.length === 0) {
    msg.value = 'Tag ID này không tồn tại trong hệ thống!'
    isError.value = true
  } else if (matches.length === 1) {
    const item = matches[0]
    exportItem(item.inventory_id, item.bin)
  } else {
    duplicateBins.value = matches
    msg.value = `Tìm thấy ${matches.length} vị trí trùng!`
  }
}

const exportItem = (inventoryId: string, bin: string) => {
  emit('outbound', inventoryId, tagId.value.trim(), bin)
  
  msg.value = `Đã xuất Tag ở vị trí ${bin || 'Không xác định'}!`
  tagId.value = ''
  duplicateBins.value = []
  isError.value = false
}

const onHide = () => {
  tagId.value = ''
  msg.value = ''
  duplicateBins.value = []
}
</script>
