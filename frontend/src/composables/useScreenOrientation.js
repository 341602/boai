import { ref, onMounted, onBeforeUnmount } from 'vue'
import { hasNativeBridge, invokeNative } from '../services/runtime'

export function useScreenOrientation() {
  const isSupported = ref(false)
  const currentOrientation = ref('portrait')
  const isLocked = ref(false)

  function checkSupport() {
    if (typeof window === 'undefined') return false
    isSupported.value = 'orientation' in screen && screen.orientation && typeof screen.orientation.lock === 'function'
    return isSupported.value
  }

  function getCurrentOrientation() {
    if (!isSupported.value) return null
    return screen.orientation?.type || null
  }

  async function invokeNativeOrientation(method, orientationLabel) {
    if (!hasNativeBridge()) {
      return false
    }

    try {
      await invokeNative(method)
      if (orientationLabel) {
        currentOrientation.value = orientationLabel
      }
      isLocked.value = method !== 'unlockOrientation'
      return true
    } catch (error) {
      console.log(`Native orientation ${method} failed:`, error)
      return false
    }
  }

  async function lock(orientation) {
    if (!isSupported.value) {
      console.log('Screen orientation lock not supported')
      return false
    }

    try {
      await screen.orientation.lock(orientation)
      isLocked.value = true
      currentOrientation.value = orientation
      return true
    } catch (error) {
      console.log('Screen orientation lock failed:', error)
      return false
    }
  }

  async function unlock() {
    if (await invokeNativeOrientation('unlockOrientation')) {
      return true
    }

    if (!isSupported.value) {
      return false
    }

    try {
      screen.orientation.unlock()
      isLocked.value = false
      return true
    } catch (error) {
      console.log('Screen orientation unlock failed:', error)
      return false
    }
  }

  async function lockPortrait() {
    let result = await invokeNativeOrientation('lockPortraitOrientation', 'portrait')
    if (result) {
      return true
    }

    result = await lock('portrait-primary')
    if (!result) {
      result = await lock('portrait')
    }
    if (!result) {
      result = await lock('any')
    }
    return result
  }

  async function lockLandscape() {
    let result = await invokeNativeOrientation('lockLandscapeOrientation', 'landscape')
    if (result) {
      return true
    }

    result = await lock('landscape')
    if (!result) {
      result = await lock('landscape-primary')
    }
    if (!result) {
      result = await lock('any')
    }
    return result
  }

  function handleOrientationChange() {
    if (!isSupported.value) return
    currentOrientation.value = screen.orientation.type
  }

  onMounted(() => {
    checkSupport()
    if (isSupported.value) {
      currentOrientation.value = getCurrentOrientation()
      screen.orientation.addEventListener('change', handleOrientationChange)
    }
  })

  onBeforeUnmount(() => {
    if (isSupported.value) {
      screen.orientation.removeEventListener('change', handleOrientationChange)
    }
    unlock()
  })

  return {
    isSupported,
    currentOrientation,
    isLocked,
    lock,
    unlock,
    lockPortrait,
    lockLandscape,
  }
}
