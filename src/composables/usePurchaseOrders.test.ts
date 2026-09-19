import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { usePurchaseOrders } from './usePurchaseOrders'
import { todayIsoDate } from '@/utils/po'

/**
 * Lưu ý: môi trường test có cấu hình Supabase thật. Mỗi test dùng Số PO duy nhất
 * (suffix ngẫu nhiên) và tự dọn dẹp PO đã tạo sau khi chạy để không nhiễm DB dùng chung.
 */
describe('usePurchaseOrders composable', () => {
  let po: ReturnType<typeof usePurchaseOrders>
  let uid: string
  let createdIds: string[]

  const poNo = (prefix: string) => `${prefix}-${uid}`

  const track = (id: string) => {
    createdIds.push(id)
    return id
  }

  const makePo = (prefix: string, target = 10000, extra: Record<string, unknown> = {}) =>
    po.createPurchaseOrder({
      po_no: poNo(prefix),
      supplier: 'NCC A',
      item_code: '8101010104',
      target_qty: target,
      created_date: todayIsoDate(),
      ...extra,
    })

  beforeEach(() => {
    po = usePurchaseOrders()
    po.clearMemory()
    po.searchText.value = ''
    po.statusFilter.value = 'open'
    uid = Math.random().toString(36).slice(2, 8).toUpperCase()
    createdIds = []
  })

  afterEach(async () => {
    for (const id of createdIds) {
      try {
        await po.deletePurchaseOrder(id)
      } catch {
        // bỏ qua lỗi dọn dẹp để không làm fail test chính
      }
    }
    po.clearMemory()
  })

  it('tạo PO mới với đầy đủ NCC + mã hàng + target + ngày tạo', async () => {
    const created = await makePo('PO-T-CREATE')
    track(created.id)
    expect(created.po_no).toBe(poNo('PO-T-CREATE'))
    expect(po.purchaseOrders.value).toHaveLength(1)
    expect(po.stats.value.openCount).toBe(1)
    expect(po.stats.value.completedCount).toBe(0)
  })

  it('chặn trùng số PO (không phân biệt hoa thường / khoảng trắng)', async () => {
    const created = await makePo('PO-T-DUP', 100)
    track(created.id)
    await expect(
      po.createPurchaseOrder({
        po_no: `  ${poNo('PO-T-DUP').toLowerCase()} `,
        supplier: 'NCC B',
        item_code: 'M2',
        target_qty: 200,
        created_date: todayIsoDate(),
      }),
    ).rejects.toThrow('đã tồn tại')
  })

  it('nhập hàng nhiều lần cộng dồn cho đến khi đạt target thì tự đóng PO', async () => {
    const created = await makePo('PO-T-FLOW')
    track(created.id)

    await po.addReceipt(created.id, { receipt_date: todayIsoDate(), qty: 3000, note: 'Đợt 1' })
    await po.addReceipt(created.id, { receipt_date: todayIsoDate(), qty: 4000, note: 'Đợt 2' })

    let progress = po.ordersWithProgress.value.find((o) => o.id === created.id)
    expect(progress?.received_qty).toBe(7000)
    expect(progress?.progress).toBe(70)
    expect(progress?.level).toBe('warning')
    expect(progress?.status).toBe('open')

    await po.addReceipt(created.id, { receipt_date: todayIsoDate(), qty: 3000, note: 'Đợt 3' })
    progress = po.ordersWithProgress.value.find((o) => o.id === created.id)
    expect(progress?.received_qty).toBe(10000)
    expect(progress?.status).toBe('completed')
    expect(po.stats.value.completedCount).toBe(1)
    expect(po.stats.value.openCount).toBe(0)
  })

  it('PO đã đóng thì không cho nhập thêm', async () => {
    const created = await makePo('PO-T-DONE', 100)
    track(created.id)
    await po.addReceipt(created.id, { receipt_date: todayIsoDate(), qty: 100 })
    await expect(po.addReceipt(created.id, { receipt_date: todayIsoDate(), qty: 10 })).rejects.toThrow('đã giao đủ')
  })

  it('xóa log nhập hàng thì PO tự mở lại khi rớt dưới target', async () => {
    const created = await makePo('PO-T-REOPEN', 1000)
    track(created.id)
    const log = await po.addReceipt(created.id, { receipt_date: todayIsoDate(), qty: 1000 })
    expect(po.ordersWithProgress.value.find((o) => o.id === created.id)?.status).toBe('completed')

    await po.deleteReceipt(log.id)
    const progress = po.ordersWithProgress.value.find((o) => o.id === created.id)
    expect(progress?.status).toBe('open')
    expect(progress?.received_qty).toBe(0)
  })

  it('lưu mô tả sản phẩm + ghi chú (tùy chọn) khi tạo và sửa PO', async () => {
    const created = await po.createPurchaseOrder({
      po_no: poNo('PO-T-META'),
      supplier: 'NCC A',
      item_code: 'M1',
      description: 'Ghế gaming',
      note: 'Giao 2 đợt',
      target_qty: 500,
      created_date: todayIsoDate(),
    })
    track(created.id)
    expect(created.description).toBe('Ghế gaming')
    expect(created.note).toBe('Giao 2 đợt')

    const updated = await po.updatePurchaseOrder(created.id, {
      po_no: poNo('PO-T-META'),
      supplier: 'NCC A',
      item_code: 'M1',
      description: 'Ghế văn phòng',
      note: '',
      target_qty: 500,
      created_date: todayIsoDate(),
    })
    expect(updated.description).toBe('Ghế văn phòng')
    expect(updated.note).toBe('')
  })

  it('xóa PO đã giao đủ thì KPI PO Đã Giao Đủ tự cập nhật giảm', async () => {
    const done = await makePo('PO-T-KPI-DONE', 100)
    const open = await makePo('PO-T-KPI-OPEN', 100)
    track(done.id)
    track(open.id)
    await po.addReceipt(done.id, { receipt_date: todayIsoDate(), qty: 100 })
    expect(po.stats.value.completedCount).toBe(1)
    expect(po.stats.value.openCount).toBe(1)

    await po.deletePurchaseOrder(done.id)
    createdIds = createdIds.filter((id) => id !== done.id)
    expect(po.stats.value.completedCount).toBe(0)
    expect(po.stats.value.openCount).toBe(1)
    expect(po.stats.value.totalOrders).toBe(1)
  })

  it('xóa PO thì xóa luôn toàn bộ log đi kèm', async () => {
    const created = await makePo('PO-T-DEL', 1000)
    track(created.id)
    await po.addReceipt(created.id, { receipt_date: todayIsoDate(), qty: 100 })
    await po.deletePurchaseOrder(created.id)
    createdIds = createdIds.filter((id) => id !== created.id)
    expect(po.purchaseOrders.value).toHaveLength(0)
    expect(po.receiptLogs.value).toHaveLength(0)
  })

  it('import Excel: PO mới thì thêm, trùng số PO thì cập nhật', async () => {
    const existing = await makePo('PO-T-IMP1', 1000, { supplier: 'NCC CU', item_code: 'M-CU' })
    track(existing.id)
    const res = await po.importPurchaseOrders([
      { po_no: poNo('PO-T-IMP1'), supplier: 'NCC MOI', item_code: 'M-MOI', description: '', note: '', target_qty: 5000, created_date: todayIsoDate() },
      { po_no: poNo('PO-T-IMP2'), supplier: 'NCC B', item_code: 'M2', description: '', note: '', target_qty: 2000, created_date: todayIsoDate() },
      { po_no: '', supplier: 'NCC X', item_code: 'MX', description: '', note: '', target_qty: 0, created_date: todayIsoDate() },
    ])
    const imp2 = po.purchaseOrders.value.find((p) => p.po_no === poNo('PO-T-IMP2'))
    if (imp2) track(imp2.id)
    expect(res.imported).toBe(2)
    expect(res.skipped).toHaveLength(1)
    // DB dùng chung có thể chứa PO thật của người dùng nên chỉ assert trên PO của test
    const mine = po.purchaseOrders.value.filter((p) => p.po_no.startsWith('PO-T-IMP'))
    expect(mine).toHaveLength(2)
    const updated = po.purchaseOrders.value.find((p) => p.po_no === poNo('PO-T-IMP1'))
    expect(updated?.target_qty).toBe(5000)
    expect(updated?.supplier).toBe('NCC MOI')
  })

  it('lọc PO theo từ khóa và trạng thái', async () => {
    const a = await makePo('PO-T-SRCHA', 100, { supplier: 'NCC ALPHA' })
    const b = await makePo('PO-T-SRCHB', 100, { supplier: 'NCC BETA' })
    track(a.id)
    track(b.id)
    await po.addReceipt(a.id, { receipt_date: todayIsoDate(), qty: 100 })

    po.statusFilter.value = 'completed'
    po.searchText.value = 'alpha'
    expect(po.filteredOrders.value).toHaveLength(1)

    po.searchText.value = ''
    po.statusFilter.value = 'completed'
    expect(po.filteredOrders.value).toHaveLength(1)
    expect(po.filteredOrders.value[0].po_no).toBe(poNo('PO-T-SRCHA'))
  })

  it('validate đầu vào: chặn target <= 0 và ngày sai', async () => {
    await expect(
      po.createPurchaseOrder({ po_no: poNo('PO-T-V'), supplier: 'N', item_code: 'M', target_qty: 0, created_date: todayIsoDate() }),
    ).rejects.toThrow('Mục tiêu')
    const created = await makePo('PO-T-V2', 100)
    track(created.id)
    await expect(po.addReceipt(created.id, { receipt_date: todayIsoDate(), qty: -5 })).rejects.toThrow('Số lượng')
  })

  it('T2: nhập hàng theo từng mã — PO chỉ đóng khi tất cả mã đủ', async () => {
    const created = await po.createPurchaseOrder({
      po_no: poNo('PO-T-LINE'),
      supplier: 'NCC A',
      item_code: 'A',
      target_qty: 1000,
      created_date: todayIsoDate(),
      lines: [
        { item_code: 'MA', description: 'Mô tả A', target_qty: 400 },
        { item_code: 'MB', description: 'Mô tả B', target_qty: 600 },
      ],
    })
    track(created.id)
    const lineA = po.poLines.value.find((l) => l.po_id === created.id && l.item_code === 'MA')
    const lineB = po.poLines.value.find((l) => l.po_id === created.id && l.item_code === 'MB')
    expect(lineA).toBeDefined()
    expect(lineB).toBeDefined()

    // Thiếu chọn mã -> chặn
    await expect(po.addReceipt(created.id, { receipt_date: todayIsoDate(), qty: 100 })).rejects.toThrow('chọn mã')

    await po.addReceipt(created.id, { receipt_date: todayIsoDate(), qty: 400, po_line_id: lineA!.id })
    let progress = po.ordersWithProgress.value.find((o) => o.id === created.id)
    expect(progress?.linesProgress.find((l) => l.id === lineA!.id)?.received_qty).toBe(400)
    expect(progress?.linesProgress.find((l) => l.id === lineB!.id)?.received_qty).toBe(0)
    // Tổng 400/1000 nhưng mã A đủ, mã B thiếu -> PO vẫn mở
    expect(progress?.status).toBe('open')

    // Mã đã đủ không cho nhập thêm
    await expect(
      po.addReceipt(created.id, { receipt_date: todayIsoDate(), qty: 10, po_line_id: lineA!.id }),
    ).rejects.toThrow('đã nhập đủ')

    await po.addReceipt(created.id, { receipt_date: todayIsoDate(), qty: 600, po_line_id: lineB!.id })
    progress = po.ordersWithProgress.value.find((o) => o.id === created.id)
    expect(progress?.status).toBe('completed')
    expect(progress?.linesProgress.every((l) => l.status === 'completed')).toBe(true)
  })
})
