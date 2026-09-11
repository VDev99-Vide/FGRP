import { createClient, SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://dhlpkycpkndfdgnbdcwn.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRobHBreWNwa25kZmRnbmJkY3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwODM2NDgsImV4cCI6MjA5NTY1OTY0OH0.aVbFpwZj6_zYlTqHYds27f9Q7brZn8Ti-0VUOFRuslE'

const rawUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY

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

// Fallback credentials ensure live connection is preserved in both dev and prod
const clientUrl = isSupabaseConfigured ? cleanedUrl : DEFAULT_SUPABASE_URL
const clientKey = isSupabaseConfigured ? rawKey : DEFAULT_SUPABASE_ANON_KEY

// Create Supabase client with strict cache-busting headers to prevent stale data in PWA
export const supabase: SupabaseClient = createClient(clientUrl, clientKey, {
  global: {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
})

export default supabase
