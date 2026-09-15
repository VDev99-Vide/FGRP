<template>
  <div class="flex flex-col flex-1 space-y-6">
    <!-- Banner hướng dẫn migration khi Supabase chưa có bảng PO -->
    <div
      v-if="needsMigration"
      class="glass-card-dark p-4 rounded-2xl border border-[#FDB52A]/40 flex items-start gap-3"
    >
      <AlertTriangle class="w-5 h-5 text-[#FDB52A] shrink-0 mt-0.5" />
      <div class="text-xs leading-relaxed">
        <p class="font-bold text-[#FDB52A]">Supabase chưa có bảng đơn đặt hàng — đang chạy tạm bằng bộ nhớ máy.</p>
        <p class="text-[#AEB9E1] mt-0.5">
          Để đồng bộ đa thiết bị, anh mở <b class="text-white">Supabase Dashboard → SQL Editor</b> rồi chạy toàn bộ file
          <span class="font-mono text-[#00C2FF]">database/purchase_orders.sql</span>, sau đó bấm đồng bộ lại.
        </p>
      </div>
    </div>

    <!-- 1. Thẻ KPI -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
          <p class="text-[10px] text-[#AEB9E1] mt-0.5">Đang nhập hàng cộng dồn</p>
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
          <p class="text-[10px] text-[#AEB9E1] mt-0.5">Đạt 100% target tự đóng</p>
        </div>
      </div>

      <div class="glass-card-dark p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
        <div class="w-11 h-11 rounded-xl bg-[#00C2FF]/15 border border-[#00C2FF]/30 flex items-center justify-center text-[#00C2FF] shrink-0">
          <Box class="w-5 h-5" />
        </div>
        <div>
          <p class="text-[11px] font-semibold text-[#AEB9E1]">Đã Nhập / Tổng Target</p>
          <div class="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
            <span class="text-xl font-bold text-[#00C2FF] font-mono">{{ stats.totalReceived.toLocaleString() }}</span>
            <span class="text-[10px] text-[#AEB9E1]">/ {{ stats.totalTarget.toLocaleString() }} PCS</span>
          </div>
          <p class="text-[10px] text-[#AEB9E1] mt-0.5">Cộng dồn mọi PO</p>
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
          <p class="text-[10px] text-[#AEB9E1] mt-0.5">Đã nhập / tổng target</p>
        </div>
      </div>
    </div>

    <!-- 2. Chart ống dòng chảy tiến độ PO (trái -> phải, đổi màu theo ngưỡng) -->
    <div class="glass-card-dark p-5 sm:p-6 flex flex-col gap-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div>
          <p class="text-[10px] font-bold text-[#CB3CFF] uppercase tracking-widest mb-1">Streaming · Trái → Phải</p>
          <h2 class="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Ống Dòng Chảy Tiến Độ PO</span>
            <span class="text-xs px-2.5 py-0.5 rounded-full bg-[#00C2FF]/15 border border-[#00C2FF]/30 text-[#00C2FF] font-mono font-semibold">
              {{ filteredOrders.length }} PO
            </span>
          </h2>
        </div>
        <div class="flex items-center gap-4 text-[11px] font-semibold">
          <span class="flex items-center gap-1.5 text-[#AEB9E1]">
            <span class="w-2.5 h-2.5 rounded-full bg-[#FF5A65] shadow-[0_0_8px_#FF5A65]"></span> &lt; 50%
          </span>
          <span class="flex items-center gap-1.5 text-[#AEB9E1]">
            <span class="w-2.5 h-2.5 rounded-full bg-[#FDB52A] shadow-[0_0_8px_#FDB52A]"></span> 50 – 99%
          </span>
          <span class="flex items-center gap-1.5 text-[#AEB9E1]">
            <span class="w-2.5 h-2.5 rounded-full bg-[#14CA74] shadow-[0_0_8px_#14CA74]"></span> 100% đóng PO
          </span>
        </div>
      </div>

      <div class="flex flex-col gap-4 max-h-[460px] overflow-y-auto custom-scroll pr-1">
        <div v-for="order in filteredOrders" :key="order.id" data-testid="po-pipe" class="glass-panel-subtle p-3.5 sm:p-4">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="font-mono font-black text-white text-sm truncate">{{ order.po_no }}</span>
              <span
                :class="[
                  'text-[10px] font-bold px-2 py-0.5 rounded-[5px] border shrink-0',
                  order.status === 'completed'
                    ? 'bg-[#14CA74]/15 text-[#14CA74] border-[#14CA74]/30'
                    : 'bg-[#FDB52A]/15 text-[#FDB52A] border-[#FDB52A]/30',
                ]"
              >
                {{ order.status === 'completed' ? 'Đã đóng' : 'Đang nhập' }}
              </span>
            </div>
            <div class="text-[11px] text-[#AEB9E1] truncate">
              {{ order.supplier }} · <span class="font-mono text-[#00C2FF]">{{ order.item_code }}</span>
            </div>
          </div>

          <!-- Ống chảy -->
          <div
            class="po-pipe-track"
            role="img"
            :aria-label="`PO ${order.po_no} đạt ${order.progress}%`"
            :title="`${order.po_no}: ${order.received_qty.toLocaleString()} / ${order.target_qty.toLocaleString()} PCS (${order.progress}%)`"
          >
            <div
              class="po-pipe-fill"
              :style="{ width: `${order.progressCapped}%`, background: PO_FLOW_COLORS[order.level].gradient, boxShadow: `0 0 14px ${PO_FLOW_COLORS[order.level].glow}` }"
            >
              <span class="po-pipe-stripes"></span>
            </div>
            <span class="po-pipe-target-flag" title="Vạch target 100%"></span>
          </div>

          <div class="flex items-center justify-between mt-1.5 text-[11px]">
            <span class="font-mono text-[#AEB9E1]">
              <b class="text-white">{{ order.received_qty.toLocaleString() }}</b> / {{ order.target_qty.toLocaleString() }} PCS
              <span class="text-white/30">· còn {{ order.remaining_qty.toLocaleString() }}</span>
            </span>
            <span class="font-mono font-black text-sm" :style="{ color: PO_FLOW_COLORS[order.level].solid }">
              {{ order.progress }}%
            </span>
          </div>
        </div>

        <div v-if="filteredOrders.length === 0" class="flex flex-col items-center justify-center gap-2.5 py-12 text-center">
          <div class="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-1">
            <PackageOpen class="w-6 h-6 text-[#AEB9E1]/70" />
          </div>
          <span class="text-sm font-semibold text-white/90">Chưa có đơn đặt hàng nào</span>
          <p class="text-[11px] text-[#AEB9E1]/70 max-w-md leading-relaxed">
            Bấm <b>"Tạo PO"</b> để nhập Số PO + Target, hoặc <b>"Import Excel"</b> để nạp hàng loạt từ file mẫu.
          </p>
        </div>
      </div>
    </div>

    <!-- 3. Bảng chi tiết PO -->
    <div class="glass-card-dark p-5 sm:p-6 flex flex-col gap-4">
      <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <p class="text-[10px] font-bold text-[#CB3CFF] uppercase tracking-widest mb-1">Purchasing · Theo dõi cộng dồn</p>
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

      <div class="w-full max-h-[440px] rounded-[14px] border border-white/15 bg-white/[0.02] relative custom-scroll" style="overflow-y: auto; overflow-x: auto">
        <table class="w-full text-left text-xs whitespace-nowrap border-collapse">
          <thead class="glass-table-sticky-head">
            <tr>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase">Số PO / NCC</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase">Mã hàng</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-right">Target</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-right">Đã nhập</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase">Tiến độ</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-center">Trạng thái</th>
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
              <td class="py-3 px-4 font-mono font-bold text-[#00C2FF] text-xs">{{ order.item_code }}</td>
              <td class="py-3 px-4 text-right font-mono text-white/90">{{ order.target_qty.toLocaleString() }}</td>
              <td class="py-3 px-4 text-right font-mono font-bold text-[#14CA74]">{{ order.received_qty.toLocaleString() }}</td>
              <td class="py-3 px-4 min-w-[160px]">
                <div class="flex items-center gap-2">
                  <div class="flex-1 h-[8px] rounded-full bg-white/10 overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-500"
                      :style="{ width: `${order.progressCapped}%`, background: PO_FLOW_COLORS[order.level].gradient }"
                    ></div>
                  </div>
                  <span class="font-mono font-bold text-[11px] w-[52px] text-right" :style="{ color: PO_FLOW_COLORS[order.level].solid }">
                    {{ order.progress }}%
                  </span>
                </div>
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
                    v-if="order.status === 'open'"
                    @click="handleManualClose(order)"
                    title="Đóng PO thủ công"
                    class="p-1.5 bg-white/5 hover:bg-white/10 text-[#AEB9E1] hover:text-white rounded-[6px] border border-white/15 cursor-pointer transition active:scale-90"
                  >
                    <Archive class="w-3.5 h-3.5" />
                  </button>
                  <button
                    v-else
                    @click="handleReopen(order)"
                    title="Mở lại PO"
                    class="p-1.5 bg-white/5 hover:bg-white/10 text-[#AEB9E1] hover:text-white rounded-[6px] border border-white/15 cursor-pointer transition active:scale-90"
                  >
                    <RotateCcw class="w-3.5 h-3.5" />
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
              <td colspan="8" class="text-center py-12 text-[#AEB9E1] italic text-xs">Không tìm thấy đơn đặt hàng phù hợp!</td>
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
  Archive,
  Box,
  CheckCircle2,
  Clock,
  History,
  PackageOpen,
  Pencil,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  TrendingUp,
  UploadCloud,
} from 'lucide-vue-next'
import { useToast } from 'primevue/usetoast'
import { usePurchaseOrders, type PoInput, type ReceiptInput } from '@/composables/usePurchaseOrders'
import type { PurchaseOrderWithProgress } from '@/types'
import { PO_FLOW_COLORS, formatIsoDate } from '@/utils/po'
import type { PoExcelRow } from '@/services/poExcel'
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
  markPoCompleted,
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
      toast.add({ severity: 'success', summary: 'Tạo PO thành công', detail: `PO [${payload.po_no}] target ${Number(payload.target_qty).toLocaleString()} PCS`, life: 3000 })
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
      summary: updated?.status === 'completed' ? 'Đạt target — PO tự đóng!' : 'Nhập hàng thành công',
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

const handleManualClose = async (order: PurchaseOrderWithProgress) => {
  try {
    await markPoCompleted(order.id, true)
    toast.add({ severity: 'success', summary: 'Đã đóng PO', detail: `PO [${order.po_no}] đã được đóng thủ công.`, life: 3000 })
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Lỗi đóng PO', detail: err instanceof Error ? err.message : 'Không đóng được PO!', life: 4000 })
  }
}

const handleReopen = async (order: PurchaseOrderWithProgress) => {
  try {
    await markPoCompleted(order.id, false)
    toast.add({ severity: 'info', summary: 'Đã mở lại PO', detail: `PO [${order.po_no}] chuyển về Chưa hoàn thành.`, life: 3000 })
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Lỗi mở lại PO', detail: err instanceof Error ? err.message : 'Không mở lại được PO!', life: 4000 })
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
    toast.add({ severity: 'success', summary: 'Đã xóa PO', detail: `PO [${deletingPo.value.po_no}] và log đi kèm đã bị xóa.`, life: 3000 })
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

<style scoped>
/* Ống dòng chảy tiến độ PO: track kính mờ + fill gradient chảy trái -> phải */
.po-pipe-track {
  position: relative;
  height: 26px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.po-pipe-fill {
  position: relative;
  height: 100%;
  border-radius: 9999px;
  min-width: 26px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

/* Vệt sọc sáng trôi liên tục tạo hiệu ứng streaming */
.po-pipe-stripes {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    -55deg,
    rgba(255, 255, 255, 0.28) 0 10px,
    rgba(255, 255, 255, 0) 10px 22px
  );
  background-size: 200% 100%;
  animation: po-flow 1.6s linear infinite;
}

@keyframes po-flow {
  from { background-position: 0 0; }
  to { background-position: 44px 0; }
}

/* Vạch target 100% ở cuối ống */
.po-pipe-target-flag {
  position: absolute;
  top: 3px;
  bottom: 3px;
  right: 3px;
  width: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.75);
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.8);
}

@media (prefers-reduced-motion: reduce) {
  .po-pipe-stripes { animation: none; }
  .po-pipe-fill { transition: none; }
}
</style>
