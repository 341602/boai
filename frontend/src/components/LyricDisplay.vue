<script setup>
import { nextTick, ref, watch } from 'vue'
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
    await nextTick()
    lineRefs.value[index]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  },
)
</script>

<template>
  <div v-if="!lines.length" class="empty-state empty-state--lyric">
    {{ emptyText }}
  </div>

  <div
    v-else
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
