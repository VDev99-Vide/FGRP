<template>
  <div class="flex flex-col flex-1 space-y-6">
    <!-- Banner hướng dẫn migration khi Supabase chưa đủ schema PO -->
    <div
      v-if="needsMigration"
      class="glass-card-dark p-4 rounded-2xl border border-[#FDB52A]/40 flex items-start gap-3"
    >
      <AlertTriangle class="w-5 h-5 text-[#FDB52A] shrink-0 mt-0.5" />
      <div class="text-xs leading-relaxed">
        <p class="font-bold text-[#FDB52A]">Supabase chưa đủ bảng/cột đơn đặt hàng — đang chạy tạm bằng bộ nhớ máy.</p>
        <p class="text-[#AEB9E1] mt-0.5">
          Để đồng bộ đa thiết bị, anh mở <b class="text-white">Supabase Dashboard → SQL Editor</b> rồi chạy toàn bộ file
          <span class="font-mono text-[#00C2FF]">database/purchase_orders.sql</span>, sau đó bấm đồng bộ lại.
        </p>
      </div>
    </div>

    <!-- 1. Thẻ KPI -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      <div class="glass-card-dark p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
        <div class="w-11 h-11 rounded-xl bg-[#FDB52A]/15 border border-[#FDB52A]/30 flex items-center justify-center text-[#FDB52A] shrink-0">
          <Clock class="w-5 h-5" />
        </div>
        <div>
          <p class="text-[11px] font-semibold text-[#AEB9E1]">PO Chưa Hoàn Thành</p>
          <div class="flex items-baseline gap-2 mt-0.5">
            <span class="text-2xl font-bold text-[#FDB52A] font-mono">{{ stats.openCount }}</span>
            <span class="text-[10px] text-[#AEB9E1]">/ {{ stats.totalOrders }} PO</span>
          </div>
        </div>
      </div>

      <div class="glass-card-dark p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
        <div class="w-11 h-11 rounded-xl bg-[#14CA74]/15 border border-[#14CA74]/30 flex items-center justify-center text-[#14CA74] shrink-0">
          <CheckCircle2 class="w-5 h-5" />
        </div>
        <div>
          <p class="text-[11px] font-semibold text-[#AEB9E1]">PO Đã Giao Đủ</p>
          <div class="flex items-baseline gap-2 mt-0.5">
            <span class="text-2xl font-bold text-[#14CA74] font-mono">{{ stats.completedCount }}</span>
            <span class="text-[10px] text-[#AEB9E1]">PO đóng</span>
          </div>
        </div>
      </div>

      <div class="glass-card-dark p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
        <div class="w-11 h-11 rounded-xl bg-[#CB3CFF]/15 border border-[#CB3CFF]/30 flex items-center justify-center text-[#CB3CFF] shrink-0">
          <TrendingUp class="w-5 h-5" />
        </div>
        <div>
          <p class="text-[11px] font-semibold text-[#AEB9E1]">Tỷ Lệ Hoàn Thành Chung</p>
          <div class="flex items-baseline gap-2 mt-0.5">
            <span class="text-2xl font-bold text-[#CB3CFF] font-mono">{{ stats.overallPercent }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. Bảng chi tiết PO -->
    <div class="glass-card-dark p-5 sm:p-6 flex flex-col gap-4">
      <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <p class="text-[10px] font-bold text-[#CB3CFF] uppercase tracking-widest mb-1">Purchasing · theo dõi đơn hàng</p>
          <h2 class="text-xl font-bold text-white tracking-tight">Danh Sách Đơn Đặt Hàng</h2>
        </div>
        <div class="flex flex-wrap gap-2.5 w-full lg:w-auto items-center">
          <div class="flex items-center gap-1 bg-[#18202D]/90 border border-white/15 p-1 rounded-[8px] text-xs">
            <button
              @click="statusFilter = 'all'"
              :class="['px-2.5 py-1 rounded-[6px] text-xs font-bold transition cursor-pointer', statusFilter === 'all' ? 'bg-[#CB3CFF] text-white shadow-[0_0_8px_#CB3CFF]' : 'text-[#AEB9E1] hover:text-white']"
            >
              Tất cả ({{ stats.totalOrders }})
            </button>
            <button
              @click="statusFilter = 'open'"
              :class="['px-2.5 py-1 rounded-[6px] text-xs font-bold transition cursor-pointer', statusFilter === 'open' ? 'bg-[#FDB52A] text-[#081028] shadow-[0_0_8px_#FDB52A]' : 'text-[#AEB9E1] hover:text-white']"
            >
              Chưa xong ({{ stats.openCount }})
            </button>
            <button
              @click="statusFilter = 'completed'"
              :class="['px-2.5 py-1 rounded-[6px] text-xs font-bold transition cursor-pointer', statusFilter === 'completed' ? 'bg-[#14CA74] text-[#081028] shadow-[0_0_8px_#14CA74]' : 'text-[#AEB9E1] hover:text-white']"
            >
              Đã giao đủ ({{ stats.completedCount }})
            </button>
          </div>
          <div class="relative flex-1 lg:w-56">
            <input
              v-model="searchText"
              type="text"
              placeholder="Tìm Số PO, NCC, mã hàng..."
              class="w-full h-[36px] px-3 pl-8 bg-[#18202D]/80 backdrop-blur-md border border-white/15 rounded-[8px] text-xs outline-none text-white placeholder-[#AEB9E1]/50 focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
            />
            <Search class="w-3.5 h-3.5 text-[#AEB9E1] absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      <div class="flex flex-wrap gap-2.5">
        <button
          @click="openCreateModal"
          class="h-[38px] px-4 btn-neon-purple rounded-[8px] text-xs font-bold flex items-center gap-2 transition cursor-pointer active:scale-95"
        >
          <PlusCircle class="w-4 h-4" />
          <span>TẠO PO</span>
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
          title="Đồng bộ trực tiếp Supabase"
          class="h-[38px] px-4 bg-white/5 hover:bg-white/10 border border-white/15 rounded-[8px] text-[#AEB9E1] hover:text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer active:scale-95"
        >
          <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin text-[#00C2FF]' : '']" />
          <span>ĐỒNG BỘ</span>
        </button>
        <button
          v-if="stats.totalOrders > 0"
          @click="showClearAllModal = true"
          title="Xóa toàn bộ PO và log nhập hàng"
          class="h-[38px] px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-[8px] text-red-400 hover:text-red-300 text-xs font-bold flex items-center gap-2 transition cursor-pointer active:scale-95"
        >
          <Trash2 class="w-4 h-4" />
          <span>XÓA TẤT CẢ</span>
        </button>
      </div>

      <div class="w-full max-h-[640px] rounded-[14px] border border-white/15 bg-white/[0.02] relative custom-scroll" style="overflow-y: auto; overflow-x: auto">
        <table class="w-full text-left text-xs whitespace-nowrap border-collapse">
          <thead class="glass-table-sticky-head">
            <tr>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase">Số PO / NCC</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase">Mã hàng / Mô tả</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-right">Mục tiêu</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-right">Đã nhập</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase">Tiến độ</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-center">Trạng thái</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase">Ghi chú</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-center">Ngày tạo</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/[0.06] font-medium">
            <tr v-for="order in filteredOrders" :key="order.id" class="hover:bg-white/[0.06] transition-colors">
              <td class="py-3 px-4">
                <p class="font-mono font-black text-white text-xs">{{ order.po_no }}</p>
                <p class="text-[10px] text-[#AEB9E1] mt-0.5">{{ order.supplier }}</p>
              </td>
              <td class="py-3 px-4">
                <p class="font-mono font-bold text-[#00C2FF] text-xs">{{ order.item_code }}</p>
                <p class="text-[10px] text-white/70 mt-0.5 max-w-[220px] truncate" :title="order.description || ''">{{ order.description || '—' }}</p>
              </td>
              <td class="py-3 px-4 text-right font-mono text-white/90">{{ order.target_qty.toLocaleString() }}</td>
              <td class="py-3 px-4 text-right font-mono font-bold text-[#14CA74]">{{ order.received_qty.toLocaleString() }}</td>
              <td class="py-3 px-4 min-w-[208px]">
                <PoWavePipe :fill="order.progressCapped" :label="`${order.progress}%`" />
              </td>
              <td class="py-3 px-4 text-center">
                <span
                  :class="[
                    'px-2.5 py-1 rounded-[5px] text-[10px] font-bold border',
                    order.status === 'completed'
                      ? 'bg-[#14CA74]/15 text-[#14CA74] border-[#14CA74]/30'
                      : 'bg-[#FDB52A]/15 text-[#FDB52A] border-[#FDB52A]/30',
                  ]"
                >
                  {{ order.status === 'completed' ? 'Đã giao đủ' : 'Chưa xong' }}
                </span>
              </td>
              <td class="py-3 px-4 text-white/70 text-xs max-w-[180px] truncate" :title="order.note || ''">{{ order.note || '—' }}</td>
              <td class="py-3 px-4 text-center font-mono text-[#AEB9E1] text-[11px]">{{ formatIsoDate(order.created_date) }}</td>
              <td class="py-3 px-4">
                <div class="flex items-center justify-center gap-1.5">
                  <button
                    v-if="order.status === 'open'"
                    @click="openReceiptModal(order)"
                    title="Nhập hàng vào PO này"
                    class="px-2.5 py-1 bg-[#14CA74]/15 hover:bg-[#14CA74]/25 text-[#14CA74] rounded-[6px] border border-[#14CA74]/30 text-[11px] font-bold cursor-pointer transition active:scale-95"
                  >
                    Nhập hàng
                  </button>
                  <button
                    @click="openHistoryModal(order)"
                    :title="`Xem ${order.receipt_count} lần nhập hàng`"
                    class="p-1.5 bg-[#00C2FF]/15 hover:bg-[#00C2FF]/25 text-[#00C2FF] rounded-[6px] border border-[#00C2FF]/30 cursor-pointer transition active:scale-90"
                  >
                    <History class="w-3.5 h-3.5" />
                  </button>
                  <button
                    @click="openEditModal(order)"
                    title="Sửa thông tin PO"
                    class="p-1.5 bg-[#FDB52A]/15 hover:bg-[#FDB52A]/25 text-[#FDB52A] rounded-[6px] border border-[#FDB52A]/30 cursor-pointer transition active:scale-90"
                  >
                    <Pencil class="w-3.5 h-3.5" />
                  </button>
                  <button
                    @click="askDeletePo(order)"
                    title="Xóa PO và toàn bộ log"
                    class="p-1.5 bg-[#FF5A65]/15 hover:bg-[#FF5A65]/25 text-[#FF5A65] rounded-[6px] border border-[#FF5A65]/30 cursor-pointer transition active:scale-90"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredOrders.length === 0">
              <td colspan="9" class="text-center py-12 text-[#AEB9E1] italic text-xs">Không tìm thấy đơn đặt hàng phù hợp!</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modals -->
    <PurchaseOrderModal
      v-model:visible="showPoModal"
      :loading="loading"
      :editing="editingPo"
      @save="handleSavePo"
    />
    <PoReceiptModal
      v-model:visible="showReceiptModal"
      :loading="loading"
      :po="receiptPo"
      @save="handleSaveReceipt"
    />
    <PoHistoryModal
      v-model:visible="showHistoryModal"
      :po="historyPo"
      :logs="historyLogs"
      @delete-log="handleDeleteLog"
    />
    <PoImportModal
      v-model:visible="showImportModal"
      :loading="loading"
      @import="handleImport"
    />
    <ConfirmModal
      v-model:visible="showDeleteModal"
      title="Xác nhận xóa đơn đặt hàng"
      :message="`Xóa PO [${deletingPo?.po_no}] cùng toàn bộ ${deletingPo?.receipt_count} dòng log nhập hàng? Không thể hoàn tác.`"
      confirmText="Xác nhận xóa"
      cancelText="Hủy bỏ"
      severity="danger"
      @confirm="executeDeletePo"
    />
    <ConfirmModal
      v-model:visible="showClearAllModal"
      title="Xác nhận xóa toàn bộ đơn đặt hàng"
      message="Xóa TOÀN BỘ PO và log nhập hàng trên hệ thống? Không thể hoàn tác."
      confirmText="Xác nhận xóa tất cả"
      cancelText="Hủy bỏ"
      severity="danger"
      @confirm="executeClearAll"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  Pencil,
  PlusCircle,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  UploadCloud,
} from 'lucide-vue-next'
import { useToast } from 'primevue/usetoast'
import { usePurchaseOrders, type PoInput, type ReceiptInput } from '@/composables/usePurchaseOrders'
import type { PurchaseOrderWithProgress } from '@/types'
import { formatIsoDate } from '@/utils/po'
import type { PoExcelRow } from '@/services/poExcel'
import PoWavePipe from './PoWavePipe.vue'
import PurchaseOrderModal from './PurchaseOrderModal.vue'
import PoReceiptModal from './PoReceiptModal.vue'
import PoHistoryModal from './PoHistoryModal.vue'
import PoImportModal from './PoImportModal.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'

const toast = useToast()

const {
  loading,
  searchText,
  statusFilter,
  stats,
  filteredOrders,
  needsMigration,
  getPoLogs,
  fetchPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  addReceipt,
  deleteReceipt,
  importPurchaseOrders,
  clearAllPurchaseOrders,
} = usePurchaseOrders()

const showPoModal = ref(false)
const showReceiptModal = ref(false)
const showHistoryModal = ref(false)
const showImportModal = ref(false)
const showDeleteModal = ref(false)
const showClearAllModal = ref(false)

const editingPo = ref<PurchaseOrderWithProgress | null>(null)
const receiptPo = ref<PurchaseOrderWithProgress | null>(null)
const historyPo = ref<PurchaseOrderWithProgress | null>(null)
const deletingPo = ref<PurchaseOrderWithProgress | null>(null)

const historyLogs = computed(() => (historyPo.value ? getPoLogs(historyPo.value.id) : []))

onMounted(() => {
  fetchPurchaseOrders()
})

const handleManualSync = async () => {
  await fetchPurchaseOrders()
  toast.add({ severity: 'info', summary: 'Đã làm mới', detail: 'Dữ liệu PO đã được đồng bộ.', life: 2500 })
}

const openCreateModal = () => {
  editingPo.value = null
  showPoModal.value = true
}

const openEditModal = (order: PurchaseOrderWithProgress) => {
  editingPo.value = order
  showPoModal.value = true
}

const handleSavePo = async (payload: PoInput, id: string | null) => {
  try {
    if (id) {
      await updatePurchaseOrder(id, payload)
      toast.add({ severity: 'success', summary: 'Cập nhật thành công', detail: `Đã lưu thay đổi PO [${payload.po_no}]`, life: 3000 })
    } else {
      await createPurchaseOrder(payload)
      toast.add({ severity: 'success', summary: 'Tạo PO thành công', detail: `PO [${payload.po_no}] mục tiêu ${Number(payload.target_qty).toLocaleString()} PCS`, life: 3000 })
    }
    showPoModal.value = false
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Lỗi lưu PO', detail: err instanceof Error ? err.message : 'Không lưu được PO!', life: 4000 })
  }
}

const openReceiptModal = (order: PurchaseOrderWithProgress) => {
  receiptPo.value = order
  showReceiptModal.value = true
}

const handleSaveReceipt = async (poId: string, payload: ReceiptInput) => {
  try {
    await addReceipt(poId, payload)
    showReceiptModal.value = false
    const updated = filteredOrders.value.find((o) => o.id === poId)
    toast.add({
      severity: 'success',
      summary: updated?.status === 'completed' ? 'Đạt mục tiêu — PO tự đóng!' : 'Nhập hàng thành công',
      detail: `Đã nhập ${Number(payload.qty).toLocaleString()} PCS vào PO [${receiptPo.value?.po_no}]`,
      life: 3500,
    })
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Lỗi nhập hàng', detail: err instanceof Error ? err.message : 'Không nhập được hàng!', life: 4000 })
  }
}

const openHistoryModal = (order: PurchaseOrderWithProgress) => {
  historyPo.value = order
  showHistoryModal.value = true
}

const handleDeleteLog = async (logId: string) => {
  try {
    await deleteReceipt(logId)
    if (historyPo.value) {
      historyPo.value = filteredOrders.value.find((o) => o.id === historyPo.value?.id) ?? historyPo.value
    }
    toast.add({ severity: 'success', summary: 'Đã xóa dòng log', detail: 'Tiến độ PO đã được tính lại.', life: 3000 })
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Lỗi xóa log', detail: err instanceof Error ? err.message : 'Không xóa được log!', life: 4000 })
  }
}

const handleImport = async (rows: PoExcelRow[]) => {
  try {
    const res = await importPurchaseOrders(rows)
    showImportModal.value = false
    toast.add({
      severity: 'success',
      summary: 'Import thành công',
      detail: `Đã nạp ${res.imported} PO${res.skipped.length ? `, bỏ qua ${res.skipped.length} dòng lỗi` : ''}!`,
      life: 4000,
    })
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Lỗi import', detail: err instanceof Error ? err.message : 'Không import được file!', life: 4000 })
  }
}

const askDeletePo = (order: PurchaseOrderWithProgress) => {
  deletingPo.value = order
  showDeleteModal.value = true
}

const executeDeletePo = async () => {
  if (!deletingPo.value) return
  try {
    await deletePurchaseOrder(deletingPo.value.id)
    toast.add({ severity: 'success', summary: 'Đã xóa PO', detail: `PO [${deletingPo.value.po_no}] và log đi kèm đã bị xóa. KPI tự cập nhật.`, life: 3000 })
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Lỗi xóa PO', detail: err instanceof Error ? err.message : 'Không xóa được PO!', life: 4000 })
  }
}

const executeClearAll = async () => {
  try {
    await clearAllPurchaseOrders()
    toast.add({ severity: 'success', summary: 'Đã xóa tất cả', detail: 'Toàn bộ PO và log nhập hàng đã bị xóa sạch!', life: 3000 })
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Lỗi xóa', detail: err instanceof Error ? err.message : 'Không xóa được dữ liệu!', life: 4000 })
  }
}
</script>
