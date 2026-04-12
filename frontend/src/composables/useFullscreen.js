import { ref, onMounted, onBeforeUnmount } from 'vue'

export function useFullscreen() {
  const isSupported = ref(false)
  const isFullscreen = ref(false)
  const fullscreenElement = ref(null)

  function checkSupport() {
    if (typeof document === 'undefined') return false
    isSupported.value = 'requestFullscreen' in document.documentElement ||
      'webkitRequestFullscreen' in document.documentElement
    return isSupported.value
  }

  async function enter(element) {
    if (!isSupported.value) {
      console.log('Fullscreen API not supported')
      return false
    }

    try {
      const target = element || document.documentElement
      if (target.requestFullscreen) {
        await target.requestFullscreen()
      } else if (target.webkitRequestFullscreen) {
        await target.webkitRequestFullscreen()
      }
      fullscreenElement.value = target
      isFullscreen.value = true
      return true
    } catch (error) {
      console.log('Failed to enter fullscreen:', error)
      return false
    }
  }

  async function exit() {
    if (!isSupported.value) {
      return false
    }

    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen()
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen()
      }
      isFullscreen.value = false
      fullscreenElement.value = null
      return true
    } catch (error) {
      console.log('Failed to exit fullscreen:', error)
      return false
    }
  }

  async function toggle(element) {
    if (isFullscreen.value) {
      return exit()
    } else {
      return enter(element)
    }
  }

  function handleFullscreenChange() {
    if (!isSupported.value) return
    isFullscreen.value = !!(document.fullscreenElement || document.webkitFullscreenElement)
    fullscreenElement.value = document.fullscreenElement || document.webkitFullscreenElement || null
  }

  onMounted(() => {
    checkSupport()
    if (isSupported.value) {
      isFullscreen.value = !!(document.fullscreenElement || document.webkitFullscreenElement)
      document.addEventListener('fullscreenchange', handleFullscreenChange)
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    }
  })

  onBeforeUnmount(() => {
    if (isSupported.value) {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    }
    if (isFullscreen.value) {
      exit()
    }
  })

  return {
    isSupported,
    isFullscreen,
    fullscreenElement,
    enter,
    exit,
    toggle,
  }
}
