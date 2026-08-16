import { createClient, SupabaseClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL || ''
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Helper to sanitize URL format
const sanitizeUrl = (url: string) => {
  if (!url) return ''
  return url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
}

const cleanedUrl = sanitizeUrl(rawUrl)

// Check if credentials are valid (not empty and not default placeholder)
export const isSupabaseConfigured = Boolean(
  cleanedUrl &&
  rawKey &&
  !cleanedUrl.includes('xxxx.supabase.co') &&
  !rawKey.includes('your_anon_key')
)

if (!isSupabaseConfigured) {
  console.info('ℹ️ Chế độ Mock Data (Demo Mode): Không tìm thấy cấu hình Supabase hợp lệ, hệ thống sẽ sử dụng dữ liệu mẫu trực quan.')
}

// Fallback dummy credentials to prevent createClient from throwing uncaught errors at module initialization
const clientUrl = isSupabaseConfigured ? cleanedUrl : 'https://placeholder-project.supabase.co'
const clientKey = isSupabaseConfigured ? rawKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy'

export const supabase: SupabaseClient = createClient(clientUrl, clientKey)
export default supabase
