import { describe, it, expect } from 'vitest'
import { filterAccessorySuggestCodes, isExcludedAccessoryCode, mergeAccessorySuggestCodes } from './accessorySuggest'

describe('T5: gợi ý phụ kiện từ metadata (loại 4 số + đầu 8)', () => {
  it('loại (1) 4 số VD 1009', () => {
    expect(isExcludedAccessoryCode('1009')).toBe(true)
  })

  it('loại (2) đầu 8 VD 8101010104', () => {
    expect(isExcludedAccessoryCode('8101010104')).toBe(true)
    expect(isExcludedAccessoryCode('8361120304')).toBe(true)
  })

  it('giữ (3) mã phụ kiện VD 7157150001', () => {
    expect(isExcludedAccessoryCode('7157150001')).toBe(false)
    expect(isExcludedAccessoryCode('990110001000')).toBe(false)
    expect(isExcludedAccessoryCode('1220190004')).toBe(false)
  })

  it('filter loại đúng, sort và dedupe', () => {
    expect(filterAccessorySuggestCodes(['1009', '8101010104', '7157150001', '7157150001', '990110001000'])).toEqual([
      '7157150001',
      '990110001000',
    ])
  })

  it('merge metadata + existing, ưu tiên metadata', () => {
    expect(mergeAccessorySuggestCodes(['7157150001', '1009'], ['OLD-1', '7157150001'])).toEqual([
      '7157150001',
      'OLD-1',
    ])
  })
})
