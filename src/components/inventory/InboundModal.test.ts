// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import InboundModal from './InboundModal.vue'

const DialogStub = { template: '<div class="dialog-stub"><slot /></div>' }
const InputStub = { template: '<input />' }

function mountModal(props: Record<string, unknown> = {}) {
  return mount(InboundModal, {
    props: { visible: true, inventoryData: [], ...props },
    global: {
      stubs: {
        Dialog: DialogStub,
        InputText: InputStub
      }
    }
  })
}

// defineExpose có thể trả ref hoặc giá trị đã unwrap tùy runtime — chuẩn hóa để assert chắc chắn
const val = <T,>(x: T | { value: T }): T =>
  (x && typeof x === 'object' && 'value' in (x as object) ? (x as { value: T }).value : (x as T))

const cleanRows = [
  { 'Tag ID': 'TAG-1', Bin: 'B1' },
  { 'Tag ID': 'TAG-2', Bin: 'B2' }
]

const dupRows = [
  { 'Tag ID': 'TAG-1', Bin: 'B1' },
  { 'Tag ID': 'TAG-1', Bin: 'B1' },
  { 'Tag ID': 'TAG-2', Bin: 'B2' }
]

describe('InboundModal - chống nạp trùng 2 lần (nguyên nhân bug 5.016 records)', () => {
  it('bấm nạp 1 lần chỉ phát DUY NHẤT 1 event import-excel, không còn import-csv', async () => {
    const wrapper = mountModal()
    ;(wrapper.vm as any).processRawRows(cleanRows)
    await nextTick()

    const btn = wrapper.findAll('button').find(b => b.text().includes('LÀM MỚI KHO'))
    expect(btn).toBeTruthy()
    await btn!.trigger('click')

    expect(wrapper.emitted('import-excel')).toHaveLength(1)
    expect(wrapper.emitted('import-csv')).toBeUndefined()
  })

  it('double-click liên tiếp vẫn chỉ phát 1 event', async () => {
    const wrapper = mountModal()
    ;(wrapper.vm as any).processRawRows(cleanRows)
    await nextTick()

    const vm = wrapper.vm as any
    vm.submitCsv()
    vm.submitCsv()
    vm.submitCsv()

    expect(wrapper.emitted('import-excel')).toHaveLength(1)
  })

  it('file có cặp Tag ID + Bin trùng: báo lỗi rõ ràng và KHÔNG cho nạp', async () => {
    const wrapper = mountModal()
    ;(wrapper.vm as any).processRawRows(dupRows)
    await nextTick()

    const vm = wrapper.vm as any
    expect(String(val(vm.csvError))).toContain('trùng')
    expect(val(vm.csvStats).duplicateRows).toBe(1)
    expect(val(vm.csvStats).duplicateGroups).toBe(1)

    const btn = wrapper.findAll('button').find(b => b.text().includes('LÀM MỚI KHO'))
    expect(btn?.attributes('disabled')).toBeDefined()

    vm.submitCsv()
    expect(wrapper.emitted('import-excel')).toBeUndefined()
  })

  it('đang tải dữ liệu (loading=true): không cho nạp, không phát event', async () => {
    const wrapper = mountModal({ loading: true })
    ;(wrapper.vm as any).processRawRows(cleanRows)
    await nextTick()

    ;(wrapper.vm as any).submitCsv()
    expect(wrapper.emitted('import-excel')).toBeUndefined()
  })

  it('cùng Tag ID nhưng khác Bin là hợp lệ (không báo trùng)', async () => {
    const wrapper = mountModal()
    ;(wrapper.vm as any).processRawRows([
      { 'Tag ID': 'TAG-1', Bin: 'B1' },
      { 'Tag ID': 'TAG-1', Bin: 'B2' }
    ])
    await nextTick()

    const vm = wrapper.vm as any
    expect(String(val(vm.csvError))).toBe('')

    vm.submitCsv()
    expect(wrapper.emitted('import-excel')).toHaveLength(1)
  })

  it('nạp lỗi (loading true -> false) tự mở khóa để bấm lại được', async () => {
    const wrapper = mountModal()
    ;(wrapper.vm as any).processRawRows(cleanRows)
    await nextTick()
    const vm = wrapper.vm as any

    vm.submitCsv()
    expect(wrapper.emitted('import-excel')).toHaveLength(1)
    expect(val(vm.submitting)).toBe(true)

    await wrapper.setProps({ loading: true })
    await wrapper.setProps({ loading: false })
    expect(val(vm.submitting)).toBe(false)

    vm.submitCsv()
    expect(wrapper.emitted('import-excel')).toHaveLength(2)
  })

  it('đóng modal thì reset trạng thái khóa và dọn preview', async () => {
    const wrapper = mountModal()
    ;(wrapper.vm as any).processRawRows(cleanRows)
    await nextTick()
    const vm = wrapper.vm as any

    vm.submitCsv()
    await wrapper.setProps({ visible: false })

    expect(val(vm.submitting)).toBe(false)
    expect(String(val(vm.csvError))).toBe('')
  })
})
