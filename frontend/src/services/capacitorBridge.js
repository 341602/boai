import { Capacitor, registerPlugin } from '@capacitor/core'

export async function initCapacitorBridge() {
  if (typeof window === 'undefined') {
    return
  }

  if (!Capacitor.isNativePlatform()) {
    return
  }

  const bridge = registerPlugin('BoAiMusic')
  const { createNativeAppService } = await import('./nativeAppService')
  const appService = createNativeAppService()

  window.__BOAI_NATIVE__ = new Proxy(appService, {
    get(target, prop, receiver) {
      if (prop in target) {
        return Reflect.get(target, prop, receiver)
      }

      if (typeof bridge[prop] === 'function') {
        return bridge[prop].bind(bridge)
      }

      return Reflect.get(target, prop, receiver)
    },
  })
}
