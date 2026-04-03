<script setup>
import { computed } from 'vue'
import { RouterView } from 'vue-router'
import GlobalPlayerBar from './components/GlobalPlayerBar.vue'
import { useViewportMode } from './composables/useViewportMode'
import { TEXTS } from './constants/texts'

const { isDesktop } = useViewportMode()
const rootModeClass = computed(() => (isDesktop.value ? 'app-root--desktop' : 'app-root--mobile'))
</script>

<template>
  <div class="app-root app-root--with-bar" :class="rootModeClass">
    <div class="app-brand">{{ TEXTS.heroEyebrow }}</div>
    <RouterView />
    <GlobalPlayerBar />
  </div>
</template>
