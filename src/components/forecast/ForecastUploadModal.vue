<template>
  <div 
    v-if="visible" 
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081028]/80 backdrop-blur-md transition-opacity"
    @click.self="$emit('update:visible', false)"
  >
    <div class="glass-card-dark w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-white/20 shadow-[0_0_35px_rgba(203,60,255,0.3)] p-6 space-y-5 overflow-hidden">
      
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#00C2FF]/30 to-[#CB3CFF]/30 border border-[#CB3CFF]/40 flex items-center justify-center text-[#CB3CFF] shadow-[0_0_12px_rgba(203,60,255,0.3)]">
            <UploadCloud class="w-5 h-5 text-[#00C2FF]" />
          </div>
          <div>
            <h3 class="text-base font-bold text-white tracking-wide">
              Nạp Dữ Liệu Xuất Hàng Dự Kiến
            </h3>
            <p class="text-[11px] text-[#AEB9E1]">
              Hỗ trợ file Excel định dạng <span class="text-[#00C2FF] font-semibold">.xlsx / .xls</span>, tự động nhận diện cột linh hoạt
            </p>
          </div>
        </div>

        <button 
          @click="$emit('update:visible', false)" 
          class="p-1.5 text-[#AEB9E1] hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Scrollable content -->
      <div class="flex-1 overflow-y-auto custom-scroll space-y-4 pr-1">

        <!-- Template Download Banner -->
        <div class="flex items-center justify-between p-3.5 bg-white/[0.03] border border-white/10 rounded-xl">
          <div class="flex items-center gap-2.5">
            <FileSpreadsheet class="w-5 h-5 text-[#14CA74]" />
            <div>
              <p class="text-xs font-bold text-white">Chưa có file mẫu chuẩn?</p>
              <p class="text-[10px] text-[#AEB9E1]">Tải file Excel mẫu gồm LPVN Item code, Loading Date, Qty, Pcs/pkg, PO, SO</p>
            </div>
          </div>
          <button 
            type="button"
            @click="downloadForecastSampleTemplate"
            class="px-3 py-1.5 bg-[#14CA74]/15 hover:bg-[#14CA74]/25 border border-[#14CA74]/30 text-[#14CA74] rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Download class="w-3.5 h-3.5" />
            <span>Tải file mẫu .xlsx</span>
          </button>
        </div>

        <!-- File Upload Area -->
        <div 
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleFileDrop"
          :class="[
            'border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer flex flex-col items-center justify-center gap-2',
            isDragging 
              ? 'border-[#CB3CFF] bg-[#CB3CFF]/10' 
              : 'border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]'
          ]"
          @click="fileInputRef?.click()"
        >
          <input 
            ref="fileInputRef"
            type="file" 
            accept=".xlsx, .xls" 
            class="hidden" 
            @change="handleFileSelect"
          >
          <div class="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#AEB9E1]">
            <UploadCloud :class="['w-6 h-6', isParsing ? 'animate-bounce text-[#00C2FF]' : '']" />
          </div>
          <div>
            <p class="text-xs font-bold text-white">
              {{ selectedFile ? selectedFile.name : 'Kéo thả file .xlsx vào đây hoặc bấm để chọn file' }}
            </p>
            <p class="text-[10px] text-[#AEB9E1] mt-0.5">
              {{ selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Tự động trích xuất Feature MID(2,4) và tính số kiện' }}
            </p>
          </div>
        </div>

        <!-- Error Alert -->
        <div v-if="errorMessage" class="p-3 bg-[#FF5A65]/15 border border-[#FF5A65]/30 rounded-xl text-xs text-[#FF5A65] flex items-center gap-2">
          <AlertCircle class="w-4 h-4 shrink-0" />
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Detected Column Mapping -->
        <div v-if="parsedHeaders.length > 0" class="space-y-2 p-3.5 bg-white/[0.03] border border-white/10 rounded-xl">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-white flex items-center gap-1.5">
              <CheckCircle2 class="w-4 h-4 text-[#14CA74]" />
              Nhận diện cột tự động
            </span>
            <span class="text-[10px] text-[#AEB9E1]">Có thể điều chỉnh lại nếu cần</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
            <div>
              <label class="text-[10px] text-[#AEB9E1] block mb-0.5">Mã hàng (LPVN Item code)*</label>
              <select 
                v-model="customMapping.item_code"
                class="w-full h-[32px] px-2 bg-[#18202D] border border-white/15 rounded text-[11px] text-[#00C2FF] font-semibold outline-none"
              >
                <option v-for="h in parsedHeaders" :key="h" :value="h">{{ h }}</option>
              </select>
            </div>

            <div>
              <label class="text-[10px] text-[#AEB9E1] block mb-0.5">Ngày đóng hàng (Loading Date)*</label>
              <select 
                v-model="customMapping.loading_date"
                class="w-full h-[32px] px-2 bg-[#18202D] border border-white/15 rounded text-[11px] text-white outline-none"
              >
                <option v-for="h in parsedHeaders" :key="h" :value="h">{{ h }}</option>
              </select>
            </div>

            <div>
              <label class="text-[10px] text-[#AEB9E1] block mb-0.5">Số lượng xuất (Qty)*</label>
              <select 
                v-model="customMapping.qty"
                class="w-full h-[32px] px-2 bg-[#18202D] border border-white/15 rounded text-[11px] text-[#14CA74] font-semibold outline-none"
              >
                <option v-for="h in parsedHeaders" :key="h" :value="h">{{ h }}</option>
              </select>
            </div>

            <div>
              <label class="text-[10px] text-[#AEB9E1] block mb-0.5">Quy cách (Pcs/pkg)*</label>
              <select 
                v-model="customMapping.pcs_per_pkg"
                class="w-full h-[32px] px-2 bg-[#18202D] border border-white/15 rounded text-[11px] text-white outline-none"
              >
                <option v-for="h in parsedHeaders" :key="h" :value="h">{{ h }}</option>
              </select>
            </div>

            <div>
              <label class="text-[10px] text-[#AEB9E1] block mb-0.5">Mã PO</label>
              <select 
                v-model="customMapping.po"
                class="w-full h-[32px] px-2 bg-[#18202D] border border-white/15 rounded text-[11px] text-white outline-none"
              >
                <option value="">-- Tự sinh --</option>
                <option v-for="h in parsedHeaders" :key="h" :value="h">{{ h }}</option>
              </select>
            </div>

            <div>
              <label class="text-[10px] text-[#AEB9E1] block mb-0.5">Mã SO</label>
              <select 
                v-model="customMapping.so"
                class="w-full h-[32px] px-2 bg-[#18202D] border border-white/15 rounded text-[11px] text-white outline-none"
              >
                <option value="">-- Tự sinh --</option>
                <option v-for="h in parsedHeaders" :key="h" :value="h">{{ h }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Preview Data Table -->
        <div v-if="parsedRows.length > 0" class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-white">
              Xem trước dữ liệu ({{ parsedRows.length }} dòng tìm thấy)
            </span>
            <span class="text-[11px] text-[#CB3CFF] font-semibold">
              Khoảng {{ previewContainerCount }} Container / Đơn
            </span>
          </div>

          <div class="max-h-48 overflow-x-auto overflow-y-auto custom-scroll border border-white/10 rounded-xl">
            <table class="w-full text-left text-[11px] whitespace-nowrap border-collapse">
              <thead class="bg-[#1f2837] text-[#AEB9E1] sticky top-0 font-semibold border-b border-white/10">
                <tr>
                  <th class="py-2 px-3">PO / SO</th>
                  <th class="py-2 px-3">LPVN ITEM CODE</th>
                  <th class="py-2 px-3 text-center">FEATURE</th>
                  <th class="py-2 px-3 text-right">QTY (PCS)</th>
                  <th class="py-2 px-3 text-right">PCS/PKG</th>
                  <th class="py-2 px-3">LOADING DATE</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5">
                <tr v-for="(r, idx) in parsedRows.slice(0, 8)" :key="idx" class="hover:bg-white/5">
                  <td class="py-2 px-3 font-mono text-[#AEB9E1]">{{ r.po }} / {{ r.so }}</td>
                  <td class="py-2 px-3 font-mono font-bold text-[#00C2FF]">{{ r.item_code }}</td>
                  <td class="py-2 px-3 font-mono font-bold text-[#CB3CFF] text-center">{{ r.feature }}</td>
                  <td class="py-2 px-3 text-right font-bold text-[#14CA74]">{{ r.qty.toLocaleString() }}</td>
                  <td class="py-2 px-3 text-right font-mono">{{ r.pcs_per_pkg }}</td>
                  <td class="py-2 px-3 font-mono text-[#AEB9E1]">{{ r.loading_date }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="parsedRows.length > 8" class="text-[10px] text-[#AEB9E1] italic text-center">
            ... và {{ parsedRows.length - 8 }} dòng khác sẽ được nạp toàn bộ vào hệ thống.
          </p>
        </div>

      </div>

      <!-- Action Footer -->
      <div class="flex items-center justify-between pt-3 border-t border-white/10 shrink-0">
        <button 
          type="button" 
          @click="$emit('update:visible', false)"
          class="px-4 py-2 bg-white/5 hover:bg-white/10 text-[#AEB9E1] rounded-lg text-xs font-semibold transition cursor-pointer"
        >
          Đóng
        </button>

        <button 
          type="button" 
          :disabled="parsedRows.length === 0 || loading"
          @click="handleConfirmUpload"
          class="px-5 py-2 btn-neon-purple rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CheckCircle2 class="w-4 h-4" />
          <span>{{ loading ? 'Đang nạp...' : `Xác nhận nạp (${parsedRows.length} dòng)` }}</span>
        </button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { 
  UploadCloud, 
  X, 
  FileSpreadsheet, 
  Download, 
  AlertCircle, 
  CheckCircle2 
} from 'lucide-vue-next'
import { 
  parseForecastExcelFile, 
  downloadForecastSampleTemplate, 
  ColumnMapping 
} from '@/services/forecastExcel'
import { ForecastRawItem } from '@/utils/forecast'

defineProps<{
  visible: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'upload', rows: ForecastRawItem[]): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const isDragging = ref(false)
const isParsing = ref(false)
const errorMessage = ref('')

const parsedHeaders = ref<string[]>([])
const parsedRows = ref<ForecastRawItem[]>([])

const customMapping = reactive<ColumnMapping>({
  item_code: '',
  loading_date: '',
  qty: '',
  pcs_per_pkg: '',
  po: '',
  so: '',
  container_no: ''
})

const previewContainerCount = computed(() => {
  const set = new Set(parsedRows.value.map(r => `${r.po}___${r.so}`))
  return set.size
})

const handleFileDrop = (e: DragEvent) => {
  isDragging.value = false
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    processFile(e.dataTransfer.files[0])
  }
}

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    processFile(target.files[0])
  }
}

const processFile = async (file: File) => {
  selectedFile.value = file
  errorMessage.value = ''
  isParsing.value = true

  try {
    const res = await parseForecastExcelFile(file)
    if (res.error) {
      errorMessage.value = res.error
      parsedHeaders.value = []
      parsedRows.value = []
      return
    }

    parsedHeaders.value = res.headers
    Object.assign(customMapping, res.detectedMapping)
    parsedRows.value = res.rows

    if (res.rows.length === 0) {
      errorMessage.value = 'Không tìm thấy dòng dữ liệu nào hợp lệ trong file Excel!'
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'Lỗi không xác định khi đọc file!'
  } finally {
    isParsing.value = false
  }
}

const handleConfirmUpload = () => {
  if (parsedRows.value.length === 0) return
  emit('upload', parsedRows.value)
}
</script>
