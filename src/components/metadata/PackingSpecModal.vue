<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081028]/80 backdrop-blur-md transition-opacity"
    @click.self="$emit('update:visible', false)"
  >
    <div class="glass-card-dark w-full max-w-lg rounded-2xl border border-white/20 shadow-[0_0_35px_rgba(203,60,255,0.3)] p-6 space-y-5">
      <div class="flex items-center justify-between pb-3 border-b border-white/10">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#00C2FF]/30 to-[#CB3CFF]/30 border border-[#CB3CFF]/40 flex items-center justify-center shadow-[0_0_12px_rgba(203,60,255,0.3)]">
            <Package class="w-5 h-5 text-[#00C2FF]" />
          </div>
          <div>
            <h3 class="text-base font-bold text-white tracking-wide">
              {{ editing ? 'Sửa Quy Cách Đóng Gói' : 'Thêm Quy Cách Đóng Gói' }}
            </h3>
            <p class="text-[11px] text-[#AEB9E1]">Chuẩn Sample.xlsx · sheet Quy cách</p>
          </div>
        </div>
        <button
          @click="$emit('update:visible', false)"
          class="p-1.5 text-[#AEB9E1] hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">Khách hàng <span class="text-[#FF5A65]">*</span></label>
            <input
              v-model="form.customer"
              type="text"
              class="w-full h-[40px] px-3.5 bg-[#18202D]/80 border border-white/15 rounded-[10px] text-xs text-white outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">Mã hàng <span class="text-[#FF5A65]">*</span></label>
            <input
              v-model="form.item_code"
              type="text"
              class="w-full h-[40px] px-3.5 bg-[#18202D]/80 border border-white/15 rounded-[10px] text-xs text-[#00C2FF] font-mono font-bold outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">Số lượng đóng gói <span class="text-[#FF5A65]">*</span></label>
            <input
              v-model.number="form.pack_qty"
              type="number"
              min="1"
              step="1"
              class="w-full h-[40px] px-3.5 bg-[#18202D]/80 border border-white/15 rounded-[10px] text-xs text-[#14CA74] font-mono font-bold outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">Trọng lượng/Cái</label>
            <input
              v-model.number="form.weight_per_unit"
              type="number"
              min="0"
              step="0.001"
              class="w-full h-[40px] px-3.5 bg-[#18202D]/80 border border-white/15 rounded-[10px] text-xs text-white font-mono outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">Quy cách thùng</label>
            <input
              v-model="form.carton_spec"
              type="text"
              class="w-full h-[40px] px-3.5 bg-[#18202D]/80 border border-white/15 rounded-[10px] text-xs text-white font-mono outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-[#AEB9E1] mb-1.5">Loại thùng</label>
            <input
              v-model="form.carton_type"
              type="text"
              class="w-full h-[40px] px-3.5 bg-[#18202D]/80 border border-white/15 rounded-[10px] text-xs text-white outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
            />
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
            <span>{{ loading ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm mới' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { Package, X, AlertCircle, CheckCircle2 } from 'lucide-vue-next'
import type { MetadataPacking } from '@/types'
import { validatePackingSpec, type PackingSpecInput } from '@/utils/metadata'

const props = defineProps<{
  visible: boolean
  loading?: boolean
  editing?: MetadataPacking | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'save', payload: PackingSpecInput, id: string | null): void
}>()

const form = reactive<PackingSpecInput>({
  customer: '',
  item_code: '',
  pack_qty: 0,
  weight_per_unit: 0,
  carton_spec: '',
  carton_type: '',
})
const formError = ref('')

watch(
  () => [props.visible, props.editing] as const,
  ([visible, editing]) => {
    if (!visible) return
    formError.value = ''
    if (editing) {
      form.customer = editing.customer
      form.item_code = editing.item_code
      form.pack_qty = editing.pack_qty
      form.weight_per_unit = editing.weight_per_unit
      form.carton_spec = editing.carton_spec
      form.carton_type = editing.carton_type
    } else {
      form.customer = ''
      form.item_code = ''
      form.pack_qty = 0
      form.weight_per_unit = 0
      form.carton_spec = ''
      form.carton_type = ''
    }
  },
  { immediate: true },
)

const handleSubmit = () => {
  const err = validatePackingSpec(form)
  if (err) {
    formError.value = err
    return
  }
  formError.value = ''
  emit('save', { ...form }, props.editing?.id ?? null)
}
</script>
