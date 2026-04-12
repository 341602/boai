<script setup>
import { nextTick, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { Play } from 'lucide-vue-next'
import { TEXTS } from '../constants/texts'

const props = defineProps({
  lines: {
    type: Array,
    default: () => [],
  },
  activeIndex: {
    type: Number,
    default: 0,
  },
  emptyText: {
    type: String,
    default: TEXTS.noLyrics,
  },
  interactive: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['seek-line'])

const lineRefs = ref([])
const selectedIndex = ref(-1)
const pressTimer = ref(null)
const pressedIndex = ref(-1)
const pointerStart = ref({ x: 0, y: 0 })
const longPressTriggered = ref(false)
const containerRef = ref(null)
const currentScrollTop = ref(0)
const targetScrollTop = ref(0)
const animationFrameId = ref(null)
const isAnimating = ref(false)

const SCROLL_DURATION = 300 // 滚动动画持续时间（毫秒）

function setLineRef(element, index) {
  if (element) {
    lineRefs.value[index] = element
  }
}

function clearPressTimer() {
  if (pressTimer.value) {
    window.clearTimeout(pressTimer.value)
    pressTimer.value = null
  }
}

function clearPressedState() {
  clearPressTimer()
  pressedIndex.value = -1
  longPressTriggered.value = false
}

function clearSelectedLine() {
  selectedIndex.value = -1
}

function handlePointerDown(event, index) {
  if (!props.interactive) {
    return
  }

  if (event.pointerType === 'mouse' && event.button !== 0) {
    return
  }

  clearPressTimer()
  pressedIndex.value = index
  pointerStart.value = {
    x: event.clientX || 0,
    y: event.clientY || 0,
  }
  longPressTriggered.value = false
  pressTimer.value = window.setTimeout(() => {
    selectedIndex.value = index
    longPressTriggered.value = true
  }, 420)
}

function handlePointerMove(event) {
  if (!props.interactive || pressedIndex.value < 0) {
    return
  }

  const moveX = Math.abs((event.clientX || 0) - pointerStart.value.x)
  const moveY = Math.abs((event.clientY || 0) - pointerStart.value.y)

  if (moveX > 10 || moveY > 10) {
    clearPressedState()
  }
}

function handlePointerEnd() {
  clearPressTimer()
  pressedIndex.value = -1
  longPressTriggered.value = false
}

function seekLine(line) {
  emit('seek-line', line)
  clearSelectedLine()
}

// 使用 requestAnimationFrame 实现平滑滚动动画
function animateScroll(startTime) {
  if (!containerRef.value) return
  
  const elapsed = Date.now() - startTime
  const progress = Math.min(elapsed / SCROLL_DURATION, 1)
  
  // 使用 ease-out 缓动函数
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

function scrollToActiveLine(index) {
  if (!containerRef.value || !lineRefs.value[index]) return
  
  const container = containerRef.value
  const activeLine = lineRefs.value[index]
  const containerHeight = container.clientHeight
  const lineTop = activeLine.offsetTop
  const lineHeight = activeLine.clientHeight
  
  // 计算目标滚动位置（使当前歌词居中）
  targetScrollTop.value = lineTop - (containerHeight / 2) + (lineHeight / 2)
  
  // 如果已经在目标位置附近，不触发动画
  if (Math.abs(container.scrollTop - targetScrollTop.value) < 5) {
    return
  }
  
  // 取消之前的动画
  if (animationFrameId.value) {
    cancelAnimationFrame(animationFrameId.value)
  }
  
  isAnimating.value = true
  animateScroll(Date.now())
}

watch(
  () => props.lines,
  () => {
    lineRefs.value = []
    clearSelectedLine()
    clearPressedState()
  },
)

watch(
  () => props.activeIndex,
  async (index) => {
    if (index < 0 || index >= props.lines.length) return
    
    await nextTick()
    scrollToActiveLine(index)
  },
)

onBeforeUnmount(() => {
  if (animationFrameId.value) {
    cancelAnimationFrame(animationFrameId.value)
  }
})
</script>

<template>
  <div v-if="!lines.length" class="empty-state empty-state--lyric">
    {{ emptyText }}
  </div>

  <div
    v-else
    ref="containerRef"
    class="lyric-stage"
    :class="{ 'lyric-stage--interactive': interactive }"
    @scroll.passive="clearSelectedLine"
  >
    <div
      v-for="(line, index) in lines"
      :key="line.id"
      :ref="(element) => setLineRef(element, index)"
      class="lyric-stage__row"
      :class="{ 'lyric-stage__row--selected': interactive && index === selectedIndex }"
      @pointerdown="handlePointerDown($event, index)"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerEnd"
      @pointercancel="clearPressedState"
      @pointerleave="clearPressedState"
    >
      <p
        class="lyric-stage__line"
        :class="{ 'lyric-stage__line--active': index === activeIndex }"
      >
        {{ line.text }}
      </p>

      <button
        v-if="interactive && index === selectedIndex"
        class="lyric-stage__action icon-button icon-button--solid"
        type="button"
        :title="TEXTS.play"
        :aria-label="TEXTS.play"
        @click.stop="seekLine(line)"
      >
        <Play class="button-icon" />
      </button>
    </div>
  </div>
</template>
