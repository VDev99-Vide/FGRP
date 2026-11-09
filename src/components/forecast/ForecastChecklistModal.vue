<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081028]/80 backdrop-blur-md transition-opacity"
    @click.self="$emit('update:visible', false)"
  >
    <div class="glass-card-dark w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-white/20 shadow-[0_0_35px_rgba(203,60,255,0.3)] p-6 space-y-4 overflow-hidden">

      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
        <div class="flex items-center gap-3">
          <div
            :class="[
              'w-9 h-9 rounded-xl border flex items-center justify-center shadow-sm',
              statusMode === 'pending'
                ? 'bg-[#00C2FF]/20 border-[#00C2FF]/40 text-[#00C2FF]'
                : 'bg-[#14CA74]/20 border-[#14CA74]/40 text-[#14CA74]'
            ]"
          >
            <CheckSquare class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-white tracking-wide flex items-center gap-2 flex-wrap">
              <span>{{ targetContainer ? 'Tích Chọn Hoàn Thành Theo Line (Group PO/SO)' : 'Chọn Tất Cả & Thao Tác Nhanh Theo Check-list' }}</span>
              <span
                v-if="targetContainer"
                class="text-xs font-mono px-2.5 py-0.5 rounded bg-[#CB3CFF]/20 text-[#CB3CFF] border border-[#CB3CFF]/40"
              >
                PO: {{ targetContainer.po }} | SO: {{ targetContainer.so }}
              </span>
            </h3>
            <p class="text-[11px] text-[#AEB9E1] mt-0.5">
              <template v-if="statusMode === 'pending'">
                Tích chọn từng line đã chuẩn bị xong để chuyển về <b>Đã xong</b> (các line còn lại vẫn giữ ở <b>Chờ chuẩn bị</b>; các line cùng group sẽ tự đồng bộ).
              </template>
              <template v-else>
                Tích chọn từng line hoặc cả group để <b>Hoàn lại Chờ chuẩn bị</b> hoặc <b>Xóa</b> theo check-list.
              </template>
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

      <!-- Toolbar: Select All / Unselect All + Search -->
      <div class="flex flex-wrap items-center justify-between gap-2.5 p-3 bg-white/[0.03] border border-white/10 rounded-xl shrink-0">
        <div class="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            @click="handleSelectAllInModal"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border bg-[#CB3CFF]/20 hover:bg-[#CB3CFF]/30 text-white border-[#CB3CFF]/50"
          >
            <CheckSquare class="w-3.5 h-3.5 text-[#CB3CFF]" />
            <span>{{ isAllModalSelected ? 'Bỏ chọn tất cả' : `Chọn tất cả (${totalModalLines} line)` }}</span>
          </button>

          <span class="text-xs text-[#AEB9E1]">
            Đã tích chọn:
            <b class="text-[#00C2FF] font-mono">{{ selectedModalLinesCount }}</b> / {{ totalModalLines }} line
            <span class="text-white/40 font-mono">({{ localSelectedIds.size }} mã hàng)</span>
          </span>
        </div>

        <div v-if="!targetContainer" class="relative w-full sm:w-56">
          <input
            v-model="modalSearch"
            type="text"
            placeholder="Lọc nhanh PO, SO, Feature, Kho..."
            class="w-full h-[32px] px-3 pl-8 bg-[#18202D] border border-white/15 rounded-lg text-xs text-white placeholder-[#AEB9E1]/50 outline-none focus:border-[#CB3CFF]"
          />
          <Search class="w-3.5 h-3.5 text-[#AEB9E1] absolute left-2.5 top-2" />
        </div>
      </div>

      <!-- Scrollable List of Containers & Feature Lines -->
      <div class="flex-1 overflow-y-auto custom-scroll space-y-3 pr-1">
        <div
          v-for="cont in displayedContainers"
          :key="`${cont.po}-${cont.so}-${cont.status}`"
          class="rounded-xl border border-white/15 bg-white/[0.02] overflow-hidden"
        >
          <!-- Group Header -->
          <div
            class="px-4 py-2.5 bg-gradient-to-r from-[#CB3CFF]/15 via-[#00C2FF]/10 to-transparent border-b border-white/10 flex flex-wrap items-center justify-between gap-2 cursor-pointer"
            @click="toggleModalContainer(cont)"
          >
            <div class="flex items-center gap-2.5">
              <input
                type="checkbox"
                :checked="isModalContainerSelected(cont)"
                @click.stop
                @change="toggleModalContainer(cont)"
                class="w-4 h-4 accent-[#CB3CFF] cursor-pointer"
              />
              <span class="font-mono font-black text-xs text-white">
                PO: {{ cont.po }} | SO: {{ cont.so }}
              </span>
              <span class="text-[11px] font-mono text-[#00C2FF] bg-[#00C2FF]/15 border border-[#00C2FF]/30 px-2 py-0.5 rounded">
                Loading: {{ cont.loading_date }}
              </span>
            </div>

            <div class="flex items-center gap-2 text-[11px]">
              <span class="text-[#AEB9E1] font-mono">{{ cont.featureGroups.length }} line</span>
              <span class="font-mono font-bold text-[#CB3CFF] bg-[#CB3CFF]/15 border border-[#CB3CFF]/30 px-2 py-0.5 rounded">
                {{ cont.summaryPkgLabel }}
              </span>
            </div>
          </div>

          <!-- Feature Lines inside Group -->
          <div class="divide-y divide-white/[0.06]">
            <label
              v-for="fg in cont.featureGroups"
              :key="`${cont.po}-${cont.so}-${fg.feature}`"
              :class="[
                'flex items-center justify-between gap-3 px-4 py-2.5 transition cursor-pointer select-none',
                isModalFeatureSelected(fg) ? 'bg-[#CB3CFF]/10' : 'hover:bg-white/[0.04]'
              ]"
            >
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <input
                  type="checkbox"
                  :checked="isModalFeatureSelected(fg)"
                  @change="toggleModalFeature(fg)"
                  class="w-4 h-4 accent-[#CB3CFF] cursor-pointer shrink-0"
                />

                <!-- Feature Badge -->
                <span
                  :class="[
                    'font-mono font-black text-xs px-2.5 py-1 rounded-[6px] border shrink-0',
                    fg.is_accessory
                      ? 'text-[#FDB52A] bg-[#FDB52A]/15 border-[#FDB52A]/30'
                      : 'text-[#CB3CFF] bg-[#CB3CFF]/15 border-[#CB3CFF]/30'
                  ]"
                >
                  {{ fg.feature === '1220' || fg.is_special ? '★ Mã 1220' : fg.feature }}
                </span>

                <!-- Item codes -->
                <div class="flex flex-wrap items-center gap-1.5 min-w-0">
                  <span
                    v-for="it in fg.items"
                    :key="it.id || it.item_code"
                    class="font-mono text-[11px] font-bold text-[#00C2FF] bg-white/[0.04] border border-white/10 px-2 py-0.5 rounded"
                  >
                    {{ it.item_code }}
                  </span>
                </div>
              </div>

              <!-- Right Info: Qty, Warehouse, Pkg -->
              <div class="flex items-center gap-2.5 shrink-0 text-xs font-mono">
                <span class="text-[#14CA74] font-bold">
                  {{ Number(fg.totalQty || 0).toLocaleString() }} PCS
                </span>

                <span
                  v-if="fg.warehouseLabel && fg.warehouseLabel !== '—'"
                  :class="[
                    'px-2 py-0.5 rounded text-[11px] font-bold border',
                    fg.isMultiWarehouse
                      ? 'text-[#FDB52A] bg-[#FDB52A]/15 border-[#FDB52A]/30'
                      : 'text-[#00C2FF] bg-[#00C2FF]/15 border-[#00C2FF]/30'
                  ]"
                >
                  {{ fg.isMultiWarehouse ? fg.warehouseLabel : `Kho ${fg.warehouseLabel}` }}
                </span>

                <span
                  :class="[
                    'px-2.5 py-0.5 rounded font-bold border',
                    fg.is_accessory
                      ? 'text-[#FDB52A] bg-[#FDB52A]/15 border-[#FDB52A]/30'
                      : 'text-[#CB3CFF] bg-[#CB3CFF]/15 border-[#CB3CFF]/30'
                  ]"
                >
                  {{ fg.pkgCount }} {{ fg.unit_type === 'thung' ? 'Thùng' : 'Kiện' }}
                </span>
              </div>
            </label>
          </div>
        </div>

        <div v-if="displayedContainers.length === 0" class="text-center py-10 text-xs text-[#AEB9E1] italic">
          Không có dữ liệu phù hợp trong danh sách hiện tại.
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10 shrink-0">
        <button
          type="button"
          @click="$emit('update:visible', false)"
          class="px-4 py-2 bg-white/5 hover:bg-white/10 text-[#AEB9E1] rounded-lg text-xs font-semibold transition cursor-pointer"
        >
          Đóng
        </button>

        <div class="flex flex-wrap items-center gap-2">
          <!-- Nút Xóa Khóa Cứng Theo Check-list -->
          <button
            type="button"
            :disabled="localSelectedIds.size === 0 || loading"
            @click="handleDeleteSelected"
            class="px-4 py-2 bg-[#FF5A65]/15 hover:bg-[#FF5A65]/25 border border-[#FF5A65]/40 text-[#FF5A65] rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 class="w-4 h-4" />
            <span>Xóa đã chọn ({{ selectedModalLinesCount }} line)</span>
          </button>

          <!-- Nút Chuẩn bị xong / Hoàn lại Theo Check-list -->
          <button
            v-if="statusMode === 'pending'"
            type="button"
            :disabled="localSelectedIds.size === 0 || loading"
            @click="handleConfirmMarkReady"
            class="px-5 py-2 bg-[#00C2FF]/20 hover:bg-[#00C2FF]/35 border border-[#00C2FF]/50 text-[#00C2FF] hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCircle2 class="w-4 h-4" />
            <span>{{ loading ? 'Đang xử lý...' : `Xác nhận Chuẩn bị xong (${selectedModalLinesCount} line)` }}</span>
          </button>

          <button
            v-else
            type="button"
            :disabled="localSelectedIds.size === 0 || loading"
            @click="handleConfirmRevertPending"
            class="px-5 py-2 bg-[#FDB52A]/20 hover:bg-[#FDB52A]/35 border border-[#FDB52A]/50 text-[#FDB52A] hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw class="w-4 h-4" />
            <span>{{ loading ? 'Đang xử lý...' : `Hoàn lại Chờ chuẩn bị (${selectedModalLinesCount} line)` }}</span>
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  CheckSquare,
  CheckCircle2,
  RotateCcw,
  Trash2,
  Search,
  X
} from 'lucide-vue-next'
import { ForecastContainerGroup, ForecastFeatureGroup } from '@/utils/forecast'

const props = defineProps<{
  visible: boolean
  containers: ForecastContainerGroup[]
  targetContainer?: ForecastContainerGroup | null
  selectedIds: Set<string>
  statusMode: 'pending' | 'ready'
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'update:selectedIds', val: Set<string>): void
  (e: 'mark-ready', ids: string[]): void
  (e: 'revert-pending', ids: string[]): void
  (e: 'delete-selected', ids: string[]): void
}>()

const modalSearch = ref('')
const localSelectedIds = ref<Set<string>>(new Set())

const getFeatureIds = (fg: ForecastFeatureGroup): string[] =>
  (fg.items || []).map((it) => String(it.id)).filter(Boolean)

const getContainerIds = (c: ForecastContainerGroup): string[] =>
  (c.allItems || []).map((it) => String(it.id)).filter(Boolean)

const baseContainers = computed<ForecastContainerGroup[]>(() => {
  if (props.targetContainer) {
    return [props.targetContainer]
  }
  return props.containers || []
})

const displayedContainers = computed<ForecastContainerGroup[]>(() => {
  const q = modalSearch.value.toLowerCase().trim()
  if (!q || props.targetContainer) return baseContainers.value
  return baseContainers.value.filter((c) => {
    const str = [
      c.po,
      c.so,
      c.loading_date,
      ...c.featureGroups.map((fg) => `${fg.feature} ${fg.warehouseLabel} ${fg.items.map((i) => i.item_code).join(' ')}`),
    ]
      .join(' ')
      .toLowerCase()
    return str.includes(q)
  })
})

watch(
  () => [props.visible, props.targetContainer, props.selectedIds] as const,
  ([vis]) => {
    if (!vis) {
      modalSearch.value = ''
      return
    }
    // Khi mở modal cho 1 container cụ thể: chỉ lấy những id đã chọn thuộc container đó
    if (props.targetContainer) {
      const cIds = new Set(getContainerIds(props.targetContainer))
      const filtered = Array.from(props.selectedIds).filter((id) => cIds.has(id))
      localSelectedIds.value = new Set(filtered)
    } else {
      localSelectedIds.value = new Set(props.selectedIds)
    }
  },
  { immediate: true },
)

const syncSelection = (next: Set<string>) => {
  localSelectedIds.value = next
  emit('update:selectedIds', new Set(next))
}

const isModalFeatureSelected = (fg: ForecastFeatureGroup): boolean => {
  const ids = getFeatureIds(fg)
  return ids.length > 0 && ids.every((id) => localSelectedIds.value.has(id))
}

const isModalContainerSelected = (c: ForecastContainerGroup): boolean => {
  const ids = getContainerIds(c)
  return ids.length > 0 && ids.every((id) => localSelectedIds.value.has(id))
}

const toggleModalFeature = (fg: ForecastFeatureGroup) => {
  const ids = getFeatureIds(fg)
  const all = ids.every((id) => localSelectedIds.value.has(id))
  const next = new Set(localSelectedIds.value)
  if (all) ids.forEach((id) => next.delete(id))
  else ids.forEach((id) => next.add(id))
  syncSelection(next)
}

const toggleModalContainer = (c: ForecastContainerGroup) => {
  const ids = getContainerIds(c)
  const all = ids.every((id) => localSelectedIds.value.has(id))
  const next = new Set(localSelectedIds.value)
  if (all) ids.forEach((id) => next.delete(id))
  else ids.forEach((id) => next.add(id))
  syncSelection(next)
}

const allModalFeatureGroups = computed<ForecastFeatureGroup[]>(() => {
  const list: ForecastFeatureGroup[] = []
  displayedContainers.value.forEach((c) => {
    list.push(...c.featureGroups)
  })
  return list
})

const totalModalLines = computed(() => allModalFeatureGroups.value.length)

const selectedModalLinesCount = computed(() => {
  return allModalFeatureGroups.value.filter((fg) => isModalFeatureSelected(fg)).length
})

const isAllModalSelected = computed(() => {
  const allIds: string[] = []
  displayedContainers.value.forEach((c) => allIds.push(...getContainerIds(c)))
  return allIds.length > 0 && allIds.every((id) => localSelectedIds.value.has(id))
})

const handleSelectAllInModal = () => {
  const allIds: string[] = []
  displayedContainers.value.forEach((c) => allIds.push(...getContainerIds(c)))
  const all = allIds.length > 0 && allIds.every((id) => localSelectedIds.value.has(id))
  const next = new Set(localSelectedIds.value)
  if (all) allIds.forEach((id) => next.delete(id))
  else allIds.forEach((id) => next.add(id))
  syncSelection(next)
}

const handleConfirmMarkReady = () => {
  const ids = Array.from(localSelectedIds.value)
  if (ids.length === 0) return
  emit('mark-ready', ids)
}

const handleConfirmRevertPending = () => {
  const ids = Array.from(localSelectedIds.value)
  if (ids.length === 0) return
  emit('revert-pending', ids)
}

const handleDeleteSelected = () => {
  const ids = Array.from(localSelectedIds.value)
  if (ids.length === 0) return
  emit('delete-selected', ids)
}
</script>
