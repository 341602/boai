<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { Play, Minus, Plus, RotateCcw, MoreHorizontal } from 'lucide-vue-next'
import { TEXTS } from '../constants/texts'
import { useLyricsScroll } from '../composables/useLyricsScroll'
import { useLyricsSettings } from '../composables/useLocalStorage'

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
  showFontControls: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['seek-line'])

const { containerRef, lineRefs, setLineRef, scrollToActiveLine, reset } = useLyricsScroll()
const { settings, increaseFontSize, decreaseFontSize, resetFontSize, getFontSizeStyle } = useLyricsSettings()

const fontControlsExpanded = ref(false)
let autoHideTimer = null

function toggleFontControls() {
  fontControlsExpanded.value = !fontControlsExpanded.value
  if (fontControlsExpanded.value) {
    resetAutoHideTimer()
  } else {
    clearAutoHideTimer()
  }
}

function resetAutoHideTimer() {
  clearAutoHideTimer()
  autoHideTimer = setTimeout(() => {
    fontControlsExpanded.value = false
  }, 3000)
}

function clearAutoHideTimer() {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer)
    autoHideTimer = null
  }
}

function handleContainerClick(event) {
  if (fontControlsExpanded.value) {
    fontControlsExpanded.value = false
    clearAutoHideTimer()
  }
}

function onDecreaseFontSize() {
  decreaseFontSize()
  resetAutoHideTimer()
}

function onResetFontSize() {
  resetFontSize()
  resetAutoHideTimer()
}

function onIncreaseFontSize() {
  increaseFontSize()
  resetAutoHideTimer()
}

onBeforeUnmount(() => {
  clearAutoHideTimer()
})

const selectedIndex = ref(-1)
const pressTimer = ref(null)
const pressedIndex = ref(-1)
const pointerStart = ref({ x: 0, y: 0 })
const longPressTriggered = ref(false)

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

watch(
  () => props.lines,
  () => {
    reset()
    clearSelectedLine()
    clearPressedState()
  },
)

watch(
  () => props.activeIndex,
  async (index) => {
    if (index < 0 || index >= props.lines.length) return

    await scrollToActiveLine(index)
  },
)
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
    @click="handleContainerClick"
  >
    <div v-if="showFontControls" class="lyric-stage__font-controls">
      <button
        v-if="!fontControlsExpanded"
        class="icon-button lyric-stage__font-button"
        type="button"
        title="字体设置"
        aria-label="字体设置"
        @click.stop="toggleFontControls"
      >
        <MoreHorizontal class="button-icon" />
      </button>
      <template v-else>
        <button
          class="icon-button lyric-stage__font-button"
          type="button"
          title="减小字体"
          aria-label="减小字体"
          @click.stop="onDecreaseFontSize"
        >
          <Minus class="button-icon" />
        </button>
        <button
          class="icon-button lyric-stage__font-button"
          type="button"
          title="重置字体"
          aria-label="重置字体"
          @click.stop="onResetFontSize"
        >
          <RotateCcw class="button-icon" />
        </button>
        <button
          class="icon-button lyric-stage__font-button"
          type="button"
          title="增大字体"
          aria-label="增大字体"
          @click.stop="onIncreaseFontSize"
        >
          <Plus class="button-icon" />
        </button>
      </template>
    </div>

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
        :style="getFontSizeStyle()"
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
