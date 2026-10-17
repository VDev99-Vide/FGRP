import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Supabase client — test phải hermetic, KHÔNG chạm DB thật
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn()
}))

vi.mock('@/services/supabase', () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from },
  isSupabaseConfigured: true
}))

import { useInventory, replaceInventoryFlight } from './useInventory'

const makeChain = (data: unknown[] = []) => {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.range = vi.fn(async () => ({ data, error: null }))
  return chain
}

describe('useInventory - chống nhân đôi dữ liệu khi làm mới kho từ file (bug 2508 -> 5016)', () => {
  beforeEach(() => {
    replaceInventoryFlight.reset()
    mocks.rpc.mockReset()
    mocks.from.mockReset()
    mocks.from.mockImplementation(() => makeChain([]))
  })

  it('lời gọi thứ 2 song song bị từ chối, RPC replace_inventory chỉ chạy ĐÚNG 1 lần', async () => {
    let releaseRpc!: (value: { error: null }) => void
    mocks.rpc.mockImplementation(() => new Promise((resolve) => { releaseRpc = resolve }))

    const inv = useInventory()
    const rows = Array.from({ length: 3 }, (_, i) => ({ tag_id: `TAG-${i}`, bin: 'B1' }))

    const first = inv.replaceInventoryData(rows)
    const second = inv.replaceInventoryData(rows)

    await expect(second).rejects.toThrow(/đang chạy/)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith('replace_inventory', { payload: rows })

    releaseRpc({ error: null })
    await first
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })

  it('sau khi hoàn tất thì lời gọi kế tiếp chạy bình thường', async () => {
    mocks.rpc.mockResolvedValue({ error: null })

    const inv = useInventory()
    await inv.replaceInventoryData([{ tag_id: 'A', bin: 'B' }])
    await inv.replaceInventoryData([{ tag_id: 'C', bin: 'D' }])

    expect(mocks.rpc).toHaveBeenCalledTimes(2)
  })

  it('mở khóa khi RPC lỗi để lần sau vẫn nạp được', async () => {
    mocks.rpc.mockRejectedValueOnce(new Error('network'))
    const inv = useInventory()

    await expect(inv.replaceInventoryData([{ tag_id: 'A', bin: 'B' }])).rejects.toThrow('network')
    expect(replaceInventoryFlight.isRunning()).toBe(false)

    mocks.rpc.mockResolvedValueOnce({ error: null })
    await inv.replaceInventoryData([{ tag_id: 'A', bin: 'B' }])
    expect(mocks.rpc).toHaveBeenCalledTimes(2)
  })
})
