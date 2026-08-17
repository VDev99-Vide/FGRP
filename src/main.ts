import { createApp } from 'vue'
import App from './App.vue'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'

// Import PWA Service Worker auto-updater
import { registerSW } from 'virtual:pwa-register'

// Tự động kiểm tra và cập nhật Service Worker ngay khi có bản build mới
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
