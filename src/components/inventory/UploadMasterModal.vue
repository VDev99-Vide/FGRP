<template>
  <Dialog 
    :visible="visible" 
    @update:visible="$emit('update:visible', $event)" 
    modal 
    header="Cập Nhật Dữ Liệu Nguồn (MASTER DATA)" 
    :style="{ width: '90vw', maxWidth: '550px' }"
    @hide="onHide"
  >
    <div class="space-y-4 pt-2">
      <div class="p-6 border-2 border-dashed border-[#CB3CFF]/40 rounded-xl bg-white/[0.04] backdrop-blur-md text-center">
        <label class="block text-xs font-bold text-[#CB3CFF] mb-3 uppercase tracking-wider">
          Tải lên file: Stock Balance With Batch.csv
        </label>
        
        <input 
          type="file" 
          ref="fileInput" 
          accept=".csv" 
          @change="handleFileChange"
          class="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-[7px] file:border-0 file:text-xs file:font-bold file:bg-[#CB3CFF]/20 file:text-[#CB3CFF] hover:file:bg-[#CB3CFF]/30 cursor-pointer text-[#AEB9E1] mx-auto"
        />

        <p class="text-[10px] text-[#AEB9E1] mt-3 font-medium">
          Lưu ý: Hành động này sẽ đồng bộ và cập nhật lại toàn bộ danh sách nguồn master data.
        </p>
      </div>

      <!-- Tin nhắn trạng thái -->
      <p v-if="statusMsg" :class="['text-xs font-bold text-center h-4', statusClass]">{{ statusMsg }}</p>

      <!-- CSV Preview -->
      <div v-if="previewRows.length > 0" class="p-4 border border-white/10 rounded-xl bg-white/[0.04] backdrop-blur-md space-y-3">
        <p class="text-[10px] font-bold text-[#AEB9E1] uppercase tracking-widest">Xem trước file tải lên</p>
        <div class="p-2 bg-white/5 rounded-[6px] text-xs font-bold text-center">
          Tổng số dòng đọc được: <span class="text-[#00C2FF] text-sm font-black">{{ totalCount }}</span>
        </div>

        <!-- Preview Table -->
        <div class="max-h-40 overflow-y-auto border border-white/10 rounded-[6px] text-[10px] custom-scroll">
          <table class="w-full text-left border-collapse">
            <thead class="bg-[#283241]/85 backdrop-blur-md sticky top-0 font-bold text-[#AEB9E1]">
              <tr>
                <th class="p-2">Batch/Tag</th>
                <th class="p-2">Stock Code</th>
                <th class="p-2 text-right">Qty</th>
                <th class="p-2">WH</th>
                <th class="p-2">Create Date</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5 text-white font-mono">
              <tr v-for="(row, idx) in previewRows" :key="idx" class="hover:bg-white/5">
                <td class="p-2 font-bold text-[#00C2FF]">{{ row.batch }}</td>
                <td class="p-2 text-[#AEB9E1]">{{ row.stock_code }}</td>
                <td class="p-2 text-right font-sans font-bold text-[#14CA74]">{{ row.qty }}</td>
                <td class="p-2 text-center">{{ row.warehouse }}</td>
                <td class="p-2 text-[#AEB9E1]">{{ row.create_date }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <button 
          @click="submit" 
          :disabled="loading"
          class="w-full btn-neon-purple font-bold py-3 rounded-[7px] text-xs transition shadow-lg cursor-pointer disabled:opacity-50"
        >
          {{ loading ? 'ĐANG LƯU HỆ THỐNG...' : `CẬP NHẬT LÊN HỆ THỐNG (${totalCount} dòng)` }}
        </button>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Dialog from 'primevue/dialog'
import Papa from 'papaparse'
import { normalizeCsvData } from '@/services/csvNormalizer'

const props = defineProps<{
  visible: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'upload', payload: any[]): void
}>()

const fileInput = ref<any>(null)
const previewRows = ref<any[]>([])
const totalCount = ref(0)
const statusMsg = ref('')
const isError = ref(false)

let finalPayload: any[] = []

const statusClass = computed(() => isError.value ? 'text-[#FF5A65]' : 'text-[#00C2FF]')

const handleFileChange = (event: any) => {
  const file = event.target.files[0]
  if (!file) return

  statusMsg.value = 'Đang đọc file...'
  isError.value = false
  previewRows.value = []

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      try {
        const rawRows = results.data as Record<string, any>[]
        const normalized = normalizeCsvData(rawRows, 'master_data')
        
        finalPayload = normalized.filter(row => row.batch)

        if (finalPayload.length === 0) {
          statusMsg.value = 'File không có dữ liệu Batch/Tag ID hợp lệ!'
          isError.value = true
          return
        }

        totalCount.value = finalPayload.length
        previewRows.value = finalPayload.slice(0, 8)
        statusMsg.value = 'Đọc file hoàn tất. Vui lòng kiểm tra bản xem trước.'
      } catch (e: any) {
        statusMsg.value = 'Lỗi xử lý file: ' + e.message
        isError.value = true
      }
    },
    error: (err) => {
      statusMsg.value = 'Lỗi parse CSV: ' + err.message
      isError.value = true
    }
  })
}

const submit = () => {
  if (finalPayload.length === 0) return
  emit('upload', finalPayload)
}

const onHide = () => {
  previewRows.value = []
  totalCount.value = 0
  statusMsg.value = ''
  isError.value = false
  finalPayload = []
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}
</script>
