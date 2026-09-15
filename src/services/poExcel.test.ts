import { describe, it, expect } from 'vitest'
import {
  detectPoColumnMapping,
  mapRowsToPurchaseOrders,
  normalizePoDateCell,
  type PoColumnMapping,
} from './poExcel'

describe('detectPoColumnMapping (nhận diện cột tiếng Việt linh hoạt)', () => {
  it('nhận diện đúng file mẫu chuẩn', () => {
    const m = detectPoColumnMapping(['Số PO', 'Nhà cung cấp', 'Mã hàng', 'Target', 'Ngày tạo'])
    expect(m.po_no).toBe('Số PO')
    expect(m.supplier).toBe('Nhà cung cấp')
    expect(m.item_code).toBe('Mã hàng')
    expect(m.target_qty).toBe('Target')
    expect(m.created_date).toBe('Ngày tạo')
  })

  it('nhận diện tiêu đề viết kiểu khác (không dấu / tiếng Anh)', () => {
    const m = detectPoColumnMapping(['PO', 'NCC', 'ITEM CODE', 'SO LUONG', 'NGAY'])
    expect(m.po_no).toBe('PO')
    expect(m.supplier).toBe('NCC')
    expect(m.item_code).toBe('ITEM CODE')
    expect(m.target_qty).toBe('SO LUONG')
    expect(m.created_date).toBe('NGAY')
  })

  it('không nhầm cột "Số PO" với cột khác chứa chữ po', () => {
    const m = detectPoColumnMapping(['Số PO', 'Support Note', 'Target'])
    expect(m.po_no).toBe('Số PO')
  })
})

describe('normalizePoDateCell', () => {
  it('chuỗi dd/mm/yyyy -> yyyy-mm-dd', () => {
    expect(normalizePoDateCell('15/09/2026')).toBe('2026-09-15')
  })

  it('chuỗi yyyy-mm-dd giữ nguyên', () => {
    expect(normalizePoDateCell('2026-09-15')).toBe('2026-09-15')
  })

  it('ô trống thì mặc định hôm nay', () => {
    const today = new Date()
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate(),
    ).padStart(2, '0')}`
    expect(normalizePoDateCell('')).toBe(expected)
  })
})

describe('mapRowsToPurchaseOrders', () => {
  const mapping: PoColumnMapping = {
    po_no: 'Số PO',
    supplier: 'Nhà cung cấp',
    item_code: 'Mã hàng',
    target_qty: 'Target',
    created_date: 'Ngày tạo',
  }

  it('ánh xạ đúng và lọc dòng thiếu Số PO / Target', () => {
    const rows = mapRowsToPurchaseOrders(
      [
        { 'Số PO': 'PO-001', 'Nhà cung cấp': 'NCC A', 'Mã hàng': '8101010104', Target: 10000, 'Ngày tạo': '15/09/2026' },
        { 'Số PO': '', 'Nhà cung cấp': 'NCC B', 'Mã hàng': 'X', Target: 5000, 'Ngày tạo': '' },
        { 'Số PO': 'PO-003', 'Nhà cung cấp': 'NCC C', 'Mã hàng': 'Y', Target: 0, 'Ngày tạo': '' },
      ],
      mapping,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      po_no: 'PO-001',
      supplier: 'NCC A',
      item_code: '8101010104',
      target_qty: 10000,
      created_date: '2026-09-15',
    })
  })
})
