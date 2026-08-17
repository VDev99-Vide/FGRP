import { ref, onMounted } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function usePwaInstall() {
  const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
  const canInstall = ref(false)
  const isInstalled = ref(false)
  const showInstallModal = ref(false)
  const isIOS = ref(false)
  const isUpdateAvailable = ref(false)

  // Kiểm tra trạng thái standalone (đã cài đặt và đang chạy dưới dạng App)
  const checkInstalledState = () => {
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')

    if (isStandaloneMode) {
      isInstalled.value = true
      canInstall.value = false
    }
  }

  // Khởi tạo listeners
  onMounted(() => {
    checkInstalledState()

    // Nhận biết thiết bị iOS
    const ua = window.navigator.userAgent.toLowerCase()
    isIOS.value = /iphone|ipad|ipod/.test(ua)

    // Lắng nghe sự kiện trước khi cài đặt của trình duyệt Chromium
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault()
      deferredPrompt.value = e as BeforeInstallPromptEvent
      canInstall.value = true
    })

    // Lắng nghe khi người dùng đã cài đặt thành công
    window.addEventListener('appinstalled', () => {
      isInstalled.value = true
      canInstall.value = false
      deferredPrompt.value = null
      console.info('🎉 Ứng dụng Dashdark V đã được cài đặt thành công trên thiết bị!')
    })

    // Lắng nghe Service Worker controller thay đổi để thông báo cập nhật
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        isUpdateAvailable.value = true
      })
    }
  })

  // Hàm kích hoạt cài đặt App
  const triggerInstall = async (): Promise<'accepted' | 'dismissed' | 'modal_opened'> => {
    if (deferredPrompt.value) {
      try {
        await deferredPrompt.value.prompt()
        const choice = await deferredPrompt.value.userChoice
        deferredPrompt.value = null
        if (choice.outcome === 'accepted') {
          canInstall.value = false
          isInstalled.value = true
        }
        return choice.outcome
      } catch (err) {
        console.warn('Lỗi khi kích hoạt cài đặt native PWA:', err)
        showInstallModal.value = true
        return 'modal_opened'
      }
    } else {
      // Hiển thị modal hướng dẫn cài đặt thủ công chi tiết
      showInstallModal.value = true
      return 'modal_opened'
    }
  }

  // Hàm xóa toàn bộ cache và làm mới ứng dụng (chống 100% tình trạng dữ liệu cũ bị kẹt)
  const clearAppCacheAndReload = async () => {
    try {
      if ('caches' in window) {
        const cacheKeys = await caches.keys()
        await Promise.all(cacheKeys.map(key => caches.delete(key)))
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        for (const reg of registrations) {
          await reg.update()
        }
      }
      // Force reload từ server
      window.location.reload()
    } catch (e) {
      console.error('Lỗi khi xóa cache:', e)
      window.location.reload()
    }
  }

  return {
    canInstall,
    isInstalled,
    showInstallModal,
    isIOS,
    isUpdateAvailable,
    triggerInstall,
    clearAppCacheAndReload
  }
}
