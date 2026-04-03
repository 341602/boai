import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'app' ? './' : '/',
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    allowedHosts: ['nc8c79fe.natappfree.cc', '.natappfree.cc'],
    proxy: {
      '/search': 'http://127.0.0.1:3000',
      '/song': 'http://127.0.0.1:3000',
      '/lyric': 'http://127.0.0.1:3000',
      '/health': 'http://127.0.0.1:3000',
    },
  },
}))
