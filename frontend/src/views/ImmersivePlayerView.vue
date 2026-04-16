<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import { ArrowDownToLine, ArrowDownUp, ArrowLeft, Check, Heart, ListMusic, ListPlus, X, Shuffle, Repeat1, Trash2, Palette } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import MarqueeText from '../components/MarqueeText.vue'
import PlaylistPickerModal from '../components/PlaylistPickerModal.vue'
import { useViewportMode } from '../composables/useViewportMode'
import { TEXTS } from '../constants/texts'
import { usePlayerStore } from '../stores/player'
import { formatArtists, getTrackInitial } from '../utils/track'
import { useScreenOrientation } from '../composables/useScreenOrientation'
import { useFullscreen } from '../composables/useFullscreen'

const router = useRouter()
const player = usePlayerStore()
const { isMobile } = useViewportMode()
const { lockLandscape, lockPortrait } = useScreenOrientation()
const { enter, exit } = useFullscreen()

const showImmersiveControls = ref(false)
const trackPulse = ref(false)
let hideControlsTimer = null
let trackPulseTimer = null

const { activeLyricIndex, currentQueue, currentQueueSource, currentSong, isCurrentFavorite, lyricLines, playbackMode, playlists, isPlaying, currentTime } = player

const coverUrl = computed(() => currentSong.value?.album?.picUrl || currentSong.value?.picUrl || '')
const currentTrackKey = computed(() => currentSong.value?.cid || currentSong.value?.id || '')
const isLiteImmersive = computed(() => isMobile.value)
const waveCount = computed(() => (isLiteImmersive.value ? 8 : 6))
const starCount = computed(() => (isLiteImmersive.value ? 10 : 50))
const glowOrbIndexes = computed(() => (isLiteImmersive.value ? [1, 2] : [1, 2, 3, 4]))
const spectrumBarCount = computed(() => (isLiteImmersive.value ? 14 : 36))

const spectrumArray = ref([])
let audioContext = null
let analyser = null
let source = null
let animationFrameId = null
let tempArray = null
let audioInitAttempts = 0

const immersiveStyle = computed(() => ({
  ...waveColorStyle.value,
  '--immersive-bg-blur': isLiteImmersive.value ? '42px' : '80px',
  '--immersive-bg-scale': isLiteImmersive.value ? '1.08' : '1.2',
}))

const spectrumBars = computed(() => {
  if (!spectrumArray.value.length) {
    return []
  }

  const targetCount = spectrumBarCount.value
  const step = Math.max(1, Math.floor(spectrumArray.value.length / targetCount))

  return Array.from({ length: targetCount }, (_, index) => {
    const valueIndex = Math.min(spectrumArray.value.length - 1, index * step)
    return spectrumArray.value[valueIndex] || 0
  })
})

function getWaveStyle(index) {
  const total = Math.max(1, waveCount.value)
  const progress = index / total
  const edgeFalloff = Math.max(0.08, 0.26 - progress * 0.017)
  const ringFalloff = Math.max(0.06, 0.2 - progress * 0.012)
  const shadowFalloff = Math.max(0.05, 0.16 - progress * 0.01)
  const driftX = (index % 2 === 0 ? -1 : 1) * (1.4 + progress * 1.6)
  const driftY = ((index % 3) - 1) * (0.9 + progress * 1.1)
  const baseSize = isLiteImmersive.value ? 34 : 28

  return {
    animationDelay: `${index * 0.86 + progress * 0.35}s`,
    '--ripple-duration': `${7.4 + progress * 1.1}s`,
    '--ripple-size': `${baseSize + progress * 18}vmin`,
    '--wave-core-alpha': edgeFalloff.toFixed(3),
    '--wave-ring-alpha': ringFalloff.toFixed(3),
    '--wave-shadow-alpha': shadowFalloff.toFixed(3),
    '--wave-drift-x': driftX.toFixed(2),
    '--wave-drift-y': driftY.toFixed(2),
  }
}

function initAudioAnalysis() {
  if (audioInitAttempts > 5) return
  
  try {
    const audio = document.querySelector('audio')
    if (!audio) {
      audioInitAttempts++
      setTimeout(initAudioAnalysis, 500)
      return
    }

    if (audioContext) {
      return
    }

    audioContext = new (window.AudioContext || window.webkitAudioContext)()
    analyser = audioContext.createAnalyser()
    analyser.fftSize = isLiteImmersive.value ? 128 : 256
    analyser.smoothingTimeConstant = isLiteImmersive.value ? 0.72 : 0.6
    analyser.minDecibels = -90
    analyser.maxDecibels = -10
    
    source = audioContext.createMediaElementSource(audio)
    source.connect(analyser)
    analyser.connect(audioContext.destination)

    const bufferLength = analyser.frequencyBinCount
    tempArray = new Uint8Array(bufferLength)
    spectrumArray.value = new Array(bufferLength).fill(0)

    startSpectrumLoop()
  } catch (e) {
    console.error('Audio analysis init failed:', e)
    audioInitAttempts++
    setTimeout(initAudioAnalysis, 500)
  }
}

function stopSpectrumLoop() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}

function startSpectrumLoop() {
  if (animationFrameId || !analyser || !tempArray || currentTheme.value !== 'spectrum') {
    return
  }

  let lastFrameTime = 0
  const frameInterval = isLiteImmersive.value ? 150 : 48

  const tick = (timestamp = 0) => {
    if (!analyser || !tempArray || currentTheme.value !== 'spectrum') {
      animationFrameId = null
      return
    }

    animationFrameId = requestAnimationFrame(tick)

    if (timestamp - lastFrameTime < frameInterval) {
      return
    }

    lastFrameTime = timestamp
    analyser.getByteFrequencyData(tempArray)
    spectrumArray.value = Array.from(tempArray)
  }

  animationFrameId = requestAnimationFrame(tick)
}

function getSpectrumBarStyle(value) {
  const normalizedValue = Math.pow(value / 255, 0.5)
  const height = Math.max(3, Math.min(100, normalizedValue * 100))
  const { r, g, b } = dominantColor.value
  const opacity = 0.5 + normalizedValue * 0.5
  return {
    height: `${height}%`,
    background: `linear-gradient(to top, rgba(${r}, ${g}, ${b}, ${opacity}), rgba(255, 255, 255, ${opacity * 0.95}))`
  }
}
const bgStyle = computed(() => {
  if (!coverUrl.value) return {}
  return {
    backgroundImage: `url(${coverUrl.value})`,
  }
})

const dominantColor = ref({ r: 255, g: 255, b: 255 })
const colorLoaded = ref(false)

async function extractDominantColor(imageUrl) {
  if (!imageUrl) {
    dominantColor.value = { r: 255, g: 255, b: 255 }
    colorLoaded.value = false
    return
  }

  try {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.src = imageUrl + '?t=' + Date.now()

    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = 50
    canvas.height = 50
    ctx.drawImage(img, 0, 0, 50, 50)

    const imageData = ctx.getImageData(0, 0, 50, 50)
    const data = imageData.data
    let r = 0, g = 0, b = 0, count = 0

    for (let i = 0; i < data.length; i += 4) {
      const pixelR = data[i]
      const pixelG = data[i + 1]
      const pixelB = data[i + 2]
      const brightness = (pixelR + pixelG + pixelB) / 3

      if (brightness > 30 && brightness < 230) {
        r += pixelR
        g += pixelG
        b += pixelB
        count++
      }
    }

    if (count > 0) {
      dominantColor.value = {
        r: Math.round(r / count),
        g: Math.round(g / count),
        b: Math.round(b / count)
      }
    } else {
      dominantColor.value = { r: 255, g: 255, b: 255 }
    }
    colorLoaded.value = true
  } catch (e) {
    console.error('Failed to extract color:', e)
    dominantColor.value = { r: 255, g: 255, b: 255 }
    colorLoaded.value = false
  }
}

const THEMES = [
  { id: 'water-waves', name: '姘存尝绾?, icon: '馃寠' },
  { id: 'star-particles', name: '绻佹槦', icon: '鉁? },
  { id: 'spectrum', name: '寰嬪姩', icon: '馃幍' },
  { id: 'glow', name: '鍏夋檿', icon: '馃挮' }
]

const currentTheme = ref(localStorage.getItem('immersive-theme') || 'water-waves')

function setTheme(themeId) {
  currentTheme.value = themeId
  localStorage.setItem('immersive-theme', themeId)
}

const waveColorStyle = computed(() => {
  const { r, g, b } = dominantColor.value
  return {
    '--wave-color': `rgba(${r}, ${g}, ${b}, 0.18)`,
    '--wave-color-strong': `rgba(${r}, ${g}, ${b}, 0.35)`,
    '--wave-glow': `rgba(${r}, ${g}, ${b}, 0.15)`,
    '--accent-r': r,
    '--accent-g': g,
    '--accent-b': b
  }
})

const starStyles = ref([])

function initStarStyles() {
  const styles = []
  for (let i = 0; i < starCount.value; i++) {
    const isBright = Math.random() > 0.7
    styles.push({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: isLiteImmersive.value
        ? (isBright ? Math.random() * 2 + 1.5 : Math.random() * 1.4 + 0.8)
        : (isBright ? Math.random() * 3 + 2 : Math.random() * 2 + 1),
      delay: Math.random() * 5,
      duration: Math.random() * 4 + 3,
      isBright
    })
  }
  starStyles.value = styles
}

function getStarStyle(index) {
  if (!starStyles.value[index]) return {}
  const s = starStyles.value[index]
  const { r, g, b } = dominantColor.value
  const baseColor = s.isBright ? `rgba(255, 255, 255, 0.9)` : `rgba(${r}, ${g}, ${b}, 0.6)`
  const glowColor = s.isBright ? `rgba(255, 255, 255, 0.4)` : `rgba(${r}, ${g}, ${b}, 0.2)`
  return {
    left: s.left,
    top: s.top,
    width: `${s.size}px`,
    height: `${s.size}px`,
    animationDelay: `${s.delay}s`,
    animationDuration: `${s.duration}s`,
    background: baseColor,
    boxShadow: `0 0 ${s.isBright ? 10 : 4}px ${glowColor}`
  }
}

const playlistPickerOpen = ref(false)
const playlistPickerError = ref('')
const queueOpen = ref(false)
const playbackModeOpen = ref(false)
const themePickerOpen = ref(false)

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

const overlayOpen = computed(() => queueOpen.value || playbackModeOpen.value || themePickerOpen.value)

function toggleImmersiveControls() {
  showImmersiveControls.value = !showImmersiveControls.value
  resetHideTimer()
  
  if (showImmersiveControls.value) {
    document.body.classList.add('immersive-controls-shown')
  } else {
    document.body.classList.remove('immersive-controls-shown')
  }
  
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume()
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

watch(coverUrl, (newUrl) => {
  if (newUrl) {
    extractDominantColor(newUrl)
  }
})

watch(
  currentTheme,
  async (theme) => {
    if (theme === 'spectrum') {
      await nextTick()
      initAudioAnalysis()

      if (audioContext && audioContext.state === 'suspended') {
        try {
          await audioContext.resume()
        } catch (e) {}
      }

      startSpectrumLoop()
      return
    }

    stopSpectrumLoop()
  },
)

watch(starCount, () => {
  initStarStyles()
})

watch(currentTrackKey, (next, previous) => {
  if (!next || !previous || next === previous) {
    return
  }

  trackPulse.value = true
  window.clearTimeout(trackPulseTimer)
  trackPulseTimer = window.setTimeout(() => {
    trackPulse.value = false
  }, 950)
})

onMounted(async () => {
  if (coverUrl.value) {
    extractDominantColor(coverUrl.value)
  }
  
  initStarStyles()
  
  try {
    await lockLandscape()
  } catch (e) {}
  
  try {
    await enter()
  } catch (e) {}
  
  document.body.style.overflow = 'hidden'
  document.body.classList.remove('immersive-controls-shown')
  
  await nextTick()
  if (currentTheme.value === 'spectrum') {
    initAudioAnalysis()
  }
  
  const resumeAudio = async () => {
    if (audioContext && audioContext.state === 'suspended') {
      try {
        await audioContext.resume()
      } catch (e) {}
    }
  }
  
  document.addEventListener('click', resumeAudio, { once: true })
  document.addEventListener('touchstart', resumeAudio, { once: true })
})

onBeforeUnmount(() => {
  if (hideControlsTimer) {
    clearTimeout(hideControlsTimer)
  }
  window.clearTimeout(trackPulseTimer)
  stopSpectrumLoop()
  if (audioContext) {
    audioContext.close()
  }
  document.body.style.overflow = ''
  document.body.classList.remove('immersive-controls-shown')
})
</script>

<template>
  <div
    class="immersive-player"
    :class="{
      'immersive-player--playing': isPlaying,
      'immersive-player--paused': !isPlaying,
      'immersive-player--track-pulse': trackPulse,
    }"
    :style="immersiveStyle"
  >
    <div v-if="coverUrl" class="immersive-player__bg-blur" :style="bgStyle" />

    <!-- 娑撳顣介懗灞炬珯 -->
    <!-- 閸斻劍鍔呭瀛樺皾娑撳顣?-->
    <div v-if="currentTheme === 'water-waves'" class="immersive-player__sound-waves">
      <div class="immersive-player__water-surface"></div>
      <div class="immersive-player__water-caustics"></div>
      <div
        v-for="i in waveCount"
        :key="'ripple-' + i"
        class="immersive-player__ripple"
        :style="getWaveStyle(i - 1)"
      ></div>
    </div>

    <!-- 閺勭喓鈹栫划鎺戠摍娑撳顣?-->
    <div v-if="currentTheme === 'star-particles'" class="immersive-player__stars">
      <div v-for="i in starCount" :key="'star-' + i" class="immersive-player__star" :style="getStarStyle(i - 1)"></div>
    </div>

    <!-- 妫版垼姘ㄥ▔銏犺埌娑撳顣?-->
    <div v-if="currentTheme === 'spectrum'" class="immersive-player__spectrum">
      <div v-for="(barValue, index) in spectrumBars" :key="'bar-' + index" class="immersive-player__spectrum-bar" :style="getSpectrumBarStyle(barValue)"></div>
    </div>

    <!-- 濡紕纭﹂崗澶嬫娑撳顣?-->
    <div v-if="currentTheme === 'glow'" class="immersive-player__glow">
      <div
        v-for="orbIndex in glowOrbIndexes"
        :key="'glow-' + orbIndex"
        class="immersive-player__glow-orb"
        :class="`immersive-player__glow-orb--${orbIndex}`"
      ></div>
    </div>

    <div class="immersive-player__content" @click="toggleImmersiveControls">
      <!-- Header - 閻愮懓鍤弰鍓с仛閺冭埖妯夌粈?-->
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
            type="button"
            title="涓婚"
            aria-label="涓婚"
            @click.stop="themePickerOpen = !themePickerOpen"
          >
            <Palette class="button-icon" />
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

      <!-- 鐏炲懍鑵戝宀冪槤閺勫墽銇?-->
      <div class="immersive-player__lyrics-center">
        <!-- 濮濆矁鐦濇０鍕潔 - 閸欘亝妯夌粈鍝勭秼閸撳秶娈戞稉鈧崣?-->
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

    <!-- 娑撳顣介柅澶嬪閸?-->
    <div v-if="themePickerOpen" class="player-panel-overlay" @click="themePickerOpen = false">
      <section class="surface player-panel player-panel--theme" @click.stop>
        <header class="player-panel__header">
          <div class="player-panel__meta">
            <span>濞屽韫堝Ο鈥崇础</span>
            <h2>闁瀚ㄦ稉濠氼暯</h2>
          </div>
          <button class="icon-button" type="button" title="閸忔娊妫? aria-label="閸忔娊妫? @click="themePickerOpen = false">
            <X class="button-icon" />
          </button>
        </header>

        <div class="theme-list">
          <button
            v-for="theme in THEMES"
            :key="theme.id"
            class="theme-option"
            :class="{ 'theme-option--active': currentTheme === theme.id }"
            type="button"
            @click="setTheme(theme.id)"
          >
            <span class="theme-option__icon">{{ theme.icon }}</span>
            <span class="theme-option__name">{{ theme.name }}</span>
            <Check v-if="currentTheme === theme.id" class="button-icon" />
          </button>
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
  filter: blur(var(--immersive-bg-blur, 80px)) saturate(136%) brightness(0.45);
  transform: scale(var(--immersive-bg-scale, 1.2));
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

/* 閻喎鐤勫瀛樺皾缁捐鏅ラ弸?*/
.immersive-player__sound-waves {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  overflow: hidden;
  contain: layout paint style;
}

  .immersive-player__water-surface {
  position: absolute;
  inset: -8%;
  background:
    radial-gradient(120% 78% at 50% 58%, rgba(166, 208, 224, 0.16) 0%, rgba(68, 108, 133, 0.04) 60%, transparent 100%),
    radial-gradient(92% 68% at 50% 46%, rgba(235, 246, 252, 0.12) 0%, rgba(112, 157, 184, 0.06) 42%, transparent 90%),
    linear-gradient(160deg, rgba(20, 34, 44, 0.22) 0%, rgba(26, 46, 60, 0.08) 50%, rgba(9, 17, 24, 0.26) 100%);
  transform: scale(1.05);
  filter: saturate(120%);
  animation: waterSurfaceDrift 14s ease-in-out infinite alternate;
}

.immersive-player__water-caustics {
  position: absolute;
  inset: -12%;
  background:
    repeating-radial-gradient(
      ellipse at 50% 50%,
      rgba(225, 245, 255, 0.14) 0,
      rgba(225, 245, 255, 0.04) 2.2%,
      rgba(48, 78, 98, 0) 4.5%
    ),
    repeating-linear-gradient(
      116deg,
      rgba(210, 236, 248, 0.08) 0%,
      rgba(210, 236, 248, 0) 16%,
      rgba(210, 236, 248, 0.08) 32%
    );
  background-size: 220% 220%, 240% 240%;
  mix-blend-mode: screen;
  opacity: 0.54;
  animation: waterCausticsDrift 16s linear infinite;
}

.immersive-player__ripple {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--ripple-size, 34vmin);
  height: var(--ripple-size, 34vmin);
  border-radius: 50%;
  will-change: transform, opacity;
  border: 2px solid rgba(var(--accent-rgb), var(--wave-ring-alpha, 0.08));
  background: radial-gradient(
    circle at 50% 48%,
    rgba(255, 255, 255, calc(var(--wave-core-alpha, 0.1) * 0.75)) 0%,
    rgba(var(--accent-rgb), var(--wave-core-alpha, 0.1)) 22%,
    rgba(var(--accent-rgb), var(--wave-shadow-alpha, 0.06)) 58%,
    transparent 82%
  );
  opacity: 0;
  box-shadow:
    0 0 26px rgba(var(--accent-rgb), calc(var(--wave-shadow-alpha, 0.06) * 0.9)),
    inset 0 0 20px rgba(255, 255, 255, 0.08);
  transform: translate(-50%, -50%) scale(0.32);
  animation: waterRipplePulse var(--ripple-duration, 7.4s) cubic-bezier(0.16, 0.48, 0.22, 1) infinite;
}

@keyframes waterRipplePulse {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.32);
  }
  14% {
    opacity: 0.65;
  }
  58% {
    opacity: 0.24;
  }
  100% {
    opacity: 0;
    transform: translate(
      calc(-50% + var(--wave-drift-x, 0) * 1vmin),
      calc(-50% + var(--wave-drift-y, 0) * 1vmin)
    ) scale(1.5);
  }
}

@keyframes waterSurfaceDrift {
  0% {
    transform: scale(1.04) translate3d(-1.4%, -0.8%, 0);
    opacity: 0.74;
  }
  100% {
    transform: scale(1.08) translate3d(1.1%, 1.4%, 0);
    opacity: 0.9;
  }
}

@keyframes waterCausticsDrift {
  0% {
    background-position: 0% 22%, 0% 50%;
  }
  100% {
    background-position: 110% 78%, 100% 45%;
  }
}

.immersive-player--paused .immersive-player__water-surface {
  animation-duration: 22s;
  opacity: 0.58;
}

.immersive-player--paused .immersive-player__water-caustics {
  animation-duration: 28s;
  opacity: 0.22;
}

.immersive-player--paused .immersive-player__ripple {
  animation-duration: 11s;
  opacity: 0.42;
}

.immersive-player--track-pulse .immersive-player__water-surface {
  animation: waterSurfaceDrift 9s ease-in-out infinite alternate, immersiveWaterFlash 0.9s ease-out;
}

.immersive-player--track-pulse .immersive-player__ripple:nth-of-type(3),
.immersive-player--track-pulse .immersive-player__ripple:nth-of-type(4) {
  animation-duration: 3.8s;
  border-color: rgba(255, 255, 255, 0.24);
}

@keyframes immersiveWaterFlash {
  0% {
    filter: saturate(150%) brightness(1.12);
  }
  100% {
    filter: saturate(120%) brightness(1);
  }
}
.immersive-player__stars {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  overflow: hidden;
  contain: layout paint style;
}

.immersive-player__star {
  position: absolute;
  border-radius: 50%;
  will-change: opacity, transform;
  animation: starTwinkle 4s ease-in-out infinite;
}

@keyframes starTwinkle {
  0%, 100% {
    opacity: 0.15;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

/* 瀵板濮╂稉濠氼暯 - 閻滈鍞０鎴ｆ皑閸欘垵顫嬮崠?*/
.immersive-player__spectrum {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 4px;
  padding: 0 10%;
  padding-bottom: 10%;
  contain: layout paint style;
}

.immersive-player__spectrum-bar {
  flex: 1;
  min-width: 6px;
  max-width: 14px;
  border-radius: 999px 999px 0 0;
  transition: height 0.08s ease-out;
  transform-origin: bottom;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
}

/* 閸忓妾挎稉濠氼暯 - 娴兼﹢娉ゅ娑樻纯閸忓妾?*/
.immersive-player__glow {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  overflow: hidden;
  contain: layout paint style;
}

.immersive-player__glow-orb {
  position: absolute;
  border-radius: 50%;
  will-change: transform, opacity;
}

.immersive-player__glow-orb--1 {
  width: 60vh;
  height: 60vh;
  left: -10%;
  top: -10%;
  background: radial-gradient(
    circle,
    rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.25) 0%,
    transparent 55%
  );
  filter: blur(80px);
  animation: glowDrift1 18s ease-in-out infinite;
}

.immersive-player__glow-orb--2 {
  width: 50vh;
  height: 50vh;
  right: -5%;
  top: 10%;
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.18) 0%,
    transparent 50%
  );
  filter: blur(70px);
  animation: glowDrift2 22s ease-in-out infinite;
}

.immersive-player__glow-orb--3 {
  width: 45vh;
  height: 45vh;
  left: 20%;
  bottom: -15%;
  background: radial-gradient(
    circle,
    rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.2) 0%,
    transparent 50%
  );
  filter: blur(65px);
  animation: glowDrift3 20s ease-in-out infinite;
}

.immersive-player__glow-orb--4 {
  width: 55vh;
  height: 55vh;
  right: 15%;
  bottom: -10%;
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.15) 0%,
    transparent 55%
  );
  filter: blur(75px);
  animation: glowDrift4 24s ease-in-out infinite;
}

@keyframes glowDrift1 {
  0%, 100% {
    transform: translate(0, 0) scale(1);
    opacity: 0.6;
  }
  33% {
    transform: translate(10%, 15%) scale(1.1);
    opacity: 0.8;
  }
  66% {
    transform: translate(5%, 10%) scale(0.9);
    opacity: 0.5;
  }
}

@keyframes glowDrift2 {
  0%, 100% {
    transform: translate(0, 0) scale(1);
    opacity: 0.5;
  }
  33% {
    transform: translate(-12%, -10%) scale(1.05);
    opacity: 0.7;
  }
  66% {
    transform: translate(-5%, 8%) scale(0.95);
    opacity: 0.4;
  }
}

@keyframes glowDrift3 {
  0%, 100% {
    transform: translate(0, 0) scale(1);
    opacity: 0.55;
  }
  33% {
    transform: translate(15%, -12%) scale(1.08);
    opacity: 0.75;
  }
  66% {
    transform: translate(8%, -5%) scale(0.92);
    opacity: 0.45;
  }
}

@keyframes glowDrift4 {
  0%, 100% {
    transform: translate(0, 0) scale(1);
    opacity: 0.6;
  }
  33% {
    transform: translate(-10%, -8%) scale(1.12);
    opacity: 0.7;
  }
  66% {
    transform: translate(-6%, 5%) scale(0.88);
    opacity: 0.5;
  }
}

/* 娑撳顣介柅澶嬪閸ｃ劍鐗卞?*/
.player-panel--theme {
  width: min(360px, 100%);
  max-height: none;
}

.theme-list {
  display: grid;
  gap: 8px;
  min-height: 0;
  overflow: auto;
  padding-right: 2px;
}

.theme-option {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  text-align: left;
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.14);
  color: inherit;
  box-shadow: var(--shadow-button);
  transition: all 0.2s ease;
}

.theme-option--active {
  border-color: transparent;
  background: rgba(var(--accent-rgb), 0.08);
}

.theme-option__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent);
  font-size: 1.2rem;
}

.theme-option__name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.94rem;
  font-weight: 650;
}

.immersive-player__content {
  position: relative;
  z-index: 10;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  contain: layout paint style;
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
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  width: 100%;
  max-width: 800px;
  text-align: center;
  padding: 20px 40px;
  z-index: 11;
  pointer-events: none;
}

.immersive-player__lyrics-center * {
  pointer-events: auto;
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
  font-size: clamp(1.2rem, 2.5vw, 1.8rem);
  line-height: 1.6;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  color: rgba(255, 255, 255, 0.35);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  letter-spacing: 0.01em;
}

.immersive-player__lyric-preview-line--near {
  color: rgba(255, 255, 255, 0.55);
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
}

.immersive-player__lyric-preview-line--active {
  font-size: clamp(1.5rem, 3.5vw, 2.2rem);
  font-weight: 700;
  color: #ffffff;
  text-shadow:
    0 0 20px rgba(255, 255, 255, 0.3),
    0 0 40px rgba(255, 255, 255, 0.15),
    0 4px 20px rgba(0, 0, 0, 0.5),
    0 8px 40px rgba(0, 0, 0, 0.3);
  letter-spacing: 0.03em;
  transform: scale(1.05);
  background: linear-gradient(
    135deg,
    #ffffff 0%,
    #f0f8ff 50%,
    #ffffff 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4));
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

@media (max-width: 979px) {
  .immersive-player__bg-blur {
    inset: -24px;
    filter: blur(var(--immersive-bg-blur, 42px)) saturate(130%) brightness(0.45);
  }

  .immersive-player__water-surface {
    inset: -10%;
    animation-duration: 16s;
  }

  .immersive-player__water-caustics {
    inset: -14%;
    opacity: 0.46;
    animation-duration: 18s;
  }

  .immersive-player__ripple {
    border-width: 1.8px;
    box-shadow:
      0 0 18px rgba(var(--accent-rgb), 0.16),
      inset 0 0 12px rgba(255, 255, 255, 0.06);
    animation-duration: 8.2s;
  }

  .immersive-player__spectrum {
    gap: 3px;
    padding: 0 12%;
    padding-bottom: 12%;
  }

  .immersive-player__spectrum-bar {
    min-width: 5px;
    max-width: 10px;
    transition: height 0.15s ease-out;
    box-shadow: 0 0 6px rgba(255, 255, 255, 0.08);
  }

  .immersive-player__glow-orb {
    filter: blur(40px) !important;
    opacity: 0.7;
  }

  .immersive-player__header {
    padding: calc(12px + env(safe-area-inset-top, 0px)) 12px 10px;
  }

  .immersive-player__actions {
    gap: 3px;
    padding: 3px;
    background: rgba(255, 255, 255, 0.09);
  }

  .immersive-player__header .icon-button {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: rgba(255, 255, 255, 0.14);
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.14);
  }

  .immersive-player__lyrics-center {
    max-width: none;
    padding: 20px 24px;
  }

  .immersive-player__lyric-preview {
    min-height: 96px;
    gap: 12px;
  }

  .immersive-player__lyric-preview-line {
    transition: color 0.24s ease, opacity 0.24s ease, transform 0.24s ease;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.28);
  }

  .immersive-player__lyric-preview-line--active {
    transform: scale(1.05);
    filter: none;
    text-shadow:
      0 2px 18px rgba(0, 0, 0, 0.36),
      0 0 18px rgba(255, 255, 255, 0.12);
  }

  .player-panel,
  .theme-option {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
</style>
