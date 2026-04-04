<script setup>
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import GlobalPlayerBar from './components/GlobalPlayerBar.vue'
import { useViewportMode } from './composables/useViewportMode'
import { TEXTS } from './constants/texts'

const route = useRoute()
const { isDesktop } = useViewportMode()
const rootModeClass = computed(() => (isDesktop.value ? 'app-root--desktop' : 'app-root--mobile'))
const showBrand = computed(() => !(route.name === 'player' && !isDesktop.value))
</script>

<template>
  <div class="app-root app-root--with-bar" :class="rootModeClass">
    <div v-if="showBrand" class="app-brand">{{ TEXTS.heroEyebrow }}</div>
    <RouterView />
    <GlobalPlayerBar />
  </div>
</template>
