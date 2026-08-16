<template>
  <div class="flex flex-col lg:flex-row min-h-screen w-full text-white relative">
    <!-- PrimeVue Toast Host -->
    <Toast />
    <ConfirmDialog />

    <!-- Sidebar Navigation (Dashdark V) -->
    <AppSidebar 
      v-model="currentTab" 
      :lastSync="lastSync" 
      :loading="loading" 
      @refresh="loadAllData" 
    />

    <!-- Main Content wrapper -->
    <div class="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
      <!-- Top Header Area (Fixed/Sticky at top of content with Frosted Glass) -->
      <header class="hidden lg:flex justify-between items-center px-8 py-5 glass-header shrink-0 z-20">
        <div class="flex items-center gap-3.5">
          <!-- Glowing Brand Logo Next to Header -->
          <div class="w-10 h-10 rounded-[12px] bg-gradient-to-tr from-[#00C2FF] via-[#CB3CFF] to-[#7e14ff] p-[1.5px] shadow-[0_0_16px_rgba(203,60,255,0.45)] shrink-0 flex items-center justify-center">
            <div class="w-full h-full bg-[#18202D] rounded-[10.5px] flex items-center justify-center">
              <svg viewBox="0 0 32 32" fill="none" class="w-6 h-6">
                <path d="M6 10C6 7.79086 7.79086 6 10 6H16V16H6V10Z" fill="#00C2FF"/>
                <path d="M16 16H26V22C26 24.2091 24.2091 26 22 26H16V16Z" fill="#00C2FF"/>
                <path d="M16 6H22C24.2091 6 26 7.79086 26 10V16H16V6Z" fill="#CB3CFF"/>
                <path d="M6 16H16V26H10C7.79086 26 6 24.2091 6 22V16Z" fill="#CB3CFF"/>
              </svg>
            </div>
          </div>
          <div>
            <h1 class="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>Xin chào !</span>
              <span v-if="currentTab !== 'dashboard'" class="text-[#CB3CFF] text-xl font-medium">/ {{ currentTabName }}</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#CB3CFF]/15 text-[#CB3CFF] border border-[#CB3CFF]/30 tracking-wider">V PRO</span>
            </h1>
            <p class="text-xs text-[#AEB9E1] mt-0.5">
              Hệ thống quản lý tồn kho và báo cáo tự động <span class="text-white font-bold">Dashdark V</span>
            </p>
          </div>
        </div>
        
        <div class="flex items-center gap-4">
          <!-- Connection Mode Badge -->
          <div v-if="isDemoMode" class="flex items-center gap-2 px-3 py-1.5 bg-[#FDB52A]/15 border border-[#FDB52A]/30 backdrop-blur-md rounded-[8px] text-[#FDB52A] text-xs font-semibold shadow-sm">
            <span class="w-2 h-2 rounded-full bg-[#FDB52A] animate-pulse"></span>
            <span>Dữ liệu mẫu (Demo Mode)</span>
            <button 
              @click="handleResetMockData" 
              title="Đặt lại dữ liệu mẫu về mặc định ban đầu" 
              class="ml-1 text-[11px] underline text-[#FDB52A] hover:text-white font-bold cursor-pointer"
            >
              Đặt lại
            </button>
          </div>
          <div v-else class="flex items-center gap-2 px-3 py-1.5 bg-[#05C168]/15 border border-[#05C168]/30 backdrop-blur-md rounded-[8px] text-[#14CA74] text-xs font-semibold shadow-sm">
            <span class="w-2 h-2 rounded-full bg-[#14CA74] shadow-[0_0_6px_#14CA74] animate-pulse"></span>
            <span>Database kết nối</span>
          </div>

          <div class="text-right pl-3 border-l border-white/10">
            <p class="text-[10px] text-[#AEB9E1]">Đồng bộ lúc</p>
            <p class="text-xs font-mono font-bold text-white">{{ lastSync }}</p>
          </div>
        </div>
      </header>

      <!-- Main Scrollable Body Area -->
      <main class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 w-full">
        <div class="max-w-[1708px] mx-auto w-full flex flex-col gap-8 pb-12">
          
          <!-- Transition giữa các Tabs -->
          <transition name="tab-fade" mode="out-in">
            
            <!-- 1. TAB DASHBOARD (Dashdark V Layout) -->
            <div v-if="currentTab === 'dashboard'" class="space-y-8">
              
              <!-- 1.1. Top 5 Metric Cards -->
              <KpiCards :kpi="kpi" />

              <!-- 1.2. Big Wave Chart: Tổng số lượng PCS (ISCALA vs ACTUAL) -->
              <ComparisonChart :data="summaryData" />

              <!-- 1.3. Middle Row: Visitors Ring Chart + Recent Orders Table -->
              <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <!-- Phân Tích Rủi Ro Lệch Kho ( top 5 ) Radial Chart -->
                <VisitorsRingChart :summary-data="summaryData" />

                <!-- Bảng dữ liệu Tag ID lỗi -->
                <RecentOrdersTable 
                  :inventory-data="inventoryData" 
                  :analysis="analysis" 
                />
              </div>

              <!-- 1.4. Bottom Section: Users by country & World Dot Matrix Map (Chấm Đỏ Lỗi, Chấm Vàng Trùng) -->
              <WorldDotMapCard 
                :analysis="analysis" 
                :inventory-data="inventoryData" 
                :kpi="kpi"
              />
            </div>

            <!-- 2. TAB TỒN KHO THÀNH PHẨM (Inventory AG Grid) -->
            <div v-else-if="currentTab === 'inventory'" class="flex flex-col flex-1 space-y-6">
              <!-- Control Action Buttons -->
              <div class="flex flex-wrap gap-3 glass-card-dark p-4 rounded-2xl border border-white/10 shrink-0">
                <button 
                  @click="showInboundModal = true"
                  class="flex-1 sm:flex-none h-[40px] px-5 bg-[#05C168]/20 hover:bg-[#05C168]/30 border border-[#05C168]/40 text-[#14CA74] rounded-[8px] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
                >
                  <PlusCircle class="w-4 h-4" />
                  <span>NHẬP KHO (IN)</span>
                </button>
                <button 
                  @click="showOutboundModal = true"
                  class="flex-1 sm:flex-none h-[40px] px-5 bg-[#FF5A65]/20 hover:bg-[#FF5A65]/30 border border-[#FF5A65]/40 text-[#FF5A65] rounded-[8px] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
                >
                  <MinusCircle class="w-4 h-4" />
                  <span>XUẤT KHO (OUT)</span>
                </button>
                <button 
                  @click="showUploadModal = true"
                  class="flex-1 sm:flex-none h-[40px] px-5 btn-neon-purple rounded-[8px] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
                >
                  <UploadCloud class="w-4 h-4" />
                  <span>CẬP NHẬT NGUỒN</span>
                </button>
              </div>

              <!-- Inventory Grid AG Grid component -->
              <InventoryGrid 
                :data="inventoryData" 
                @quick-out="triggerQuickOutbound"
                @edit="triggerEditInventory"
                @export="exportExcel"
              />
            </div>

            <!-- 3. TAB QUẢN LÝ PHỤ KIỆN (Accessories) -->
            <div v-else-if="currentTab === 'accessories'" class="glass-card-dark p-6 lg:p-8 space-y-6">
              <!-- Accessories Header Controls -->
              <div class="flex flex-col sm:flex-row justify-between items-center gap-4 pb-2 border-b border-white/[0.08]">
                <div>
                  <h3 class="text-lg font-bold text-white tracking-wide">Quản Lý Phụ Kiện</h3>
                  <p class="text-xs text-[#AEB9E1]">Theo dõi tồn kho &amp; phân bổ phụ kiện theo vị trí Bin</p>
                </div>
                <div class="flex items-center gap-3 w-full sm:w-auto">
                  <div class="relative flex-1 sm:w-80">
                    <input 
                      type="text" 
                      v-model="pkFilter"
                      placeholder="Tìm nhanh Code, Bin..." 
                      class="w-full h-[40px] px-4 pl-10 bg-white/[0.06] backdrop-blur-md border border-white/15 rounded-[8px] text-xs outline-none text-white placeholder-[#AEB9E1]/50 focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
                    >
                    <Search class="w-4 h-4 text-[#AEB9E1] absolute left-3.5 top-3" />
                  </div>
                  <button 
                    @click="showAccInboundModal = true"
                    class="h-[40px] px-5 btn-neon-purple rounded-[8px] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-sm shrink-0"
                  >
                    <PlusCircle class="w-4 h-4" />
                    <span>NHẬP PHỤ KIỆN</span>
                  </button>
                </div>
              </div>

              <!-- Accessories Frosted Glass Table (DỮ LIỆU GẮN TRỰC TIẾP TRÊN BẢNG KÍNH MỜ TIÊU CHUẨN) -->
              <div class="overflow-x-auto overflow-y-auto max-h-[600px] custom-scroll">
                <table class="w-full text-left text-xs whitespace-nowrap border-collapse">
                  <thead class="bg-[#283241]/75 backdrop-blur-md text-[#AEB9E1] font-semibold border-b border-white/10 sticky top-0 z-10">
                    <tr>
                      <th class="py-3.5 px-4 font-semibold">MÃ PHỤ KIỆN (CODE)</th>
                      <th class="py-3.5 px-4 text-right font-semibold">SỐ LƯỢNG (QTY)</th>
                      <th class="py-3.5 px-4 text-center font-semibold">VỊ TRÍ (BIN)</th>
                      <th class="py-3.5 px-4 text-center font-semibold">THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/[0.06] font-medium">
                    <tr 
                      v-for="row in filteredPkData" 
                      :key="row.id"
                      class="transition-colors duration-150 hover:bg-white/[0.08]"
                    >
                      <td class="py-3.5 px-4 font-bold text-[#00C2FF] font-mono text-xs">{{ row.code }}</td>
                      <td class="py-3.5 px-4 text-right font-bold text-[#14CA74] text-xs">{{ formatNumber(row.qty) }}</td>
                      <td class="py-3.5 px-4 text-center text-[#AEB9E1] font-mono text-xs">{{ row.bin || 'N/A' }}</td>
                      <td class="py-3.5 px-4 text-center">
                        <div class="flex justify-center gap-2">
                          <button 
                            @click="triggerEditAccessory(row)" 
                            class="px-3 py-1 bg-[#FDB52A]/15 hover:bg-[#FDB52A]/25 text-[#FDB52A] rounded-[4px] border border-[#FDB52A]/30 text-xs font-bold cursor-pointer transition"
                          >
                            Sửa
                          </button>
                          <button 
                            @click="triggerOutboundAccessory(row)" 
                            class="px-3 py-1 bg-[#FF5A65]/15 hover:bg-[#FF5A65]/25 text-[#FF5A65] rounded-[4px] border border-[#FF5A65]/30 text-xs font-bold cursor-pointer transition"
                          >
                            Xuất
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="filteredPkData.length === 0">
                      <td colspan="4" class="text-center py-12 text-[#AEB9E1] italic text-xs">
                        Không tìm thấy phụ kiện phù hợp!
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </transition>

        </div>
      </main>

      <!-- Footer -->
      <footer class="w-full text-center py-3.5 glass-footer text-[10px] font-semibold text-[#AEB9E1] tracking-wider shrink-0 z-20">
        <span class="neon-glow-text">
          ENGINEERED BY VINH &copy; 2026 | DATA ANALYTICS SYSTEM — DASHDARK V PRO
        </span>
      </footer>
    </div>

    <!-- ----------------------------------------- -->
    <!-- MODALS & DIALOGS HOSTS                    -->
    <!-- ----------------------------------------- -->

    <!-- 1. Inbound Inventory Modal -->
    <InboundModal 
      v-model:visible="showInboundModal"
      :inventory-data="inventoryData"
      @inbound="handleInboundSubmit"
      @import-csv="handleCsvImportSubmit"
    />

    <!-- 2. Outbound Inventory Modal -->
    <OutboundModal 
      v-model:visible="showOutboundModal"
      :inventory-data="inventoryData"
      :loading="loading"
      @outbound="handleOutboundSubmit"
    />

    <!-- 3. Quick Outbound Modal -->
    <QuickOutboundModal 
      v-model:visible="showQuickOutModal"
      :target="quickOutTarget"
      @cancel="showQuickOutModal = false"
      @confirm="handleQuickOutConfirm"
    />

    <!-- 4. Edit Inventory Modal -->
    <EditInventoryModal 
      v-model:visible="showEditInvModal"
      :target="editInvTarget"
      :loading="loading"
      @cancel="showEditInvModal = false"
      @save="handleEditInvSubmit"
    />

    <!-- 5. Upload Master CSV Modal -->
    <UploadMasterModal 
      v-model:visible="showUploadModal"
      :loading="loading"
      @upload="handleUploadMasterSubmit"
    />

    <!-- 6. Accessory Inbound Modal -->
    <AccessoryInboundModal 
      v-model:visible="showAccInboundModal"
      :unique-codes="uniqueCodes"
      :loading="loading"
      @cancel="showAccInboundModal = false"
      @save="handleAccInboundSubmit"
    />

    <!-- 7. Accessory Edit Modal -->
    <AccessoryEditModal 
      v-model:visible="showAccEditModal"
      :target="accEditTarget"
      :loading="loading"
      @cancel="showAccEditModal = false"
      @save="handleAccEditSubmit"
    />

    <!-- 8. Accessory Outbound Modal -->
    <AccessoryOutboundModal 
      v-model:visible="showAccOutModal"
      :target="accOutTarget"
      :loading="loading"
      @outbound-all="handleAccOutAll"
      @outbound-partial="handleAccOutPartial"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'

// Icons
import { 
  PlusCircle, 
  MinusCircle, 
  UploadCloud, 
  Search 
} from 'lucide-vue-next'

// Layout & Dashboard Components
import AppSidebar from '@/components/layout/AppSidebar.vue'
import KpiCards from '@/components/kpi/KpiCards.vue'
import ComparisonChart from '@/components/charts/ComparisonChart.vue'
import VisitorsRingChart from '@/components/dashboard/VisitorsRingChart.vue'
import RecentOrdersTable from '@/components/dashboard/RecentOrdersTable.vue'
import WorldDotMapCard from '@/components/dashboard/WorldDotMapCard.vue'
import InventoryGrid from '@/components/inventory/InventoryGrid.vue'

// Modals
import InboundModal from '@/components/inventory/InboundModal.vue'
import OutboundModal from '@/components/inventory/OutboundModal.vue'
import QuickOutboundModal from '@/components/inventory/QuickOutboundModal.vue'
import EditInventoryModal from '@/components/inventory/EditInventoryModal.vue'
import UploadMasterModal from '@/components/inventory/UploadMasterModal.vue'
import AccessoryInboundModal from '@/components/accessories/AccessoryInboundModal.vue'
import AccessoryEditModal from '@/components/accessories/AccessoryEditModal.vue'
import AccessoryOutboundModal from '@/components/accessories/AccessoryOutboundModal.vue'

// Composables & Services
import { useInventory } from '@/composables/useInventory'
import { useAccessories } from '@/composables/useAccessories'
import { resetMockData } from '@/services/mockData'
import { exportToExcel } from '@/services/excelExport'
import { formatNumber } from '@/utils/format'
import { InventoryRow, HangPhuKienRow } from '@/types'

const toast = useToast()

// States
const currentTab = ref('dashboard')

// Composables states
const {
  loading,
  isDemoMode,
  inventoryData,
  summaryData,
  kpi,
  analysis,
  lastSync,
  fetchInventory,
  inbound,
  importCsvData,
  deleteInventoryItem,
  editInventoryItem,
  replaceMasterData
} = useInventory()

const {
  accessoriesData,
  pkFilter,
  uniqueCodes,
  filteredPkData,
  fetchAccessories,
  inboundAccessory,
  editAccessory,
  deleteAccessory,
  outboundAccessoryPartial
} = useAccessories()

// Modal Triggers
const showInboundModal = ref(false)
const showOutboundModal = ref(false)
const showQuickOutModal = ref(false)
const showEditInvModal = ref(false)
const showUploadModal = ref(false)
const showAccInboundModal = ref(false)
const showAccEditModal = ref(false)
const showAccOutModal = ref(false)

// Active Modal Targets
const quickOutTarget = ref<InventoryRow | null>(null)
const editInvTarget = ref<InventoryRow | null>(null)
const accEditTarget = ref<HangPhuKienRow | null>(null)
const accOutTarget = ref<HangPhuKienRow | null>(null)

// Current Tab Name in Vietnamese
const currentTabName = computed(() => {
  switch (currentTab.value) {
    case 'dashboard': return 'Bảng Điều Khiển'
    case 'inventory': return 'Tồn Kho Thành Phẩm'
    case 'accessories': return 'Quản Lý Phụ Kiện'
    default: return ''
  }
})

// Load All System Data
const loadAllData = async () => {
  try {
    await Promise.all([
      fetchInventory(),
      fetchAccessories()
    ])
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi tải dữ liệu',
      detail: e.message || 'Không thể đồng bộ dữ liệu!',
      life: 5000
    })
  }
}

// Reset Mock Data
const handleResetMockData = () => {
  resetMockData()
  loadAllData()
  toast.add({
    severity: 'info',
    summary: 'Đã đặt lại dữ liệu',
    detail: 'Dữ liệu mẫu đã được khôi phục về trạng thái ban đầu',
    life: 3000
  })
}

onMounted(() => {
  loadAllData()
})

// Inbound Submission (Manual)
const handleInboundSubmit = async (payload: { tagId: string; bin: string; option: 'update' | 'insert' }) => {
  try {
    await inbound(payload.tagId, payload.bin, payload.option)
    toast.add({
      severity: 'success',
      summary: 'Nhập kho thành công',
      detail: `Đã nhập Tag ${payload.tagId} vào Bin ${payload.bin}`,
      life: 3000
    })
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi nhập kho',
      detail: e.message,
      life: 4000
    })
  }
}

// Inbound CSV Import
const handleCsvImportSubmit = async (rows: { tag_id: string; bin: string }[]) => {
  try {
    await importCsvData(rows)
    showInboundModal.value = false
    toast.add({
      severity: 'success',
      summary: 'Nhập CSV thành công',
      detail: `Đã nhập thêm ${rows.length} dòng tồn kho`,
      life: 4000
    })
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi import CSV',
      detail: e.message,
      life: 4000
    })
  }
}

// Outbound Submission
const handleOutboundSubmit = async (inventoryId: string, tagId: string, bin: string) => {
  try {
    await deleteInventoryItem(inventoryId)
    toast.add({
      severity: 'success',
      summary: 'Xuất kho thành công',
      detail: `Đã xuất Tag ${tagId} từ Bin ${bin || 'N/A'}`,
      life: 3000
    })
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi xuất kho',
      detail: e.message,
      life: 4000
    })
  }
}

// Trigger Quick Outbound from Grid Row Button
const triggerQuickOutbound = (row: InventoryRow) => {
  quickOutTarget.value = row
  showQuickOutModal.value = true
}

const handleQuickOutConfirm = async (row: InventoryRow) => {
  try {
    await deleteInventoryItem(row.inventory_id)
    showQuickOutModal.value = false
    toast.add({
      severity: 'success',
      summary: 'Xuất kho nhanh thành công',
      detail: `Đã xóa dòng Tag ${row.tag_id} khỏi kho`,
      life: 3000
    })
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi xuất kho nhanh',
      detail: e.message,
      life: 4000
    })
  }
}

// Trigger Edit Inventory Row
const triggerEditInventory = (row: InventoryRow) => {
  editInvTarget.value = row
  showEditInvModal.value = true
}

const handleEditInvSubmit = async (payload: { inventoryId: string; tagId: string; bin: string }) => {
  try {
    await editInventoryItem(payload.inventoryId, payload.tagId, payload.bin)
    showEditInvModal.value = false
    toast.add({
      severity: 'success',
      summary: 'Cập nhật thành công',
      detail: 'Đã lưu thay đổi dòng tồn kho',
      life: 3000
    })
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi cập nhật',
      detail: e.message,
      life: 4000
    })
  }
}

// Upload Master Data
const handleUploadMasterSubmit = async (payload: any[]) => {
  try {
    await replaceMasterData(payload)
    showUploadModal.value = false
    toast.add({
      severity: 'success',
      summary: 'Cập nhật nguồn thành công',
      detail: `Đã tải lên ${payload.length} dòng dữ liệu nguồn mới`,
      life: 4000
    })
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi cập nhật nguồn',
      detail: e.message,
      life: 4000
    })
  }
}

// --- PHỤ KIỆN HANDLERS ---

// Nhập kho phụ kiện
const handleAccInboundSubmit = async (payload: { code: string; qty: number; bin: string }) => {
  try {
    await inboundAccessory(payload.code, payload.qty, payload.bin)
    showAccInboundModal.value = false
    toast.add({
      severity: 'success',
      summary: 'Nhập phụ kiện thành công',
      detail: `Đã nhập ${payload.qty} sản phẩm ${payload.code} vào Bin ${payload.bin}`,
      life: 3500
    })
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi nhập phụ kiện',
      detail: e.message,
      life: 4000
    })
  }
}

// Chỉnh sửa phụ kiện
const triggerEditAccessory = (row: HangPhuKienRow) => {
  accEditTarget.value = row
  showAccEditModal.value = true
}

const handleAccEditSubmit = async (payload: { id: string; code: string; qty: number; bin: string }) => {
  try {
    await editAccessory(payload.id, payload.code, payload.qty, payload.bin)
    showAccEditModal.value = false
    toast.add({
      severity: 'success',
      summary: 'Cập nhật phụ kiện thành công',
      detail: `Đã lưu thay đổi phụ kiện ${payload.code}`,
      life: 3000
    })
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi chỉnh sửa phụ kiện',
      detail: e.message,
      life: 4000
    })
  }
}

// Xuất kho phụ kiện
const triggerOutboundAccessory = (row: HangPhuKienRow) => {
  accOutTarget.value = row
  showAccOutModal.value = true
}

const handleAccOutAll = async (id: string) => {
  try {
    await deleteAccessory(id)
    showAccOutModal.value = false
    toast.add({
      severity: 'success',
      summary: 'Xuất hết thành công',
      detail: 'Đã xóa phụ kiện khỏi kho',
      life: 3000
    })
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi xuất phụ kiện',
      detail: e.message,
      life: 4000
    })
  }
}

const handleAccOutPartial = async (id: string, currentQty: number, outQty: number) => {
  try {
    await outboundAccessoryPartial(id, currentQty, outQty)
    showAccOutModal.value = false
    toast.add({
      severity: 'success',
      summary: 'Xuất một phần thành công',
      detail: `Đã xuất ${outQty} sản phẩm phụ kiện`,
      life: 3000
    })
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi xuất một phần',
      detail: e.message,
      life: 4000
    })
  }
}

// Export Excel
const exportExcel = () => {
  try {
    exportToExcel(inventoryData.value, summaryData.value, accessoriesData.value)
    toast.add({
      severity: 'success',
      summary: 'Đang tải báo cáo Excel',
      detail: 'Đã xuất dữ liệu thực tế thành công!',
      life: 3000
    })
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi xuất báo cáo',
      detail: e.message || 'Không thể tạo file báo cáo!',
      life: 4000
    })
  }
}
</script>
