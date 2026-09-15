import * as XLSX from 'xlsx'
import { todayIsoDate } from '@/utils/po'

export interface PoColumnMapping {
  po_no: string
  supplier: string
  item_code: string
  description: string
  note: string
  target_qty: string
  created_date: string
}

export interface PoExcelRow {
  po_no: string
  supplier: string
  item_code: string
  description: string
  note: string
  target_qty: number
  created_date: string
}

export interface ParsePoExcelResult {
  headers: string[]
  detectedMapping: PoColumnMapping
  rows: PoExcelRow[]
  rawRows: Record<string, unknown>[]
  error?: string
}

// Chuẩn hóa tiêu đề cột: bỏ dấu tiếng Việt, hoa thường, ký tự đặc biệt
function normalizeHeaderName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

function findHeader(
  normHeaders: { original: string; norm: string }[],
  patterns: string[],
  exactFirst = false,
): string {
  for (const pattern of patterns) {
    const found = normHeaders.find((h) =>
      exactFirst ? h.norm === pattern : h.norm === pattern || h.norm.includes(pattern),
    )
    if (found) return found.original
  }
  return ''
}

/** Tự động nhận diện cột PO từ tiêu đề file Excel (hàm thuần túy, dễ unit test). */
export function detectPoColumnMapping(headers: string[]): PoColumnMapping {
  const normHeaders = headers.map((h) => ({ original: h, norm: normalizeHeaderName(h) }))

  return {
    // Ưu tiên khớp chính xác trước để tránh cột "Số PO" bị nhận nhầm sang cột khác chứa "po"
    po_no: findHeader(normHeaders, ['sopo', 'mapo', 'ponumber', 'purchaseorder', 'po'], true),
    supplier: findHeader(normHeaders, ['nhacungcap', 'ncc', 'supplier', 'vendor', 'nhasanxuat']),
    item_code: findHeader(normHeaders, ['mahang', 'masanpham', 'itemcode', 'stockcode', 'code', 'item']),
    description: findHeader(normHeaders, ['motasanpham', 'mota', 'description', 'tensanpham', 'product']),
    note: findHeader(normHeaders, ['ghichu', 'note', 'remark', 'diengiai']),
    target_qty: findHeader(normHeaders, ['muctieu', 'target', 'soluongtarget', 'soluongdat', 'soluong', 'qty', 'quantity']),
    created_date: findHeader(normHeaders, ['ngaytao', 'createddate', 'ngaydat', 'ngay', 'date']),
  }
}

/** Chuẩn hóa 1 ô ngày Excel về yyyy-mm-dd (hỗ trợ serial Excel + chuỗi dd/mm/yyyy). */
export function normalizePoDateCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return todayIsoDate()
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) {
      const m = String(parsed.m).padStart(2, '0')
      const d = String(parsed.d).padStart(2, '0')
      return `${parsed.y}-${m}-${d}`
    }
    return todayIsoDate()
  }
  const s = String(value).trim()
  const vn = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (vn) {
    return `${vn[3]}-${vn[2].padStart(2, '0')}-${vn[1].padStart(2, '0')}`
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return todayIsoDate(d)
  return todayIsoDate()
}

/** Ánh xạ các dòng JSON thô từ sheet Excel thành dữ liệu PO hợp lệ (lọc dòng thiếu Số PO/Target). */
export function mapRowsToPurchaseOrders(
  jsonRows: Record<string, unknown>[],
  mapping: PoColumnMapping,
): PoExcelRow[] {
  const rows: PoExcelRow[] = []
  jsonRows.forEach((r) => {
    const po_no = String(mapping.po_no ? (r[mapping.po_no] ?? '') : '').trim()
    const targetRaw = mapping.target_qty ? r[mapping.target_qty] : 0
    const target_qty = Number(String(targetRaw ?? '').replace(/[,.\s]/g, '')) || Number(targetRaw) || 0
    if (!po_no || !(target_qty > 0)) return

    rows.push({
      po_no,
      supplier: String(mapping.supplier ? (r[mapping.supplier] ?? '') : '').trim(),
      item_code: String(mapping.item_code ? (r[mapping.item_code] ?? '') : '').trim(),
      description: String(mapping.description ? (r[mapping.description] ?? '') : '').trim(),
      note: String(mapping.note ? (r[mapping.note] ?? '') : '').trim(),
      target_qty,
      created_date: normalizePoDateCell(mapping.created_date ? r[mapping.created_date] : undefined),
    })
  })
  return rows
}

/** Đọc file Excel .xlsx từ modal import (giữ nguyên pattern của forecastExcel). */
export async function parsePoExcelFile(file: File): Promise<ParsePoExcelResult> {
  try {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return { headers: [], detectedMapping: detectPoColumnMapping([]), rows: [], rawRows: [], error: 'File Excel không có sheet nào!' }
    }
    const sheet = workbook.Sheets[sheetName]
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    if (jsonRows.length === 0) {
      return { headers: [], detectedMapping: detectPoColumnMapping([]), rows: [], rawRows: [], error: 'File Excel không có dòng dữ liệu nào!' }
    }

    const headers = Object.keys(jsonRows[0])
    const detectedMapping = detectPoColumnMapping(headers)

    if (!detectedMapping.po_no || !detectedMapping.target_qty) {
      return {
        headers,
        detectedMapping,
        rows: [],
        rawRows: jsonRows,
        error: 'Không nhận diện được cột "Số PO" hoặc "Target". Hãy dùng file mẫu hoặc chỉnh lại tiêu đề cột!',
      }
    }

    const rows = mapRowsToPurchaseOrders(jsonRows, detectedMapping)
    if (rows.length === 0) {
      return { headers, detectedMapping, rows, rawRows: jsonRows, error: 'Không có dòng nào hợp lệ (mỗi dòng cần Số PO + Target > 0)!' }
    }
    return { headers, detectedMapping, rows, rawRows: jsonRows }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định khi đọc file!'
    return { headers: [], detectedMapping: detectPoColumnMapping([]), rows: [], rawRows: [], error: message }
  }
}

/** Tải file Excel mẫu để người dùng điền hàng loạt rồi nạp lại. */
export function downloadPoSampleTemplate(): void {
  const headers = ['Số PO', 'Nhà cung cấp', 'Mã hàng', 'Mô tả sản phẩm', 'Ghi chú', 'Mục tiêu', 'Ngày tạo']
  const ws = XLSX.utils.json_to_sheet([], { header: headers })
  ws['!cols'] = [{ wch: 18 }, { wch: 24 }, { wch: 16 }, { wch: 26 }, { wch: 20 }, { wch: 12 }, { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'PO_Template')
  XLSX.writeFile(wb, 'PO_Template_Mau.xlsx')
}
