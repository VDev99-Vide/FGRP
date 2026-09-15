<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081028]/80 backdrop-blur-md transition-opacity"
    @click.self="$emit('update:visible', false)"
  >
    <div class="glass-card-dark w-full max-w-lg rounded-2xl border border-white/20 shadow-[0_0_35px_rgba(203,60,255,0.3)] p-6 space-y-5">
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
        <div>
          <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">Số PO <span class="text-[#FF5A65]">*</span></label>
          <input
            v-model="form.po_no"
            type="text"
            placeholder=""
            class="w-full h-[40px] px-3.5 bg-[#18202D]/80 border border-white/15 rounded-[10px] text-xs text-white font-mono font-bold placeholder-[#AEB9E1]/40 outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
          />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">Nhà cung cấp <span class="text-[#FF5A65]">*</span></label>
            <input
              v-model="form.supplier"
              type="text"
              placeholder=""
              class="w-full h-[40px] px-3.5 bg-[#18202D]/80 border border-white/15 rounded-[10px] text-xs text-white placeholder-[#AEB9E1]/40 outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">Mã hàng <span class="text-[#FF5A65]">*</span></label>
            <input
              v-model="form.item_code"
              type="text"
              placeholder=""
              class="w-full h-[40px] px-3.5 bg-[#18202D]/80 border border-white/15 rounded-[10px] text-xs text-[#00C2FF] font-mono font-bold placeholder-[#AEB9E1]/40 outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">Mô tả sản phẩm</label>
          <input
            v-model="form.description"
            type="text"
            placeholder=""
            class="w-full h-[40px] px-3.5 bg-[#18202D]/80 border border-white/15 rounded-[10px] text-xs text-white placeholder-[#AEB9E1]/40 outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">Ghi chú</label>
          <input
            v-model="form.note"
            type="text"
            placeholder=""
            class="w-full h-[40px] px-3.5 bg-[#18202D]/80 border border-white/15 rounded-[10px] text-xs text-white placeholder-[#AEB9E1]/40 outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
          />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">Mục tiêu (PCS) <span class="text-[#FF5A65]">*</span></label>
            <input
              v-model.number="form.target_qty"
              type="number"
              min="1"
              step="1"
              placeholder=""
              class="w-full h-[40px] px-3.5 bg-[#18202D]/80 border border-white/15 rounded-[10px] text-xs text-[#14CA74] font-mono font-bold placeholder-[#AEB9E1]/40 outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">Ngày tạo PO <span class="text-[#FF5A65]">*</span></label>
            <input
              v-model="form.created_date"
              type="date"
              class="w-full h-[40px] px-3.5 bg-[#18202D]/80 border border-white/15 rounded-[10px] text-xs text-white font-mono outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition [color-scheme:dark]"
            />
            <p class="text-[10px] text-[#AEB9E1]/70 mt-1">Mặc định hôm nay, sửa được tự do.</p>
          </div>
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
            class="px-5 py-2 btn-neon-purple rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <CheckCircle2 class="w-4 h-4" />
            <span>{{ loading ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo PO' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ShoppingCart, X, AlertCircle, CheckCircle2 } from 'lucide-vue-next'
import type { PurchaseOrder } from '@/types'
import type { PoInput } from '@/composables/usePurchaseOrders'
import { todayIsoDate, validatePoInput } from '@/utils/po'

const props = defineProps<{
  visible: boolean
  loading?: boolean
  editing?: PurchaseOrder | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'save', payload: PoInput, id: string | null): void
}>()

const form = reactive<PoInput>({
  po_no: '',
  supplier: '',
  item_code: '',
  description: '',
  note: '',
  target_qty: 10000,
  created_date: todayIsoDate(),
})
const formError = ref('')

watch(
  () => [props.visible, props.editing] as const,
  ([visible, editing]) => {
    if (!visible) return
    formError.value = ''
    if (editing) {
      form.po_no = editing.po_no
      form.supplier = editing.supplier
      form.item_code = editing.item_code
      form.description = editing.description ?? ''
      form.note = editing.note ?? ''
      form.target_qty = editing.target_qty
      form.created_date = editing.created_date
    } else {
      form.po_no = ''
      form.supplier = ''
      form.item_code = ''
      form.description = ''
      form.note = ''
      form.target_qty = 10000
      form.created_date = todayIsoDate()
    }
  },
  { immediate: true },
)

const handleSubmit = () => {
  const err = validatePoInput(form)
  if (err) {
    formError.value = err
    return
  }
  formError.value = ''
  emit('save', { ...form }, props.editing?.id ?? null)
}
</script>
