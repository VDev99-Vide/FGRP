import { describe, it, expect } from 'vitest'
import { buildPackSpecMap, calcPkgByPackSpec, getPackSpecByFeature, getPackSpecByMaHang, isDoubleBoxType, isSingleBoxType } from './packingSpec'
import { calculateFeaturePkg, groupAndSortForecastData } from './forecast'

describe('T4: packingSpec metadata trung tâm (chuẩn mới ma_hang + feature)', () => {
  const specs = [
    { item_code: '1009', ma_hang: '8100920004', feature: '1009', pack_qty: 220, carton_type: 'thùng đôi' },
    { item_code: '1220', ma_hang: '1220190004', feature: '1220', pack_qty: 200, carton_type: 'thùng đơn' },
    { item_code: '1010', ma_hang: '8101010104', feature: '1010', pack_qty: 250, carton_type: 'thùng đôi', carton_spec: '1470*1135*925' },
    { item_code: '1010', ma_hang: '8101010104', feature: '1010', pack_qty: 250, carton_type: 'thùng đơn', carton_spec: '1150*1140*460' },
  ]

  it('phân biệt thùng đơn/đôi', () => {
    expect(isSingleBoxType('thùng đơn')).toBe(true)
    expect(isSingleBoxType('thùng đôi')).toBe(false)
    expect(isDoubleBoxType('thùng đôi')).toBe(true)
  })

  it('tra cứu đúng feature, thiếu thì missing=true', () => {
    expect(getPackSpecByFeature('1009', specs)).toMatchObject({ pack_qty: 220, missing: false, isSingle: false })
    expect(getPackSpecByFeature('1220', specs)).toMatchObject({ pack_qty: 200, missing: false, isSingle: true })
    expect(getPackSpecByFeature('9999', specs).missing).toBe(true)
    expect(getPackSpecByFeature('1009', []).missing).toBe(true)
  })

  it('1010 mặc định ưu tiên thùng đôi + ước tính, chọn đơn khi preferredType=đơn', () => {
    const dbl = getPackSpecByFeature('1010', specs)
    expect(dbl.isSingle).toBe(false)
    expect(dbl.isEstimated).toBe(true)
    const sgl = getPackSpecByFeature('1010', specs, 'thùng đơn')
    expect(sgl.isSingle).toBe(true)
    expect(sgl.isEstimated).toBeFalsy()
  })

  it('tra cứu theo ma_hang full ưu tiên (chuẩn mới)', () => {
    expect(getPackSpecByMaHang('8100920004', specs, undefined, '1009')).toMatchObject({ pack_qty: 220, missing: false })
    expect(getPackSpecByMaHang('8101010104', specs)).toMatchObject({ pack_qty: 250, missing: false, isSingle: false, isEstimated: true })
    expect(getPackSpecByMaHang('8101010104', specs, 'thùng đơn')).toMatchObject({ isSingle: true })
    expect(getPackSpecByMaHang('KHONG-CO', specs, undefined, '9999').missing).toBe(true)
  })

  it('build map 1 lần, trùng bỏ qua', () => {
    const m = buildPackSpecMap([...specs, { item_code: '1009', ma_hang: 'X', feature: '1009', pack_qty: 999, carton_type: 'thùng đôi' }])
    expect(m.get('1009')?.pack_qty).toBe(220)
  })

  it('ví dụ chốt: 1009 tổng 2200 thùng đôi /2/220 = 5 Kiện', () => {
    expect(calcPkgByPackSpec(2200, 220, false)).toBe(5)
  })

  it('thùng đơn không chia 2: 1220 tổng 4400/200 = 22 Kiện', () => {
    expect(calcPkgByPackSpec(4400, 200, true)).toBe(22)
  })

  it('calculateFeaturePkg dùng packSpec khi có', () => {
    const items = [{ qty: 1100, pcs_per_pkg: 999 }, { qty: 1100, pcs_per_pkg: 999 }]
    expect(calculateFeaturePkg(items, false, false, { pack_qty: 220, carton_type: 'thùng đôi', isSingle: false })).toBe(5)
    expect(calculateFeaturePkg([{ qty: 4400, pcs_per_pkg: 999 }], false, true, { pack_qty: 200, carton_type: 'thùng đơn', isSingle: true })).toBe(22)
  })

  it('groupAndSort dùng metadata + gắn missingSpec khi thiếu', () => {
    const items = [
      { po: 'P', so: 'S', item_code: '8100920004', loading_date: '10/09/2026', qty: 1100, pcs_per_pkg: 999 },
      { po: 'P', so: 'S', item_code: '8100910004', loading_date: '10/09/2026', qty: 1100, pcs_per_pkg: 999 },
    ]
    const map = buildPackSpecMap(specs)
    const g = groupAndSortForecastData(items, map)
    // feature resolve từ metadata ma_hang -> 1009 (không còn MID cứng)
    const fg = g[0].featureGroups.find((x) => x.feature === '1009')!
    expect(fg.pkgCount).toBe(5)
    expect(fg.missingSpec).toBe(false)
    expect(fg.packQtyUsed).toBe(220)

    const g2 = groupAndSortForecastData(items, buildPackSpecMap([]))
    expect(g2[0].featureGroups.find((x) => x.feature === '1009')?.missingSpec).toBe(false) // chưa wiring specs -> không warn sai

    const g3 = groupAndSortForecastData(
      [{ po: 'P', so: 'S', item_code: '8999912345', loading_date: '10/09/2026', qty: 100, pcs_per_pkg: 10 }],
      map,
    )
    expect(g3[0].featureGroups[0].missingSpec).toBe(true)
  })
})
