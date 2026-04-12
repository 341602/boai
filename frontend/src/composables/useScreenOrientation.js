import { ref, onMounted, onBeforeUnmount } from 'vue'

export function useScreenOrientation() {
  const isSupported = ref(false)
  const currentOrientation = ref('portrait')
  const isLocked = ref(false)

  function checkSupport() {
    if (typeof window === 'undefined') return false
    isSupported.value = 'orientation' in screen
    return isSupported.value
  }

  function getCurrentOrientation() {
    if (!isSupported.value) return null
    return screen.orientation?.type || null
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
    return lock('portrait')
  }

  async function lockLandscape() {
    return lock('landscape')
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
