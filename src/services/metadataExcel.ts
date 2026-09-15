import * as XLSX from 'xlsx'

export interface MetadataColumnMapping {
  customer: string
  item_code: string
  pack_qty: string
  weight_per_unit: string
  carton_spec: string
  carton_type: string
}

export interface MetadataExcelRow {
  customer: string
  item_code: string
  pack_qty: number
  weight_per_unit: number
  carton_spec: string
  carton_type: string
}

export interface ParseMetadataExcelResult {
  headers: string[]
  detectedMapping: MetadataColumnMapping
  rows: MetadataExcelRow[]
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

function findHeader(normHeaders: { original: string; norm: string }[], patterns: string[]): string {
  for (const pattern of patterns) {
    const found = normHeaders.find((h) => h.norm === pattern || h.norm.includes(pattern))
    if (found) return found.original
  }
  return ''
}

/** Tự động nhận diện 6 cột chuẩn Sample.xlsx (hàm thuần túy, dễ unit test). */
export function detectMetadataColumnMapping(headers: string[]): MetadataColumnMapping {
  const normHeaders = headers.map((h) => ({ original: h, norm: normalizeHeaderName(h) }))

  return {
    customer: findHeader(normHeaders, ['khachhang', 'customer', 'client', 'kh']),
    item_code: findHeader(normHeaders, ['mahang', 'itemcode', 'masanpham', 'code', 'item']),
    pack_qty: findHeader(normHeaders, ['soluongdonggoi', 'packqty', 'packingqty', 'soluong', 'qty', 'quantity']),
    weight_per_unit: findHeader(normHeaders, ['trongluong', 'trongtruong', 'weight', 'khoiluong']),
    carton_spec: findHeader(normHeaders, ['quycachthung', 'cartonspec', 'quycach', 'kichthuoc', 'spec']),
    carton_type: findHeader(normHeaders, ['loaithung', 'cartontype', 'loai', 'type']),
  }
}

/** Ép ô số Excel (hỗ trợ chuỗi có dấu phẩy/chấm phân cách). */
export function normalizeMetadataNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const cleaned = String(value ?? '').replace(/\s/g, '')
  if (cleaned === '') return 0
  // Chuỗi "1.480" hay "1,480": nếu có cả . và , thì coi là phân cách nghìn
  const num = Number(cleaned.replace(/,/g, ''))
  return Number.isFinite(num) ? num : 0
}

/**
 * Ánh xạ các dòng JSON thô từ sheet Excel thành dòng quy cách hợp lệ.
 * Lọc dòng thiếu Khách hàng / Mã hàng / Số lượng đóng gói <= 0.
 */
export function mapRowsToPackingSpecs(
  jsonRows: Record<string, unknown>[],
  mapping: MetadataColumnMapping,
): MetadataExcelRow[] {
  const rows: MetadataExcelRow[] = []
  jsonRows.forEach((r) => {
    const customer = String(mapping.customer ? (r[mapping.customer] ?? '') : '').trim()
    const item_code = String(mapping.item_code ? (r[mapping.item_code] ?? '') : '').trim()
    const pack_qty = normalizeMetadataNumber(mapping.pack_qty ? r[mapping.pack_qty] : 0)
    if (!customer || !item_code || !(pack_qty > 0)) return

    rows.push({
      customer,
      item_code,
      pack_qty,
      weight_per_unit: normalizeMetadataNumber(mapping.weight_per_unit ? r[mapping.weight_per_unit] : 0),
      carton_spec: String(mapping.carton_spec ? (r[mapping.carton_spec] ?? '') : '').trim(),
      carton_type: String(mapping.carton_type ? (r[mapping.carton_type] ?? '') : '').trim(),
    })
  })
  return rows
}

/** Đọc file Excel .xlsx từ modal import (giữ nguyên pattern poExcel/forecastExcel). */
export async function parseMetadataExcelFile(file: File): Promise<ParseMetadataExcelResult> {
  const emptyMapping = detectMetadataColumnMapping([])
  try {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return { headers: [], detectedMapping: emptyMapping, rows: [], rawRows: [], error: 'File Excel không có sheet nào!' }
    }
    const sheet = workbook.Sheets[sheetName]
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    if (jsonRows.length === 0) {
      return { headers: [], detectedMapping: emptyMapping, rows: [], rawRows: [], error: 'File Excel không có dòng dữ liệu nào!' }
    }

    const headers = Object.keys(jsonRows[0])
    const detectedMapping = detectMetadataColumnMapping(headers)

    if (!detectedMapping.customer || !detectedMapping.item_code || !detectedMapping.pack_qty) {
      return {
        headers,
        detectedMapping,
        rows: [],
        rawRows: jsonRows,
        error: 'Không nhận diện được cột "Khách Hàng", "Mã hàng" hoặc "Số lượng đóng gói". Hãy dùng file mẫu!',
      }
    }

    const rows = mapRowsToPackingSpecs(jsonRows, detectedMapping)
    if (rows.length === 0) {
      return { headers, detectedMapping, rows, rawRows: jsonRows, error: 'Không có dòng nào hợp lệ (mỗi dòng cần Khách hàng + Mã hàng + Số lượng > 0)!' }
    }
    return { headers, detectedMapping, rows, rawRows: jsonRows }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định khi đọc file!'
    return { headers: [], detectedMapping: emptyMapping, rows: [], rawRows: [], error: message }
  }
}

/** Tải file Excel mẫu đúng định dạng Sample.xlsx (sheet Quy cách, 6 cột chuẩn). */
export function downloadMetadataSampleTemplate(): void {
  const sample = [
    {
      'Khách Hàng': 'Best Chair',
      'Mã hàng': 1009,
      'Số lượng đóng gói': 220,
      'Trọng trượng/Cái': 1.48,
      'Quy cách thùng': '1470*1135*925',
      'Loại thùng': 'thùng đôi',
    },
    {
      'Khách Hàng': 'England',
      'Mã hàng': 7201940001,
      'Số lượng đóng gói': 60,
      'Trọng trượng/Cái': 0.165,
      'Quy cách thùng': '335*190*170',
      'Loại thùng': 'carton box',
    },
  ]
  const ws = XLSX.utils.json_to_sheet(sample)
  ws['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Quy cách')
  XLSX.writeFile(wb, 'QuyCach_Template_Mau.xlsx')
}
