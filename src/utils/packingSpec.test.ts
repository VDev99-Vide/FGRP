import { describe, it, expect } from 'vitest'
import { buildPackSpecMap, calcPkgByPackSpec, getPackSpecByFeature, isDoubleBoxType, isSingleBoxType } from './packingSpec'
import { calculateFeaturePkg, groupAndSortForecastData } from './forecast'

describe('T4: packingSpec metadata trung tâm', () => {
  const specs = [
    { item_code: '1009', pack_qty: 220, carton_type: 'thùng đôi' },
    { item_code: '1220', pack_qty: 200, carton_type: 'thùng đơn' },
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

  it('build map 1 lần, trùng bỏ qua', () => {
    const m = buildPackSpecMap([...specs, { item_code: '1009', pack_qty: 999, carton_type: 'thùng đôi' }])
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
      { po: 'P', so: 'S', item_code: '810090203', loading_date: '10/09/2026', qty: 1100, pcs_per_pkg: 999 },
      { po: 'P', so: 'S', item_code: '810091203', loading_date: '10/09/2026', qty: 1100, pcs_per_pkg: 999 },
    ]
    const map = buildPackSpecMap(specs)
    const g = groupAndSortForecastData(items, map)
    // feature tách từ 810090203 -> 1009
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
