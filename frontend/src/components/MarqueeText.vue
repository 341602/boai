<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  text: {
    type: String,
    default: '',
  },
  tag: {
    type: String,
    default: 'span',
  },
})

const containerRef = ref(null)
const measureRef = ref(null)
const overflowing = ref(false)
const marqueeDistance = ref(0)

const MARQUEE_GAP = 28
let resizeObserver = null

const marqueeStyle = computed(() => ({
  '--marquee-gap': `${MARQUEE_GAP}px`,
  '--marquee-distance': `${marqueeDistance.value}px`,
  '--marquee-duration': `${Math.max(8, marqueeDistance.value / 28).toFixed(2)}s`,
}))

async function syncOverflow() {
  await nextTick()

  const container = containerRef.value
  const measure = measureRef.value

  if (!container || !measure) {
    overflowing.value = false
    marqueeDistance.value = 0
    return
  }

  const containerWidth = Math.ceil(container.clientWidth)
  const textWidth = Math.ceil(measure.scrollWidth)
  const shouldMarquee = textWidth - containerWidth > 2

  overflowing.value = shouldMarquee
  marqueeDistance.value = shouldMarquee ? textWidth + MARQUEE_GAP : 0
}

watch(() => props.text, syncOverflow)

onMounted(async () => {
  await syncOverflow()

  if (typeof ResizeObserver === 'undefined') {
    return
  }

  resizeObserver = new ResizeObserver(() => {
    void syncOverflow()
  })

  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }

  if (measureRef.value) {
    resizeObserver.observe(measureRef.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})
</script>

<template>
  <component
    :is="tag"
    ref="containerRef"
    class="marquee-text"
    :class="{ 'marquee-text--overflowing': overflowing }"
    :style="marqueeStyle"
    :aria-label="text"
    :title="text"
  >
    <span ref="measureRef" class="marquee-text__measure" aria-hidden="true">{{ text }}</span>

    <span v-if="overflowing" class="marquee-text__track" aria-hidden="true">
      <span class="marquee-text__copy">{{ text }}</span>
      <span class="marquee-text__gap" aria-hidden="true"></span>
      <span class="marquee-text__copy" aria-hidden="true">{{ text }}</span>
    </span>

    <span v-else class="marquee-text__copy" aria-hidden="true">{{ text }}</span>
  </component>
</template>
