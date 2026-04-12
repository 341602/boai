<script setup>
import { computed, watch, onMounted, onUnmounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import GlobalPlayerBar from './components/GlobalPlayerBar.vue'
import { useViewportMode } from './composables/useViewportMode'
import { TEXTS } from './constants/texts'

const route = useRoute()
const { isDesktop } = useViewportMode()
const rootModeClass = computed(() => (isDesktop.value ? 'app-root--desktop' : 'app-root--mobile'))
const showBrand = computed(() => !(route.name === 'player' && !isDesktop.value) && !(route.name === 'immersive' && !isDesktop.value))
const showWithBar = computed(() => !(route.name === 'player' && !isDesktop.value) && !(route.name === 'immersive' && !isDesktop.value))

const lockOrientation = async (orientation) => {
  if (isDesktop.value) return
  
  try {
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock(orientation)
    }
  } catch (error) {
    console.log('Screen orientation lock not supported:', error)
  }
}

const unlockOrientation = () => {
  if (isDesktop.value) return
  
  try {
    if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock()
    }
  } catch (error) {
    console.log('Screen orientation unlock not supported:', error)
  }
}

const updateOrientation = () => {
  if (isDesktop.value) return
  
  if (route.name === 'immersive') {
    lockOrientation('landscape')
  } else {
    lockOrientation('portrait')
  }
}

const stopOrientationWatch = watch(() => route.name, () => {
  updateOrientation()
}, { immediate: true })

onMounted(() => {
  updateOrientation()
})

onUnmounted(() => {
  stopOrientationWatch()
  unlockOrientation()
})
</script>

<template>
  <div class="app-root" :class="[rootModeClass, showWithBar ? 'app-root--with-bar' : '', route.name === 'immersive' ? 'app-root--immersive' : '']">
    <div v-if="showBrand" class="app-brand">{{ TEXTS.heroEyebrow }}</div>
    <RouterView />
    <GlobalPlayerBar />
  </div>
</template>
