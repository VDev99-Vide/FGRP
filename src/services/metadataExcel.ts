import * as XLSX from 'xlsx'
import { normalizeCartonType, stringifyMaHang } from '@/utils/metadata'

export interface MetadataColumnMapping {
  customer: string
  ma_hang: string
  feature: string
  pack_qty: string
  weight_per_unit: string
  carton_spec: string
  carton_type: string
  /** Legacy alias: khi file cũ chỉ có 1 cột Mã hàng (=feature), map về ma_hang. */
  item_code?: string
}

export interface MetadataExcelRow {
  customer: string
  ma_hang: string
  feature: string
  /** Legacy alias giữ cho caller cũ (luôn = feature). */
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

/**
 * Tự động nhận diện 7 cột chuẩn Sample.xlsx mới:
 * Khách Hàng | Mã hàng (full) | Feature | Số lượng đóng gói | Trọng lượng | Quy cách thùng | Loại thùng
 * Tương thích ngược file 6 cột cũ (chỉ có Mã hàng = feature): feature sẽ fallback = ma_hang ở mapRows.
 */
export function detectMetadataColumnMapping(headers: string[]): MetadataColumnMapping {
  const normHeaders = headers.map((h) => ({ original: h, norm: normalizeHeaderName(h) }))

  // Feature phải detect trước để không bị 'mahang' nuốt.
  // 'Mã hàng' (mahang) -> ma_hang; 'Feature' (feature) -> feature.
  const feature = findHeader(normHeaders, ['feature'])
  let ma_hang = ''
  // Ưu tiên header chứa 'mahang' nhưng không phải 'feature'
  for (const h of normHeaders) {
    if (h.norm.includes('mahang') || h.norm === 'mahang' || h.norm.includes('itemcode') || h.norm.includes('masanpham')) {
      // Nếu header là 'Feature' thì bỏ qua (đã map feature)
      if (h.original !== feature) {
        ma_hang = h.original
        break
      }
    }
  }
  if (!ma_hang) {
    ma_hang = findHeader(normHeaders, ['mahang', 'itemcode', 'masanpham', 'code', 'item'])
    // Nếu chỉ có 1 cột mã và nó trùng feature (file cũ), giữ ma_hang, feature sẽ fallback sau.
    if (ma_hang && ma_hang === feature) {
      // file cũ 6 cột: 'Mã hàng' vừa là ma_hang vừa là feature -> giữ ma_hang, feature để trống để fallback
    }
  }
  // Nếu file cũ không có cột Feature riêng, feature = '' để mapRows fallback.
  // Nếu ma_hang rỗng nhưng feature có (hiếm), dùng feature làm ma_hang tạm.
  if (!ma_hang && feature) ma_hang = feature

  return {
    customer: findHeader(normHeaders, ['khachhang', 'customer', 'client', 'kh']),
    ma_hang,
    feature: feature === ma_hang ? '' : feature,
    pack_qty: findHeader(normHeaders, ['soluongdonggoi', 'packqty', 'packingqty', 'soluong', 'qty', 'quantity']),
    weight_per_unit: findHeader(normHeaders, ['trongluong', 'trongtruong', 'weight', 'khoiluong']),
    carton_spec: findHeader(normHeaders, ['quycachthung', 'cartonspec', 'quycach', 'kichthuoc', 'spec']),
    carton_type: findHeader(normHeaders, ['loaithung', 'cartontype', 'loai', 'type']),
  }
}

/** Ép ô số Excel (hỗ trợ locale VN: '1,48' -> 1.48, '1,480' nghìn -> 1480, '1.480' -> 1480). */
export function normalizeMetadataNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const cleaned = String(value ?? '').replace(/\s/g, '')
  if (cleaned === '') return 0
  const hasComma = cleaned.includes(',')
  const hasDot = cleaned.includes('.')
  let norm = cleaned
  if (hasComma && hasDot) {
    // Có cả , và . -> coi , là phân cách nghìn
    norm = cleaned.replace(/,/g, '')
  } else if (hasComma) {
    // Chỉ có , : nếu đuôi ,ddd (3 số) -> nghìn, ngược lại thập phân VN -> dot
    if (/,\d{3}$/.test(cleaned)) norm = cleaned.replace(/,/g, '')
    else norm = cleaned.replace(/,/g, '.')
  }
  const num = Number(norm)
  return Number.isFinite(num) ? num : 0
}

/**
 * Ánh xạ các dòng JSON thô từ sheet Excel thành dòng quy cách hợp lệ (chuẩn 7 cột).
 * - Yêu cầu: Khách hàng + Mã hàng + Feature (fallback = Mã hàng cho file cũ/phụ kiện) + SL > 0.
 * - Chuẩn hóa Loại thùng về 3 loại (thùng đơn / thùng đôi / phụ kiện).
 */
export function mapRowsToPackingSpecs(
  jsonRows: Record<string, unknown>[],
  mapping: MetadataColumnMapping,
): MetadataExcelRow[] {
  const rows: MetadataExcelRow[] = []
  jsonRows.forEach((r) => {
    const customer = String(mapping.customer ? (r[mapping.customer] ?? '') : '').trim()
    const ma_hang = stringifyMaHang(mapping.ma_hang ? r[mapping.ma_hang] : '')
    const featureRaw = String(mapping.feature ? (r[mapping.feature] ?? '') : '').trim()
    // Fallback: file cũ 6 cột không có Feature riêng -> feature = ma_hang
    const feature = featureRaw || ma_hang
    const pack_qty = normalizeMetadataNumber(mapping.pack_qty ? r[mapping.pack_qty] : 0)
    if (!customer || !ma_hang || !feature || !(pack_qty > 0)) return

    rows.push({
      customer,
      ma_hang,
      feature,
      item_code: feature,
      pack_qty,
      weight_per_unit: normalizeMetadataNumber(mapping.weight_per_unit ? r[mapping.weight_per_unit] : 0),
      carton_spec: String(mapping.carton_spec ? (r[mapping.carton_spec] ?? '') : '').trim(),
      carton_type: normalizeCartonType(mapping.carton_type ? (r[mapping.carton_type] ?? '') : ''),
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

    if (!detectedMapping.customer || !detectedMapping.ma_hang || !detectedMapping.pack_qty) {
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
      return { headers, detectedMapping, rows, rawRows: jsonRows, error: 'Không có dòng nào hợp lệ (mỗi dòng cần Khách hàng + Mã hàng + Feature + Số lượng > 0)!' }
    }
    return { headers, detectedMapping, rows, rawRows: jsonRows }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định khi đọc file!'
    return { headers: [], detectedMapping: emptyMapping, rows: [], rawRows: [], error: message }
  }
}

/** Tải file Excel mẫu đúng định dạng Sample.xlsx mới (7 cột chuẩn). */
export function downloadMetadataSampleTemplate(): void {
  const sample = [
    {
      'Khách Hàng': 'Best Chair',
      'Mã hàng': 8100920004,
      'Feature': 1009,
      'Số lượng đóng gói': 220,
      'Trọng trượng/Cái': 1.48,
      'Quy cách thùng': '1470*1135*925',
      'Loại thùng': 'thùng đôi',
    },
    {
      'Khách Hàng': 'Cleverland/ Distribution/West Coast',
      'Mã hàng': 8101010104,
      'Feature': 1010,
      'Số lượng đóng gói': 250,
      'Trọng trượng/Cái': 1.32,
      'Quy cách thùng': '1470*1135*925',
      'Loại thùng': 'thùng đôi',
    },
    {
      'Khách Hàng': 'Stanley/ West Coast',
      'Mã hàng': 8101010104,
      'Feature': 1010,
      'Số lượng đóng gói': 250,
      'Trọng trượng/Cái': 1.32,
      'Quy cách thùng': '1150*1140*460',
      'Loại thùng': 'thùng đơn',
    },
    {
      'Khách Hàng': 'Southern Motion',
      'Mã hàng': 1326810101,
      'Feature': 1326810101,
      'Số lượng đóng gói': 40,
      'Trọng trượng/Cái': 0.666,
      'Quy cách thùng': '475*230*140',
      'Loại thùng': 'phụ kiện',
    },
  ]
  const ws = XLSX.utils.json_to_sheet(sample)
  ws['!cols'] = [{ wch: 32 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Quy cách')
  XLSX.writeFile(wb, 'QuyCach_Template_Mau.xlsx')
}
