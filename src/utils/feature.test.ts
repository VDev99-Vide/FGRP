import { describe, it, expect } from 'vitest'
import { extractFeatureFromItemCode, extractFeatureFromStockCode, isSpecialStockCode } from './feature'

describe('T3: feature centralize + hard-code 1220', () => {
  it('1220190004 và 1220200004 đều → 1220 (4 số đầu)', () => {
    expect(extractFeatureFromItemCode('1220190004')).toBe('1220')
    expect(extractFeatureFromItemCode('1220200004')).toBe('1220')
    expect(extractFeatureFromStockCode('1220190004')).toBe('1220')
    expect(isSpecialStockCode('1220190004')).toBe(true)
  })

  it('mã thường MID(2,4): 810090203→1009, 8163210604→1632, 8515210204→5152', () => {
    expect(extractFeatureFromItemCode('810090203')).toBe('1009')
    expect(extractFeatureFromItemCode('8163210604')).toBe('1632')
    expect(extractFeatureFromItemCode('8515210204')).toBe('5152')
  })

  it('phụ kiện giữ nguyên mã, không tách', () => {
    expect(extractFeatureFromItemCode('7157150001', true)).toBe('7157150001')
  })

  it('rỗng / ngắn trả No data hoặc giữ nguyên', () => {
    expect(extractFeatureFromItemCode('')).toBe('No data')
    expect(extractFeatureFromStockCode('No data')).toBe('No data')
  })

  it('re-export từ forecast.ts vẫn cùng kết quả (tương thích ngược)', async () => {
    const f = await import('./forecast')
    expect(f.extractFeatureFromItemCode('1220190004')).toBe('1220')
    expect(f.extractFeatureFromItemCode('810090203')).toBe('1009')
    expect(f.isSpecialStockCode('1220200004')).toBe(true)
  })
})
