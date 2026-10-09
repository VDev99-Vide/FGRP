<template>
  <Dialog 
    :visible="visible" 
    @update:visible="$emit('update:visible', $event)" 
    modal 
    header="Nhập Kho Thành Phẩm (INBOUND)" 
    :style="{ width: '90vw', maxWidth: '550px' }"
    :breakpoints="{ '960px': '75vw', '641px': '95vw' }"
  >
    <div class="space-y-6 pt-2">
      <!-- 1. Quét thủ công (Barcode / PDA Scan) -->
      <div class="p-5 border border-[#05C168]/25 rounded-xl bg-white/[0.04] backdrop-blur-md">
        <div class="flex items-center gap-2 mb-3">
          <span class="w-2 h-2 bg-[#14CA74] rounded-full shadow-[0_0_6px_#14CA74]"></span>
          <p class="text-[11px] font-bold text-[#14CA74] uppercase tracking-wider">
            QUÉT THỦ CÔNG (BARCODE / PDA)
          </p>
        </div>
        <div class="space-y-4">
          <div>
            <label class="text-[10px] font-bold text-[#AEB9E1] uppercase">Vị Trí (Bin)</label>
            <InputText 
              v-model="bin" 
              placeholder="Nhập hoặc quét Bin..." 
              class="w-full mt-1 p-2.5 font-mono font-bold text-sm bg-white/[0.06] border border-white/15 rounded-[7px] text-white placeholder-[#AEB9E1]/40 focus:border-[#14CA74]"
              @keydown.enter="focusTag"
            />
          </div>
          <div>
            <label class="text-[10px] font-bold text-[#AEB9E1] uppercase">Tag ID</label>
            <InputText 
              ref="tagInput"
              v-model="tagId" 
              placeholder="Quét Tag ID (Nhấn Enter)..." 
              class="w-full mt-1 p-2.5 font-mono font-bold text-sm bg-white/[0.06] border border-[#14CA74]/50 rounded-[7px] text-white placeholder-[#AEB9E1]/40 focus:border-[#14CA74]"
              @keydown.enter="handleManualInbound"
            />
          </div>
        </div>
        <p v-if="manualMsg" class="text-xs font-bold text-center mt-3 text-[#14CA74]">{{ manualMsg }}</p>
      </div>

      <!-- 2. Nhập file Excel (.xlsx) -->
      <div class="p-5 border border-[#00C2FF]/30 rounded-xl bg-white/[0.04] backdrop-blur-md space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 bg-[#00C2FF] rounded-full shadow-[0_0_6px_#00C2FF]"></span>
            <p class="text-[11px] font-bold text-[#00C2FF] uppercase tracking-wider">
              NHẬP BẰNG FILE EXCEL (.XLSX)
            </p>
          </div>
          <span class="text-[10px] font-mono text-[#AEB9E1] px-2 py-0.5 bg-white/5 border border-white/10 rounded">
            Thay thế toàn bộ
          </span>
        </div>

        <!-- Cảnh báo cơ chế làm mới kho tự động -->
        <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-start gap-2.5">
          <AlertCircle class="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <p class="font-bold">Làm mới kho tự động:</p>
            <p class="text-[10px] text-amber-200/80 leading-relaxed mt-0.5">
              Khi tải file lên, hệ thống sẽ <strong>tự động xóa sạch dữ liệu tồn kho cũ</strong> và <strong>thay thế bằng danh sách mới trong file</strong> (tương tự modal Cập Nhật Nguồn).
            </p>
          </div>
        </div>
        
        <!-- File Picker -->
        <div class="flex flex-col gap-2">
          <label class="text-[10px] font-bold text-[#AEB9E1] uppercase">Chọn file Excel (.xlsx, .xls) hoặc CSV</label>
          <input 
            type="file" 
            ref="fileInput" 
            accept=".xlsx, .xls, .csv" 
            @change="handleFileSelected"
            class="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-[7px] file:border-0 file:text-xs file:font-bold file:bg-[#00C2FF]/20 file:text-[#00C2FF] hover:file:bg-[#00C2FF]/30 cursor-pointer text-[#AEB9E1]"
          />
          <p class="text-[10px] text-[#AEB9E1]">
            File cần có các cột: Tag ID (hoặc Mã kiện) và Vị trí (Bin).
          </p>
        </div>

        <!-- CSV/Excel Preview Section (Frosted Glass Table) -->
        <div v-if="csvPreview" class="mt-4 p-4 border border-white/10 rounded-xl bg-white/[0.04] backdrop-blur-md space-y-3">
          <p class="text-[10px] font-bold text-[#AEB9E1] uppercase tracking-widest">Xem trước file tải lên</p>
          <div class="grid grid-cols-3 gap-2 text-center text-xs font-bold">
            <div class="p-2 bg-white/5 rounded-[6px]">
              <span class="block text-[#AEB9E1] font-medium text-[10px]">Tổng dòng</span>
              <span class="text-white text-sm font-bold">{{ csvStats.total }}</span>
            </div>
            <div class="p-2 bg-[#05C168]/15 border border-[#05C168]/30 rounded-[6px] text-[#14CA74]">
              <span class="block font-medium text-[10px]">Hợp lệ</span>
              <span class="text-sm font-bold">{{ csvStats.valid }}</span>
            </div>
            <div class="p-2 bg-[#FF5A65]/15 border border-[#FF5A65]/30 rounded-[6px] text-[#FF5A65]">
              <span class="block font-medium text-[10px]">Lỗi/Rỗng</span>
              <span class="text-sm font-bold">{{ csvStats.invalid }}</span>
            </div>
          </div>

          <!-- Preview Table on Glass -->
          <div class="max-h-36 overflow-y-auto border border-white/10 rounded-[6px] text-[11px] custom-scroll">
            <table class="w-full text-left border-collapse">
              <thead class="bg-[#283241]/85 backdrop-blur-md sticky top-0 font-bold text-[#AEB9E1]">
                <tr>
                  <th class="p-2">Tag ID</th>
                  <th class="p-2">Vị Trí (Bin)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5 text-white">
                <tr v-for="(row, idx) in csvPreview" :key="idx" class="hover:bg-white/5">
                  <td class="p-2 font-mono font-bold text-[#00C2FF]">{{ row.tag_id }}</td>
                  <td class="p-2 font-mono text-[#AEB9E1]">{{ row.bin || 'N/A' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="flex gap-2 pt-1">
            <button 
              @click="submitCsv"
              class="flex-1 bg-[#00C2FF] hover:bg-[#00C2FF]/90 text-[#081028] font-bold py-2.5 rounded-[7px] text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-1.5"
            >
              <RefreshCw class="w-3.5 h-3.5" />
              <span>LÀM MỚI KHO TỪ FILE ({{ csvStats.valid }} dòng)</span>
            </button>
            <button 
              @click="cancelCsv"
              class="px-4 bg-white/10 hover:bg-white/20 text-[#AEB9E1] font-bold py-2.5 rounded-[7px] text-xs transition cursor-pointer"
            >
              HỦY
            </button>
          </div>
        </div>
      </div>
    </div>
  </Dialog>

  <!-- Conflict Confirmation Dialog -->
  <Dialog 
    v-model:visible="showConflict" 
    modal 
    header="Tag ID Đã Tồn Tại" 
    :style="{ width: '90vw', maxWidth: '400px' }"
    :closable="false"
  >
    <div class="space-y-4 pt-2 text-center">
      <div class="w-12 h-12 bg-[#FDB52A]/20 border border-[#FDB52A]/40 rounded-full flex items-center justify-center mx-auto text-[#FDB52A]">
        <HelpCircle class="w-6 h-6" />
      </div>
      <h4 class="text-base font-bold text-white">Xử Lý Tag ID Trùng</h4>
      <p class="text-xs text-[#AEB9E1] leading-relaxed">
        Tag ID <span class="font-bold text-white">{{ conflictTag }}</span> hiện đang ở vị trí <span class="font-bold text-[#CB3CFF]">{{ conflictExistingBin }}</span>.
        Bạn muốn thay đổi vị trí cũ hay ghi nhận thêm tồn kho mới?
      </p>
      <div class="flex gap-3 pt-2">
        <button 
          @click="resolveConflict('update')" 
          class="flex-1 bg-[#FDB52A] hover:bg-[#FDB52A]/90 text-[#081028] font-bold py-2.5 rounded-[7px] text-xs transition cursor-pointer"
        >
          ĐỔI VỊ TRÍ
        </button>
        <button 
          @click="resolveConflict('insert')" 
          class="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 rounded-[7px] text-xs transition cursor-pointer"
        >
          GHI THÊM
        </button>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, nextTick } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { HelpCircle, RefreshCw, AlertCircle } from 'lucide-vue-next'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { normalizeCsvData } from '@/services/csvNormalizer'
import { InventoryRow } from '@/types'

const props = defineProps<{
  visible: boolean
  inventoryData: InventoryRow[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'inbound', payload: { tagId: string; bin: string; option: 'update' | 'insert' }): void
  (e: 'import-excel', rows: { tag_id: string; bin: string }[]): void
  (e: 'import-csv', rows: { tag_id: string; bin: string }[]): void
}>()

const bin = ref('')
const tagId = ref('')
const manualMsg = ref('')
const tagInput = ref<any>(null)

const showConflict = ref(false)
const conflictTag = ref('')
const conflictExistingBin = ref('')

const fileInput = ref<any>(null)
const csvPreview = ref<any[] | null>(null)
const csvStats = reactive({ total: 0, valid: 0, invalid: 0 })
let finalCsvRows: { tag_id: string; bin: string }[] = []

const focusTag = () => {
  if (tagInput.value) {
    tagInput.value.$el.focus()
  }
}

const handleManualInbound = () => {
  const cleanTag = tagId.value.trim()
  const cleanBin = bin.value.trim()

  if (!cleanBin) {
    manualMsg.value = 'Vui lòng nhập Vị Trí (Bin) trước!'
    return
  }
  if (!cleanTag) {
    manualMsg.value = 'Vui lòng nhập Tag ID!'
    return
  }

  manualMsg.value = 'Đang kiểm tra...'

  const matched = props.inventoryData.find(item => item.tag_id === cleanTag)

  if (matched) {
    conflictTag.value = cleanTag
    conflictExistingBin.value = matched.bin || 'Không xác định'
    showConflict.value = true
    manualMsg.value = ''
  } else {
    emit('inbound', { tagId: cleanTag, bin: cleanBin, option: 'insert' })
    tagId.value = ''
    manualMsg.value = 'Đã nhập thành công!'
    nextTick(() => {
      if (tagInput.value) tagInput.value.$el.focus()
    })
  }
}

const resolveConflict = (option: 'update' | 'insert') => {
  emit('inbound', { 
    tagId: conflictTag.value, 
    bin: bin.value.trim(), 
    option 
  })
  showConflict.value = false
  tagId.value = ''
  manualMsg.value = option === 'update' ? 'Đã cập nhật vị trí mới!' : 'Đã ghi thêm dòng mới!'
  nextTick(() => {
    if (tagInput.value) tagInput.value.$el.focus()
  })
}

const processRawRows = (rawRows: Record<string, any>[]) => {
  const normalized = normalizeCsvData(rawRows, 'inventory') as { tag_id: string; bin: string }[]
  
  finalCsvRows = normalized.filter(row => row.tag_id)
  const invalidCount = normalized.length - finalCsvRows.length

  csvStats.total = normalized.length
  csvStats.valid = finalCsvRows.length
  csvStats.invalid = invalidCount
  csvPreview.value = finalCsvRows.slice(0, 8)
}

const handleFileSelected = (event: any) => {
  const file = event.target.files[0]
  if (!file) return

  const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')

  if (isExcel) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' })
        processRawRows(rawRows)
      } catch (err: any) {
        console.error('Lỗi đọc Excel:', err)
        csvPreview.value = null
      }
    }
    reader.readAsArrayBuffer(file)
  } else {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        processRawRows(results.data as Record<string, any>[])
      }
    })
  }
}

const submitCsv = () => {
  if (finalCsvRows.length > 0) {
    emit('import-excel', finalCsvRows)
    emit('import-csv', finalCsvRows)
    cancelCsv()
  }
}

const cancelCsv = () => {
  csvPreview.value = null
  finalCsvRows = []
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}
</script>
