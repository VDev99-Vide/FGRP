import { describe, it, expect } from 'vitest'
import { detectColumnMapping, resolvePreviewWithMetadata, calcPreviewPkg } from './forecastExcel'

describe('detectColumnMapping (chuẩn mới: PO/SO/Item/Qty/Date, PCS+Feature từ metadata)', () => {
  it('tự động nhận diện file mẫu mới (không có Pcs/pkg, Feature)', () => {
    const headers = [
      'PO',
      'SO',
      'LPVN Item code',
      'Loading date',
      'Qty',
    ]

    const mapping = detectColumnMapping(headers)
    expect(mapping.item_code).toBe('LPVN Item code')
    expect(mapping.loading_date).toBe('Loading date')
    expect(mapping.qty).toBe('Qty')
    expect(mapping.po).toBe('PO')
    expect(mapping.so).toBe('SO')
    // File mới không có PCS/pkg -> để trống, resolve từ metadata
    expect(mapping.pcs_per_pkg).toBe('')
  })

  it('vẫn tương thích file cũ có Pcs/pkg (optional)', () => {
    const headers = [
      'LPVN Item code',
      'Loading Date',
      'Qty',
      'Pcs/pkg',
      'PO',
      'SO',
      'Container No'
    ]

    const mapping = detectColumnMapping(headers)
    expect(mapping.item_code).toBe('LPVN Item code')
    expect(mapping.pcs_per_pkg).toBe('Pcs/pkg')
    expect(mapping.container_no).toBe('Container No')
  })

  it('nhận diện các tiêu đề tiếng Việt', () => {
    const headers = [
      'Mã hàng',
      'Ngày đóng hàng',
      'Số lượng',
      'Mã PO',
      'Mã SO'
    ]

    const mapping = detectColumnMapping(headers)
    expect(mapping.item_code).toBe('Mã hàng')
    expect(mapping.loading_date).toBe('Ngày đóng hàng')
    expect(mapping.qty).toBe('Số lượng')
    expect(mapping.po).toBe('Mã PO')
    expect(mapping.so).toBe('Mã SO')
  })
})

describe('resolvePreviewWithMetadata (Feature + PCS từ metadata)', () => {
  const specs = [
    { ma_hang: '8100920004', feature: '1009', pack_qty: 220, carton_type: 'thùng đôi', carton_spec: '1470*1135*925' },
    { ma_hang: '1326810101', feature: '1326810101', pack_qty: 40, carton_type: 'phụ kiện', carton_spec: '475*230*140' },
  ]
  it('mã có metadata -> resolve đúng, mã thiếu -> tag Thiếu Meta-data', () => {
    const rows = resolvePreviewWithMetadata(
      [
        { po: 'P', so: 'S', item_code: '8100920004', loading_date: '10/09/2026', qty: 2200, pcs_per_pkg: 0 } as never,
        { po: 'P', so: 'S', item_code: 'KHONG-CO', loading_date: '10/09/2026', qty: 100, pcs_per_pkg: 0, feature: 'XXXX' } as never,
      ],
      specs,
    )
    expect(rows[0].resolvedFeature).toBe('1009')
    expect(rows[0].resolvedPackQty).toBe(220)
    expect(rows[0].missingMetadata).toBe(false)
    expect(rows[1].missingMetadata).toBe(true)
  })

  it('phụ kiện resolve từ metadata (không cần cột Feature trong file)', () => {
    const rows = resolvePreviewWithMetadata(
      [{ po: 'P', so: 'S', item_code: '1326810101', loading_date: '10/09/2026', qty: 80, pcs_per_pkg: 0 } as never],
      specs,
    )
    expect(rows[0].is_accessory).toBe(true)
    expect(rows[0].resolvedPackQty).toBe(40)
  })

  it('1010 calc theo đơn/đôi do user chọn', () => {
    const row = {
      item_code: '8101010104', qty: 500, pcs_per_pkg: 0, resolvedPackQty: 250, resolvedCartonType: 'thùng đôi',
      is_accessory: false, is1010: true,
    } as never
    expect(calcPreviewPkg(row, 'thùng đôi')).toBe(1) // 500/2/250
    expect(calcPreviewPkg(row, 'thùng đơn')).toBe(2) // 500/250
  })
})

describe('parseForecastExcelFile with actual September shipment excel file', () => {
  it('đọc và phân tích chính xác file September shipment -update SEP10.xlsx (nếu có)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(process.cwd(), 'September shipment -update SEP10.xlsx')

    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath)
      const { parseForecastExcelFile } = await import('./forecastExcel')
      const result = await parseForecastExcelFile(buffer)

      expect(result.error).toBeUndefined()
      expect(result.rows.length).toBeGreaterThan(0)
      expect(result.detectedMapping.item_code).toBeTruthy()
      expect(result.detectedMapping.qty).toBeTruthy()

      // Kiểm tra có chứa mã đặc biệt 1220
      const hasSpecial1220 = result.rows.some(r => r.is_special && r.feature === '1220')
      expect(hasSpecial1220).toBe(true)
    }
  })
})
