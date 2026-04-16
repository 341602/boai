<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { House, ListMusic, Pause, Play, Settings2, SkipBack, SkipForward } from 'lucide-vue-next'
import MarqueeText from './MarqueeText.vue'
import { useRoute, useRouter } from 'vue-router'
import { useViewportMode } from '../composables/useViewportMode'
import { TEXTS } from '../constants/texts'
import { lastNonPlayerRoute } from '../router'
import { usePlayerStore } from '../stores/player'
import { formatTime } from '../utils/lyrics'
import { formatArtists, getTrackInitial } from '../utils/track'

const route = useRoute()
const router = useRouter()
const player = usePlayerStore()
const { isDesktop } = useViewportMode()

const seekMax = computed(() => player.duration.value || player.currentTime.value || 0)
const canSeek = computed(() => Boolean(player.currentSong.value?.cid && seekMax.value > 0))
const mobilePanel = ref('player')
const suppressTap = ref(false)
const swipeStartX = ref(0)
const swiping = ref(false)
const trackChanging = ref(false)
let trackChangeTimer = null

const mobileNavItems = [
  {
    name: 'home',
    label: TEXTS.navHome,
    icon: House,
  },
  {
    name: 'playlist',
    label: TEXTS.navPlaylist,
    icon: ListMusic,
  },
  {
    name: 'settings',
    label: TEXTS.navSettings,
    icon: Settings2,
  },
]

const mobileTrackStyle = computed(() => ({
  transform: mobilePanel.value === 'player' ? 'translateX(0%)' : 'translateX(-50%)',
}))

const currentTrackKey = computed(() => player.currentSong.value?.cid || player.currentSong.value?.id || '')

function armTapSuppression() {
  suppressTap.value = true
  window.setTimeout(() => {
    suppressTap.value = false
  }, 220)
}

function openPlayer() {
  if (suppressTap.value) {
    return
  }

  if (!player.currentSong.value?.cid || route.name === 'player') {
    return
  }

  router.push({ name: 'player' })
}

function togglePlayerPage() {
  if (suppressTap.value || !player.currentSong.value?.cid) {
    return
  }

  if (route.name === 'player') {
    router.push(lastNonPlayerRoute.value || { name: 'home' })
    return
  }

  router.push({ name: 'player' })
}

function goTo(name) {
  if (suppressTap.value || route.name === name) {
    mobilePanel.value = 'player'
    return
  }

  mobilePanel.value = 'player'
  router.push({ name })
}

function shouldIgnoreSwipeTarget(target) {
  if (!(target instanceof Element)) {
    return true
  }

  return Boolean(
    target.closest('input[type="range"]') ||
      target.closest('.global-player__controls') ||
      target.closest('.global-player__nav-action'),
  )
}

function handleTouchStart(event) {
  if (isDesktop.value || route.name === 'immersive' || shouldIgnoreSwipeTarget(event.target)) {
    swiping.value = false
    return
  }

  swipeStartX.value = event.touches[0]?.clientX || 0
  swiping.value = true
}

function handleTouchEnd(event) {
  if (!swiping.value) {
    return
  }

  const endX = event.changedTouches[0]?.clientX || 0
  const deltaX = endX - swipeStartX.value
  swiping.value = false
  swipeStartX.value = 0

  if (mobilePanel.value === 'player' && deltaX > 44 && route.name !== 'immersive') {
    mobilePanel.value = 'nav'
    armTapSuppression()
    return
  }

  if (mobilePanel.value === 'nav' && deltaX < -44) {
    mobilePanel.value = 'player'
    armTapSuppression()
  }
}

watch(currentTrackKey, (next, previous) => {
  if (!next || !previous || next === previous) {
    return
  }

  trackChanging.value = true
  window.clearTimeout(trackChangeTimer)
  trackChangeTimer = window.setTimeout(() => {
    trackChanging.value = false
  }, 360)
})

onBeforeUnmount(() => {
  window.clearTimeout(trackChangeTimer)
})
</script>

<template>
  <footer
    class="global-player surface"
    :class="{
      'global-player--mobile-nav': !isDesktop && mobilePanel === 'nav',
      'global-player--playing': player.isPlaying.value,
      'global-player--track-changing': trackChanging,
    }"
  >
    <template v-if="isDesktop">
      <button class="global-player__art" type="button" @click="togglePlayerPage">
        <div v-if="player.currentSong.value?.album?.picUrl || player.currentSong.value?.picUrl" class="global-player__cover">
          <img
            :src="player.currentSong.value?.album?.picUrl || player.currentSong.value?.picUrl"
            :alt="player.currentSong.value?.name || 'cover'"
          />
        </div>
        <div v-else class="global-player__cover global-player__cover--fallback">
          {{ getTrackInitial(player.currentSong.value) }}
        </div>
      </button>

      <button class="global-player__track" type="button" @click="openPlayer">
        <div class="global-player__meta">
          <MarqueeText tag="strong" :text="player.currentSong.value?.name || TEXTS.notPlaying" />
          <MarqueeText
            v-if="player.currentSong.value"
            tag="p"
            :text="formatArtists(player.currentSong.value)"
          />
        </div>
      </button>

      <label class="global-player__seek-row">
        <span class="global-player__time">{{ formatTime(player.currentTime.value) }}</span>
        <input
          class="global-player__range"
          type="range"
          min="0"
          :max="seekMax"
          step="0.1"
          :value="player.currentTime.value"
          :disabled="!canSeek"
          @input="player.seekTo($event.target.value)"
        />
        <span class="global-player__time">{{ formatTime(player.duration.value) }}</span>
      </label>

      <div class="global-player__controls">
        <button class="icon-button" type="button" :title="TEXTS.prev" :aria-label="TEXTS.prev" @click="player.playPrevious">
          <SkipBack class="button-icon" />
        </button>
        <button
          class="icon-button icon-button--solid"
          type="button"
          :title="player.isPlaying.value ? TEXTS.pause : TEXTS.play"
          :aria-label="player.isPlaying.value ? TEXTS.pause : TEXTS.play"
          @click="player.togglePlayback"
        >
          <Pause v-if="player.isPlaying.value" class="button-icon" />
          <Play v-else class="button-icon" />
        </button>
        <button class="icon-button" type="button" :title="TEXTS.next" :aria-label="TEXTS.next" @click="player.playNext">
          <SkipForward class="button-icon" />
        </button>
      </div>
    </template>

    <div
      v-else
      class="global-player__mobile-viewport"
      @touchstart.passive="handleTouchStart"
      @touchend.passive="handleTouchEnd"
      @touchcancel="swiping = false"
    >
      <div class="global-player__mobile-track" :style="mobileTrackStyle">
        <section class="global-player__mobile-panel global-player__mobile-panel--player">
          <button class="global-player__art" type="button" @click="togglePlayerPage">
            <div
              v-if="player.currentSong.value?.album?.picUrl || player.currentSong.value?.picUrl"
              class="global-player__cover"
            >
              <img
                :src="player.currentSong.value?.album?.picUrl || player.currentSong.value?.picUrl"
                :alt="player.currentSong.value?.name || 'cover'"
              />
            </div>
            <div v-else class="global-player__cover global-player__cover--fallback">
              {{ getTrackInitial(player.currentSong.value) }}
            </div>
          </button>

          <button class="global-player__track" type="button" @click="openPlayer">
            <div class="global-player__meta">
              <MarqueeText tag="strong" :text="player.currentSong.value?.name || TEXTS.notPlaying" />
              <MarqueeText
                v-if="player.currentSong.value"
                tag="p"
                :text="formatArtists(player.currentSong.value)"
              />
            </div>
          </button>

          <label class="global-player__seek-row">
            <span class="global-player__time">{{ formatTime(player.currentTime.value) }}</span>
            <input
              class="global-player__range"
              type="range"
              min="0"
              :max="seekMax"
              step="0.1"
              :value="player.currentTime.value"
              :disabled="!canSeek"
              @input="player.seekTo($event.target.value)"
            />
            <span class="global-player__time">{{ formatTime(player.duration.value) }}</span>
          </label>

          <div class="global-player__controls">
            <button class="icon-button" type="button" :title="TEXTS.prev" :aria-label="TEXTS.prev" @click="player.playPrevious">
              <SkipBack class="button-icon" />
            </button>
            <button
              class="icon-button icon-button--solid"
              type="button"
              :title="player.isPlaying.value ? TEXTS.pause : TEXTS.play"
              :aria-label="player.isPlaying.value ? TEXTS.pause : TEXTS.play"
              @click="player.togglePlayback"
            >
              <Pause v-if="player.isPlaying.value" class="button-icon" />
              <Play v-else class="button-icon" />
            </button>
            <button class="icon-button" type="button" :title="TEXTS.next" :aria-label="TEXTS.next" @click="player.playNext">
              <SkipForward class="button-icon" />
            </button>
          </div>
        </section>

        <section class="global-player__mobile-panel global-player__mobile-panel--nav">
          <button
            v-for="item in mobileNavItems"
            :key="item.name"
            class="global-player__nav-action"
            :class="{ 'global-player__nav-action--active': route.name === item.name }"
            type="button"
            :title="item.label"
            :aria-label="item.label"
            @click="goTo(item.name)"
          >
            <component :is="item.icon" class="button-icon" />
          </button>
        </section>
      </div>
    </div>
  </footer>
</template>
