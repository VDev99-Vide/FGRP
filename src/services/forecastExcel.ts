import * as XLSX from 'xlsx'
import { 
  extractFeatureFromItemCode, 
  formatLoadingDate, 
  isSpecialStockCode,
  ForecastRawItem 
} from '@/utils/forecast'

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

  // 4. Pcs/pkg
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

  // 8. Cột nhận diện Accessories / Feature
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
      // Trích xuất giá trị dựa trên mapping
      const itemCodeRaw = row[detectedMapping.item_code] || ''
      if (!itemCodeRaw || String(itemCodeRaw).trim() === '') return // Bỏ qua dòng trống mã hàng

      const itemCode = String(itemCodeRaw).trim()
      const loadingDateRaw = row[detectedMapping.loading_date] || ''
      const loadingDate = formatLoadingDate(loadingDateRaw)
      
      const qtyRaw = row[detectedMapping.qty]
      const qty = Math.abs(parseFloat(String(qtyRaw || 0).replace(/,/g, ''))) || 0

      const pcsPerPkgRaw = row[detectedMapping.pcs_per_pkg]
      const pcsPerPkg = Math.abs(parseFloat(String(pcsPerPkgRaw || 0).replace(/,/g, ''))) || 0

      const po = String(row[detectedMapping.po] || `PO-${defaultIndex}`).trim()
      const so = String(row[detectedMapping.so] || `SO-${defaultIndex}`).trim()
      const containerNo = detectedMapping.container_no ? String(row[detectedMapping.container_no] || '').trim() : ''

      // Cột nhận diện Accessories / Feature
      const featRaw = detectedMapping.feature_or_accessory ? String(row[detectedMapping.feature_or_accessory] || '').trim() : ''
      const featLower = featRaw.toLowerCase()
      const isAccessory = featLower.includes('acc') // "accessories", "accessory"
      const isBox = featLower === 'box' || featLower.includes('box')
      const isSpecial = isSpecialStockCode(itemCode) || featLower.includes('special')
      const feature = extractFeatureFromItemCode(itemCode, isAccessory)
      const unitType: 'kien' | 'thung' = isAccessory ? 'thung' : 'kien'

      rows.push({
        po,
        so,
        container_no: containerNo,
        item_code: itemCode,
        feature,
        loading_date: loadingDate,
        qty,
        pcs_per_pkg: pcsPerPkg,
        pkg: 0, // Sẽ được tính toán phân nhóm
        is_accessory: isAccessory,
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
 * Tạo và tải xuống file Excel mẫu (.xlsx) chuẩn theo file nhà máy:
 * Tham khảo cấu trúc chuẩn từ "September shipment -update SEP10.xlsx" (Sheet: Data-full info.)
 */
export function downloadForecastSampleTemplate() {
  const sampleData = [
    {
      'PO': '0N64-0003004870',
      'SO': '2610000099',
      'LPVN Item code': '1220190004',
      'Loading date': '17/09/2026',
      'Qty': 4400,
      'PCS/pkg': 200,
      'Feature': 'special code'
    },
    {
      'PO': '0N64-0003004870',
      'SO': '2610000099',
      'LPVN Item code': '1220200004',
      'Loading date': '17/09/2026',
      'Qty': 4400,
      'PCS/pkg': 200,
      'Feature': 'special code'
    },
    {
      'PO': '64853',
      'SO': '2610000112',
      'LPVN Item code': '8515210204',
      'Loading date': '14/09/2026',
      'Qty': 1750,
      'PCS/pkg': 70,
      'Feature': ''
    },
    {
      'PO': '64853',
      'SO': '2610000112',
      'LPVN Item code': '8515220204',
      'Loading date': '14/09/2026',
      'Qty': 1750,
      'PCS/pkg': 70,
      'Feature': ''
    },
    {
      'PO': '64853',
      'SO': '2610000112',
      'LPVN Item code': '1325730001',
      'Loading date': '14/09/2026',
      'Qty': 1750,
      'PCS/pkg': 25,
      'Feature': 'accessories'
    },
    {
      'PO': '64853',
      'SO': '2610000112',
      'LPVN Item code': '1326830101',
      'Loading date': '14/09/2026',
      'Qty': 1750,
      'PCS/pkg': 25,
      'Feature': 'accessories'
    },
    {
      'PO': '93957',
      'SO': '2610000145',
      'LPVN Item code': '8869510104',
      'Loading date': '12/09/2026',
      'Qty': 1508,
      'PCS/pkg': 52,
      'Feature': ''
    },
    {
      'PO': '93957',
      'SO': '2610000145',
      'LPVN Item code': '8869520104',
      'Loading date': '12/09/2026',
      'Qty': 1508,
      'PCS/pkg': 52,
      'Feature': ''
    },
    {
      'PO': '93957',
      'SO': '2610000145',
      'LPVN Item code': '1455350001',
      'Loading date': '12/09/2026',
      'Qty': 1700,
      'PCS/pkg': 50,
      'Feature': 'accessories'
    }
  ]

  const ws = XLSX.utils.json_to_sheet(sampleData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data-full info.')
  XLSX.writeFile(wb, 'Mau_Xuat_Hang_Du_Kien.xlsx')
}
