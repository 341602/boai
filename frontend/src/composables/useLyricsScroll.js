import { ref, onBeforeUnmount, nextTick } from 'vue'

export function useLyricsScroll(options = {}) {
  const { scrollDuration = 300 } = options

  const containerRef = ref(null)
  const lineRefs = ref([])
  const currentScrollTop = ref(0)
  const targetScrollTop = ref(0)
  const animationFrameId = ref(null)
  const isAnimating = ref(false)

  function setLineRef(element, index) {
    if (element) {
      lineRefs.value[index] = element
    }
  }

  function animateScroll(startTime) {
    if (!containerRef.value) return

    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / scrollDuration, 1)

    const easeProgress = 1 - Math.pow(1 - progress, 3)

    currentScrollTop.value = targetScrollTop.value * easeProgress
    containerRef.value.scrollTop = currentScrollTop.value

    if (progress < 1) {
      animationFrameId.value = requestAnimationFrame(() => animateScroll(startTime))
    } else {
      isAnimating.value = false
      animationFrameId.value = null
    }
  }

  async function scrollToActiveLine(index) {
    if (!containerRef.value || !lineRefs.value[index]) return

    await nextTick()

    const container = containerRef.value
    const activeLine = lineRefs.value[index]
    const containerHeight = container.clientHeight
    const lineTop = activeLine.offsetTop
    const lineHeight = activeLine.clientHeight

    targetScrollTop.value = lineTop - (containerHeight / 2) + (lineHeight / 2)

    if (Math.abs(container.scrollTop - targetScrollTop.value) < 5) {
      return
    }

    if (animationFrameId.value) {
      cancelAnimationFrame(animationFrameId.value)
    }

    isAnimating.value = true
    animateScroll(Date.now())
  }

  function reset() {
    lineRefs.value = []
  }

  onBeforeUnmount(() => {
    if (animationFrameId.value) {
      cancelAnimationFrame(animationFrameId.value)
    }
  })

  return {
    containerRef,
    lineRefs,
    setLineRef,
    scrollToActiveLine,
    reset,
  }
}
