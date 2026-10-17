import { describe, it, expect, vi } from 'vitest'
import { createSingleFlight } from './singleFlight'

describe('createSingleFlight - chống gọi trùng lặp thao tác nguy hiểm', () => {
  it('chặn lời gọi thứ 2 khi lời gọi thứ nhất đang chạy', async () => {
    const flight = createSingleFlight('test')
    let release!: () => void
    const fn = vi.fn(() => new Promise<void>((resolve) => { release = resolve }))

    const first = flight.run(fn)
    expect(flight.isRunning()).toBe(true)

    const second = flight.run(fn)
    await expect(second).rejects.toThrow(/đang chạy/)

    release()
    await first
    expect(fn).toHaveBeenCalledTimes(1)
    expect(flight.isRunning()).toBe(false)
  })

  it('cho phép chạy lại bình thường sau khi hoàn tất', async () => {
    const flight = createSingleFlight('test')
    const fn = vi.fn(async () => 42)
    await expect(flight.run(fn)).resolves.toBe(42)
    await expect(flight.run(fn)).resolves.toBe(42)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('mở khóa khi thao tác lỗi (không kẹt vĩnh viễn)', async () => {
    const flight = createSingleFlight('test')
    const failing = vi.fn(async () => { throw new Error('boom') })
    await expect(flight.run(failing)).rejects.toThrow('boom')
    expect(flight.isRunning()).toBe(false)

    const okFn = vi.fn(async () => 'ok')
    await expect(flight.run(okFn)).resolves.toBe('ok')
  })

  it('reset() giải phóng khóa ngay lập tức (dùng cho test)', async () => {
    const flight = createSingleFlight('test')
    let release!: () => void
    const running = flight.run(() => new Promise<void>((resolve) => { release = resolve }))
    expect(flight.isRunning()).toBe(true)

    flight.reset()
    expect(flight.isRunning()).toBe(false)

    // fn được defer qua microtask — chờ 1 tick để closure gán release
    await Promise.resolve()
    release()
    await running
  })
})
