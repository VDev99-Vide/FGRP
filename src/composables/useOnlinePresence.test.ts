import { describe, it, expect } from 'vitest'
import {
  presenceStateToUsers,
  useOnlinePresence,
  type PresenceSelf,
} from './useOnlinePresence'

/** Fake channel Supabase Realtime để test logic join/sync/leave/track mà không chạm mạng. */
class FakeChannel {
  handlers: Record<string, Array<() => void>> = {}
  state: Record<string, Array<Record<string, unknown>>> = {}
  subscribed = false
  tracked: Record<string, unknown> | null = null
  untracked = false
  unsubscribed = false

  on(_event: string, filter: { event: string }, cb: () => void) {
    const k = String(filter?.event || 'sync')
    if (!this.handlers[k]) this.handlers[k] = []
    this.handlers[k].push(cb)
    return this
  }

  async subscribe() {
    this.subscribed = true
  }

  async track(payload: Record<string, unknown>) {
    this.tracked = payload
    const ref = `ref-${String(payload.email)}`
    this.state[ref] = [payload]
    this.emit('sync')
  }

  async untrack() {
    this.untracked = true
  }

  async unsubscribe() {
    this.unsubscribed = true
  }

  presenceState() {
    return this.state
  }

  emit(kind: string) {
    ;(this.handlers[kind] || []).forEach((cb) => cb())
  }

  /** Giả lập user khác join từ client khác (cùng channel server). */
  remoteJoin(payload: Record<string, unknown>) {
    const ref = `ref-${String(payload.email)}`
    this.state[ref] = [payload]
    this.emit('join')
    this.emit('sync')
  }

  remoteLeave(email: string) {
    const ref = `ref-${String(email)}`
    delete this.state[ref]
    this.emit('leave')
    this.emit('sync')
  }
}

describe('presenceStateToUsers (map state thô -> danh sách online)', () => {
  it('state rỗng/null -> danh sách rỗng', () => {
    expect(presenceStateToUsers({})).toEqual([])
    expect(presenceStateToUsers(null)).toEqual([])
    expect(presenceStateToUsers(undefined)).toEqual([])
  })

  it('gộp nhiều tab cùng email thành 1 dòng, giữ joinedAt sớm nhất, sắp xếp tăng dần', () => {
    const users = presenceStateToUsers({
      'ref-a1': [{ id: '1', email: 'Vinh@gmail.com', name: 'Vinh', joined_at: 300 }],
      'ref-a2': [{ id: '1', email: 'vinh@GMAIL.com', name: 'Vinh', joined_at: 100 }],
      'ref-b': [{ id: '2', email: 'Hung@gmail.com', name: 'Hùng', joined_at: 200 }],
      'ref-bad': [{ id: '3', email: '', name: '?', joined_at: 50 }],
    })
    expect(users).toHaveLength(2)
    expect(users[0].email).toBe('vinh@GMAIL.com')
    expect(users[0].joinedAt).toBe(100)
    expect(users[1].email).toBe('Hung@gmail.com')
  })
})

describe('useOnlinePresence (join/track/leave với fake channel)', () => {
  const self: PresenceSelf = { id: 'u-1', email: 'Vinh@gmail.com', name: 'Vinh' }

  it('startPresence subscribe + track đúng payload, sync ra chính mình', async () => {
    const fake = new FakeChannel()
    const presence = useOnlinePresence(() => fake as never)
    const ok = await presence.startPresence(self)
    expect(ok).toBe(true)
    expect(fake.subscribed).toBe(true)
    expect(fake.tracked).toMatchObject({ email: 'Vinh@gmail.com', name: 'Vinh' })
    expect(presence.presenceConnected.value).toBe(true)
    expect(presence.onlineUsers.value.map((u) => u.email)).toEqual(['Vinh@gmail.com'])
  })

  it('user khác join/leave cập nhật danh sách realtime', async () => {
    const fake = new FakeChannel()
    const presence = useOnlinePresence(() => fake as never)
    await presence.startPresence(self)

    fake.remoteJoin({ id: 'u-2', email: 'Hung@gmail.com', name: 'Hùng', joined_at: Date.now() })
    expect(presence.onlineUsers.value.map((u) => u.email).sort()).toEqual(
      ['Hung@gmail.com', 'Vinh@gmail.com'].sort(),
    )

    fake.remoteLeave('Hung@gmail.com')
    expect(presence.onlineUsers.value.map((u) => u.email)).toEqual(['Vinh@gmail.com'])
  })

  it('stopPresence untrack + unsubscribe + xóa danh sách local', async () => {
    const fake = new FakeChannel()
    const presence = useOnlinePresence(() => fake as never)
    await presence.startPresence(self)
    await presence.stopPresence()
    expect(fake.untracked).toBe(true)
    expect(fake.unsubscribed).toBe(true)
    expect(presence.onlineUsers.value).toEqual([])
    expect(presence.presenceConnected.value).toBe(false)
  })

  it('email trống -> từ chối start, không tạo channel', async () => {
    const fake = new FakeChannel()
    const presence = useOnlinePresence(() => fake as never)
    const ok = await presence.startPresence({ email: '  ', name: '?' })
    expect(ok).toBe(false)
    expect(fake.subscribed).toBe(false)
  })

  it('bật cờ justJoined khi join thành công để kích hoạt hiệu ứng trượt avatar', async () => {
    const fake = new FakeChannel()
    const presence = useOnlinePresence(() => fake as never)
    await presence.startPresence(self)
    expect(presence.justJoined.value).toBe(true)
  })

  it('gọi startPresence nhiều lần với cùng user -> giữ nguyên channel, không recreate', async () => {
    let createCount = 0
    const fake = new FakeChannel()
    const presence = useOnlinePresence(() => {
      createCount++
      return fake as never
    })
    await presence.startPresence(self)
    await presence.startPresence(self)
    expect(createCount).toBe(1)
  })

  it('channelFactory nhận key là lowercase email của user', async () => {
    let passedKey = ''
    const fake = new FakeChannel()
    const presence = useOnlinePresence((key) => {
      passedKey = key || ''
      return fake as never
    })
    await presence.startPresence({ email: 'Vinh@Gmail.Com', name: 'Vinh' })
    expect(passedKey).toBe('vinh@gmail.com')
  })
})

