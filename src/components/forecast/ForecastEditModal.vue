<template>
  <div 
    v-if="visible && editForm" 
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081028]/80 backdrop-blur-md transition-opacity"
    @click.self="$emit('cancel')"
  >
    <div class="glass-card-dark w-full max-w-lg rounded-2xl border border-white/20 shadow-[0_0_30px_rgba(203,60,255,0.25)] p-6 space-y-5">
      
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-white/10">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-[#CB3CFF]/20 border border-[#CB3CFF]/40 flex items-center justify-center text-[#CB3CFF]">
            <Edit3 class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-base font-bold text-white tracking-wide">
              Chỉnh Sửa Dòng Xuất Hàng
            </h3>
            <p class="text-[11px] text-[#AEB9E1]">Cập nhật thông tin mã hàng và quy cách đóng gói</p>
          </div>
        </div>
        <button 
          @click="$emit('cancel')" 
          class="p-1.5 text-[#AEB9E1] hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Form Inputs -->
      <form @submit.prevent="handleSave" class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <!-- PO -->
          <div>
            <label class="block text-[11px] font-semibold text-[#AEB9E1] mb-1">Mã PO</label>
            <input 
              v-model="editForm.po"
              type="text" 
              required
              class="w-full h-[38px] px-3 bg-[#18202D]/90 border border-white/15 rounded-lg text-xs text-white outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition font-mono"
            >
          </div>

          <!-- SO -->
          <div>
            <label class="block text-[11px] font-semibold text-[#AEB9E1] mb-1">Mã SO</label>
            <input 
              v-model="editForm.so"
              type="text" 
              required
              class="w-full h-[38px] px-3 bg-[#18202D]/90 border border-white/15 rounded-lg text-xs text-white outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition font-mono"
            >
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <!-- Container No -->
          <div>
            <label class="block text-[11px] font-semibold text-[#AEB9E1] mb-1">Số Container (Cont)</label>
            <input 
              v-model="editForm.container_no"
              type="text" 
              placeholder="VD: TGHU-882103"
              class="w-full h-[38px] px-3 bg-[#18202D]/90 border border-white/15 rounded-lg text-xs text-white outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition font-mono"
            >
          </div>

          <!-- Loading Date -->
          <div>
            <label class="block text-[11px] font-semibold text-[#AEB9E1] mb-1">Ngày Xuất (Loading Date)</label>
            <input 
              v-model="editForm.loading_date"
              type="text" 
              placeholder="dd/mm/yyyy"
              required
              class="w-full h-[38px] px-3 bg-[#18202D]/90 border border-white/15 rounded-lg text-xs text-white outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition font-mono"
            >
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <!-- LPVN Item Code -->
          <div>
            <label class="block text-[11px] font-semibold text-[#AEB9E1] mb-1">
              Mã LPVN Item Code
            </label>
            <input 
              v-model="editForm.item_code"
              type="text" 
              required
              class="w-full h-[38px] px-3 bg-[#18202D]/90 border border-white/15 rounded-lg text-xs text-[#00C2FF] font-bold outline-none focus:border-[#00C2FF] focus:ring-1 ring-[#00C2FF] transition font-mono"
            >
            <div class="flex items-center gap-1.5 mt-1 flex-wrap">
              <span class="text-[10px] text-[#AEB9E1]">
                Feature: <b class="text-[#CB3CFF]">{{ previewFeature }}</b>
              </span>
              <span 
                v-if="isSpecial"
                class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#CB3CFF]/20 text-[#CB3CFF] border border-[#CB3CFF]/40"
              >
                ★ Mã đặc biệt (1220)
              </span>
            </div>
          </div>

          <!-- Trạng Thái -->
          <div>
            <label class="block text-[11px] font-semibold text-[#AEB9E1] mb-1">Trạng Thái</label>
            <select 
              v-model="editForm.status"
              class="w-full h-[38px] px-3 bg-[#18202D]/90 border border-white/15 rounded-lg text-xs text-white outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
            >
              <option value="pending">Chờ chuẩn bị</option>
              <option value="ready">Chuẩn bị xong</option>
            </select>
            
            <!-- Checkbox Phụ kiện -->
            <label class="flex items-center gap-2 mt-2 cursor-pointer select-none">
              <input 
                type="checkbox" 
                v-model="editForm.is_accessory"
                class="rounded border-white/20 text-[#CB3CFF] focus:ring-0 cursor-pointer"
              >
              <span class="text-[11px] font-medium text-[#FDB52A] flex items-center gap-1">
                <Package class="w-3.5 h-3.5" />
                Hàng phụ kiện (Accessories - Đóng thùng)
              </span>
            </label>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <!-- Qty -->
          <div>
            <label class="block text-[11px] font-semibold text-[#AEB9E1] mb-1">
              Số Lượng Xuất (Qty - PCS)
            </label>
            <input 
              v-model.number="editForm.qty"
              type="number" 
              min="0"
              required
              class="w-full h-[38px] px-3 bg-[#18202D]/90 border border-white/15 rounded-lg text-xs text-[#14CA74] font-bold outline-none focus:border-[#14CA74] focus:ring-1 ring-[#14CA74] transition font-mono"
            >
          </div>

          <!-- Pcs/pkg -->
          <div>
            <label class="block text-[11px] font-semibold text-[#AEB9E1] mb-1">
              Quy Cách (Pcs/pkg)
            </label>
            <input 
              v-model.number="editForm.pcs_per_pkg"
              type="number" 
              min="1"
              required
              class="w-full h-[38px] px-3 bg-[#18202D]/90 border border-white/15 rounded-lg text-xs text-white outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition font-mono"
            >
          </div>
        </div>

        <!-- Live Preview Kiện / Thùng -->
        <div class="p-3 bg-white/[0.04] border border-white/10 rounded-xl flex items-center justify-between">
          <span class="text-xs text-[#AEB9E1]">
            Quy đổi {{ editForm.is_accessory ? 'số thùng xuất' : 'số kiện đơn lẻ' }}:
          </span>
          <span :class="['text-xs font-bold', editForm.is_accessory ? 'text-[#FDB52A]' : 'text-[#CB3CFF]']">
            {{ previewSinglePkg }} {{ editForm.is_accessory ? 'Thùng' : 'Kiện' }}
          </span>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center justify-between pt-3 border-t border-white/10">
          <button 
            type="button" 
            @click="handleDelete"
            class="px-3.5 py-2 bg-[#FF5A65]/15 hover:bg-[#FF5A65]/25 text-[#FF5A65] border border-[#FF5A65]/30 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 class="w-3.5 h-3.5" />
            <span>Xóa dòng</span>
          </button>

          <div class="flex items-center gap-2">
            <button 
              type="button" 
              @click="$emit('cancel')"
              class="px-4 py-2 bg-white/5 hover:bg-white/10 text-[#AEB9E1] rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              Hủy
            </button>
            <button 
              type="submit" 
              :disabled="loading"
              class="px-5 py-2 btn-neon-purple rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <Save class="w-3.5 h-3.5" />
              <span>Lưu thay đổi</span>
            </button>
          </div>
        </div>
      </form>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Edit3, X, Save, Trash2, Package } from 'lucide-vue-next'
import { extractFeatureFromItemCode, isSpecialStockCode, ForecastRawItem } from '@/utils/forecast'

const props = defineProps<{
  visible: boolean
  target: ForecastRawItem | null
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'cancel'): void
  (e: 'save', item: ForecastRawItem): void
  (e: 'delete', id: string): void
}>()

const editForm = ref<ForecastRawItem | null>(null)

watch(() => props.target, (newTarget) => {
  if (newTarget) {
    editForm.value = { ...newTarget }
  } else {
    editForm.value = null
  }
}, { immediate: true })

const isSpecial = computed(() => {
  if (!editForm.value?.item_code) return false
  return isSpecialStockCode(editForm.value.item_code)
})

const previewFeature = computed(() => {
  if (!editForm.value?.item_code) return 'No data'
  return extractFeatureFromItemCode(editForm.value.item_code, Boolean(editForm.value.is_accessory))
})

const previewSinglePkg = computed(() => {
  if (!editForm.value) return 0
  const qty = Number(editForm.value.qty) || 0
  const pcs = Number(editForm.value.pcs_per_pkg) || 0
  if (pcs <= 0) return 0
  return (qty / pcs).toFixed(2)
})

const handleSave = () => {
  if (!editForm.value) return
  emit('save', { ...editForm.value })
}

const handleDelete = () => {
  if (!editForm.value?.id) return
  if (confirm(`Bạn có chắc muốn xóa mã hàng ${editForm.value.item_code} khỏi danh sách xuất?`)) {
    emit('delete', editForm.value.id)
  }
}
</script>
