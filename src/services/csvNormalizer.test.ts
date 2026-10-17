import { describe, it, expect } from 'vitest'
import { formatDateValue, normalizeCsvData, findDuplicateInventoryRows } from './csvNormalizer'

describe('csvNormalizer - formatDateValue', () => {
  it('chuyển đổi số serial date của Excel (46201) thành dd/mm/yyyy (28/06/2026)', () => {
    expect(formatDateValue(46201)).toBe('28/06/2026')
    expect(formatDateValue('46201')).toBe('28/06/2026')
    expect(formatDateValue('46201.5')).toBe('28/06/2026')
  })

  it('chuyển đổi Date object (từ XLSX cellDates: true) thành dd/mm/yyyy', () => {
    const d = new Date('2026-06-28T00:00:00.000Z')
    expect(formatDateValue(d)).toBe('28/06/2026')
  })

  it('chuyển đổi định dạng ISO YYYY-MM-DD thành dd/mm/yyyy', () => {
    expect(formatDateValue('2026-06-28')).toBe('28/06/2026')
    expect(formatDateValue('2026-10-09T03:00:00Z')).toBe('09/10/2026')
  })

  it('giữ nguyên chuỗi ngày đã là dd/mm/yyyy', () => {
    expect(formatDateValue('28/06/2026')).toBe('28/06/2026')
  })

  it('trả về rỗng cho giá trị rỗng/null/undefined', () => {
    expect(formatDateValue('')).toBe('')
    expect(formatDateValue(null)).toBe('')
    expect(formatDateValue(undefined)).toBe('')
  })
})

describe('csvNormalizer - normalizeCsvData', () => {
  it('chuẩn hóa master_data chứa số serial date và các biến thể cột', () => {
    const raw = [
      {
        'Batch': 'TAG100',
        'LP.No': '1220190004',
        'Qty': '250',
        'Warehouse': '60',
        'Create Date': 46201
      }
    ]
    const normalized = normalizeCsvData(raw, 'master_data')
    expect(normalized).toHaveLength(1)
    expect(normalized[0].batch).toBe('TAG100')
    expect(normalized[0].stock_code).toBe('1220190004')
    expect(normalized[0].qty).toBe(250)
    expect(normalized[0].warehouse).toBe('60')
    expect(normalized[0].create_date).toBe('28/06/2026')
  })

  it('chuẩn hóa inventory chứa tag_id và bin', () => {
    const raw = [
      {
        'Mã kiện': 'TAG999',
        'Vị trí': 'BIN-A1'
      }
    ]
    const normalized = normalizeCsvData(raw, 'inventory')
    expect(normalized).toHaveLength(1)
    expect(normalized[0].tag_id).toBe('TAG999')
    expect(normalized[0].bin).toBe('BIN-A1')
  })
})

describe('csvNormalizer - findDuplicateInventoryRows (chặn file trùng Tag ID + Bin)', () => {
  it('phát hiện đúng nhóm trùng và số dòng dư', () => {
    const info = findDuplicateInventoryRows([
      { tag_id: 'T1', bin: 'B1' },
      { tag_id: 'T1', bin: 'B1' },
      { tag_id: 'T2', bin: 'B1' },
      { tag_id: 'T3', bin: 'B2' },
      { tag_id: 'T3', bin: 'B2' },
      { tag_id: 'T3', bin: 'B2' }
    ])
    expect(info.duplicateGroups).toBe(2)
    expect(info.duplicateRows).toBe(3) // (2-1) + (3-1)
    expect(info.samples[0]).toMatchObject({ tag_id: 'T3', bin: 'B2', count: 3 })
  })

  it('cùng Tag ID nhưng khác Bin KHÔNG coi là trùng', () => {
    const info = findDuplicateInventoryRows([
      { tag_id: 'T1', bin: 'B1' },
      { tag_id: 'T1', bin: 'B2' }
    ])
    expect(info.duplicateGroups).toBe(0)
    expect(info.duplicateRows).toBe(0)
  })

  it('trim khoảng trắng trước khi so trùng, bỏ qua dòng không có tag_id', () => {
    const info = findDuplicateInventoryRows([
      { tag_id: ' T1 ', bin: ' B1 ' },
      { tag_id: 'T1', bin: 'B1' },
      { tag_id: '', bin: 'B9' }
    ])
    expect(info.duplicateGroups).toBe(1)
    expect(info.duplicateRows).toBe(1)
  })
})
