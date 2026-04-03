import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const DESKTOP_MIN_WIDTH = 980

export function useViewportMode() {
  const isDesktop = ref(typeof window !== 'undefined' ? window.innerWidth >= DESKTOP_MIN_WIDTH : false)
  let mediaQuery = null
  let cleanup = null

  const updateMode = () => {
    if (typeof window === 'undefined') {
      return
    }

    isDesktop.value = window.innerWidth >= DESKTOP_MIN_WIDTH
  }

  onMounted(() => {
    if (typeof window === 'undefined') {
      return
    }

    mediaQuery = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`)
    updateMode()

    const handleChange = () => {
      updateMode()
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      cleanup = () => mediaQuery?.removeEventListener('change', handleChange)
    } else {
      mediaQuery.addListener(handleChange)
      cleanup = () => mediaQuery?.removeListener(handleChange)
    }
  })

  onBeforeUnmount(() => {
    cleanup?.()
  })

  return {
    isDesktop,
    isMobile: computed(() => !isDesktop.value),
  }
}
