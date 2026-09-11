import { describe, it, expect, beforeEach } from 'vitest'
import { useAuth, isAllowedUser, ALLOWED_USERS } from './useAuth'

// Mock localStorage for test environment
const store = new Map<string, string>()
const mockStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, val: string) => { store.set(key, String(val)) },
  removeItem: (key: string) => { store.delete(key) },
  clear: () => { store.clear() },
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() { return store.size }
}
;(globalThis as any).localStorage = mockStorage

describe('useAuth composable', () => {
  let auth: ReturnType<typeof useAuth>

  beforeEach(async () => {
    mockStorage.clear()
    auth = useAuth()
    await auth.logout()
  })

  it('isAllowedUser chỉ chấp nhận 3 tài khoản Vinh, Hung, Luu (không phân biệt hoa thường)', () => {
    expect(ALLOWED_USERS.length).toBe(3)
    expect(isAllowedUser('Vinh@gmail.com')).toBeDefined()
    expect(isAllowedUser('vinh@gmail.com')).toBeDefined()
    expect(isAllowedUser('Hung@gmail.com')).toBeDefined()
    expect(isAllowedUser('hung@gmail.com')).toBeDefined()
    expect(isAllowedUser('Luu@gmail.com')).toBeDefined()
    expect(isAllowedUser('luu@gmail.com')).toBeDefined()

    expect(isAllowedUser('hacker@gmail.com')).toBeUndefined()
    expect(isAllowedUser('admin@gmail.com')).toBeUndefined()
  })

  it('đăng nhập thành công với tài khoản hợp lệ và mật khẩu 123', async () => {
    const success = await auth.login('Vinh@gmail.com', '123')
    expect(success).toBe(true)
    expect(auth.isAuthenticated.value).toBe(true)
    expect(auth.currentUser.value?.email).toBe('Vinh@gmail.com')
    expect(auth.currentUser.value?.name).toBe('Vinh')

    // Kiểm tra đã ghi nhớ trên thiết bị
    const saved = mockStorage.getItem('fgrp_auth_device_session')
    expect(saved).not.toBeNull()
    expect(JSON.parse(saved!).email).toBe('Vinh@gmail.com')
  })

  it('từ chối đăng nhập khi sai mật khẩu', async () => {
    await expect(auth.login('Hung@gmail.com', 'wrong_pass')).rejects.toThrow('Mật khẩu không chính xác')
    expect(auth.isAuthenticated.value).toBe(false)
  })

  it('từ chối đăng nhập khi email không thuộc danh sách cho phép', async () => {
    await expect(auth.login('khonghopli@gmail.com', '123')).rejects.toThrow('không có quyền truy cập')
    expect(auth.isAuthenticated.value).toBe(false)
  })

  it('khôi phục phiên đăng nhập trên thiết bị (ghi nhớ đăng nhập lần đầu)', async () => {
    await auth.login('Luu@gmail.com', '123')
    expect(auth.isAuthenticated.value).toBe(true)

    // Giả lập mở lại trình duyệt
    const newAuthInstance = useAuth()
    await newAuthInstance.initAuth()
    expect(newAuthInstance.isAuthenticated.value).toBe(true)
    expect(newAuthInstance.currentUser.value?.email).toBe('Luu@gmail.com')
  })

  it('đăng xuất xóa sạch session trên thiết bị', async () => {
    await auth.login('Vinh@gmail.com', '123')
    expect(auth.isAuthenticated.value).toBe(true)

    await auth.logout()
    expect(auth.isAuthenticated.value).toBe(false)
    expect(auth.currentUser.value).toBeNull()
    expect(mockStorage.getItem('fgrp_auth_device_session')).toBeNull()
  })
})
