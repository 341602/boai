import { createApp } from 'vue'
import './style.css'
import './styles/mobile.css'
import './styles/desktop.css'
import App from './App.vue'
import { initThemePreference } from './composables/useThemePreference'
import router from './router'
import { initCapacitorBridge } from './services/capacitorBridge'

initThemePreference()
await initCapacitorBridge()

if (typeof window !== 'undefined') {
  window.__BOAI_HANDLE_ANDROID_BACK__ = () => {
    try {
      if (typeof window.__BOAI_ACTIVE_BACK_HANDLER__ === 'function') {
        const handledByPage = window.__BOAI_ACTIVE_BACK_HANDLER__()

        if (handledByPage) {
          return true
        }
      }
    } catch (error) {
      console.warn('Page back handler failed:', error)
    }

    const currentRoute = router.currentRoute.value

    if (!currentRoute?.name || currentRoute.name === 'home') {
      return false
    }

    if (window.history.length > 1) {
      router.back()
      return true
    }

    router.push({ name: 'home' })
    return true
  }
}

createApp(App).use(router).mount('#app')

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
