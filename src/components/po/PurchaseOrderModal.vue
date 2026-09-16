<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081028]/80 backdrop-blur-md transition-opacity"
    @click.self="$emit('update:visible', false)"
  >
    <div class="glass-card-dark w-full max-w-2xl rounded-2xl border border-white/20 shadow-[0_0_35px_rgba(203,60,255,0.3)] p-6 space-y-5 max-h-[90vh] overflow-y-auto custom-scroll">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-white/10">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#00C2FF]/30 to-[#CB3CFF]/30 border border-[#CB3CFF]/40 flex items-center justify-center shadow-[0_0_12px_rgba(203,60,255,0.3)]">
            <ShoppingCart class="w-5 h-5 text-[#00C2FF]" />
          </div>
          <div>
            <h3 class="text-base font-bold text-white tracking-wide">
              {{ editing ? 'Chỉnh Sửa Đơn Đặt Hàng' : 'Tạo Đơn Đặt Hàng Mới' }}
            </h3>
            <p v-if="!editing && isDraftRestored" class="text-[10px] text-[#FDB52A] mt-0.5">Đã khôi phục nháp lưu tạm (tự xóa khi đóng trình duyệt).</p>
          </div>
        </div>
        <button
          @click="$emit('update:visible', false)"
          class="p-1.5 text-[#AEB9E1] hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">Số PO <span class="text-[#FF5A65]">*</span></label>
            <input
              v-model="form.po_no"
              type="text"
              placeholder=""
              class="w-full h-[40px] px-3.5 bg-white/[0.05] backdrop-blur-md border border-white/15 rounded-[10px] text-xs text-white font-mono font-bold placeholder-[#AEB9E1]/40 outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">Nhà cung cấp <span class="text-[#FF5A65]">*</span></label>
            <input
              v-model="form.supplier"
              type="text"
              placeholder=""
              class="w-full h-[40px] px-3.5 bg-white/[0.05] backdrop-blur-md border border-white/15 rounded-[10px] text-xs text-white placeholder-[#AEB9E1]/40 outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
            />
          </div>
        </div>

        <!-- T1: Danh sách sản phẩm (1 PO nhiều sản phẩm) -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <label class="block text-xs font-semibold text-[#AEB9E1]">Sản phẩm trong PO ({{ lines.length }}) <span class="text-[#FF5A65]">*</span></label>
            <button
              type="button"
              @click="addLine"
              :disabled="lines.length >= PO_LINES_MAX"
              class="px-3 py-1.5 bg-[#00C2FF]/15 hover:bg-[#00C2FF]/25 border border-[#00C2FF]/40 text-[#00C2FF] rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer disabled:opacity-40"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>Thêm sản phẩm</span>
            </button>
          </div>

          <div
            v-for="(line, idx) in lines"
            :key="idx"
            class="p-3 bg-white/[0.03] border border-white/10 rounded-xl space-y-3"
          >
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-white/80">Sản phẩm {{ idx + 1 }}</span>
              <button
                v-if="lines.length > 1"
                type="button"
                @click="removeLine(idx)"
                class="p-1 text-[#FF5A65] hover:bg-[#FF5A65]/15 rounded-lg transition cursor-pointer"
                :title="`Xóa sản phẩm ${idx + 1}`"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-semibold text-[#AEB9E1] mb-1">Mã hàng <span class="text-[#FF5A65]">*</span></label>
                <input
                  v-model="line.item_code"
                  type="text"
                  placeholder=""
                  class="w-full h-[38px] px-3 bg-white/[0.05] border border-white/15 rounded-[8px] text-xs text-[#00C2FF] font-mono font-bold outline-none focus:border-[#CB3CFF] transition"
                />
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-[#AEB9E1] mb-1">Mục tiêu (PCS) <span class="text-[#FF5A65]">*</span></label>
                <input
                  v-model.number="line.target_qty"
                  type="number"
                  min="1"
                  step="1"
                  placeholder=""
                  class="w-full h-[38px] px-3 bg-white/[0.05] border border-white/15 rounded-[8px] text-xs text-[#14CA74] font-mono font-bold outline-none focus:border-[#CB3CFF] transition"
                />
              </div>
            </div>
            <div>
              <label class="block text-[11px] font-semibold text-[#AEB9E1] mb-1">Mô tả sản phẩm</label>
              <input
                v-model="line.description"
                type="text"
                placeholder=""
                class="w-full h-[38px] px-3 bg-white/[0.05] border border-white/15 rounded-[8px] text-xs text-white outline-none focus:border-[#CB3CFF] transition"
              />
            </div>
          </div>

          <p class="text-[11px] text-[#AEB9E1]/80">Tổng mục tiêu PO: <b class="text-[#14CA74] font-mono">{{ totalTarget.toLocaleString() }}</b> PCS</p>
        </div>

        <div>
          <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">Ghi chú</label>
          <input
            v-model="form.note"
            type="text"
            placeholder=""
            class="w-full h-[40px] px-3.5 bg-white/[0.05] backdrop-blur-md border border-white/15 rounded-[10px] text-xs text-white placeholder-[#AEB9E1]/40 outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">Ngày tạo PO <span class="text-[#FF5A65]">*</span></label>
          <input
            v-model="form.created_date"
            type="date"
            class="w-full h-[40px] px-3.5 bg-white/[0.05] backdrop-blur-md border border-white/15 rounded-[10px] text-xs text-white font-mono outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition [color-scheme:dark]"
          />
          <p class="text-[10px] text-[#AEB9E1]/70 mt-1">Mặc định hôm nay, sửa được tự do.</p>
        </div>

        <div v-if="formError" class="p-3 bg-[#FF5A65]/15 border border-[#FF5A65]/30 rounded-xl text-xs text-[#FF5A65] flex items-center gap-2">
          <AlertCircle class="w-4 h-4 shrink-0" />
          <span>{{ formError }}</span>
        </div>

        <div class="flex items-center justify-between gap-2.5 pt-1">
          <button
            v-if="!editing"
            type="button"
            @click="handleClearDraft"
            class="px-4 py-2 bg-white/5 hover:bg-white/10 text-[#AEB9E1] rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Xóa nháp
          </button>
          <div v-else class="flex-1"></div>
          <div class="flex items-center gap-2.5">
            <button
              type="button"
              @click="$emit('update:visible', false)"
              class="px-4 py-2 bg-white/5 hover:bg-white/10 text-[#AEB9E1] rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              :disabled="loading"
              class="px-5 py-2 btn-neon-purple rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <CheckCircle2 class="w-4 h-4" />
              <span>{{ loading ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo PO' }}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ShoppingCart, X, AlertCircle, CheckCircle2, Plus, Trash2 } from 'lucide-vue-next'
import type { PurchaseOrder } from '@/types'
import type { PoInput } from '@/composables/usePurchaseOrders'
import { PO_LINES_MAX, todayIsoDate, validatePoInput, type PoLineInput } from '@/utils/po'
import { clearPoDraft, loadPoDraft, savePoDraft } from '@/utils/poDraft'

const props = defineProps<{
  visible: boolean
  loading?: boolean
  editing?: PurchaseOrder | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'save', payload: PoInput, id: string | null): void
}>()

const form = reactive({
  po_no: '',
  supplier: '',
  note: '',
  created_date: todayIsoDate(),
})
const lines = ref<PoLineInput[]>([{ item_code: '', description: '', target_qty: '' as unknown as number }])
const formError = ref('')
const isDraftRestored = ref(false)

let draftTimer: ReturnType<typeof setTimeout> | null = null
const scheduleDraftSave = () => {
  if (props.editing) return
  if (draftTimer) clearTimeout(draftTimer)
  draftTimer = setTimeout(() => {
    savePoDraft({
      po_no: form.po_no,
      supplier: form.supplier,
      note: form.note,
      created_date: form.created_date,
      lines: lines.value.map((l) => ({ ...l })),
    })
  }, 300)
}

watch([() => form.po_no, () => form.supplier, () => form.note, () => form.created_date, lines], scheduleDraftSave, { deep: true })

const totalTarget = computed(() => lines.value.reduce((s, l) => s + (Number(l.target_qty) || 0), 0))

const addLine = () => {
  if (lines.value.length >= PO_LINES_MAX) return
  lines.value.push({ item_code: '', description: '', target_qty: '' as unknown as number })
}

const removeLine = (idx: number) => {
  if (lines.value.length <= 1) return
  lines.value.splice(idx, 1)
}

const resetCreateForm = () => {
  const draft = loadPoDraft()
  if (draft) {
    form.po_no = draft.po_no || ''
    form.supplier = draft.supplier || ''
    form.note = draft.note || ''
    form.created_date = draft.created_date || todayIsoDate()
    lines.value = draft.lines && draft.lines.length > 0 ? draft.lines.map((l) => ({ ...l })) : [{ item_code: '', description: '', target_qty: '' as unknown as number }]
    isDraftRestored.value = true
  } else {
    form.po_no = ''
    form.supplier = ''
    form.note = ''
    form.created_date = todayIsoDate()
    lines.value = [{ item_code: '', description: '', target_qty: '' as unknown as number }]
    isDraftRestored.value = false
  }
}

watch(
  () => [props.visible, props.editing] as const,
  ([visible, editing]) => {
    if (!visible) return
    formError.value = ''
    if (editing) {
      form.po_no = editing.po_no
      form.supplier = editing.supplier
      form.note = editing.note ?? ''
      form.created_date = editing.created_date
      const editLines = (editing.lines || []).filter((l) => l.item_code || Number(l.target_qty) > 0)
      if (editLines.length > 0) {
        lines.value = editLines.map((l) => ({ item_code: l.item_code, description: l.description || '', target_qty: l.target_qty }))
      } else {
        lines.value = [{ item_code: editing.item_code, description: editing.description || '', target_qty: editing.target_qty }]
      }
      isDraftRestored.value = false
    } else {
      resetCreateForm()
    }
  },
  { immediate: true },
)

const handleClearDraft = () => {
  clearPoDraft()
  form.po_no = ''
  form.supplier = ''
  form.note = ''
  form.created_date = todayIsoDate()
  lines.value = [{ item_code: '', description: '', target_qty: '' as unknown as number }]
  isDraftRestored.value = false
}

const handleSubmit = () => {
  const payload: PoInput = {
    po_no: form.po_no,
    supplier: form.supplier,
    item_code: lines.value[0]?.item_code || '',
    description: lines.value[0]?.description || '',
    note: form.note,
    target_qty: totalTarget.value,
    created_date: form.created_date,
    lines: lines.value.map((l) => ({ ...l })),
  }
  const err = validatePoInput(payload)
  if (err) {
    formError.value = err
    return
  }
  formError.value = ''
  if (!props.editing) clearPoDraft()
  emit('save', payload, props.editing?.id ?? null)
}
</script>
