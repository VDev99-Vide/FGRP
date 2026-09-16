<template>
  <div
    v-if="visible && po"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081028]/80 backdrop-blur-md transition-opacity"
    @click.self="$emit('update:visible', false)"
  >
    <div class="glass-card-dark w-full max-w-md rounded-2xl border border-white/20 shadow-[0_0_35px_rgba(20,202,116,0.25)] p-6 space-y-5 max-h-[90vh] overflow-y-auto custom-scroll">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-white/10">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-[#14CA74]/15 border border-[#14CA74]/40 flex items-center justify-center text-[#14CA74] shadow-[0_0_12px_rgba(20,202,116,0.3)]">
            <PackagePlus class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-white tracking-wide">Nhập Hàng Theo Mã</h3>
            <p class="text-[11px] text-[#AEB9E1] font-mono font-bold">{{ po.po_no }} · {{ po.supplier }}</p>
          </div>
        </div>
        <button
          @click="$emit('update:visible', false)"
          class="p-1.5 text-[#AEB9E1] hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Chọn mã hàng (PO nhiều mã) -->
      <div v-if="hasMultiLines">
        <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">Mã hàng cần nhập <span class="text-[#FF5A65]">*</span></label>
        <select
          v-model="form.po_line_id"
          class="w-full h-[40px] px-3 bg-white/[0.05] border border-white/15 rounded-[10px] text-xs text-white font-mono font-bold outline-none focus:border-[#14CA74] transition cursor-pointer [&>option]:bg-[#18202D]"
        >
          <option v-for="line in po.linesProgress" :key="line.id" :value="line.id" :disabled="line.status === 'completed'">
            {{ line.item_code }} — {{ Number(line.received_qty).toLocaleString() }}/{{ Number(line.target_qty).toLocaleString() }} PCS{{ line.status === 'completed' ? ' (ĐỦ)' : '' }}
          </option>
        </select>
        <p v-if="selectedLine?.description" class="text-[11px] text-white/70 mt-1.5 leading-relaxed">{{ selectedLine.description }}</p>
      </div>
      <div v-else class="glass-panel-subtle p-3 text-xs">
        <p class="text-[10px] text-[#AEB9E1] uppercase tracking-wider font-bold">Mã hàng</p>
        <p class="font-mono font-bold text-[#00C2FF] mt-0.5">{{ po.item_code }}</p>
        <p v-if="po.description" class="text-white/70 mt-0.5 leading-relaxed">{{ po.description }}</p>
      </div>

      <!-- Snapshot mã đang chọn -->
      <div v-if="selectedLine" class="glass-panel-subtle p-3.5 flex items-center justify-between text-xs border border-[#14CA74]/20">
        <div>
          <p class="text-[10px] text-[#AEB9E1] uppercase tracking-wider font-bold">Mã [{{ selectedLine.item_code }}] đã nhập / Target</p>
          <p class="font-mono font-bold text-white mt-0.5">
            <span class="text-[#14CA74]">{{ Number(selectedLine.received_qty).toLocaleString() }}</span>
            <span class="text-white/40"> / {{ Number(selectedLine.target_qty).toLocaleString() }} PCS ({{ selectedLine.progress }}%)</span>
          </p>
        </div>
        <div class="text-right">
          <p class="text-[10px] text-[#AEB9E1] uppercase tracking-wider font-bold">Mã này còn lại</p>
          <p class="font-mono font-black text-[#FDB52A] mt-0.5">{{ Number(selectedLine.remaining_qty).toLocaleString() }} PCS</p>
        </div>
      </div>

      <!-- Snapshot tổng PO -->
      <div class="glass-panel-subtle p-3.5 flex items-center justify-between text-xs opacity-80">
        <div>
          <p class="text-[10px] text-[#AEB9E1] uppercase tracking-wider font-bold">Tổng PO đã nhập / Target</p>
          <p class="font-mono font-bold text-white mt-0.5">
            <span class="text-[#14CA74]">{{ po.received_qty.toLocaleString() }}</span>
            <span class="text-white/40"> / {{ po.target_qty.toLocaleString() }} PCS</span>
          </p>
        </div>
        <div class="text-right">
          <p class="text-[10px] text-[#AEB9E1] uppercase tracking-wider font-bold">PO còn lại</p>
          <p class="font-mono font-black text-[#FDB52A] mt-0.5">{{ po.remaining_qty.toLocaleString() }} PCS</p>
        </div>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">Ngày nhập hàng <span class="text-[#FF5A65]">*</span></label>
            <input
              v-model="form.receipt_date"
              type="date"
              class="w-full h-[40px] px-3.5 bg-white/[0.05] backdrop-blur-md border border-white/15 rounded-[10px] text-xs text-white font-mono outline-none focus:border-[#14CA74] focus:ring-1 ring-[#14CA74] transition [color-scheme:dark]"
            />
            <p class="text-[10px] text-[#AEB9E1]/70 mt-1">Mặc định hôm nay, sửa được tự do.</p>
          </div>
          <div>
            <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">Số lượng nhập (PCS) <span class="text-[#FF5A65]">*</span></label>
            <input
              v-model.number="form.qty"
              type="number"
              min="1"
              step="1"
              placeholder="VD: 1500"
              class="w-full h-[40px] px-3.5 bg-white/[0.05] backdrop-blur-md border border-white/15 rounded-[10px] text-xs text-[#14CA74] font-mono font-bold placeholder-[#AEB9E1]/40 outline-none focus:border-[#14CA74] focus:ring-1 ring-[#14CA74] transition"
            />
            <p v-if="selectedLine && selectedLine.status !== 'completed'" class="text-[10px] text-[#AEB9E1]/70 mt-1">
              Còn thiếu {{ Number(selectedLine.remaining_qty).toLocaleString() }} PCS cho mã này.
            </p>
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">Ghi chú đợt nhập</label>
          <input
            v-model="form.note"
            type="text"
            placeholder="VD: Đợt 3 - cont về kho 62..."
            class="w-full h-[40px] px-3.5 bg-white/[0.05] backdrop-blur-md border border-white/15 rounded-[10px] text-xs text-white placeholder-[#AEB9E1]/40 outline-none focus:border-[#14CA74] focus:ring-1 ring-[#14CA74] transition"
          />
        </div>

        <div v-if="formError" class="p-3 bg-[#FF5A65]/15 border border-[#FF5A65]/30 rounded-xl text-xs text-[#FF5A65] flex items-center gap-2">
          <AlertCircle class="w-4 h-4 shrink-0" />
          <span>{{ formError }}</span>
        </div>

        <div class="flex items-center justify-end gap-2.5 pt-1">
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
            class="px-5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 bg-[#14CA74]/20 hover:bg-[#14CA74]/30 border border-[#14CA74]/40 text-[#14CA74] hover:text-white shadow-sm"
          >
            <CheckCircle2 class="w-4 h-4" />
            <span>{{ loading ? 'Đang nhập...' : 'Xác nhận nhập' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { PackagePlus, X, AlertCircle, CheckCircle2 } from 'lucide-vue-next'
import type { PurchaseOrderWithProgress } from '@/types'
import type { ReceiptInput } from '@/composables/usePurchaseOrders'
import { todayIsoDate, validateLineReceiptInput } from '@/utils/po'

const props = defineProps<{
  visible: boolean
  loading?: boolean
  po?: PurchaseOrderWithProgress | null
  initialLineId?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'save', poId: string, payload: ReceiptInput): void
}>()

const form = reactive<ReceiptInput>({ receipt_date: todayIsoDate(), qty: 0, note: '', po_line_id: null, item_code: '' })
const formError = ref('')

const hasMultiLines = computed(() => (props.po?.linesProgress || []).length > 1)
const lineCount = computed(() => (props.po?.linesProgress || []).length || 1)
const selectedLine = computed(() => {
  const lines = props.po?.linesProgress || []
  if (lines.length === 0) return null
  if (!hasMultiLines.value) return lines[0]
  return lines.find((l) => l.id === form.po_line_id) || null
})

const defaultLineId = () => {
  const lines = props.po?.linesProgress || []
  if (lines.length <= 1) return null
  if (props.initialLineId && lines.some((l) => l.id === props.initialLineId)) return props.initialLineId
  return lines.find((l) => l.status === 'open')?.id ?? lines[0]?.id ?? null
}

watch(
  () => [props.visible, props.po?.id, props.initialLineId] as const,
  ([visible]) => {
    if (!visible) return
    formError.value = ''
    form.receipt_date = todayIsoDate()
    form.qty = 0
    form.note = ''
    form.po_line_id = defaultLineId()
    form.item_code = ''
  },
  { immediate: true },
)

const handleSubmit = () => {
  if (!props.po) return
  const err = validateLineReceiptInput(form, lineCount.value)
  if (err) {
    formError.value = err
    return
  }
  if (selectedLine.value?.status === 'completed') {
    formError.value = `Mã [${selectedLine.value.item_code}] đã nhập đủ, không thể nhập thêm!`
    return
  }
  formError.value = ''
  emit('save', props.po.id, {
    ...form,
    qty: Number(form.qty),
    item_code: selectedLine.value?.item_code || props.po.item_code,
  })
}
</script>
