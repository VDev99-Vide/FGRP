/**
 * T1: Nháp modal tạo PO lưu tạm bằng sessionStorage.
 * - Tự xóa khi đóng tab/browser (đúng yêu cầu, chỉ modal tạo PO).
 * - Không dùng localStorage.
 */
import type { PoLineInput } from '@/utils/po'

export const PO_DRAFT_KEY = 'po-draft'

export interface PoDraft {
  po_no: string
  supplier: string
  note: string
  created_date: string
  lines: PoLineInput[]
  savedAt: string
}

const canUseSession = (): boolean => {
  try {
    return typeof sessionStorage !== 'undefined'
  } catch {
    return false
  }
}

export function savePoDraft(draft: Omit<PoDraft, 'savedAt'>): void {
  if (!canUseSession()) return
  try {
    const payload: PoDraft = { ...draft, savedAt: new Date().toISOString() }
    sessionStorage.setItem(PO_DRAFT_KEY, JSON.stringify(payload))
  } catch {
    // Bỏ qua lỗi quota/không khả dụng — không chặn nhập liệu
  }
}

export function loadPoDraft(): PoDraft | null {
  if (!canUseSession()) return null
  try {
    const raw = sessionStorage.getItem(PO_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PoDraft
    if (!parsed || !Array.isArray(parsed.lines)) return null
    return parsed
  } catch {
    return null
  }
}

export function clearPoDraft(): void {
  if (!canUseSession()) return
  try {
    sessionStorage.removeItem(PO_DRAFT_KEY)
  } catch {
    // noop
  }
}
