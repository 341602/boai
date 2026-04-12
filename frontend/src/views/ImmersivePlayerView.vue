<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowDownToLine, ArrowDownUp, ArrowLeft, Check, Heart, ListMusic, ListPlus, X, Shuffle, Repeat1, Trash2 } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import MarqueeText from '../components/MarqueeText.vue'
import PlaylistPickerModal from '../components/PlaylistPickerModal.vue'
import { TEXTS } from '../constants/texts'
import { usePlayerStore } from '../stores/player'
import { formatArtists, getTrackInitial } from '../utils/track'
import { useScreenOrientation } from '../composables/useScreenOrientation'
import { useFullscreen } from '../composables/useFullscreen'

const router = useRouter()
const player = usePlayerStore()
const { isSupported: screenOrientationSupported, lockLandscape, lockPortrait } = useScreenOrientation()
const { isSupported: fullscreenSupported, isFullscreen, enter, exit, toggle } = useFullscreen()

const showImmersiveControls = ref(false)
let hideControlsTimer = null

const { activeLyricIndex, currentQueue, currentQueueSource, currentSong, isCurrentFavorite, lyricLines, playbackMode, playlists } = player

const coverUrl = computed(() => currentSong.value?.album?.picUrl || currentSong.value?.picUrl || '')
const bgStyle = computed(() => {
  if (!coverUrl.value) return {}
  return {
    backgroundImage: `url(${coverUrl.value})`,
  }
})

const playlistPickerOpen = ref(false)
const playlistPickerError = ref('')
const queueOpen = ref(false)
const playbackModeOpen = ref(false)

const playbackModeOptions = [
  {
    value: player.PLAYBACK_MODES.order,
    label: TEXTS.playbackModeOrder,
    icon: ArrowDownUp,
  },
  {
    value: player.PLAYBACK_MODES.shuffle,
    label: TEXTS.playbackModeShuffle,
    icon: Shuffle,
  },
  {
    value: player.PLAYBACK_MODES.single,
    label: TEXTS.playbackModeSingle,
    icon: Repeat1,
  },
]

const selectedPlaylistIds = computed(() =>
  currentSong.value?.cid
    ? playlists.value
        .filter((playlist) => player.playlistContainsSong(playlist.id, currentSong.value.cid))
        .map((playlist) => playlist.id)
    : [],
)

const mobilePreview = computed(() => {
  if (!lyricLines.value.length) {
    return {
      lines: [],
      activeIndex: -1,
    }
  }

  const safeIndex = Math.min(Math.max(activeLyricIndex.value, 0), lyricLines.value.length - 1)
  const start = Math.max(0, safeIndex - 2)
  const end = Math.min(lyricLines.value.length, safeIndex + 3)

  return {
    lines: lyricLines.value.slice(start, end),
    activeIndex: safeIndex - start,
  }
})

const playbackModeLabel = computed(
  () => playbackModeOptions.find((option) => option.value === playbackMode.value)?.label || TEXTS.playbackModeOrder,
)

const playbackModeIcon = computed(
  () => playbackModeOptions.find((option) => option.value === playbackMode.value)?.icon || ArrowDownUp,
)

const currentQueueTitle = computed(() => {
  if (currentQueueSource.value === 'favorites') {
    return TEXTS.favoritesCollection
  }

  if (currentQueueSource.value === 'recent') {
    return TEXTS.recentTitle
  }

  if (currentQueueSource.value?.startsWith('playlist:')) {
    const playlistId = currentQueueSource.value.slice('playlist:'.length)
    return playlists.value.find((item) => item.id === playlistId)?.name || TEXTS.queueTitle
  }

  if (currentQueueSource.value === 'search') {
    return TEXTS.resultTitle
  }

  return TEXTS.queueTitle
})

const overlayOpen = computed(() => queueOpen.value || playbackModeOpen.value)

function toggleImmersiveControls() {
  showImmersiveControls.value = !showImmersiveControls.value
  resetHideTimer()
  
  if (showImmersiveControls.value) {
    document.body.classList.add('immersive-controls-shown')
  } else {
    document.body.classList.remove('immersive-controls-shown')
  }
}

function resetHideTimer() {
  if (hideControlsTimer) {
    clearTimeout(hideControlsTimer)
  }
  if (showImmersiveControls.value) {
    hideControlsTimer = setTimeout(() => {
      showImmersiveControls.value = false
      document.body.classList.remove('immersive-controls-shown')
    }, 3000)
  }
}

async function exitImmersiveMode() {
  try {
    lockPortrait()
  } catch (e) {}
  
  try {
    await exit()
  } catch (e) {}
  
  router.back()
}

function openPlaylistPicker() {
  if (!currentSong.value?.cid) {
    return
  }

  playlistPickerError.value = ''
  playlistPickerOpen.value = true
}

function closePlaylistPicker() {
  playlistPickerOpen.value = false
  playlistPickerError.value = ''
}

function addToPlaylist(playlistId) {
  const result = player.addSongToPlaylist(playlistId, currentSong.value)

  if (!result.ok) {
    playlistPickerError.value = result.message || ''
    return
  }

  closePlaylistPicker()
}

function createAndAddPlaylist(name) {
  const created = player.createPlaylist(name)

  if (!created.ok) {
    playlistPickerError.value = created.message || ''
    return
  }

  const added = player.addSongToPlaylist(created.playlist.id, currentSong.value)

  if (!added.ok) {
    playlistPickerError.value = added.message || ''
    return
  }

  closePlaylistPicker()
}

function toggleQueuePanel() {
  if (!currentSong.value?.cid) {
    return
  }

  playbackModeOpen.value = false
  queueOpen.value = !queueOpen.value
  resetHideTimer()
}

function closeQueuePanel() {
  queueOpen.value = false
}

function togglePlaybackModePanel() {
  if (!currentSong.value?.cid) {
    return
  }

  queueOpen.value = false
  playbackModeOpen.value = !playbackModeOpen.value
  resetHideTimer()
}

function closePlaybackModePanel() {
  playbackModeOpen.value = false
}

function choosePlaybackMode(mode) {
  player.setPlaybackMode(mode)
  playbackModeOpen.value = false
}

async function playQueueSong(index) {
  await player.playQueueIndex(index)
  queueOpen.value = false
}

function queueSongAsNext(index) {
  player.queueSongNext(index)
}

async function removeQueueSong(index) {
  await player.removeQueueItem(index)

  if (!currentQueue.value.length || !currentSong.value?.cid) {
    queueOpen.value = false
  }
}

watch(overlayOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

onMounted(async () => {
  try {
    await lockLandscape()
  } catch (e) {}
  
  try {
    await enter()
  } catch (e) {}
  
  document.body.style.overflow = 'hidden'
  document.body.classList.remove('immersive-controls-shown')
})

onBeforeUnmount(() => {
  if (hideControlsTimer) {
    clearTimeout(hideControlsTimer)
  }
  document.body.style.overflow = ''
  document.body.classList.remove('immersive-controls-shown')
})
</script>

<template>
  <div class="immersive-player">
    <div v-if="coverUrl" class="immersive-player__bg-blur" :style="bgStyle" />

    <!-- 动感光波背景 - 水波纹 -->
    <div class="immersive-player__sound-waves">
      <!-- 左边的波纹 -->
      <div class="immersive-player__sound-wave immersive-player__sound-wave--left-1"></div>
      <div class="immersive-player__sound-wave immersive-player__sound-wave--left-2"></div>
      <div class="immersive-player__sound-wave immersive-player__sound-wave--left-3"></div>
      <!-- 右边的波纹 -->
      <div class="immersive-player__sound-wave immersive-player__sound-wave--right-1"></div>
      <div class="immersive-player__sound-wave immersive-player__sound-wave--right-2"></div>
      <div class="immersive-player__sound-wave immersive-player__sound-wave--right-3"></div>
    </div>

    <div class="immersive-player__content" @click="toggleImmersiveControls">
      <!-- Header - 点击显示时显示 -->
      <header v-if="showImmersiveControls" class="immersive-player__header">
        <button class="icon-button" type="button" :title="TEXTS.back" :aria-label="TEXTS.back" @click.stop="exitImmersiveMode">
          <ArrowLeft class="button-icon" />
        </button>
        
        <div class="immersive-player__actions">
          <button
            class="icon-button"
            type="button"
            :disabled="!currentSong"
            :title="playbackModeLabel"
            :aria-label="playbackModeLabel"
            @click.stop="togglePlaybackModePanel"
          >
            <component :is="playbackModeIcon" class="button-icon" />
          </button>
          <button
            class="icon-button"
            type="button"
            :disabled="!currentSong"
            :title="TEXTS.queueTitle"
            :aria-label="TEXTS.queueTitle"
            @click.stop="toggleQueuePanel"
          >
            <ListMusic class="button-icon" />
          </button>
          <button
            class="icon-button"
            :class="{ 'icon-button--active': isCurrentFavorite }"
            type="button"
            :title="isCurrentFavorite ? TEXTS.unfavorite : TEXTS.favorite"
            :aria-label="isCurrentFavorite ? TEXTS.unfavorite : TEXTS.favorite"
            @click.stop="player.toggleFavorite()"
          >
            <Heart class="button-icon button-icon--favorite" />
          </button>
          <button
            class="icon-button"
            type="button"
            :disabled="!currentSong"
            :title="TEXTS.playlistAdd"
            :aria-label="TEXTS.playlistAdd"
            @click.stop="openPlaylistPicker"
          >
            <ListPlus class="button-icon" />
          </button>
        </div>
      </header>

      <!-- 居中歌词显示 -->
      <div class="immersive-player__lyrics-center">
        <!-- 歌词预览 - 只显示当前的一句 -->
        <div class="immersive-player__lyric-preview">
          <template v-if="mobilePreview.lines.length && mobilePreview.activeIndex >= 0">
            <p
              class="immersive-player__lyric-preview-line immersive-player__lyric-preview-line--active"
            >
              {{ mobilePreview.lines[mobilePreview.activeIndex].text }}
            </p>
          </template>
          <p v-else class="immersive-player__lyric-preview-line immersive-player__lyric-preview-line--empty">
            {{ TEXTS.noLyrics }}
          </p>
        </div>
      </div>
    </div>

    <PlaylistPickerModal
      :open="playlistPickerOpen"
      :song="currentSong"
      :playlists="playlists"
      :selected-ids="selectedPlaylistIds"
      :error-text="playlistPickerError"
      @close="closePlaylistPicker"
      @add="addToPlaylist"
      @create-and-add="createAndAddPlaylist"
    />

    <div v-if="playbackModeOpen" class="player-panel-overlay" @click="closePlaybackModePanel">
      <section class="surface player-panel player-panel--mode" @click.stop>
        <header class="player-panel__header">
          <div class="player-panel__meta">
            <span>{{ TEXTS.playbackModeTitle }}</span>
            <h2>{{ playbackModeLabel }}</h2>
          </div>
          <button class="icon-button" type="button" :title="TEXTS.close" :aria-label="TEXTS.close" @click="closePlaybackModePanel">
            <X class="button-icon" />
          </button>
        </header>

        <div class="player-mode-list">
          <button
            v-for="option in playbackModeOptions"
            :key="option.value"
            class="player-mode-option"
            :class="{ 'player-mode-option--active': option.value === playbackMode }"
            type="button"
            @click="choosePlaybackMode(option.value)"
          >
            <span class="player-mode-option__icon">
              <component :is="option.icon" class="button-icon" />
            </span>
            <strong>{{ option.label }}</strong>
            <Check v-if="option.value === playbackMode" class="button-icon" />
          </button>
        </div>
      </section>
    </div>

    <div v-if="queueOpen" class="player-panel-overlay" @click="closeQueuePanel">
      <section class="surface player-panel player-panel--queue" @click.stop>
        <header class="player-panel__header">
          <div class="player-panel__meta">
            <span>{{ TEXTS.queueTitle }}</span>
            <h2>{{ currentQueueTitle }}</h2>
            <p>{{ currentQueue.length }} {{ TEXTS.trackUnit }}</p>
          </div>
          <button class="icon-button" type="button" :title="TEXTS.close" :aria-label="TEXTS.close" @click="closeQueuePanel">
            <X class="button-icon" />
          </button>
        </header>

        <div v-if="!currentQueue.length" class="empty-state empty-state--modal">
          {{ TEXTS.queueEmpty }}
        </div>

        <div v-else class="player-queue-list">
          <article
            v-for="(song, index) in currentQueue"
            :key="song.cid || `${song.id}-${index}`"
            class="player-queue-row"
            :class="{ 'player-queue-row--active': song.cid === currentSong?.cid }"
          >
            <button class="player-queue-row__main" type="button" @click="playQueueSong(index)">
              <span class="player-queue-row__index">{{ String(index + 1).padStart(2, '0') }}</span>

              <div v-if="song.album?.picUrl || song.picUrl" class="player-queue-row__cover">
                <img :src="song.album?.picUrl || song.picUrl" :alt="song.name" />
              </div>
              <div v-else class="player-queue-row__cover player-queue-row__cover--fallback">
                {{ getTrackInitial(song) }}
              </div>

              <div class="player-queue-row__meta">
                <MarqueeText tag="strong" :text="song.name" />
                <MarqueeText tag="p" :text="formatArtists(song)" />
              </div>
            </button>

            <div class="player-queue-row__actions">
              <button
                class="icon-button"
                type="button"
                :disabled="song.cid === currentSong?.cid"
                :title="TEXTS.queuePlayNext"
                :aria-label="TEXTS.queuePlayNext"
                @click="queueSongAsNext(index)"
              >
                <ArrowDownToLine class="button-icon" />
              </button>
              <button
                class="icon-button icon-button--danger"
                type="button"
                :title="TEXTS.remove"
                :aria-label="TEXTS.remove"
                @click="removeQueueSong(index)"
              >
                <Trash2 class="button-icon" />
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.immersive-player {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: 1000;
}

.immersive-player__bg-blur {
  position: absolute;
  inset: -50px;
  z-index: 0;
  background-size: cover;
  background-position: center center;
  background-repeat: no-repeat;
  filter: blur(80px) saturate(140%) brightness(0.45);
  transform: scale(1.2);
}

.immersive-player::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(
    180deg,
    rgba(15, 18, 25, 0.18) 0%,
    rgba(15, 18, 25, 0.06) 22%,
    transparent 42%,
    rgba(15, 18, 25, 0.08) 72%,
    rgba(15, 18, 25, 0.45) 92%,
    rgba(15, 18, 25, 0.7) 100%
  );
  pointer-events: none;
}

/* 水波纹样式的动感光波 - 从两边向中间散发 */
.immersive-player__sound-waves {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  overflow: hidden;
}

.immersive-player__sound-wave {
  position: absolute;
  top: 50%;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: radial-gradient(circle, transparent 50%, rgba(255, 255, 255, 0.05) 70%, transparent 80%);
}

/* 左边的波纹 */
.immersive-player__sound-wave--left-1 {
  left: 0;
  transform: translate(-50%, -50%);
  animation: waterWave 3.5s ease-out infinite;
  animation-delay: 0s;
}

.immersive-player__sound-wave--left-2 {
  left: 0;
  transform: translate(-50%, -50%);
  animation: waterWave 3.5s ease-out infinite;
  animation-delay: 1.2s;
}

.immersive-player__sound-wave--left-3 {
  left: 0;
  transform: translate(-50%, -50%);
  animation: waterWave 3.5s ease-out infinite;
  animation-delay: 2.4s;
}

/* 右边的波纹 */
.immersive-player__sound-wave--right-1 {
  right: 0;
  transform: translate(50%, -50%);
  animation: waterWave 3.5s ease-out infinite;
  animation-delay: 0s;
}

.immersive-player__sound-wave--right-2 {
  right: 0;
  transform: translate(50%, -50%);
  animation: waterWave 3.5s ease-out infinite;
  animation-delay: 1.2s;
}

.immersive-player__sound-wave--right-3 {
  right: 0;
  transform: translate(50%, -50%);
  animation: waterWave 3.5s ease-out infinite;
  animation-delay: 2.4s;
}

@keyframes waterWave {
  0% {
    width: 10vh;
    height: 10vh;
    opacity: 0.7;
  }
  100% {
    width: 100vh;
    height: 100vh;
    opacity: 0;
  }
}

.immersive-player__content {
  position: relative;
  z-index: 10;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.immersive-player__header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
  padding: calc(12px + env(safe-area-inset-top, 0px)) 16px 12px;
  border-bottom: none;
  background: transparent;
  z-index: 15;
  position: relative;
}

.immersive-player__actions {
  justify-content: flex-end;
  gap: 4px;
  padding: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.09);
  border: 1px solid rgba(255, 255, 255, 0.11);
}

.immersive-player__header .icon-button {
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(12px) saturate(140%);
  -webkit-backdrop-filter: blur(12px) saturate(140%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.immersive-player__lyrics-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  text-align: center;
  padding: 20px 40px;
  position: relative;
  z-index: 11;
}

.immersive-player__lyric-preview {
  flex: 0 0 auto;
  min-height: 120px;
  max-height: 160px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 16px;
  background: transparent;
  border: none;
  padding: 0;
  text-align: center;
}

.immersive-player__lyric-preview-line {
  text-align: center;
  font-size: clamp(1.4rem, 3vw, 2rem);
  line-height: 1.5;
  transition: all 0.3s ease;
  color: rgba(255, 255, 255, 0.4);
}

.immersive-player__lyric-preview-line--near {
  color: rgba(255, 255, 255, 0.6);
}

.immersive-player__lyric-preview-line--active {
  font-size: clamp(1.8rem, 4vw, 2.6rem);
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
  letter-spacing: 0.02em;
}

.immersive-player__lyric-preview-line--empty {
  color: rgba(255, 255, 255, 0.4);
}

.immersive-player__seek-row {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 600px;
  margin-top: 20px;
}

.immersive-player__time {
  font-size: 0.72rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.immersive-player__range {
  width: 100%;
  height: 28px;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  cursor: pointer;
  outline: none;
  --progress: 0%;
}

.immersive-player__range::-webkit-slider-runnable-track {
  height: 3px;
  border-radius: 2px;
  background: linear-gradient(to right, #ffffff var(--progress), rgba(255, 255, 255, 0.12) var(--progress));
}

.immersive-player__range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.2);
  margin-top: -5.25px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.immersive-player__controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 48px;
  margin-top: 16px;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.immersive-player__controls .icon-button--large {
  width: 72px;
  height: 72px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05));
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.immersive-player__controls .icon-button:not(.icon-button--large) {
  width: 48px;
  height: 48px;
  opacity: 0.9;
}
</style>
