<script setup>
import { computed, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import GlobalPlayerBar from './components/GlobalPlayerBar.vue'
import { useViewportMode } from './composables/useViewportMode'
import { useScreenOrientation } from './composables/useScreenOrientation'
import { TEXTS } from './constants/texts'

const route = useRoute()
const { isDesktop } = useViewportMode()
const { isSupported, lockLandscape, lockPortrait } = useScreenOrientation()

const rootModeClass = computed(() => (isDesktop.value ? 'app-root--desktop' : 'app-root--mobile'))
const showBrand = computed(() => !(route.name === 'player' && !isDesktop.value) && !(route.name === 'immersive' && !isDesktop.value))
const showWithBar = computed(() => !(route.name === 'player' && !isDesktop.value) && !(route.name === 'immersive' && !isDesktop.value))

watch(() => route.name, () => {
  if (isDesktop.value) return
  
  if (route.name === 'immersive') {
    lockLandscape()
  } else {
    lockPortrait()
  }
}, { immediate: true })
</script>

<template>
  <div class="app-root" :class="[rootModeClass, showWithBar ? 'app-root--with-bar' : '', route.name === 'immersive' ? 'app-root--immersive' : '']">
    <div v-if="showBrand" class="app-brand">{{ TEXTS.heroEyebrow }}</div>
    <RouterView />
    <GlobalPlayerBar />
  </div>
</template>
