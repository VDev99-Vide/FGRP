import { createApp } from 'vue'
import App from './App.vue'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'

// PWA Service Worker & Anti-Stale Cache Management
if (import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.info('🚀 Phát hiện bản cập nhật mới của Dashdark V! Đang tự động làm mới...')
        updateSW(true)
      },
      onOfflineReady() {
        console.info('📱 Dashdark V đã sẵn sàng hoạt động offline')
      }
    })

    if ('serviceWorker' in navigator) {
      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return
        refreshing = true
        window.location.reload()
      })
    }
  })
} else {
  // Trong môi trường DEV / Localhost: Tự động gỡ bỏ mọi Service Worker cũ và dọn sạch cache để chống dính cache 100%
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister()
      }
    })
  }
  if ('caches' in window) {
    caches.keys().then((keys) => {
      for (const key of keys) {
        caches.delete(key)
      }
    })
  }
}

// Import CSS (including Tailwind CSS v4, AG Grid, and Dashdark V Dark Glassmorphism tokens)
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import './styles/index.css'

// ECharts Setup
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, PieChart, GaugeChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  PolarComponent
} from 'echarts/components'
import VChart from 'vue-echarts'

// Đăng ký các module ECharts cần dùng
use([
  CanvasRenderer,
  BarChart,
  LineChart,
  PieChart,
  GaugeChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  PolarComponent
])

const app = createApp(App)

// Cấu hình PrimeVue v4 Aura Dark
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: 'system'
    }
  }
})

app.use(ToastService)
app.use(ConfirmationService)

// Đăng ký component ECharts toàn cục
app.component('v-chart', VChart)

app.mount('#app')
