import { ref } from 'vue'
import { supabase, isSupabaseConfigured } from '@/services/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface OnlineUser {
  id: string
  email: string
  name: string
  joinedAt: number
}

export interface PresenceSelf {
  id?: string
  email: string
  name: string
}

/** Tên channel presence dùng chung toàn hệ thống (không cần migration SQL). */
export const ONLINE_PRESENCE_CHANNEL = 'online-users'

type PresenceState = Record<string, Array<Record<string, unknown>>>

/**
 * Map presence state thô của Supabase thành danh sách user online.
 * Thuần túy (dễ unit test): gộp nhiều tab cùng email thành 1 dòng (giữ joinedAt sớm nhất),
 * sắp xếp theo thời gian join tăng dần.
 */
export function presenceStateToUsers(state: PresenceState | null | undefined): OnlineUser[] {
  if (!state) return []
  const byEmail = new Map<string, OnlineUser>()
  Object.values(state).forEach((presences) => {
    ;(presences || []).forEach((p) => {
      const email = String(p.email || '').trim()
      if (!email) return
      const key = email.toLowerCase()
      const joinedAt = Number(p.joined_at) || 0
      const prev = byEmail.get(key)
      if (!prev || joinedAt < prev.joinedAt) {
        byEmail.set(key, {
          id: String(p.id || ''),
          email,
          name: String(p.name || email),
          joinedAt,
        })
      }
    })
  })
  return Array.from(byEmail.values()).sort((a, b) => a.joinedAt - b.joinedAt)
}

/**
 * Presence online 0đ cho 4 user (Supabase Realtime Presence, không cần bảng SQL).
 * - Track 1 lần khi login, untrack khi logout/đóng tab. Server tự hết hạn khi mất socket.
 * - Không poll, không heartbeat thủ công -> message chỉ phát sinh khi join/leave
 *   (vài chục/tháng với 4 user, quota Free 2 triệu/tháng).
 */
export function useOnlinePresence(
  channelFactory?: (key?: string) => RealtimeChannel,
) {
  const onlineUsers = ref<OnlineUser[]>([])
  const presenceConnected = ref(false)
  const presenceError = ref<string | null>(null)
  const justJoined = ref(false)

  let channel: RealtimeChannel | null = null
  let currentEmail: string | null = null
  let isTransitioning = false
  let joinTimer: ReturnType<typeof setTimeout> | null = null

  const triggerJoinAnimation = () => {
    justJoined.value = true
    if (joinTimer) clearTimeout(joinTimer)
    joinTimer = setTimeout(() => {
      justJoined.value = false
    }, 1500)
  }

  const makeChannel = (key: string) => {
    if (channelFactory) {
      return channelFactory(key)
    }
    return supabase.channel(ONLINE_PRESENCE_CHANNEL, {
      config: {
        presence: { key },
      },
    })
  }

  const syncFromChannel = () => {
    if (!channel) return
    try {
      const state = channel.presenceState() as PresenceState
      onlineUsers.value = presenceStateToUsers(state)
    } catch (e) {
      console.warn('[Presence] Không đọc được presence state:', e)
    }
  }

  /** Bắt đầu track user hiện tại lên channel online chung. */
  const startPresence = async (self: PresenceSelf): Promise<boolean> => {
    const email = String(self?.email || '').trim()
    if (!email) return false

    const cleanEmail = email.toLowerCase()

    // Idempotent: Nếu đã kết nối với chính email này và channel đang hoạt động thì giữ nguyên
    if (channel && currentEmail === cleanEmail && presenceConnected.value) {
      return true
    }

    // Nếu đang trong quá trình chuyển đổi (đang kết nối/ngắt), chờ lượt
    if (isTransitioning) {
      await new Promise((resolve) => setTimeout(resolve, 150))
      if (channel && currentEmail === cleanEmail && presenceConnected.value) {
        return true
      }
    }

    if (!channelFactory && !isSupabaseConfigured) {
      presenceError.value = 'Chưa cấu hình Supabase nên không bật presence.'
      return false
    }

    isTransitioning = true
    try {
      await stopPresence()
      presenceError.value = null
      currentEmail = cleanEmail

      const ch = makeChannel(cleanEmail)
      channel = ch

      const payload = {
        id: String(self.id || ''),
        email: self.email,
        name: String(self.name || self.email),
        joined_at: Date.now(),
      }

      ch.on('presence', { event: 'sync' }, syncFromChannel)
        .on('presence', { event: 'join' }, () => {
          syncFromChannel()
          triggerJoinAnimation()
        })
        .on('presence', { event: 'leave' }, syncFromChannel)

      // Supabase subscribe với callback SUBSCRIBED
      ch.subscribe(async (status, err) => {
        if (status === 'SUBSCRIBED') {
          try {
            await ch.track(payload)
            presenceConnected.value = true
            syncFromChannel()
            triggerJoinAnimation()
          } catch (trackErr) {
            console.warn('[Presence] track error on SUBSCRIBED:', trackErr)
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('[Presence] Channel error:', err)
          presenceConnected.value = false
          presenceError.value = err?.message || 'Lỗi kết nối Realtime'
        } else if (status === 'TIMED_OUT') {
          console.warn('[Presence] Channel timeout:', err)
          presenceConnected.value = false
          presenceError.value = 'Hết thời gian kết nối Realtime'
        } else if (status === 'CLOSED') {
          presenceConnected.value = false
        }
      })

      // Hỗ trợ đồng bộ ngay nếu là FakeChannel trong test hoặc socket đã sẵn sàng
      try {
        await ch.track(payload)
        presenceConnected.value = true
        syncFromChannel()
        triggerJoinAnimation()
      } catch {
        // bỏ qua nếu socket thực tế đang đợi kết nối SUBSCRIBED
      }

      return true
    } catch (e: unknown) {
      presenceError.value = e instanceof Error ? e.message : 'Không bật được presence.'
      console.warn('[Presence] startPresence thất bại:', e)
      channel = null
      currentEmail = null
      presenceConnected.value = false
      return false
    } finally {
      isTransitioning = false
    }
  }

  /** Dừng track + hủy subscribe, xóa danh sách online local. */
  const stopPresence = async (): Promise<void> => {
    const ch = channel
    channel = null
    currentEmail = null
    presenceConnected.value = false
    onlineUsers.value = []
    if (!ch) return

    try {
      await ch.untrack()
    } catch {
      // bỏ qua: socket có thể đã đóng (đóng tab)
    }

    try {
      await ch.unsubscribe()
    } catch {
      // bỏ qua
    }

    if (!channelFactory) {
      try {
        await supabase.removeChannel(ch)
      } catch {
        // bỏ qua
      }
    }
  }

  return {
    onlineUsers,
    presenceConnected,
    presenceError,
    justJoined,
    startPresence,
    stopPresence,
  }
}
