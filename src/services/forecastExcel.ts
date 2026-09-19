import * as XLSX from 'xlsx'
import {
  extractFeatureFromItemCode,
  formatLoadingDate,
  isSpecialStockCode,
  ForecastRawItem
} from '@/utils/forecast'
import { isCode1010 } from '@/utils/packingSpec'

export interface ColumnMapping {
  item_code: string
  loading_date: string
  qty: string
  pcs_per_pkg: string
  po: string
  so: string
  container_no?: string
  feature_or_accessory?: string
}

export interface ParseExcelResult {
  headers: string[]
  detectedMapping: ColumnMapping
  rows: ForecastRawItem[]
  error?: string
}

export interface MetadataSpecForForecast {
  ma_hang?: string
  feature?: string
  item_code?: string
  pack_qty: number
  carton_type: string
  carton_spec?: string
}

export interface ResolvedPreviewRow extends ForecastRawItem {
  resolvedFeature: string
  resolvedPackQty: number
  resolvedCartonType: string
  resolvedCartonSpec: string
  fromMetadata: boolean
  missingMetadata: boolean
  is1010: boolean
}

// Chuẩn hóa tên cột để so khớp không phân biệt hoa thường, dấu tiếng Việt, dấu cách, ký tự đặc biệt
function normalizeHeaderName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

/**
 * Tự động nhận diện cột tương ứng từ danh sách tiêu đề cột trong file Excel
 * Chuẩn mới: chỉ cần PO, SO, LPVN Item code, Loading date, Qty (+ Container optional).
 * PCS/pkg và Feature KHÔNG còn trong file — tham chiếu metadata ở preview.
 * Vẫn nhận diện pcs_per_pkg / feature_or_accessory nếu file cũ còn để tương thích.
 */
export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    item_code: '',
    loading_date: '',
    qty: '',
    pcs_per_pkg: '',
    po: '',
    so: '',
    container_no: '',
    feature_or_accessory: ''
  }

  const normHeaders = headers.map(h => ({
    original: h,
    norm: normalizeHeaderName(h)
  }))

  // 1. Item Code
  const itemCodePatterns = ['lpvnitemcode', 'itemcode', 'mahang', 'masanpham', 'stockcode', 'lpno', 'partnumber', 'partno', 'code', 'item']
  for (const pattern of itemCodePatterns) {
    const found = normHeaders.find(h => h.norm.includes(pattern))
    if (found) {
      mapping.item_code = found.original
      break
    }
  }

  // 2. Loading Date
  const datePatterns = ['loadingdate', 'loading', 'ngaydonghang', 'ngayxuat', 'ngayloading', 'etd', 'shipdate', 'shipmentdate', 'date', 'ngay']
  for (const pattern of datePatterns) {
    const found = normHeaders.find(h => h.norm.includes(pattern))
    if (found) {
      mapping.loading_date = found.original
      break
    }
  }

  // 3. Qty
  const qtyPatterns = ['qty', 'quantity', 'soluong', 'tongxuat', 'actual', 'pcs', 'soluongxuat', 'amount', 'total']
  for (const pattern of qtyPatterns) {
    const found = normHeaders.find(h => h.norm === pattern || h.norm.includes(pattern))
    if (found) {
      mapping.qty = found.original
      break
    }
  }

  // 4. Pcs/pkg (optional — file mới không có, chỉ để tương thích file cũ)
  const pkgPatterns = ['pcspkg', 'pcsperpkg', 'quycach', 'quycachdonggoi', 'packing', 'pcsctn', 'pcscarton', 'pcskien', 'packsize', 'pkgqty']
  for (const pattern of pkgPatterns) {
    const found = normHeaders.find(h => h.norm.includes(pattern))
    if (found) {
      mapping.pcs_per_pkg = found.original
      break
    }
  }

  // 5. PO
  const poPatterns = ['ponumber', 'purchaseno', 'purchaseorder', 'mapo', 'po']
  for (const pattern of poPatterns) {
    const found = normHeaders.find(h => h.norm === pattern || h.norm.startsWith(pattern) || h.norm.endsWith(pattern))
    if (found) {
      mapping.po = found.original
      break
    }
  }

  // 6. SO
  const soPatterns = ['sonumber', 'salesorder', 'maso', 'so']
  for (const pattern of soPatterns) {
    const found = normHeaders.find(h => h.norm === pattern || h.norm.startsWith(pattern) || h.norm.endsWith(pattern))
    if (found) {
      mapping.so = found.original
      break
    }
  }

  // 7. Container
  const contPatterns = ['containerno', 'container', 'contno', 'socont', 'socontainer', 'cont']
  for (const pattern of contPatterns) {
    const found = normHeaders.find(h => h.norm.includes(pattern))
    if (found) {
      mapping.container_no = found.original
      break
    }
  }

  // 8. Cột nhận diện Accessories / Feature (optional — file mới không có)
  const featPatterns = ['feature', 'accessories', 'accessory', 'phukien', 'loaihang', 'itemtype', 'type', 'remark', 'note', 'column1']
  for (const pattern of featPatterns) {
    const found = normHeaders.find(h => h.norm === pattern || h.norm.includes(pattern))
    if (found) {
      mapping.feature_or_accessory = found.original
      break
    }
  }

  return mapping
}

/**
 * Đọc và chuẩn hóa dữ liệu từ file Excel (.xlsx / .xls)
 * Chuẩn mới: chỉ yêu cầu Item code + Loading date + Qty (+ PO/SO). PCS/pkg + Feature resolve từ metadata ở tầng preview.
 */
export async function parseForecastExcelFile(file: File | ArrayBuffer | Uint8Array): Promise<ParseExcelResult> {
  try {
    let buffer: ArrayBuffer | Uint8Array
    if (file instanceof ArrayBuffer || file instanceof Uint8Array) {
      buffer = file
    } else if (file && typeof (file as any).arrayBuffer === 'function') {
      buffer = await (file as any).arrayBuffer()
    } else {
      throw new Error('Định dạng file không hỗ trợ')
    }

    const workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: true,
      cellNF: false,
      cellText: false
    })

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { headers: [], detectedMapping: {} as any, rows: [], error: 'File Excel không có sheet nào!' }
    }

    // Ưu tiên sheet 'Data-full info.' nếu có (như file mẫu của nhà máy), ngược lại lấy sheet đầu tiên
    const targetSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('data-full') || n.toLowerCase().includes('data')) || workbook.SheetNames[0]
    const worksheet = workbook.Sheets[targetSheetName]

    // Chuyển sheet thành mảng 2 chiều để quét tìm dòng tiêu đề
    const rawMatrix = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, blankrows: false })
    if (!rawMatrix || rawMatrix.length === 0) {
      return { headers: [], detectedMapping: {} as any, rows: [], error: 'Sheet Excel trống!' }
    }

    // Tìm dòng header tốt nhất (dòng chứa ít nhất 2 từ khóa quen thuộc)
    let headerRowIndex = 0
    let maxMatchCount = 0

    for (let r = 0; r < Math.min(10, rawMatrix.length); r++) {
      const row = rawMatrix[r]
      if (!Array.isArray(row)) continue

      let matchCount = 0
      row.forEach(cell => {
        const norm = normalizeHeaderName(String(cell || ''))
        if (norm.includes('code') || norm.includes('item') || norm.includes('po') ||
            norm.includes('so') || norm.includes('qty') || norm.includes('date') ||
            norm.includes('pkg') || norm.includes('pack') || norm.includes('feature')) {
          matchCount++
        }
      })

      if (matchCount > maxMatchCount) {
        maxMatchCount = matchCount
        headerRowIndex = r
      }
    }

    const rawHeaders = (rawMatrix[headerRowIndex] || []).map(cell => String(cell || '').trim()).filter(Boolean)
    const detectedMapping = detectColumnMapping(rawHeaders)

    // Đọc lại sheet theo header tìm được
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      range: headerRowIndex,
      raw: false,
      dateNF: 'dd/mm/yyyy'
    })

    const rows: ForecastRawItem[] = []
    let defaultIndex = 1

    jsonRows.forEach(row => {
      // Trích xuất giá trị dựa trên mapping (chuẩn mới: pcs/pkg optional)
      const itemCodeRaw = detectedMapping.item_code ? row[detectedMapping.item_code] : ''
      if (!itemCodeRaw || String(itemCodeRaw).trim() === '') return // Bỏ qua dòng trống mã hàng

      const itemCode = String(itemCodeRaw).trim()
      const loadingDateRaw = detectedMapping.loading_date ? row[detectedMapping.loading_date] : ''
      const loadingDate = formatLoadingDate(loadingDateRaw)

      const qtyRaw = detectedMapping.qty ? row[detectedMapping.qty] : 0
      const qty = Math.abs(parseFloat(String(qtyRaw || 0).replace(/,/g, ''))) || 0

      // PCS/pkg optional (file mới không có -> 0, resolve từ metadata ở preview)
      const pcsPerPkgRaw = detectedMapping.pcs_per_pkg ? row[detectedMapping.pcs_per_pkg] : 0
      const pcsPerPkg = Math.abs(parseFloat(String(pcsPerPkgRaw || 0).replace(/,/g, ''))) || 0

      const po = detectedMapping.po ? String(row[detectedMapping.po] || `PO-${defaultIndex}`).trim() : `PO-${defaultIndex}`
      const so = detectedMapping.so ? String(row[detectedMapping.so] || `SO-${defaultIndex}`).trim() : `SO-${defaultIndex}`
      const containerNo = detectedMapping.container_no ? String(row[detectedMapping.container_no] || '').trim() : ''

      // Cột nhận diện Accessories / Feature (optional — file mới không có, resolve từ metadata)
      const featRaw = detectedMapping.feature_or_accessory ? String(row[detectedMapping.feature_or_accessory] || '').trim() : ''
      const featLower = featRaw.toLowerCase()
      const isAccessoryFromFile = featLower.includes('acc') // "accessories", "accessory"
      const isBox = featLower === 'box' || featLower.includes('box')
      const isSpecial = isSpecialStockCode(itemCode) || featLower.includes('special')
      // Feature tạm (fallback MID) — sẽ được resolve lại từ metadata ở preview
      const feature = extractFeatureFromItemCode(itemCode, isAccessoryFromFile)
      const unitType: 'kien' | 'thung' = isAccessoryFromFile ? 'thung' : 'kien'

      rows.push({
        po: po || `PO-${defaultIndex}`,
        so: so || `SO-${defaultIndex}`,
        container_no: containerNo,
        item_code: itemCode,
        feature,
        loading_date: loadingDate,
        qty,
        pcs_per_pkg: pcsPerPkg,
        pkg: 0, // Sẽ được tính toán phân nhóm (theo metadata)
        is_accessory: isAccessoryFromFile,
        is_special: isSpecial,
        is_box: isBox,
        unit_type: unitType,
        status: 'pending'
      })

      defaultIndex++
    })

    return {
      headers: rawHeaders,
      detectedMapping,
      rows
    }
  } catch (err: any) {
    return {
      headers: [],
      detectedMapping: {} as any,
      rows: [],
      error: err.message || 'Lỗi đọc file Excel!'
    }
  }
}

/**
 * Resolve preview rows với metadata (hiển thị Feature + PCS/pkg + Loại thùng trực tiếp từ metadata).
 * - Nếu mã có trong metadata (ma_hang exact): feature/pack/carton từ metadata, fromMetadata=true.
 * - Nếu thiếu: giữ fallback MID + pcs từ file (nếu có), missingMetadata=true để gắn tag 'Thiếu Meta-data'.
 * - 1010: is1010=true để modal hỏi chọn đơn/đôi.
 */
export function resolvePreviewWithMetadata(
  rows: ForecastRawItem[],
  specs: MetadataSpecForForecast[] | null | undefined,
): ResolvedPreviewRow[] {
  const list = specs || []
  return rows.map((r) => {
    const code = String(r.item_code || '').trim()
    const hit = list.find((s) => String(s.ma_hang || '').trim() === code)
    if (hit) {
      const feat = String(hit.feature || hit.item_code || r.feature || '').trim() || String(r.feature || '')
      const isAcc = (() => {
        const ct = String(hit.carton_type || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        if (ct.includes('phu kien') || ct.includes('phukien') || ct.includes('carton') || ct.includes('plywood') || ct.includes('box')) return true
        return false
      })()
      return {
        ...r,
        feature: feat,
        pcs_per_pkg: Number(hit.pack_qty) || Number(r.pcs_per_pkg) || 0,
        is_accessory: isAcc,
        unit_type: isAcc ? 'thung' : 'kien',
        resolvedFeature: feat,
        resolvedPackQty: Number(hit.pack_qty) || 0,
        resolvedCartonType: String(hit.carton_type || ''),
        resolvedCartonSpec: String(hit.carton_spec || ''),
        fromMetadata: true,
        missingMetadata: false,
        is1010: isCode1010(code),
      }
    }
    // Thiếu metadata: thử tra theo feature (dạng cũ) để lấy pack nếu có
    const featFallback = String(r.feature || '').trim()
    const hitFeat = featFallback ? list.find((s) => String(s.feature || s.item_code || '').trim() === featFallback) : undefined
    if (hitFeat && Number(hitFeat.pack_qty) > 0) {
      return {
        ...r,
        resolvedFeature: featFallback,
        resolvedPackQty: Number(hitFeat.pack_qty),
        resolvedCartonType: String(hitFeat.carton_type || ''),
        resolvedCartonSpec: String(hitFeat.carton_spec || ''),
        fromMetadata: true,
        missingMetadata: false,
        is1010: code === '8101010104' || code === '8101020104',
      }
    }
    return {
      ...r,
      resolvedFeature: String(r.feature || ''),
      resolvedPackQty: Number(r.pcs_per_pkg) || 0,
      resolvedCartonType: '',
      resolvedCartonSpec: '',
      fromMetadata: false,
      missingMetadata: true,
      is1010: isCode1010(code),
    }
  })
}

/**
 * Tính số kiện preview cho 1 row đã resolve (dùng để hiển thị, group chính tính lại sau import).
 * - Phụ kiện: qty/pack. Đơn: qty/pack. Đôi: qty/2/pack (với 1010 đôi theo preferred).
 * - 1010 đơn/đôi do user chọn trong modal (preferred1010Type).
 */
export function calcPreviewPkg(row: ResolvedPreviewRow, preferred1010Type: string = 'thùng đôi'): number {
  const qty = Number(row.qty) || 0
  const pack = Number(row.resolvedPackQty) || Number(row.pcs_per_pkg) || 0
  if (pack <= 0 || qty <= 0) return 0
  if (row.is_accessory) return Math.round((qty / pack) * 100) / 100
  if (row.is1010) {
    const wantSingle = String(preferred1010Type).toLowerCase().includes('đơn') || String(preferred1010Type).toLowerCase().normalize('NFD').includes('don')
    if (wantSingle) return Math.round((qty / pack) * 100) / 100
    return Math.round((qty / 2 / pack) * 100) / 100
  }
  const ct = String(row.resolvedCartonType || '')
  const single = /thùng đơn/i.test(ct) || ct.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes('don')
  if (single) return Math.round((qty / pack) * 100) / 100
  // Mặc định đôi khi có metadata, fallback cũ khi thiếu: đơn lẻ không /2? Preview group tính lại, ở đây tính per-row đôi nếu >=? Giữ đơn giản: nếu thiếu metadata, qty/pack
  if (row.missingMetadata) return Math.round((qty / (pack || 1)) * 100) / 100
  return Math.round((qty / 2 / pack) * 100) / 100
}

/**
 * Tạo và tải xuống file Excel mẫu (.xlsx) CHUẨN MỚI:
 * Chỉ gồm PO, SO, LPVN Item code, Loading date, Qty (+ Container optional).
 * PCS/pkg và Feature THAM CHIẾU metadata (không có trong file).
 */
export function downloadForecastSampleTemplate() {
  const sampleData = [
    {
      'PO': '0N64-0003004870',
      'SO': '2610000099',
      'LPVN Item code': '1220190004',
      'Loading date': '17/09/2026',
      'Qty': 4400,
    },
    {
      'PO': '0N64-0003004870',
      'SO': '2610000099',
      'LPVN Item code': '1220200004',
      'Loading date': '17/09/2026',
      'Qty': 4400,
    },
    {
      'PO': '64853',
      'SO': '2610000112',
      'LPVN Item code': '8515210204',
      'Loading date': '14/09/2026',
      'Qty': 1750,
    },
    {
      'PO': '64853',
      'SO': '2610000112',
      'LPVN Item code': '8515220204',
      'Loading date': '14/09/2026',
      'Qty': 1750,
    },
    {
      'PO': '64853',
      'SO': '2610000112',
      'LPVN Item code': '1325730001',
      'Loading date': '14/09/2026',
      'Qty': 1750,
    },
    {
      'PO': '64853',
      'SO': '2610000112',
      'LPVN Item code': '1326830101',
      'Loading date': '14/09/2026',
      'Qty': 1750,
    },
    {
      'PO': '93957',
      'SO': '2610000145',
      'LPVN Item code': '8869510104',
      'Loading date': '12/09/2026',
      'Qty': 1508,
    },
    {
      'PO': '93957',
      'SO': '2610000145',
      'LPVN Item code': '8869520104',
      'Loading date': '12/09/2026',
      'Qty': 1508,
    },
    {
      'PO': '93957',
      'SO': '2610000145',
      'LPVN Item code': '1455350001',
      'Loading date': '12/09/2026',
      'Qty': 1700,
    }
  ]

  const ws = XLSX.utils.json_to_sheet(sampleData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data-full info.')
  XLSX.writeFile(wb, 'Mau_Xuat_Hang_Du_Kien.xlsx')
}
