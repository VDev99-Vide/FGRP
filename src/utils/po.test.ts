import { describe, it, expect } from 'vitest'
import {
  PO_FLOW_COLORS,
  PO_LINES_MAX,
  buildPoLineProgress,
  buildPoProgress,
  calcPoProgress,
  computePoStats,
  filterPurchaseOrders,
  formatIsoDate,
  getEffectivePoLines,
  getPoProgressLevel,
  hexWithAlpha,
  interpolatePoColor,
  isValidIsoDate,
  normalizePoNo,
  shadeHex,
  sortPoForDisplay,
  sumPoLinesTarget,
  todayIsoDate,
  validateLineReceiptInput,
  validatePoInput,
  validatePoLines,
  validateReceiptInput,
} from './po'
import type { PurchaseOrder, PoReceiptLog } from '@/types'

const makePo = (over: Partial<PurchaseOrder> = {}): PurchaseOrder => ({
  id: 'po-1',
  po_no: 'PO-10000',
  supplier: 'NCC A',
  item_code: '8101010104',
  target_qty: 10000,
  created_date: '2026-09-01',
  status: 'open',
  ...over,
})

const makeLog = (over: Partial<PoReceiptLog> = {}): PoReceiptLog => ({
  id: 'log-1',
  po_id: 'po-1',
  receipt_date: '2026-09-15',
  qty: 1000,
  ...over,
})

describe('getPoProgressLevel (3 ngưỡng màu tự động)', () => {
  it('dưới 50% là danger (đỏ)', () => {
    expect(getPoProgressLevel(0)).toBe('danger')
    expect(getPoProgressLevel(49.99)).toBe('danger')
  })

  it('từ 50% đến dưới 100% là warning (vàng)', () => {
    expect(getPoProgressLevel(50)).toBe('warning')
    expect(getPoProgressLevel(75)).toBe('warning')
    expect(getPoProgressLevel(99.99)).toBe('warning')
  })

  it('từ 100% trở lên là success (xanh lá, kể cả nhập vượt)', () => {
    expect(getPoProgressLevel(100)).toBe('success')
    expect(getPoProgressLevel(120)).toBe('success')
  })

  it('mỗi level đều có màu solid đi kèm', () => {
    expect(PO_FLOW_COLORS.danger.solid).toBe('#FF5A65')
    expect(PO_FLOW_COLORS.warning.solid).toBe('#FDB52A')
    expect(PO_FLOW_COLORS.success.solid).toBe('#14CA74')
  })
})

describe('interpolatePoColor (xanh biển nhạt -> xanh lá theo %)', () => {
  it('0% là xanh nước biển nhạt', () => {
    expect(interpolatePoColor(0)).toBe('#7DD3FC')
  })

  it('100% là xanh lá', () => {
    expect(interpolatePoColor(100)).toBe('#14CA74')
  })

  it('50% là điểm giữa 2 màu', () => {
    expect(interpolatePoColor(50)).toBe('#49CFB8')
  })

  it('màu chuyển dần đều: % càng cao kênh đỏ càng giảm', () => {
    const c25 = interpolatePoColor(25)
    const c75 = interpolatePoColor(75)
    expect(parseInt(c25.slice(1, 3), 16)).toBeGreaterThan(parseInt(c75.slice(1, 3), 16))
  })

  it('kẹp ngoài khoảng 0-100', () => {
    expect(interpolatePoColor(-10)).toBe('#7DD3FC')
    expect(interpolatePoColor(150)).toBe('#14CA74')
  })
})
describe('shadeHex & hexWithAlpha (màu ống sóng nước)', () => {
  it('percent 0 giữ nguyên màu', () => {
    expect(shadeHex('#14CA74', 0)).toBe('#14CA74')
  })

  it('-100 về đen, +100 về trắng', () => {
    expect(shadeHex('#FFFFFF', -100)).toBe('#000000')
    expect(shadeHex('#000000', 100)).toBe('#FFFFFF')
  })

  it('-50 tối một nửa xanh lá', () => {
    expect(shadeHex('#14CA74', -50)).toBe('#0A653A')
  })

  it('hexWithAlpha ra rgba chuẩn', () => {
    expect(hexWithAlpha('#7DD3FC', 0.45)).toBe('rgba(125, 211, 252, 0.45)')
    expect(hexWithAlpha('#14CA74', 2)).toBe('rgba(20, 202, 116, 1)')
  })
})

describe('calcPoProgress', () => {
  it('ví dụ nghiệp vụ: target 10000, đã nhập 2500 -> 25%', () => {
    expect(calcPoProgress(10000, 2500)).toBe(25)
  })

  it('nhập đủ target -> 100%', () => {
    expect(calcPoProgress(10000, 10000)).toBe(100)
  })

  it('target <= 0 thì trả về 0% để tránh chia cho 0', () => {
    expect(calcPoProgress(0, 500)).toBe(0)
    expect(calcPoProgress(-5, 500)).toBe(0)
  })
})

describe('buildPoProgress (cộng dồn log nhập hàng)', () => {
  it('cộng dồn nhiều lần nhập theo thời gian', () => {
    const po = makePo({ target_qty: 10000 })
    const logs = [makeLog({ id: 'l1', qty: 3000 }), makeLog({ id: 'l2', qty: 2000 })]
    const r = buildPoProgress(po, logs)
    expect(r.received_qty).toBe(5000)
    expect(r.remaining_qty).toBe(5000)
    expect(r.progress).toBe(50)
    expect(r.progressCapped).toBe(50)
    expect(r.level).toBe('warning')
    expect(r.status).toBe('open')
    expect(r.receipt_count).toBe(2)
  })

  it('chỉ tính log thuộc đúng PO', () => {
    const po = makePo({ target_qty: 10000 })
    const logs = [makeLog({ qty: 10000 }), makeLog({ id: 'l2', po_id: 'po-khac', qty: 99999 })]
    expect(buildPoProgress(po, logs).received_qty).toBe(10000)
  })

  it('đạt đủ target thì tự đóng PO (completed + success)', () => {
    const po = makePo({ target_qty: 10000 })
    const logs = [makeLog({ qty: 10000 })]
    const r = buildPoProgress(po, logs)
    expect(r.status).toBe('completed')
    expect(r.level).toBe('success')
    expect(r.remaining_qty).toBe(0)
  })

  it('nhập vượt target vẫn completed, % thực giữ nguyên, % hiển thị chặn ở 100', () => {
    const po = makePo({ target_qty: 10000 })
    const logs = [makeLog({ qty: 12000 })]
    const r = buildPoProgress(po, logs)
    expect(r.status).toBe('completed')
    expect(r.progress).toBe(120)
    expect(r.progressCapped).toBe(100)
    expect(r.remaining_qty).toBe(0)
  })

  it('chưa có log nào thì 0% danger và còn nguyên target', () => {
    const r = buildPoProgress(makePo({ target_qty: 10000 }), [])
    expect(r.received_qty).toBe(0)
    expect(r.remaining_qty).toBe(10000)
    expect(r.progress).toBe(0)
    expect(r.level).toBe('danger')
    expect(r.status).toBe('open')
  })
})

describe('computePoStats (thẻ KPI)', () => {
  it('đếm đúng PO chưa hoàn thành / đã giao đủ + tổng target', () => {
    const orders = [
      buildPoProgress(makePo({ id: 'a', target_qty: 10000 }), [makeLog({ po_id: 'a', qty: 10000 })]),
      buildPoProgress(makePo({ id: 'b', target_qty: 5000 }), [makeLog({ po_id: 'b', qty: 1000 })]),
      buildPoProgress(makePo({ id: 'c', target_qty: 2000 }), []),
    ]
    const s = computePoStats(orders)
    expect(s.totalOrders).toBe(3)
    expect(s.completedCount).toBe(1)
    expect(s.openCount).toBe(2)
    expect(s.totalTarget).toBe(17000)
    expect(s.totalReceived).toBe(11000)
    expect(s.overallPercent).toBeCloseTo(64.71, 1)
  })

  it('danh sách rỗng thì mọi chỉ số bằng 0', () => {
    const s = computePoStats([])
    expect(s).toEqual({
      totalOrders: 0,
      openCount: 0,
      completedCount: 0,
      totalTarget: 0,
      totalReceived: 0,
      overallPercent: 0,
    })
  })
})

describe('sortPoForDisplay & filterPurchaseOrders', () => {
  it('PO mở tiến độ cao lên trước, PO xong xuống dưới', () => {
    const orders = [
      buildPoProgress(makePo({ id: 'done', target_qty: 100 }), [makeLog({ po_id: 'done', qty: 100 })]),
      buildPoProgress(makePo({ id: 'low', target_qty: 100 }), [makeLog({ po_id: 'low', qty: 10 })]),
      buildPoProgress(makePo({ id: 'high', target_qty: 100 }), [makeLog({ po_id: 'high', qty: 80 })]),
    ]
    const sorted = sortPoForDisplay(orders)
    expect(sorted.map((o) => o.id)).toEqual(['high', 'low', 'done'])
  })

  it('lọc theo từ khóa và trạng thái', () => {
    const orders = [
      buildPoProgress(makePo({ id: 'a', po_no: 'PO-001', supplier: 'NCC A' }), []),
      buildPoProgress(makePo({ id: 'b', po_no: 'PO-002', supplier: 'NCC B' }), [
        makeLog({ po_id: 'b', qty: 10000 }),
      ]),
    ]
    expect(filterPurchaseOrders(orders, 'ncc a', 'open')).toHaveLength(1)
    expect(filterPurchaseOrders(orders, '', 'completed')).toHaveLength(1)
    expect(filterPurchaseOrders(orders, '', 'open')).toHaveLength(1)
    expect(filterPurchaseOrders(orders, 'khong-co', 'open')).toHaveLength(0)
    expect(filterPurchaseOrders(orders, 'khong-co', 'completed')).toHaveLength(0)
  })
})

describe('validatePoInput & validateReceiptInput', () => {
  it('PO hợp lệ cho qua', () => {
    expect(
      validatePoInput({
        po_no: 'PO-1',
        supplier: 'NCC A',
        item_code: '8101010104',
        target_qty: 10000,
        created_date: '2026-09-15',
      }),
    ).toBeNull()
  })

  it('mục tiêu bỏ trống hoặc <= 0 thì chặn (modal không điền sẵn)', () => {
    const base = { po_no: 'P', supplier: 'N', item_code: 'M', created_date: '2026-09-15' }
    expect(validatePoInput({ ...base, target_qty: '' })).toContain('Mục tiêu')
    expect(validatePoInput({ ...base, target_qty: 0 })).toContain('Mục tiêu')
    expect(validatePoInput({ ...base, target_qty: 10000 })).toBeNull()
  })

  it('bắt lỗi thiếu trường và target sai', () => {
    expect(
      validatePoInput({ po_no: '', supplier: 'N', item_code: 'M', target_qty: 1, created_date: '2026-09-15' }),
    ).toContain('Số PO')
    expect(
      validatePoInput({ po_no: 'P', supplier: '', item_code: 'M', target_qty: 1, created_date: '2026-09-15' }),
    ).toContain('Nhà cung cấp')
    expect(
      validatePoInput({ po_no: 'P', supplier: 'N', item_code: '', target_qty: 1, created_date: '2026-09-15' }),
    ).toContain('Mã hàng')
    expect(
      validatePoInput({ po_no: 'P', supplier: 'N', item_code: 'M', target_qty: 0, created_date: '2026-09-15' }),
    ).toContain('Mục tiêu')
    expect(
      validatePoInput({ po_no: 'P', supplier: 'N', item_code: 'M', target_qty: 5, created_date: '15/09/2026' }),
    ).toContain('Ngày tạo')
  })

  it('bắt lỗi log nhập hàng', () => {
    expect(validateReceiptInput({ qty: 100, receipt_date: '2026-09-15' })).toBeNull()
    expect(validateReceiptInput({ qty: 0, receipt_date: '2026-09-15' })).toContain('Số lượng')
    expect(validateReceiptInput({ qty: 10, receipt_date: 'abc' })).toContain('Ngày nhập')
  })
})

describe('helpers ngày tháng & chuẩn hóa', () => {
  it('normalizePoNo trim + uppercase để chống trùng', () => {
    expect(normalizePoNo('  po-001 ')).toBe('PO-001')
  })

  it('todayIsoDate trả về yyyy-mm-dd', () => {
    expect(todayIsoDate(new Date(2026, 8, 15))).toBe('2026-09-15')
  })

  it('formatIsoDate hiển thị dd/mm/yyyy', () => {
    expect(formatIsoDate('2026-09-15')).toBe('15/09/2026')
  })

  it('isValidIsoDate chặn ngày sai định dạng', () => {
    expect(isValidIsoDate('2026-09-15')).toBe(true)
    expect(isValidIsoDate('15/09/2026')).toBe(false)
    expect(isValidIsoDate('')).toBe(false)
  })
})

describe('T1: PO N sản phẩm (po_lines)', () => {
  it('sumPoLinesTarget cộng dồn đúng', () => {
    expect(sumPoLinesTarget([{ item_code: 'A', target_qty: 4000 }, { item_code: 'B', target_qty: 6000 }])).toBe(10000)
    expect(sumPoLinesTarget([])).toBe(0)
    expect(sumPoLinesTarget(null)).toBe(0)
  })

  it('validatePoLines chặn rỗng / quá max / thiếu mã / target sai', () => {
    expect(validatePoLines([])).toContain('ít nhất 1 sản phẩm')
    expect(validatePoLines([{ item_code: '', target_qty: 10 }])).toContain('Dòng 1')
    expect(validatePoLines([{ item_code: 'A', target_qty: 0 }])).toContain('Dòng 1')
    expect(validatePoLines([{ item_code: 'A', target_qty: 10 }])).toBeNull()
    const many = Array.from({ length: PO_LINES_MAX + 1 }, (_, i) => ({ item_code: `M${i}`, target_qty: 1 }))
    expect(validatePoLines(many)).toContain('Tối đa')
  })

  it('validatePoInput ưu tiên lines: target = sum, vẫn bắt ngày sai', () => {
    expect(
      validatePoInput({
        po_no: 'PO-1',
        supplier: 'NCC',
        item_code: '',
        target_qty: 0,
        created_date: '2026-09-15',
        lines: [
          { item_code: 'A', target_qty: 4000 },
          { item_code: 'B', target_qty: 6000 },
        ],
      }),
    ).toBeNull()
    expect(
      validatePoInput({
        po_no: 'PO-1',
        supplier: 'NCC',
        item_code: '',
        target_qty: 0,
        created_date: '15/09/2026',
        lines: [{ item_code: 'A', target_qty: 10 }],
      }),
    ).toContain('Ngày tạo')
  })

  it('filter tìm được mã trong lines', () => {
    const orders = [
      buildPoProgress(makePo({ id: 'm', po_no: 'PO-M', item_code: 'A', target_qty: 100, lines: [] }), []),
      buildPoProgress(
        makePo({
          id: 'n',
          po_no: 'PO-N',
          item_code: 'B1',
          target_qty: 100,
          lines: [
            { id: 'l1', po_id: 'n', po_no: 'PO-N', item_code: 'B1', target_qty: 60 },
            { id: 'l2', po_id: 'n', po_no: 'PO-N', item_code: 'B2-HEX', target_qty: 40 },
          ],
        }),
        [],
      ),
    ]
    expect(filterPurchaseOrders(orders, 'b2-hex', 'open')).toHaveLength(1)
    expect(filterPurchaseOrders(orders, 'b2-hex', 'open')[0].id).toBe('n')
  })
})

describe('T2: nhập hàng theo từng mã', () => {
  const multiPo = (over: Partial<PurchaseOrder> = {}) =>
    makePo({
      id: 'po-m',
      po_no: 'PO-MULTI',
      item_code: 'A',
      target_qty: 10000,
      lines: [
        { id: 'la', po_id: 'po-m', po_no: 'PO-MULTI', item_code: 'A', description: 'Ghế A', target_qty: 4000 },
        { id: 'lb', po_id: 'po-m', po_no: 'PO-MULTI', item_code: 'B', description: 'Ghế B', target_qty: 6000 },
      ],
      ...over,
    })

  it('getEffectivePoLines: PO cũ không lines -> 1 dòng ảo từ header', () => {
    const lines = getEffectivePoLines(makePo({ id: 'x', item_code: 'M1', target_qty: 500 }))
    expect(lines).toHaveLength(1)
    expect(lines[0].item_code).toBe('M1')
    expect(getEffectivePoLines(multiPo())).toHaveLength(2)
  })

  it('linesProgress chỉ cộng log gán đúng mã, log gộp cũ không tính vào mã nào', () => {
    const logs = [
      makeLog({ id: 'g', po_id: 'po-m', qty: 6000, po_line_id: null }),
      makeLog({ id: 'a1', po_id: 'po-m', qty: 4000, po_line_id: 'la', item_code: 'A' }),
    ]
    const r = buildPoProgress(multiPo(), logs)
    expect(r.linesProgress).toHaveLength(2)
    expect(r.linesProgress.find((l) => l.id === 'la')?.received_qty).toBe(4000)
    expect(r.linesProgress.find((l) => l.id === 'lb')?.received_qty).toBe(0)
    expect(r.legacy_received_qty).toBe(6000)
    expect(r.received_qty).toBe(10000)
  })

  it('PO nhiều mã chưa có log theo mã nào: giữ logic gộp cũ (đủ tổng -> completed)', () => {
    const r = buildPoProgress(multiPo(), [makeLog({ po_id: 'po-m', qty: 10000, po_line_id: null })])
    expect(r.status).toBe('completed')
  })

  it('đã có log theo mã: PO chỉ đóng khi TẤT CẢ mã đủ (tổng đủ nhưng còn mã thiếu vẫn open)', () => {
    const logs = [
      makeLog({ id: 'g', po_id: 'po-m', qty: 6000, po_line_id: null }),
      makeLog({ id: 'a1', po_id: 'po-m', qty: 4000, po_line_id: 'la', item_code: 'A' }),
    ]
    const r = buildPoProgress(multiPo(), logs)
    // Tổng 10000/10000 nhưng mã B mới 0/6000
    expect(r.status).toBe('open')
    const done = buildPoProgress(multiPo(), [
      ...logs,
      makeLog({ id: 'b1', po_id: 'po-m', qty: 6000, po_line_id: 'lb', item_code: 'B' }),
    ])
    expect(done.status).toBe('completed')
    expect(done.linesProgress.every((l) => l.status === 'completed')).toBe(true)
  })

  it('buildPoLineProgress cho PO 1 mã cũ: toàn bộ log PO tính hết vào mã duy nhất', () => {
    const po = makePo({ id: 's', target_qty: 1000 })
    const line = getEffectivePoLines(po)[0]
    const r = buildPoLineProgress(line, [makeLog({ po_id: 's', qty: 400 })])
    expect(r.received_qty).toBe(400)
    expect(r.remaining_qty).toBe(600)
  })

  it('validateLineReceiptInput bắt buộc chọn mã khi PO nhiều mã', () => {
    expect(validateLineReceiptInput({ qty: 10, receipt_date: '2026-09-15', po_line_id: null }, 2)).toContain('chọn mã')
    expect(validateLineReceiptInput({ qty: 10, receipt_date: '2026-09-15', po_line_id: 'la' }, 2)).toBeNull()
    expect(validateLineReceiptInput({ qty: 10, receipt_date: '2026-09-15' }, 1)).toBeNull()
  })
})
