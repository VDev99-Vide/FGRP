<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081028]/80 backdrop-blur-md transition-opacity"
    @click.self="$emit('update:visible', false)"
  >
    <div class="glass-card-dark w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-white/20 shadow-[0_0_35px_rgba(203,60,255,0.3)] p-6 space-y-5 overflow-hidden">

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
              Hỗ trợ file Excel <span class="text-[#00C2FF] font-semibold">.xlsx / .xls</span> — Feature &amp; PCS/pkg tham chiếu trực tiếp metadata
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
              <p class="text-[10px] text-[#AEB9E1]">Tải file Excel mẫu gồm PO, SO, LPVN Item code, Loading Date, Qty (Feature &amp; PCS/pkg tự lấy từ metadata)</p>
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

        <!-- Cộng dồn Notice -->
        <div class="flex items-start gap-2.5 p-3 bg-[#14CA74]/10 border border-[#14CA74]/25 rounded-xl text-xs text-[#14CA74]">
          <RefreshCw class="w-4 h-4 shrink-0 mt-0.5" />
          <span class="leading-relaxed">
            <b>Cơ chế cộng dồn:</b> Khi xác nhận, hệ thống sẽ <b>cộng thêm</b> vào kế hoạch hiện có (không xóa/ghi đè dữ liệu cũ). PO + SO là duy nhất — vui lòng kiểm tra cảnh báo trùng bên dưới.
          </span>
        </div>

        <!-- Duplicate PO-SO Warning -->
        <div v-if="duplicateKeys.length > 0" class="p-3 bg-[#FDB52A]/10 border border-[#FDB52A]/40 rounded-xl text-xs text-[#FDB52A] space-y-1">
          <p class="font-bold flex items-center gap-1.5"><AlertCircle class="w-4 h-4" /> Cảnh báo: PO + SO đã có trong kế hoạch (cần kiểm tra lại vì PO/SO là duy nhất):</p>
          <ul class="list-disc ml-5 font-mono">
            <li v-for="k in duplicateKeys" :key="k">{{ k }}</li>
          </ul>
          <p class="text-[11px] opacity-80">Hệ thống vẫn cho phép cộng thêm — anh kiểm tra lại để tránh trùng, có thể xóa thủ công sau.</p>
        </div>

        <!-- Missing metadata warning -->
        <div v-if="missingCodes.length > 0" class="p-3 bg-[#FF5A65]/10 border border-[#FF5A65]/40 rounded-xl text-xs text-[#FF5A65] space-y-1">
          <p class="font-bold">⚠ Thiếu Meta-data cho {{ missingCodes.length }} mã (vẫn cho thêm, gắn tag "Thiếu Meta-data"):</p>
          <p class="font-mono">{{ missingCodes.slice(0, 10).join(', ') }}{{ missingCodes.length > 10 ? ` +${missingCodes.length - 10} mã` : '' }}</p>
          <p class="text-[11px] opacity-80">Vui lòng bổ sung trong Meta-data · Quy cách đóng gói chuẩn để tính kiện chuẩn xác.</p>
        </div>

        <!-- 1010 selector -->
        <div v-if="has1010" class="p-3.5 bg-[#CB3CFF]/10 border border-[#CB3CFF]/40 rounded-xl space-y-2.5">
          <p class="text-xs font-bold text-white flex items-center gap-1.5">
            <Package class="w-4 h-4 text-[#CB3CFF]" />
            Phát hiện mã 1010 (8101010104 / 8101020104) — chọn loại thùng để tính kiện phù hợp:
          </p>
          <div class="flex gap-2.5">
            <label class="flex-1 flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition text-xs font-bold"
              :class="chosen1010Type === 'thùng đôi' ? 'border-[#CB3CFF] bg-[#CB3CFF]/20 text-white' : 'border-white/15 bg-white/[0.03] text-[#AEB9E1] hover:text-white'">
              <input type="radio" v-model="chosen1010Type" value="thùng đôi" class="accent-[#CB3CFF]" />
              <span>Thùng đôi (tổng/2/pack + "ước tính")</span>
            </label>
            <label class="flex-1 flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition text-xs font-bold"
              :class="chosen1010Type === 'thùng đơn' ? 'border-[#00C2FF] bg-[#00C2FF]/20 text-white' : 'border-white/15 bg-white/[0.03] text-[#AEB9E1] hover:text-white'">
              <input type="radio" v-model="chosen1010Type" value="thùng đơn" class="accent-[#00C2FF]" />
              <span>Thùng đơn (từng mã/pack)</span>
            </label>
          </div>
          <p class="text-[11px] text-[#AEB9E1]">Lưu ý: trong Tồn kho, 1010 luôn tính theo thùng đôi + "Ước tính". Ở đây chọn đúng thực tế xuất hàng.</p>
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
              {{ selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Feature & PCS/pkg tự tham chiếu metadata (chuẩn xác hơn)' }}
            </p>
          </div>
        </div>

        <!-- Error Alert -->
        <div v-if="errorMessage" class="p-3 bg-[#FF5A65]/15 border border-[#FF5A65]/30 rounded-xl text-xs text-[#FF5A65] flex items-center gap-2">
          <AlertCircle class="w-4 h-4 shrink-0" />
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Detected Column Mapping (gọn: file mới chỉ cần 5 cột) -->
        <div v-if="parsedHeaders.length > 0" class="space-y-2 p-3.5 bg-white/[0.03] border border-white/10 rounded-xl">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-white flex items-center gap-1.5">
              <CheckCircle2 class="w-4 h-4 text-[#14CA74]" />
              Nhận diện cột tự động
            </span>
            <span class="text-[10px] text-[#AEB9E1]">PCS/pkg &amp; Feature lấy từ metadata (không cần trong file)</span>
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

            <div>
              <label class="text-[10px] text-[#AEB9E1] block mb-0.5">Container (optional)</label>
              <select
                v-model="customMapping.container_no"
                class="w-full h-[32px] px-2 bg-[#18202D] border border-white/15 rounded text-[11px] text-white outline-none"
              >
                <option value="">-- Bỏ qua --</option>
                <option v-for="h in parsedHeaders" :key="h" :value="h">{{ h }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Preview Data Table (Feature + PCS/pkg từ metadata) -->
        <div v-if="resolvedRows.length > 0" class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-white">
              Xem trước dữ liệu ({{ resolvedRows.length }} dòng — Feature &amp; PCS/pkg từ metadata)
            </span>
            <span class="text-[11px] text-[#CB3CFF] font-semibold">
              Khoảng {{ previewContainerCount }} Container / Đơn
            </span>
          </div>

          <div class="max-h-56 overflow-x-auto overflow-y-auto custom-scroll border border-white/10 rounded-xl">
            <table class="w-full text-left text-[11px] whitespace-nowrap border-collapse">
              <thead class="bg-[#1f2837] text-[#AEB9E1] sticky top-0 font-semibold border-b border-white/10">
                <tr>
                  <th class="py-2 px-3">PO / SO</th>
                  <th class="py-2 px-3">LPVN ITEM CODE</th>
                  <th class="py-2 px-3 text-center">FEATURE (meta)</th>
                  <th class="py-2 px-3 text-center">LOẠI HÀNG</th>
                  <th class="py-2 px-3 text-right">QTY (PCS)</th>
                  <th class="py-2 px-3 text-right">PCS/PKG (meta)</th>
                  <th class="py-2 px-3">LOADING DATE</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5">
                <tr v-for="(r, idx) in resolvedRows.slice(0, 10)" :key="idx" class="hover:bg-white/5">
                  <td class="py-2 px-3 font-mono text-[#AEB9E1]">{{ r.po }} / {{ r.so }}</td>
                  <td class="py-2 px-3 font-mono font-bold text-[#00C2FF]">{{ r.item_code }}</td>
                  <td class="py-2 px-3 font-mono font-bold text-[#CB3CFF] text-center">
                    {{ r.resolvedFeature }}
                    <span v-if="r.missingMetadata" class="ml-1 px-1 py-0.5 rounded text-[9px] font-bold bg-[#FF5A65]/15 text-[#FF5A65] border border-[#FF5A65]/30">Thiếu Meta-data</span>
                  </td>
                  <td class="py-2 px-3 text-center">
                    <span
                      v-if="r.is_accessory"
                      class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FDB52A]/15 text-[#FDB52A] border border-[#FDB52A]/30 inline-flex items-center gap-1"
                    >
                      <Package class="w-2.5 h-2.5" />
                      Phụ kiện (Thùng)
                    </span>
                    <span
                      v-else-if="r.is_special"
                      class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#CB3CFF]/15 text-[#CB3CFF] border border-[#CB3CFF]/30"
                    >
                      ★ Mã 1220
                    </span>
                    <span
                      v-else
                      class="text-[10px] text-[#AEB9E1]"
                    >
                      Thành phẩm (Kiện)
                    </span>
                  </td>
                  <td class="py-2 px-3 text-right font-bold text-[#14CA74]">{{ r.qty.toLocaleString() }}</td>
                  <td class="py-2 px-3 text-right font-mono">{{ r.resolvedPackQty || r.pcs_per_pkg || '—' }}</td>
                  <td class="py-2 px-3 font-mono text-[#AEB9E1]">{{ r.loading_date }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="resolvedRows.length > 10" class="text-[10px] text-[#AEB9E1] italic text-center">
            ... và {{ resolvedRows.length - 10 }} dòng khác sẽ được nạp (cộng dồn) vào hệ thống.
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
          :disabled="resolvedRows.length === 0 || loading"
          @click="handleConfirmUpload"
          class="px-5 py-2 btn-neon-purple rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CheckCircle2 class="w-4 h-4" />
          <span>{{ loading ? 'Đang nạp...' : `Xác nhận nạp cộng dồn (${resolvedRows.length} dòng)` }}</span>
        </button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import {
  UploadCloud,
  X,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Package,
  RefreshCw
} from 'lucide-vue-next'
import {
  parseForecastExcelFile,
  downloadForecastSampleTemplate,
  resolvePreviewWithMetadata,
  type MetadataSpecForForecast,
  type ResolvedPreviewRow,
  ColumnMapping
} from '@/services/forecastExcel'
import { findDuplicateContainerKeys, ForecastRawItem } from '@/utils/forecast'

const props = defineProps<{
  visible: boolean
  loading?: boolean
  metadataSpecs?: MetadataSpecForForecast[]
  existingItems?: Pick<ForecastRawItem, 'po' | 'so'>[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'upload', rows: ForecastRawItem[], preferred1010Type: string): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const isDragging = ref(false)
const isParsing = ref(false)
const errorMessage = ref('')

const parsedHeaders = ref<string[]>([])
const parsedRows = ref<ForecastRawItem[]>([])
const chosen1010Type = ref<string>('thùng đôi')

const customMapping = reactive<ColumnMapping>({
  item_code: '',
  loading_date: '',
  qty: '',
  pcs_per_pkg: '',
  po: '',
  so: '',
  container_no: '',
  feature_or_accessory: ''
})

const resolvedRows = computed<ResolvedPreviewRow[]>(() => {
  return resolvePreviewWithMetadata(parsedRows.value, props.metadataSpecs || [])
})

const has1010 = computed(() => resolvedRows.value.some((r) => r.is1010))

const missingCodes = computed(() => {
  const set = new Set<string>()
  resolvedRows.value.forEach((r) => {
    if (r.missingMetadata) set.add(String(r.item_code))
  })
  return Array.from(set)
})

const duplicateKeys = computed(() => {
  if (!props.existingItems || props.existingItems.length === 0) return []
  return findDuplicateContainerKeys(parsedRows.value, props.existingItems)
})

const previewContainerCount = computed(() => {
  const set = new Set(resolvedRows.value.map(r => `${r.po}___${r.so}`))
  return set.size
})

watch(() => props.visible, (v) => {
  if (v) {
    chosen1010Type.value = 'thùng đôi'
  } else {
    // reset khi đóng
    parsedHeaders.value = []
    parsedRows.value = []
    selectedFile.value = null
    errorMessage.value = ''
  }
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
  if (resolvedRows.value.length === 0) return
  // Map resolved -> ForecastRawItem (feature + pcs từ metadata)
  const finalRows: ForecastRawItem[] = resolvedRows.value.map((r) => ({
    po: r.po,
    so: r.so,
    container_no: r.container_no,
    item_code: r.item_code,
    feature: r.resolvedFeature || r.feature,
    loading_date: r.loading_date,
    qty: r.qty,
    pcs_per_pkg: r.resolvedPackQty || r.pcs_per_pkg || 0,
    pkg: 0,
    is_accessory: r.is_accessory,
    is_special: r.is_special,
    is_box: r.is_box,
    unit_type: r.unit_type,
    status: 'pending',
  }))
  emit('upload', finalRows, has1010.value ? chosen1010Type.value : 'thùng đôi')
}
</script>
