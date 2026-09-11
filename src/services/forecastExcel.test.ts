import { describe, it, expect } from 'vitest'
import { detectColumnMapping } from './forecastExcel'

describe('detectColumnMapping', () => {
  it('tự động nhận diện các biến thể tên cột LPVN Item code, Loading Date, Qty, Pcs/pkg, PO, SO', () => {
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
    expect(mapping.loading_date).toBe('Loading Date')
    expect(mapping.qty).toBe('Qty')
    expect(mapping.pcs_per_pkg).toBe('Pcs/pkg')
    expect(mapping.po).toBe('PO')
    expect(mapping.so).toBe('SO')
    expect(mapping.container_no).toBe('Container No')
  })

  it('nhận diện các tiêu đề tiếng Việt hoặc viết hoa viết thường khác nhau', () => {
    const headers = [
      'Mã hàng',
      'Ngày đóng hàng',
      'Số lượng',
      'Quy cách đóng gói',
      'Mã PO',
      'Mã SO'
    ]

    const mapping = detectColumnMapping(headers)
    expect(mapping.item_code).toBe('Mã hàng')
    expect(mapping.loading_date).toBe('Ngày đóng hàng')
    expect(mapping.qty).toBe('Số lượng')
    expect(mapping.pcs_per_pkg).toBe('Quy cách đóng gói')
    expect(mapping.po).toBe('Mã PO')
    expect(mapping.so).toBe('Mã SO')
  })

  it('nhận diện cột Feature hoặc Accessories cho hàng phụ kiện', () => {
    const headers = [
      'LPVN Item code',
      'Feature',
      'Loading Date',
      'Qty',
      'Pcs/pkg',
      'PO',
      'SO'
    ]

    const mapping = detectColumnMapping(headers)
    expect(mapping.feature_or_accessory).toBe('Feature')

    const headers2 = [
      'LPVN Item code',
      'Accessories',
      'Loading Date',
      'Qty',
      'Pcs/pkg',
      'PO',
      'SO'
    ]
    const mapping2 = detectColumnMapping(headers2)
    expect(mapping2.feature_or_accessory).toBe('Accessories')
  })
})

describe('parseForecastExcelFile with actual September shipment excel file', () => {
  it('đọc và phân tích chính xác file September shipment -update SEP10.xlsx', async () => {
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
      expect(result.detectedMapping.pcs_per_pkg).toBeTruthy()

      // Kiểm tra có chứa hàng Accessories
      const hasAccessories = result.rows.some(r => r.is_accessory)
      expect(hasAccessories).toBe(true)

      // Kiểm tra có chứa mã đặc biệt 1220
      const hasSpecial1220 = result.rows.some(r => r.is_special && r.feature === '1220')
      expect(hasSpecial1220).toBe(true)

      // Kiểm tra hàng accessories có unit_type là 'thung'
      const accItem = result.rows.find(r => r.is_accessory)
      expect(accItem?.unit_type).toBe('thung')
    }
  })
})
