<template>
  <div class="glass-card-dark p-6 flex flex-col gap-5 flex-1 min-h-0">
    <!-- Grid Header Bar -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <p class="text-[10px] font-bold text-[#CB3CFF] uppercase tracking-widest mb-1">
          HỆ THỐNG KHO THỰC TẾ
        </p>
        <h2 class="text-xl font-bold text-white tracking-tight">
          Bảng Chi Tiết Tồn Kho Thành Phẩm
        </h2>
      </div>

      <!-- Action Buttons & Search Bar -->
      <div class="flex flex-wrap gap-3 w-full sm:w-auto items-center">
        <button 
          @click="$emit('export')"
          class="flex-1 sm:flex-none h-[38px] px-4 rounded-[7px] bg-[#05C168]/20 hover:bg-[#05C168]/30 border border-[#05C168]/40 text-[#14CA74] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
        >
          <FileSpreadsheet class="w-4 h-4" />
          <span>XUẤT EXCEL</span>
        </button>

        <div class="relative flex-1 sm:w-72">
          <input 
            type="text" 
            v-model="quickFilterText"
            placeholder="Tìm Bin, Tag, Feature, Kho (62)..." 
            class="w-full h-[38px] px-3.5 pl-9 bg-[#18202D]/80 backdrop-blur-md border border-white/15 rounded-[8px] text-xs outline-none text-white placeholder-[#AEB9E1]/50 focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
          >
          <Search class="w-3.5 h-3.5 text-[#AEB9E1] absolute left-3 top-3" />
        </div>
      </div>
    </div>

    <!-- AG Grid Direct Standard Glass View -->
    <div class="ag-theme-quartz w-full flex-1 min-h-[520px] rounded-[14px] overflow-hidden">
      <ag-grid-vue
        class="w-full h-full"
        :columnDefs="columnDefs"
        :rowData="flattenedRowData"
        :defaultColDef="defaultColDef"
        :getRowId="getRowId"
        :getRowHeight="getRowHeight"
        :getRowClass="getRowClass"
        :animateRows="true"
        :gridOptions="gridOptions"
        @grid-ready="onGridReady"
        @first-data-rendered="onFirstDataRendered"
      />
    </div>

    <!-- Summary footer stats -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs">
      <span class="text-[#AEB9E1]">
        Tổng cộng <span class="font-bold text-white">{{ props.data.length }}</span> dòng tồn kho
      </span>
      <span class="text-[#AEB9E1]/40">|</span>
      <span class="text-[#AEB9E1]">
        <span class="font-bold text-[#CB3CFF]">{{ uniqueFeatureCount }}</span> Feature
      </span>
      <span class="text-[#AEB9E1]/40">|</span>
      <span class="text-[#AEB9E1]">
        Tổng Actual: <span class="font-bold text-[#14CA74]">{{ formatNumber(totalActual) }}</span> PCS
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { AgGridVue } from 'ag-grid-vue3'
import { 
  ModuleRegistry, 
  ClientSideRowModelModule, 
  QuickFilterModule,
  ColumnAutoSizeModule,
  CellStyleModule,
  ValidationModule,
  ColDef,
  GridReadyEvent,
  type GridOptions,
} from 'ag-grid-community'
import { FileSpreadsheet, Search } from 'lucide-vue-next'
import type { InventoryRow } from '@/types'
import { formatNumber, formatDateTime } from '@/utils/format'

// Register AG Grid modules
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  QuickFilterModule,
  ColumnAutoSizeModule,
  CellStyleModule,
  ValidationModule,
])

interface GroupHeaderRow {
  _rowType: 'group'
  _rowId: string
  feature: string
  kienNum: number
  kienLabel: string
  totalQty: number
  lp_no?: string
  qty?: number
  warehouse?: string
  stock_in_date?: string
  create_date?: string
  tag_id?: string
  bin?: string
  inventory_id?: string
}

interface DataRow extends InventoryRow {
  _rowType: 'data'
  _rowId: string
  kienLabel: string
}

type FlatRow = GroupHeaderRow | DataRow

const props = defineProps<{ data: InventoryRow[] }>()
const emit = defineEmits<{
  (e: 'quick-out', row: InventoryRow): void
  (e: 'edit', row: InventoryRow): void
  (e: 'export'): void
}>()

const quickFilterText = ref('')
const gridApi = ref<any>(null)

watch(quickFilterText, () => {
  if (gridApi.value) {
    gridApi.value.onFilterChanged()
  }
})

const onGridReady = (params: GridReadyEvent) => {
  gridApi.value = params.api
}
const onFirstDataRendered = () => {
  gridApi.value?.sizeColumnsToFit()
}

// Tính số kiện theo feature: kien = sum(qty) / 2 / max(qty)
const featureMetrics = computed(() => {
  const metrics: Record<string, { sum: number; max: number }> = {}
  props.data.forEach(row => {
    const feat = row.feature
    if (!feat || feat === 'No data') return
    if (!metrics[feat]) metrics[feat] = { sum: 0, max: 0 }
    const qty = Number(row.qty) || 0
    metrics[feat].sum += qty
    if (qty > metrics[feat].max) metrics[feat].max = qty
  })
  return metrics
})

const uniqueFeatureCount = computed(() => Object.keys(featureMetrics.value).length)
const totalActual = computed(() => props.data.reduce((s, r) => s + (Number(r.qty) || 0), 0))

// Flatten rows with groups
const flattenedRowData = computed((): FlatRow[] => {
  const groups: Record<string, InventoryRow[]> = {}
  const noFeatureRows: InventoryRow[] = []
  
  props.data.forEach(row => {
    const feat = row.feature
    if (!feat || feat === 'No data') {
      noFeatureRows.push(row)
      return
    }
    if (!groups[feat]) groups[feat] = []
    groups[feat].push(row)
  })

  const result: FlatRow[] = []
  const sortedFeatures = Object.keys(groups).sort()

  sortedFeatures.forEach(feature => {
    const rows = groups[feature]
    const m = featureMetrics.value[feature] || { sum: 0, max: 0 }
    const kienNum = m.max > 0 ? (m.sum / 2) / m.max : 0

    result.push({
      _rowType: 'group',
      _rowId: `group-${feature}`,
      feature,
      kienNum,
      kienLabel: `${kienNum.toFixed(2)} Kiện`,
      totalQty: m.sum,
    } as GroupHeaderRow)

    rows.forEach(row => {
      result.push({
        ...row,
        _rowType: 'data',
        _rowId: `data-${row.inventory_id || row.tag_id}`,
        kienLabel: `${kienNum.toFixed(2)} Kiện`,
      } as DataRow)
    })
  })

  noFeatureRows.forEach(row => {
    result.push({
      ...row,
      _rowType: 'data',
      _rowId: `data-noFeat-${row.inventory_id || row.tag_id}`,
      kienLabel: '—',
    } as DataRow)
  })

  return result
})

const getRowId = (params: any) => params.data._rowId

const getRowHeight = (params: any) => {
  return params.data?._rowType === 'group' ? 46 : 44
}

const getRowClass = (params: any) => {
  return params.data?._rowType === 'group' ? 'ag-group-header-row' : ''
}

const defaultColDef: ColDef = {
  sortable: true,
  filter: true,
  resizable: true,
  floatingFilter: false,
  suppressMovable: true,
}

const columnDefs = ref<ColDef[]>([
  {
    headerName: 'STOCK CODE',
    field: 'lp_no',
    minWidth: 150,
    cellRenderer: (params: any) => {
      if (params.data?._rowType === 'group') {
        const f = params.data.feature
        const kien = params.data.kienLabel
        const total = formatNumber(params.data.totalQty)
        return `
          <div style="display:flex;align-items:center;gap:10px;height:100%">
            <div style="width:3px;height:20px;background:#CB3CFF;border-radius:2px;flex-shrink:0;box-shadow:0 0 6px #CB3CFF"></div>
            <span style="font-size:12px;font-weight:800;color:#FFFFFF;letter-spacing:0.04em">
              FEATURE: ${f}
            </span>
            <span style="font-size:10px;font-weight:700;color:#CB3CFF;background:rgba(203,60,255,0.15);border:1px solid rgba(203,60,255,0.3);padding:2px 8px;border-radius:4px;white-space:nowrap">
              ${kien}
            </span>
            <span style="font-size:11px;font-weight:800;color:#14CA74;background:rgba(5,193,104,0.15);border:1px solid rgba(5,193,104,0.3);padding:2px 8px;border-radius:4px;white-space:nowrap">
              Tổng ${total} PCS
            </span>
          </div>
        `
      }
      const val = params.value
      if (!val || val === 'No data') {
        return '<span style="color:#FF5A65;font-size:10px;font-weight:700;background:rgba(255,90,101,0.15);border:1px solid rgba(255,90,101,0.3);padding:2px 6px;border-radius:4px">No Data</span>'
      }
      return `<span style="color:#AEB9E1;font-weight:600;font-family:monospace;font-size:12px">${val}</span>`
    },
    colSpan: (params: any) => params.data?._rowType === 'group' ? 8 : 1,
  },
  {
    headerName: 'FEATURE',
    field: 'feature',
    width: 100,
    cellStyle: { fontWeight: '700', color: '#CB3CFF', fontSize: '12px' },
  },
  {
    headerName: 'ACTUAL',
    field: 'qty',
    width: 110,
    type: 'numericColumn',
    valueFormatter: params => {
      if (params.data?._rowType === 'group') return ''
      return params.value != null ? formatNumber(params.value) : ''
    },
    cellStyle: { fontWeight: '800', color: '#FFFFFF', textAlign: 'right' },
  },
  {
    headerName: 'WAREHOUSE',
    field: 'warehouse',
    width: 115,
    cellRenderer: (params: any) => {
      if (params.data?._rowType === 'group') return ''
      const val = params.value
      if (!val || val === 'No data') {
        return '<span style="padding:2px 6px;background:rgba(255,90,101,0.15);border:1px solid rgba(255,90,101,0.3);color:#FF5A65;border-radius:4px;font-size:10px;font-weight:700">No Data</span>'
      }
      return `<span style="font-weight:700;color:#00C2FF;background:rgba(0,194,255,0.1);border:1px solid rgba(0,194,255,0.25);padding:2px 8px;border-radius:4px">${val}</span>`
    },
    cellStyle: { textAlign: 'center' },
  },
  {
    headerName: 'STOCK-UPDATE',
    field: 'stock_in_date',
    width: 160,
    valueFormatter: params => {
      if (params.data?._rowType === 'group') return ''
      return formatDateTime(params.value)
    },
    cellStyle: { color: '#AEB9E1', fontSize: '11px' },
  },
  {
    headerName: 'CREATEDATE',
    field: 'create_date',
    width: 115,
    valueFormatter: params => params.data?._rowType === 'group' ? '' : (params.value || ''),
    cellStyle: { color: '#AEB9E1', fontSize: '11px' },
  },
  {
    headerName: 'TAG ID',
    field: 'tag_id',
    minWidth: 160,
    cellRenderer: (params: any) => {
      if (params.data?._rowType === 'group') return ''
      if (!params.value) return ''
      return `<span style="font-family:monospace;font-weight:700;color:#00C2FF;font-size:11px">${params.value}</span>`
    },
  },
  {
    headerName: 'BIN',
    field: 'bin',
    width: 105,
    valueFormatter: params => params.data?._rowType === 'group' ? '' : (params.value || 'N/A'),
    cellStyle: { fontFamily: 'monospace', color: '#AEB9E1', fontWeight: '600', fontSize: '11px' },
  },
  {
    headerName: 'HÀNH ĐỘNG',
    field: 'actions',
    width: 110,
    sortable: false,
    filter: false,
    cellRenderer: (params: any) => {
      if (params.data?._rowType === 'group' || !params.data) return ''
      const container = document.createElement('div')
      container.style.cssText = 'display:flex;gap:6px;align-items:center;justify-content:center;height:100%'

      const btnOut = document.createElement('button')
      btnOut.style.cssText = 'color:#FF5A65;padding:5px;background:rgba(255,90,101,0.12);border-radius:6px;border:1px solid rgba(255,90,101,0.3);cursor:pointer;display:flex;align-items:center;transition:all 0.15s'
      btnOut.title = 'Xuất Nhanh'
      btnOut.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`
      btnOut.onmouseenter = () => { btnOut.style.background = 'rgba(255,90,101,0.25)' }
      btnOut.onmouseleave = () => { btnOut.style.background = 'rgba(255,90,101,0.12)' }
      btnOut.onclick = (e) => { e.stopPropagation(); emit('quick-out', params.data as InventoryRow) }

      const btnEdit = document.createElement('button')
      btnEdit.style.cssText = 'color:#FDB52A;padding:5px;background:rgba(253,181,42,0.12);border-radius:6px;border:1px solid rgba(253,181,42,0.3);cursor:pointer;display:flex;align-items:center;transition:all 0.15s'
      btnEdit.title = 'Sửa Nhanh'
      btnEdit.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`
      btnEdit.onmouseenter = () => { btnEdit.style.background = 'rgba(253,181,42,0.25)' }
      btnEdit.onmouseleave = () => { btnEdit.style.background = 'rgba(253,181,42,0.12)' }
      btnEdit.onclick = (e) => { e.stopPropagation(); emit('edit', params.data as InventoryRow) }

      container.appendChild(btnOut)
      container.appendChild(btnEdit)
      return container
    },
  },
])

const isExternalFilterPresent = () => {
  return quickFilterText.value.trim() !== ''
}

const doesExternalFilterPass = (node: any) => {
  if (!node.data) return true
  const query = quickFilterText.value.toLowerCase().trim()
  const data = node.data
  
  let whQuery = ''
  let generalQuery = query
  if (query.startsWith('w00')) {
    whQuery = query.replace('w00', '').trim()
  }

  if (data._rowType === 'group') {
    if (data.feature && data.feature.toLowerCase().includes(generalQuery)) return true
    const children = props.data.filter(r => r.feature === data.feature)
    return children.some(r => {
       if (whQuery) return r.warehouse?.includes(whQuery)
       const text = [r.feature, r.bin, r.tag_id, r.lp_no, r.warehouse].filter(Boolean).join(' ').toLowerCase()
       return text.includes(generalQuery)
    })
  }

  if (whQuery) {
    return data.warehouse?.includes(whQuery)
  }
  
  const searchableText = [
    data.feature,
    data.bin,
    data.tag_id,
    data.lp_no,
    data.warehouse
  ].filter(Boolean).join(' ').toLowerCase()

  return searchableText.includes(generalQuery)
}

const gridOptions: GridOptions = {
  suppressCellFocus: true,
  suppressRowClickSelection: true,
  overlayNoRowsTemplate: '<span style="color:#AEB9E1;font-size:12px;font-style:italic">Không có dữ liệu tồn kho</span>',
  isExternalFilterPresent,
  doesExternalFilterPass,
}
</script>
