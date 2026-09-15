import { ref, computed } from 'vue'
import { supabase, isSupabaseConfigured } from '@/services/supabase'

export interface AuthUser {
  id?: string
  email: string
  name: string
  avatar?: string
  role: string
  loggedInAt: string
}

// 4 tài khoản được phân quyền sử dụng hệ thống
export const ALLOWED_USERS: { email: string; name: string }[] = [
  { email: 'Vinh@gmail.com', name: 'Vinh' },
  { email: 'Hung@gmail.com', name: 'Hùng' },
  { email: 'Luu@gmail.com', name: 'Lưu' },
  { email: 'Tiennguyen@legget.com', name: 'Tiên Nguyễn' }
]

const STORAGE_KEY = 'fgrp_auth_device_session'

// Safe helper for localStorage (tránh lỗi khi chạy test hoặc SSR)
const getStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) return (globalThis as any).localStorage
  return null
}

// State người dùng hiện tại (lưu trong bộ nhớ ứng dụng)
const currentUser = ref<AuthUser | null>(null)
const authLoading = ref(false)
const authError = ref<string | null>(null)
const isAuthInitialized = ref(false)

/**
 * Kiểm tra xem email có nằm trong danh sách tài khoản được cấp quyền không
 */
export function isAllowedUser(email: string): { email: string; name: string } | undefined {
  const cleanEmail = (email || '').trim().toLowerCase()
  return ALLOWED_USERS.find(u => u.email.toLowerCase() === cleanEmail)
}

/**
 * Composable xác thực và phân quyền người dùng
 */
export function useAuth() {
  const isAuthenticated = computed(() => currentUser.value !== null)

  /**
   * Khôi phục phiên đăng nhập đã ghi nhớ trên thiết bị
   * "ghi nhớ đăng nhập cho thiết bị đăng nhập thành công lần đầu"
   */
  const initAuth = async () => {
    if (isAuthInitialized.value) return
    authLoading.value = true
    try {
      // 1. Kiểm tra session từ Supabase nếu có
      if (isSupabaseConfigured) {
        try {
          const { data } = await supabase.auth.getSession()
          if (data?.session?.user?.email) {
            const allowed = isAllowedUser(data.session.user.email)
            if (allowed) {
              currentUser.value = {
                id: data.session.user.id,
                email: allowed.email,
                name: allowed.name,
                role: 'Quản trị viên',
                loggedInAt: new Date().toISOString()
              }
              // Đồng bộ vào localStorage thiết bị
              const storage = getStorage()
              storage?.setItem(STORAGE_KEY, JSON.stringify(currentUser.value))
              isAuthInitialized.value = true
              return
            }
          }
        } catch (sbErr) {
          console.warn('Lỗi kiểm tra session Supabase:', sbErr)
        }
      }

      // 2. Kiểm tra phiên đã ghi nhớ trong localStorage trên thiết bị này
      const storage = getStorage()
      const savedDeviceSession = storage?.getItem(STORAGE_KEY)
      if (savedDeviceSession) {
        try {
          const parsed = JSON.parse(savedDeviceSession) as AuthUser
          if (parsed && parsed.email) {
            const allowed = isAllowedUser(parsed.email)
            if (allowed) {
              currentUser.value = {
                ...parsed,
                email: allowed.email,
                name: allowed.name,
                role: 'Quản trị viên'
              }
            }
          }
        } catch (parseErr) {
          storage?.removeItem(STORAGE_KEY)
        }
      }
    } finally {
      authLoading.value = false
      isAuthInitialized.value = true
    }
  }

  /**
   * Đăng nhập với email và password
   * Cho phép 4 user: Vinh@gmail.com, Hung@gmail.com, Luu@gmail.com, Tiennguyen@legget.com
   * Mật khẩu mặc định: 123 (hoặc 123123 nếu Supabase GoTrue yêu cầu >= 6 ký tự)
   */
  const login = async (emailInput: string, passwordInput: string): Promise<boolean> => {
    authLoading.value = true
    authError.value = null

    try {
      const email = (emailInput || '').trim()
      const password = (passwordInput || '').trim()

      if (!email || !password) {
        throw new Error('Vui lòng nhập đầy đủ Email và Mật khẩu.')
      }

      // 1. Kiểm tra email có thuộc danh sách tài khoản cho phép không
      const matchedUser = isAllowedUser(email)
      if (!matchedUser) {
        throw new Error(`Email "${email}" không có quyền truy cập. Hệ thống chỉ cho phép: Vinh@gmail.com, Hung@gmail.com, Luu@gmail.com, Tiennguyen@legget.com`)
      }

      let loginSuccessful = false
      let supabaseUserId = ''

      // 2. Thử đăng nhập qua Supabase Auth nếu đã kết nối
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: matchedUser.email.toLowerCase(),
            password: password
          })

          if (!error && data?.user) {
            loginSuccessful = true
            supabaseUserId = data.user.id
          } else {
            console.warn('Supabase signInWithPassword không thành công, kiểm tra fallback mật khẩu:', error?.message)
          }
        } catch (sbLoginErr) {
          console.warn('Lỗi gọi Supabase Auth:', sbLoginErr)
        }
      }

      // 3. Fallback kiểm tra mật khẩu mặc định (123 hoặc 123123)
      if (!loginSuccessful) {
        if (password === '123' || password === '123123') {
          loginSuccessful = true
        } else {
          throw new Error('Mật khẩu không chính xác. Mật khẩu mặc định là: 123')
        }
      }

      // 4. Thiết lập người dùng đăng nhập thành công
      const userObj: AuthUser = {
        id: supabaseUserId || `user-${Date.now()}`,
        email: matchedUser.email,
        name: matchedUser.name,
        role: 'Quản trị viên',
        loggedInAt: new Date().toISOString()
      }

      currentUser.value = userObj

      // 5. GHI NHỚ ĐĂNG NHẬP CHO THIẾT BỊ LẦN ĐẦU THÀNH CÔNG
      try {
        const storage = getStorage()
        storage?.setItem(STORAGE_KEY, JSON.stringify(userObj))
      } catch (storageErr) {
        console.warn('Không thể lưu session vào storage:', storageErr)
      }

      return true
    } catch (err: any) {
      authError.value = err.message || 'Đăng nhập không thành công'
      throw err
    } finally {
      authLoading.value = false
    }
  }

  /**
   * Đăng xuất khỏi thiết bị
   */
  const logout = async () => {
    authLoading.value = true
    try {
      if (isSupabaseConfigured) {
        try {
          await supabase.auth.signOut()
        } catch (sbErr) {
          console.warn('Lỗi Supabase signOut:', sbErr)
        }
      }

      // Xóa phiên ghi nhớ trên thiết bị
      const storage = getStorage()
      storage?.removeItem(STORAGE_KEY)
      currentUser.value = null
      authError.value = null
    } finally {
      authLoading.value = false
    }
  }

  return {
    currentUser,
    isAuthenticated,
    authLoading,
    authError,
    ALLOWED_USERS,
    initAuth,
    login,
    logout
  }
}
