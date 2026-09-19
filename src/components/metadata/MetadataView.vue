<template>
  <div class="flex flex-col flex-1 space-y-6">
    <!-- Banner migration khi Supabase chưa có bảng meta-data -->
    <div
      v-if="needsMigration"
      class="glass-card-dark p-4 rounded-2xl border border-[#FDB52A]/40 flex items-start gap-3"
    >
      <AlertTriangle class="w-5 h-5 text-[#FDB52A] shrink-0 mt-0.5" />
      <div class="text-xs leading-relaxed">
        <p class="font-bold text-[#FDB52A]">Supabase chưa có bảng meta-data — đang chạy tạm bằng bộ nhớ máy.</p>
        <p class="text-[#AEB9E1] mt-0.5">
          Để đồng bộ đa thiết bị, anh mở <b class="text-white">Supabase Dashboard → SQL Editor</b> rồi chạy toàn bộ file
          <span class="font-mono text-[#00C2FF]">database/metadata.sql</span>, sau đó bấm đồng bộ lại.
        </p>
      </div>
    </div>

    <!-- Bảng dữ liệu Quy cách (chuẩn Sample.xlsx) -->
    <div class="glass-card-dark p-5 sm:p-6 flex flex-col gap-4">
      <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <p class="text-[10px] font-bold text-[#CB3CFF] uppercase tracking-widest mb-1">Meta-data · Quy cách đóng gói chuẩn</p>
          <h2 class="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Bảng Quy Cách</span>
            <span class="text-xs px-2.5 py-0.5 rounded-full bg-[#00C2FF]/15 border border-[#00C2FF]/30 text-[#00C2FF] font-mono font-semibold">
              {{ filteredRows.length }} dòng
            </span>
          </h2>
        </div>
        <div class="relative w-full lg:w-64">
          <input
            v-model="searchText"
            type="text"
            placeholder="Tìm khách hàng, mã hàng, feature, quy cách..."
            class="w-full h-[36px] px-3 pl-8 bg-[#18202D]/80 backdrop-blur-md border border-white/15 rounded-[8px] text-xs outline-none text-white placeholder-[#AEB9E1]/50 focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
          />
          <Search class="w-3.5 h-3.5 text-[#AEB9E1] absolute left-2.5 top-2.5" />
        </div>
      </div>

      <div class="flex flex-wrap gap-2.5">
        <button
          @click="openCreateModal"
          class="h-[38px] px-4 btn-neon-purple rounded-[8px] text-xs font-bold flex items-center gap-2 transition cursor-pointer active:scale-95"
        >
          <PlusCircle class="w-4 h-4" />
          <span>THÊM MỚI</span>
        </button>
        <button
          @click="showImportModal = true"
          class="h-[38px] px-4 bg-[#00C2FF]/15 hover:bg-[#00C2FF]/25 border border-[#00C2FF]/40 text-[#00C2FF] hover:text-white rounded-[8px] text-xs font-bold flex items-center gap-2 transition cursor-pointer active:scale-95"
        >
          <UploadCloud class="w-4 h-4" />
          <span>IMPORT EXCEL</span>
        </button>
        <button
          @click="handleManualSync"
          class="h-[38px] px-4 bg-white/5 hover:bg-white/10 border border-white/15 rounded-[8px] text-[#AEB9E1] hover:text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer active:scale-95"
        >
          <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin text-[#00C2FF]' : '']" />
          <span>ĐỒNG BỘ</span>
        </button>
      </div>

      <div class="w-full max-h-[640px] rounded-[14px] border border-white/15 bg-white/[0.02] relative custom-scroll" style="overflow-y: auto; overflow-x: auto">
        <table class="w-full text-left text-xs whitespace-nowrap border-collapse">
          <thead class="glass-table-sticky-head">
            <tr>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase">Khách hàng</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase">Mã hàng</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-center">Feature</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-right">Số lượng đóng gói</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-right">Trọng lượng/Cái</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase">Quy cách thùng</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase">Loại thùng</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/[0.06] font-medium">
            <tr v-for="row in filteredRows" :key="row.id" class="hover:bg-white/[0.06] transition-colors">
              <td class="py-3 px-4 font-bold text-white text-xs">{{ row.customer }}</td>
              <td class="py-3 px-4 font-mono font-bold text-[#00C2FF] text-xs">{{ row.ma_hang || row.item_code }}</td>
              <td class="py-3 px-4 text-center font-mono font-bold text-[#CB3CFF] text-xs">{{ row.feature || row.item_code }}</td>
              <td class="py-3 px-4 text-right font-mono font-bold text-[#14CA74]">{{ Number(row.pack_qty).toLocaleString() }}</td>
              <td class="py-3 px-4 text-right font-mono text-white/90">{{ row.weight_per_unit }}</td>
              <td class="py-3 px-4 font-mono text-[#AEB9E1] text-xs">{{ row.carton_spec || '—' }}</td>
              <td class="py-3 px-4 text-white/80 text-xs">{{ row.carton_type || '—' }}</td>
              <td class="py-3 px-4">
                <div class="flex items-center justify-center gap-1.5">
                  <button
                    @click="openEditModal(row)"
                    title="Sửa dòng này"
                    class="p-1.5 bg-[#FDB52A]/15 hover:bg-[#FDB52A]/25 text-[#FDB52A] rounded-[6px] border border-[#FDB52A]/30 cursor-pointer transition active:scale-90"
                  >
                    <Pencil class="w-3.5 h-3.5" />
                  </button>
                  <button
                    @click="askDeleteRow(row)"
                    title="Xóa dòng này"
                    class="p-1.5 bg-[#FF5A65]/15 hover:bg-[#FF5A65]/25 text-[#FF5A65] rounded-[6px] border border-[#FF5A65]/30 cursor-pointer transition active:scale-90"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredRows.length === 0">
              <td colspan="8" class="text-center py-12 text-[#AEB9E1] italic text-xs">
                Chưa có dữ liệu. Bấm "IMPORT EXCEL" để nạp chuẩn Sample.xlsx (7 cột)!
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <PackingSpecModal
      v-model:visible="showModal"
      :loading="loading"
      :editing="editingRow"
      :customers="allCustomers"
      :carton-specs="allCartonSpecs"
      :carton-types="allCartonTypes"
      @save="handleSave"
    />
    <MetadataImportModal
      v-model:visible="showImportModal"
      :loading="loading"
      @import="handleImport"
    />
    <ConfirmModal
      v-model:visible="showDeleteModal"
      title="Xác nhận xóa dòng quy cách"
      :message="`Xóa dòng [${deletingRow?.customer} - ${deletingRow?.ma_hang || deletingRow?.item_code} (${deletingRow?.feature || ''})]? Không thể hoàn tác.`"
      confirmText="Xác nhận xóa"
      cancelText="Hủy bỏ"
      severity="danger"
      @confirm="executeDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  AlertTriangle,
  Pencil,
  PlusCircle,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
} from 'lucide-vue-next'
import { useToast } from 'primevue/usetoast'
import { useMetadataPacking } from '@/composables/useMetadataPacking'
import { distinctCustomers, distinctCartonSpecs, distinctCartonTypes } from '@/utils/metadata'
import type { MetadataPacking } from '@/types'
import type { PackingSpecInput } from '@/utils/metadata'
import type { MetadataExcelRow } from '@/services/metadataExcel'
import PackingSpecModal from './PackingSpecModal.vue'
import MetadataImportModal from './MetadataImportModal.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'

const toast = useToast()

const {
  loading,
  rows,
  searchText,
  filteredRows,
  needsMigration,
  fetchPackingSpecs,
  createPackingSpec,
  updatePackingSpec,
  deletePackingSpec,
  importPackingSpecs,
} = useMetadataPacking()

// Gợi ý dropdown cho THÊM MỚI (không khóa cứng — vẫn cho nhập mới)
const allCustomers = computed(() => distinctCustomers(rows.value))
const allCartonSpecs = computed(() => distinctCartonSpecs(rows.value))
const allCartonTypes = computed(() => distinctCartonTypes(rows.value))

const showModal = ref(false)
const showImportModal = ref(false)
const showDeleteModal = ref(false)
const editingRow = ref<MetadataPacking | null>(null)
const deletingRow = ref<MetadataPacking | null>(null)

onMounted(() => {
  fetchPackingSpecs()
})

const handleManualSync = async () => {
  await fetchPackingSpecs()
  toast.add({ severity: 'info', summary: 'Đã làm mới', detail: 'Dữ liệu quy cách đã được đồng bộ.', life: 2500 })
}

const openCreateModal = () => {
  editingRow.value = null
  showModal.value = true
}

const openEditModal = (row: MetadataPacking) => {
  editingRow.value = row
  showModal.value = true
}

const MEMORY_WARN_DETAIL =
  'Supabase chưa có bảng metadata_quy_cach nên dữ liệu mới CHỈ nằm trên máy này — xóa cache/reload sẽ MẤT. Hãy chạy file database/metadata.sql rồi bấm Đồng bộ!'

const warnIfMemory = (successSummary: string, successDetail: string) => {
  if (needsMigration.value) {
    toast.add({ severity: 'warn', summary: `${successSummary} (lưu tạm)`, detail: MEMORY_WARN_DETAIL, life: 6000 })
    return true
  }
  toast.add({ severity: 'success', summary: successSummary, detail: successDetail, life: 3000 })
  return false
}

const handleSave = async (payload: PackingSpecInput, id: string | null) => {
  try {
    if (id) {
      await updatePackingSpec(id, payload)
      warnIfMemory('Cập nhật thành công', 'Đã lưu thay đổi dòng quy cách lên Supabase.')
    } else {
      await createPackingSpec(payload)
      warnIfMemory('Thêm thành công', 'Đã thêm dòng quy cách mới lên Supabase.')
    }
    showModal.value = false
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Lỗi lưu dữ liệu', detail: err instanceof Error ? err.message : 'Không lưu được!', life: 4000 })
  }
}

const handleImport = async (rows: MetadataExcelRow[]) => {
  try {
    const res = await importPackingSpecs(rows)
    showImportModal.value = false
    warnIfMemory(
      'Import thành công',
      `Đã nạp ${res.imported} dòng${res.skipped.length ? `, bỏ qua ${res.skipped.length} dòng lỗi/trùng` : ''} lên Supabase!`,
    )
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Lỗi import', detail: err instanceof Error ? err.message : 'Không import được file!', life: 4000 })
  }
}

const askDeleteRow = (row: MetadataPacking) => {
  deletingRow.value = row
  showDeleteModal.value = true
}

const executeDelete = async () => {
  if (!deletingRow.value) return
  try {
    await deletePackingSpec(deletingRow.value.id)
    toast.add({ severity: 'success', summary: 'Đã xóa', detail: 'Dòng quy cách đã bị xóa.', life: 3000 })
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Lỗi xóa', detail: err instanceof Error ? err.message : 'Không xóa được!', life: 4000 })
  }
}
</script>
