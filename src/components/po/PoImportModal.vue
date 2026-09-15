<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081028]/80 backdrop-blur-md transition-opacity"
    @click.self="$emit('update:visible', false)"
  >
    <div class="glass-card-dark w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-white/20 shadow-[0_0_35px_rgba(203,60,255,0.3)] p-6 space-y-4 overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#00C2FF]/30 to-[#CB3CFF]/30 border border-[#CB3CFF]/40 flex items-center justify-center shadow-[0_0_12px_rgba(203,60,255,0.3)]">
            <UploadCloud class="w-5 h-5 text-[#00C2FF]" />
          </div>
          <div>
            <h3 class="text-base font-bold text-white tracking-wide">Import PO Hàng Loạt Từ Excel</h3>
            <p class="text-[11px] text-[#AEB9E1]">File <span class="text-[#00C2FF] font-semibold">.xlsx</span> · Trùng Số PO thì cập nhật, mới thì thêm</p>
          </div>
        </div>
        <button
          @click="$emit('update:visible', false)"
          class="p-1.5 text-[#AEB9E1] hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto custom-scroll space-y-4 pr-1">
        <!-- Template banner -->
        <div class="flex items-center justify-between p-3.5 bg-white/[0.03] border border-white/10 rounded-xl">
          <div class="flex items-center gap-2.5">
            <FileSpreadsheet class="w-5 h-5 text-[#14CA74]" />
            <div>
              <p class="text-xs font-bold text-white">Chưa có file mẫu chuẩn?</p>
              <p class="text-[10px] text-[#AEB9E1]">Tải file mẫu: Số PO, Nhà cung cấp, Mã hàng, Mô tả, Ghi chú, Mục tiêu, Ngày tạo</p>
            </div>
          </div>
          <button
            type="button"
            @click="downloadPoSampleTemplate"
            class="px-3 py-1.5 bg-[#14CA74]/15 hover:bg-[#14CA74]/25 border border-[#14CA74]/30 text-[#14CA74] rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Download class="w-3.5 h-3.5" />
            <span>Tải file mẫu .xlsx</span>
          </button>
        </div>

        <!-- Upload area -->
        <div
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleFileDrop"
          :class="[
            'border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer flex flex-col items-center justify-center gap-2',
            isDragging ? 'border-[#CB3CFF] bg-[#CB3CFF]/10' : 'border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]',
          ]"
          @click="fileInputRef?.click()"
        >
          <input ref="fileInputRef" type="file" accept=".xlsx, .xls" class="hidden" @change="handleFileSelect" />
          <div class="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#AEB9E1]">
            <UploadCloud :class="['w-6 h-6', isParsing ? 'animate-bounce text-[#00C2FF]' : '']" />
          </div>
          <p class="text-xs font-bold text-white">{{ selectedFile ? selectedFile.name : 'Kéo thả file .xlsx vào đây hoặc bấm để chọn file' }}</p>
        </div>

        <div v-if="errorMessage" class="p-3 bg-[#FF5A65]/15 border border-[#FF5A65]/30 rounded-xl text-xs text-[#FF5A65] flex items-center gap-2">
          <AlertCircle class="w-4 h-4 shrink-0" />
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Column mapping -->
        <div v-if="parsedHeaders.length > 0" class="space-y-2 p-3.5 bg-white/[0.03] border border-white/10 rounded-xl">
          <p class="text-xs font-bold text-white flex items-center gap-1.5">
            <CheckCircle2 class="w-4 h-4 text-[#14CA74]" />
            Nhận diện cột tự động (chỉnh lại nếu cần)
          </p>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div v-for="field in mappingFields" :key="field.key">
              <label class="text-[10px] text-[#AEB9E1] block mb-0.5">{{ field.label }}</label>
              <select
                v-model="customMapping[field.key]"
                class="w-full h-[32px] px-2 bg-[#18202D] border border-white/15 rounded text-[11px] text-white outline-none"
              >
                <option value="">-- Bỏ qua --</option>
                <option v-for="h in parsedHeaders" :key="h" :value="h">{{ h }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Preview -->
        <div v-if="previewRows.length > 0" class="space-y-2">
          <p class="text-xs font-bold text-white">Xem trước ({{ previewRows.length }} PO hợp lệ)</p>
          <div class="max-h-48 overflow-x-auto overflow-y-auto custom-scroll border border-white/10 rounded-xl">
            <table class="w-full text-left text-[11px] whitespace-nowrap border-collapse">
              <thead class="bg-[#1f2837] text-[#AEB9E1] sticky top-0 font-semibold border-b border-white/10">
                <tr>
                  <th class="py-2 px-3">SỐ PO</th>
                  <th class="py-2 px-3">NHÀ CUNG CẤP</th>
                  <th class="py-2 px-3">MÃ HÀNG</th>
                  <th class="py-2 px-3">MÔ TẢ</th>
                  <th class="py-2 px-3 text-right">MỤC TIÊU</th>
                  <th class="py-2 px-3">NGÀY TẠO</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5">
                <tr v-for="(r, idx) in previewRows.slice(0, 8)" :key="idx" class="hover:bg-white/5">
                  <td class="py-2 px-3 font-mono font-bold text-[#CB3CFF]">{{ r.po_no }}</td>
                  <td class="py-2 px-3 text-white/85">{{ r.supplier }}</td>
                  <td class="py-2 px-3 font-mono text-[#00C2FF]">{{ r.item_code }}</td>
                  <td class="py-2 px-3 text-white/80">{{ r.description || '—' }}</td>
                  <td class="py-2 px-3 text-right font-mono font-bold text-[#14CA74]">{{ r.target_qty.toLocaleString() }}</td>
                  <td class="py-2 px-3 font-mono text-[#AEB9E1]">{{ r.created_date }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Footer -->
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
          :disabled="previewRows.length === 0 || loading"
          @click="handleConfirm"
          class="px-5 py-2 btn-neon-purple rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CheckCircle2 class="w-4 h-4" />
          <span>{{ loading ? 'Đang import...' : `Xác nhận import (${previewRows.length} PO)` }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { UploadCloud, X, FileSpreadsheet, Download, AlertCircle, CheckCircle2 } from 'lucide-vue-next'
import {
  parsePoExcelFile,
  downloadPoSampleTemplate,
  mapRowsToPurchaseOrders,
  type PoColumnMapping,
  type PoExcelRow,
} from '@/services/poExcel'

defineProps<{ visible: boolean; loading?: boolean }>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'import', rows: PoExcelRow[]): void
}>()

const mappingFields: { key: keyof PoColumnMapping; label: string }[] = [
  { key: 'po_no', label: 'Số PO *' },
  { key: 'supplier', label: 'Nhà cung cấp' },
  { key: 'item_code', label: 'Mã hàng' },
  { key: 'description', label: 'Mô tả sản phẩm' },
  { key: 'note', label: 'Ghi chú' },
  { key: 'target_qty', label: 'Mục tiêu *' },
  { key: 'created_date', label: 'Ngày tạo' },
]

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const isDragging = ref(false)
const isParsing = ref(false)
const errorMessage = ref('')
const parsedHeaders = ref<string[]>([])
const rawRows = ref<Record<string, unknown>[]>([])

const customMapping = reactive<PoColumnMapping>({
  po_no: '',
  supplier: '',
  item_code: '',
  description: '',
  note: '',
  target_qty: '',
  created_date: '',
})

const previewRows = computed(() => {
  if (rawRows.value.length === 0 || !customMapping.po_no || !customMapping.target_qty) return []
  return mapRowsToPurchaseOrders(rawRows.value, { ...customMapping })
})

const handleFileDrop = (e: DragEvent) => {
  isDragging.value = false
  if (e.dataTransfer?.files?.length) processFile(e.dataTransfer.files[0])
}

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files?.length) processFile(target.files[0])
}

const processFile = async (file: File) => {
  selectedFile.value = file
  errorMessage.value = ''
  isParsing.value = true
  try {
    const res = await parsePoExcelFile(file)
    parsedHeaders.value = res.headers
    Object.assign(customMapping, res.detectedMapping)
    rawRows.value = res.rawRows
    if (res.error && res.rows.length === 0 && res.rawRows.length === 0) {
      errorMessage.value = res.error
    } else if (res.error) {
      errorMessage.value = res.error
    }
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : 'Lỗi không xác định khi đọc file!'
  } finally {
    isParsing.value = false
  }
}

const handleConfirm = () => {
  if (previewRows.value.length === 0) return
  emit('import', previewRows.value)
}
</script>
