import { describe, it, expect, beforeEach } from 'vitest'
import { PO_DRAFT_KEY, clearPoDraft, loadPoDraft, savePoDraft } from './poDraft'

describe('T1: poDraft sessionStorage (tự xóa khi đóng browser)', () => {
  beforeEach(() => {
    try {
      sessionStorage.clear()
    } catch {
      // noop (môi trường không có sessionStorage thì các test dưới tự skip qua null)
    }
  })

  it('save rồi load khôi phục đủ lines', () => {
    if (typeof sessionStorage === 'undefined') return
    savePoDraft({
      po_no: 'PO-1',
      supplier: 'NCC',
      note: '',
      created_date: '2026-09-16',
      lines: [{ item_code: 'A', target_qty: 100 }],
    })
    const d = loadPoDraft()
    expect(d?.po_no).toBe('PO-1')
    expect(d?.lines).toHaveLength(1)
    expect(sessionStorage.getItem(PO_DRAFT_KEY)).toContain('PO-1')
  })

  it('clear xóa nháp', () => {
    if (typeof sessionStorage === 'undefined') return
    savePoDraft({ po_no: 'X', supplier: 'Y', note: '', created_date: '2026-09-16', lines: [] })
    clearPoDraft()
    expect(loadPoDraft()).toBeNull()
  })

  it('KHÔNG dùng localStorage cho draft PO', () => {
    if (typeof sessionStorage !== 'undefined' && typeof localStorage !== 'undefined') {
      savePoDraft({ po_no: 'K', supplier: 'S', note: '', created_date: '2026-09-16', lines: [] })
      expect(localStorage.getItem(PO_DRAFT_KEY)).toBeNull()
      clearPoDraft()
    }
  })
})
