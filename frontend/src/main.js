import { createApp } from 'vue'
import './style.css'
import './styles/mobile.css'
import './styles/desktop.css'
import App from './App.vue'
import router from './router'
import { initCapacitorBridge } from './services/capacitorBridge'

await initCapacitorBridge()

createApp(App).use(router).mount('#app')

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
