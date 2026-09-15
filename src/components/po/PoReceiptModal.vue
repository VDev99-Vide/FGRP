<template>
  <div
    v-if="visible && po"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081028]/80 backdrop-blur-md transition-opacity"
    @click.self="$emit('update:visible', false)"
  >
    <div class="glass-card-dark w-full max-w-md rounded-2xl border border-white/20 shadow-[0_0_35px_rgba(20,202,116,0.25)] p-6 space-y-5">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-white/10">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-[#14CA74]/15 border border-[#14CA74]/40 flex items-center justify-center text-[#14CA74] shadow-[0_0_12px_rgba(20,202,116,0.3)]">
            <PackagePlus class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-white tracking-wide">Nhập Hàng Vào PO</h3>
            <p class="text-[11px] text-[#AEB9E1] font-mono font-bold">{{ po.po_no }}</p>
          </div>
        </div>
        <button
          @click="$emit('update:visible', false)"
          class="p-1.5 text-[#AEB9E1] hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- PO progress snapshot -->
      <div class="glass-panel-subtle p-3.5 flex items-center justify-between text-xs">
        <div>
          <p class="text-[10px] text-[#AEB9E1] uppercase tracking-wider font-bold">Đã nhập / Target</p>
          <p class="font-mono font-bold text-white mt-0.5">
            <span class="text-[#14CA74]">{{ po.received_qty.toLocaleString() }}</span>
            <span class="text-white/40"> / {{ po.target_qty.toLocaleString() }} PCS</span>
          </p>
        </div>
        <div class="text-right">
          <p class="text-[10px] text-[#AEB9E1] uppercase tracking-wider font-bold">Còn lại</p>
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
import { reactive, ref, watch } from 'vue'
import { PackagePlus, X, AlertCircle, CheckCircle2 } from 'lucide-vue-next'
import type { PurchaseOrderWithProgress } from '@/types'
import type { ReceiptInput } from '@/composables/usePurchaseOrders'
import { todayIsoDate, validateReceiptInput } from '@/utils/po'

const props = defineProps<{
  visible: boolean
  loading?: boolean
  po?: PurchaseOrderWithProgress | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'save', poId: string, payload: ReceiptInput): void
}>()

const form = reactive<ReceiptInput>({ receipt_date: todayIsoDate(), qty: 0, note: '' })
const formError = ref('')

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    formError.value = ''
    form.receipt_date = todayIsoDate()
    form.qty = 0
    form.note = ''
  },
  { immediate: true },
)

const handleSubmit = () => {
  if (!props.po) return
  const err = validateReceiptInput(form)
  if (err) {
    formError.value = err
    return
  }
  formError.value = ''
  emit('save', props.po.id, { ...form })
}
</script>
