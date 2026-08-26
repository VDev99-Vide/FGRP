import * as XLSX from 'xlsx'
import { InventoryRow, SummaryAnalysisRow, HangPhuKienRow } from '@/types'
import { sortInventoryAll } from '@/utils/sort'

function formatFilename(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  return `WMS_FG_PRO_Report_${year}${month}${day}_${hour}${minute}.xlsx`
}

// Chuyển toàn bộ giá trị trong object thành string để giữ định dạng text trong Excel
function stringifyData(data: any[]): Record<string, string>[] {
  return data.map(item => {
    const stringified: Record<string, string> = {}
    Object.entries(item).forEach(([key, val]) => {
      stringified[key] = val !== null && val !== undefined ? String(val) : ''
    })
    return stringified
  })
}

export function exportToExcel(
  inventory: InventoryRow[],
  summary: SummaryAnalysisRow[],
  accessories: HangPhuKienRow[]
): void {
  // 1. Tạo workbook mới
  const wb = XLSX.utils.book_new()

  // 2. Chuẩn bị dữ liệu cho sheet Tồn Kho Thành Phẩm (sắp xếp đồng bộ: Feature A-Z -> CreateDate A-Z -> Bin A-Z)
  const sortedInventory = sortInventoryAll(inventory)

  const inventoryHeaders = {
    lp_no: 'LP.No',
    feature: 'Feature',
    qty: 'Qty',
    warehouse: 'Warehouse',
    create_date: 'CreateDate',
    stock_in_date: 'Stock In Date',
    tag_id: 'Tag ID',
    bin: 'Bin',
    inventory_id: 'ID'
  }
  const formattedInventory = sortedInventory.map(item => ({
    [inventoryHeaders.lp_no]: item.lp_no,
    [inventoryHeaders.feature]: item.feature,
    [inventoryHeaders.qty]: item.qty,
    [inventoryHeaders.warehouse]: item.warehouse,
    [inventoryHeaders.create_date]: item.create_date,
    [inventoryHeaders.stock_in_date]: item.stock_in_date ? new Date(item.stock_in_date).toLocaleString('vi-VN') : '',
    [inventoryHeaders.tag_id]: item.tag_id,
    [inventoryHeaders.bin]: item.bin,
    [inventoryHeaders.inventory_id]: item.inventory_id
  }))
  const wsInventory = XLSX.utils.json_to_sheet(stringifyData(formattedInventory))

  // 3. Chuẩn bị dữ liệu cho sheet Summary Analysis
  const summaryHeaders = {
    feature: 'Feature',
    actual: 'Actual',
    iscala: 'iScala',
    diff: 'Chênh lệch (Diff)',
    diff_percent: 'Tỷ lệ % (Diff %)'
  }
  const formattedSummary = summary.map(item => ({
    [summaryHeaders.feature]: item.feature,
    [summaryHeaders.actual]: item.actual,
    [summaryHeaders.iscala]: item.iscala,
    [summaryHeaders.diff]: item.diff,
    [summaryHeaders.diff_percent]: `${item.diff_percent}%`
  }))
  const wsSummary = XLSX.utils.json_to_sheet(stringifyData(formattedSummary))

  // 4. Chuẩn bị dữ liệu cho sheet Phụ Kiện
  const accessoryHeaders = {
    code: 'Mã Phụ Kiện (Code)',
    qty: 'Số lượng (Qty)',
    bin: 'Vị trí (Bin)'
  }
  const formattedAccessories = accessories.map(item => ({
    [accessoryHeaders.code]: item.code,
    [accessoryHeaders.qty]: item.qty,
    [accessoryHeaders.bin]: item.bin
  }))
  const wsAccessories = XLSX.utils.json_to_sheet(stringifyData(formattedAccessories))

  // Helper để ép định dạng text cho toàn bộ ô trong sheet
  const forceTextFormat = (ws: XLSX.WorkSheet) => {
    Object.keys(ws).forEach(cell => {
      if (cell.startsWith('!')) return
      if (ws[cell] && typeof ws[cell] === 'object') {
        ws[cell].t = 's' // Thiết lập loại ô thành String
      }
    })
  }

  forceTextFormat(wsInventory)
  forceTextFormat(wsSummary)
  forceTextFormat(wsAccessories)

  // 5. Thêm các sheet vào workbook
  XLSX.utils.book_append_sheet(wb, wsInventory, 'Ton_Kho_Thanh_Pham')
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary_Analysis')
  XLSX.utils.book_append_sheet(wb, wsAccessories, 'Hang_Phu_Kien')

  // 6. Xuất file
  const filename = formatFilename()
  XLSX.writeFile(wb, filename)
}
