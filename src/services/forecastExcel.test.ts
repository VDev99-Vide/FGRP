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
})
