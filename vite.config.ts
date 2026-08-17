import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'favicon.svg',
        'favicon-32x32.png',
        'favicon-16x16.png',
        'apple-touch-icon.png',
        'logo.svg',
        'icons.svg',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-maskable-192x192.png',
        'pwa-maskable-512x512.png'
      ],
      manifest: {
        id: '/dashdark-v',
        name: 'Dashdark V',
        short_name: 'Dashdark V',
        description: 'Hệ thống quản lý tồn kho và báo cáo tự động Dashdark V Analytics Dashboard',
        theme_color: '#081028',
        background_color: '#081028',
        display: 'standalone',
        display_override: ['standalone', 'window-controls-overlay', 'minimal-ui'],
        start_url: './',
        scope: './',
        orientation: 'any',
        categories: ['productivity', 'business', 'utilities'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        // Tăng giới hạn file cache cho wallpaper background
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Tự động kích hoạt worker mới nhất mà không cần chờ đóng tab
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Chỉ lưu cache static assets tĩnh cho UI hoạt động mượt mà
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf}'],
        // TUYỆT ĐỐI KHÔNG lưu cache các file CSV, dữ liệu mẫu hoặc file data
        globIgnores: ['**/*.csv', '**/state.json', '**/Stock Balance**'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /^https:\/\/.*\.supabase\.co/,
          /\/rest\/v1\//,
          /\/auth\/v1\//,
          /\/storage\/v1\//
        ],
        runtimeCaching: [
          // 1. SUPABASE & BACKEND API: LUÔN DÙNG NetworkOnly ĐỂ TRÁNH 100% LỖI CACHE DỮ LIỆU TỒN KHO
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
            method: 'GET'
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
            method: 'POST'
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
            method: 'PATCH'
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
            method: 'DELETE'
          },
          {
            urlPattern: /\/rest\/v1\/|\/auth\/v1\/|\/storage\/v1\//i,
            handler: 'NetworkOnly'
          },
          // 2. Navigation HTML: NetworkFirst để luôn lấy trang mới nhất khi có mạng
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'dashdark-html-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 24 * 60 * 60 // 1 ngày
              }
            }
          },
          // 3. Static Fonts & Google CDN: StaleWhileRevalidate
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 ngày
              }
            }
          },
          // 4. Static Images / SVG Assets: StaleWhileRevalidate
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'dashdark-image-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 7 * 24 * 60 * 60 // 7 ngày
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  base: './'
})
