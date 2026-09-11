<template>
  <div 
    v-if="visible && editForm" 
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081028]/80 backdrop-blur-md transition-opacity"
    @click.self="$emit('cancel')"
  >
    <div class="glass-card-dark w-full max-w-xl rounded-2xl border border-white/20 shadow-[0_0_35px_rgba(203,60,255,0.25)] p-6 space-y-5 max-h-[90vh] overflow-y-auto custom-scroll">
      
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-white/10">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-[#CB3CFF]/20 border border-[#CB3CFF]/40 flex items-center justify-center text-[#CB3CFF]">
            <Edit3 class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-base font-bold text-white tracking-wide flex items-center gap-2">
              <span>Chỉnh Sửa Group Feature</span>
              <span class="font-mono text-xs px-2 py-0.5 rounded bg-[#CB3CFF]/20 text-[#CB3CFF] border border-[#CB3CFF]/40">
                {{ displayFeatureName }}
              </span>
            </h3>
            <p class="text-[11px] text-[#AEB9E1]">Cập nhật thông tin toàn bộ mã hàng thuộc Group Feature này</p>
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
        
        <!-- Section 1: Thông tin Container & Đơn hàng -->
        <div class="p-3.5 bg-white/[0.02] border border-white/10 rounded-xl space-y-3">
          <p class="text-[10px] font-bold text-[#AEB9E1] uppercase tracking-wider">Thông Tin Đơn Hàng & Xuất Hàng</p>
          
          <div class="grid grid-cols-2 gap-3">
            <!-- PO -->
            <div>
              <label class="block text-[11px] font-semibold text-[#AEB9E1] mb-1">Mã PO</label>
              <input 
                v-model="editForm.po"
                type="text" 
                required
                class="w-full h-[36px] px-3 bg-[#18202D]/90 border border-white/15 rounded-lg text-xs text-white outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition font-mono"
              >
            </div>

            <!-- SO -->
            <div>
              <label class="block text-[11px] font-semibold text-[#AEB9E1] mb-1">Mã SO</label>
              <input 
                v-model="editForm.so"
                type="text" 
                required
                class="w-full h-[36px] px-3 bg-[#18202D]/90 border border-white/15 rounded-lg text-xs text-white outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition font-mono"
              >
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <!-- Container No -->
            <div>
              <label class="block text-[11px] font-semibold text-[#AEB9E1] mb-1">Số Cont</label>
              <input 
                v-model="editForm.container_no"
                type="text" 
                placeholder="TGHU-882103"
                class="w-full h-[36px] px-3 bg-[#18202D]/90 border border-white/15 rounded-lg text-xs text-white outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition font-mono"
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
                class="w-full h-[36px] px-3 bg-[#18202D]/90 border border-white/15 rounded-lg text-xs text-white outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition font-mono"
              >
            </div>

            <!-- Trạng Thái -->
            <div>
              <label class="block text-[11px] font-semibold text-[#AEB9E1] mb-1">Trạng Thái</label>
              <select 
                v-model="editForm.status"
                class="w-full h-[36px] px-3 bg-[#18202D]/90 border border-white/15 rounded-lg text-xs text-white outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
              >
                <option value="pending">Chờ chuẩn bị</option>
                <option value="ready">Chuẩn bị xong</option>
              </select>
            </div>
          </div>

          <!-- Tùy Chọn Đánh Dấu Box hoặc Phụ Kiện -->
          <div class="flex items-center gap-4 pt-1 flex-wrap">
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox" 
                v-model="editForm.is_box"
                class="rounded border-white/20 text-[#00C2FF] focus:ring-0 cursor-pointer"
              >
              <span class="text-[11px] font-medium text-[#00C2FF] flex items-center gap-1">
                Đánh dấu "Box" (Không chia đôi, Số kiện = Qty 1 mã / Quy cách)
              </span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox" 
                v-model="editForm.is_accessory"
                class="rounded border-white/20 text-[#FDB52A] focus:ring-0 cursor-pointer"
              >
              <span class="text-[11px] font-medium text-[#FDB52A] flex items-center gap-1">
                <Package class="w-3.5 h-3.5" />
                Hàng phụ kiện (Đóng thùng)
              </span>
            </label>
          </div>
        </div>

        <!-- Section 2: Chi tiết các LPVN Item Code trong Group -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-[10px] font-bold text-[#AEB9E1] uppercase tracking-wider">
              Danh Sách LPVN Item Code Trong Group ({{ editForm.items.length }} Mã)
            </p>
          </div>

          <div 
            v-for="(it, idx) in editForm.items" 
            :key="it.id || idx"
            class="p-3.5 bg-white/[0.03] border border-white/10 rounded-xl space-y-2.5 relative"
          >
            <div class="flex items-center justify-between border-b border-white/5 pb-1.5">
              <span class="text-xs font-bold text-white flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-[#00C2FF]"></span>
                <span>Mã LPVN Item Code #{{ idx + 1 }}</span>
              </span>
              <span class="text-[10px] text-[#AEB9E1] font-mono">ID: {{ it.id || 'Mới' }}</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <!-- Item Code -->
              <div>
                <label class="block text-[10px] font-semibold text-[#AEB9E1] mb-1">Mã Hàng</label>
                <input 
                  v-model="it.item_code"
                  type="text" 
                  required
                  class="w-full h-[36px] px-3 bg-[#18202D]/90 border border-white/15 rounded-lg text-xs text-[#00C2FF] font-bold outline-none focus:border-[#00C2FF] focus:ring-1 ring-[#00C2FF] transition font-mono"
                >
              </div>

              <!-- Qty -->
              <div>
                <label class="block text-[10px] font-semibold text-[#AEB9E1] mb-1">Số Lượng (PCS)</label>
                <input 
                  v-model.number="it.qty"
                  type="number" 
                  min="0"
                  required
                  class="w-full h-[36px] px-3 bg-[#18202D]/90 border border-white/15 rounded-lg text-xs text-[#14CA74] font-bold outline-none focus:border-[#14CA74] focus:ring-1 ring-[#14CA74] transition font-mono text-right"
                >
              </div>

              <!-- Pcs/pkg -->
              <div>
                <label class="block text-[10px] font-semibold text-[#AEB9E1] mb-1">Quy Cách (Pcs/pkg)</label>
                <input 
                  v-model.number="it.pcs_per_pkg"
                  type="number" 
                  min="1"
                  required
                  class="w-full h-[36px] px-3 bg-[#18202D]/90 border border-white/15 rounded-lg text-xs text-white outline-none focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition font-mono text-right"
                >
              </div>
            </div>
          </div>
        </div>

        <!-- Section 3: Live Preview Tính Toán Kiện / Thùng -->
        <div class="p-3.5 bg-[#CB3CFF]/10 border border-[#CB3CFF]/30 rounded-xl flex items-center justify-between flex-wrap gap-2">
          <div>
            <span class="text-xs text-white font-semibold">
              Tổng số lượng: <b class="text-[#14CA74] font-mono">{{ calculatedTotalQty.toLocaleString() }}</b> PCS
            </span>
            <p class="text-[10px] text-[#AEB9E1] mt-0.5">
              Quy cách: {{ calculatedPcsPerPkg }} PCS/PKG | Feature: {{ previewFeature }}
            </p>
          </div>

          <div class="text-right">
            <span class="text-xs text-[#AEB9E1] block">Quy đổi số kiện/thùng:</span>
            <span :class="['text-sm font-black font-mono px-2.5 py-0.5 rounded-[4px] border', editForm.is_accessory ? 'text-[#FDB52A] bg-[#FDB52A]/20 border-[#FDB52A]/40' : 'text-[#CB3CFF] bg-[#CB3CFF]/20 border-[#CB3CFF]/40']">
              {{ calculatedPkgCount }} {{ editForm.is_accessory ? 'Thùng' : 'Kiện' }}
            </span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center justify-between pt-3 border-t border-white/10">
          <button 
            type="button" 
            @click="handleDeleteGroup"
            class="px-3.5 py-2 bg-[#FF5A65]/15 hover:bg-[#FF5A65]/25 text-[#FF5A65] border border-[#FF5A65]/30 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 class="w-3.5 h-3.5" />
            <span>Xóa cả group</span>
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
              class="px-5 py-2 btn-neon-purple rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50 active:scale-95"
            >
              <Save class="w-3.5 h-3.5" />
              <span>Lưu thay đổi group</span>
            </button>
          </div>
        </div>
      </form>

    </div>

    <!-- Floating UI Confirm Modal Xóa Group -->
    <ConfirmModal 
      v-model:visible="showDeleteConfirm"
      title="Xác nhận xóa group Feature"
      :message="`Bạn có chắc chắn muốn xóa toàn bộ group Feature [${displayFeatureName}] (${editForm?.items?.length || 0} mã hàng) khỏi danh sách xuất không? Thao tác này không thể hoàn tác.`"
      confirmText="Xác nhận xóa"
      cancelText="Hủy bỏ"
      severity="danger"
      @confirm="handleConfirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Edit3, X, Save, Trash2, Package } from 'lucide-vue-next'
import { 
  extractFeatureFromItemCode, 
  isSpecialStockCode, 
  calculateFeaturePkg,
  ForecastRawItem, 
  ForecastFeatureGroup, 
  ForecastContainerGroup 
} from '@/utils/forecast'
import ConfirmModal from '@/components/common/ConfirmModal.vue'

interface EditGroupFormState {
  po: string
  so: string
  container_no: string
  loading_date: string
  status: 'pending' | 'ready'
  feature: string
  is_accessory: boolean
  is_box: boolean
  items: ForecastRawItem[]
}

const props = defineProps<{
  visible: boolean
  group: ForecastFeatureGroup | null
  container: ForecastContainerGroup | null
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'cancel'): void
  (e: 'save-group', items: ForecastRawItem[]): void
  (e: 'delete-group', items: ForecastRawItem[]): void
}>()

const editForm = ref<EditGroupFormState | null>(null)
const showDeleteConfirm = ref(false)

watch(() => [props.visible, props.group, props.container], () => {
  if (props.visible && props.group && props.container) {
    const isAcc = Boolean(props.group.is_accessory)
    const isBox = Boolean(props.group.is_box || props.group.items.some(i => i.is_box))
    
    editForm.value = {
      po: props.container.po,
      so: props.container.so,
      container_no: props.container.container_no || '',
      loading_date: props.container.loading_date,
      status: props.container.status || 'pending',
      feature: props.group.feature,
      is_accessory: isAcc,
      is_box: isBox,
      items: props.group.items.map(it => ({ ...it }))
    }
  } else {
    editForm.value = null
  }
}, { immediate: true })

const displayFeatureName = computed(() => {
  if (!editForm.value) return ''
  if (editForm.value.feature === '1220' || editForm.value.items.some(i => isSpecialStockCode(i.item_code))) {
    return '★ Mã 1220'
  }
  return editForm.value.feature
})

const previewFeature = computed(() => {
  if (!editForm.value || editForm.value.items.length === 0) return ''
  const first = editForm.value.items[0]
  return extractFeatureFromItemCode(first.item_code, editForm.value.is_accessory)
})

const calculatedTotalQty = computed(() => {
  if (!editForm.value) return 0
  return editForm.value.items.reduce((s, it) => s + (Number(it.qty) || 0), 0)
})

const calculatedPcsPerPkg = computed(() => {
  if (!editForm.value || editForm.value.items.length === 0) return 0
  return Number(editForm.value.items[0]?.pcs_per_pkg) || 0
})

const calculatedPkgCount = computed(() => {
  if (!editForm.value || editForm.value.items.length === 0) return 0
  return calculateFeaturePkg(
    editForm.value.items,
    editForm.value.is_accessory,
    editForm.value.is_box
  )
})

const handleSave = () => {
  if (!editForm.value) return
  
  const feat = previewFeature.value || editForm.value.feature
  const isAcc = editForm.value.is_accessory
  const isBox = editForm.value.is_box
  const unitType: 'kien' | 'thung' = isAcc ? 'thung' : 'kien'

  // Chuẩn hóa và đồng bộ thuộc tính chung vào từng item trong group
  const updatedItems: ForecastRawItem[] = editForm.value.items.map(it => {
    const isSpec = isSpecialStockCode(it.item_code)
    return {
      ...it,
      po: editForm.value!.po.trim(),
      so: editForm.value!.so.trim(),
      container_no: editForm.value!.container_no.trim(),
      loading_date: editForm.value!.loading_date.trim(),
      status: editForm.value!.status,
      feature: feat,
      is_accessory: isAcc,
      is_special: isSpec,
      is_box: isBox,
      unit_type: unitType,
      updated_at: new Date().toISOString()
    }
  })

  emit('save-group', updatedItems)
}

const handleDeleteGroup = () => {
  if (!editForm.value || editForm.value.items.length === 0) return
  showDeleteConfirm.value = true
}

const handleConfirmDelete = () => {
  if (editForm.value) {
    emit('delete-group', editForm.value.items)
  }
}
</script>
