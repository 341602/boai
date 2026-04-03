<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowDownToLine, ArrowDownUp, ArrowLeft, Check, Heart, House, ListMusic, ListPlus, Repeat1, Settings2, Shuffle, Trash2, X } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import LyricDisplay from '../components/LyricDisplay.vue'
import PlaylistPickerModal from '../components/PlaylistPickerModal.vue'
import { useViewportMode } from '../composables/useViewportMode'
import { TEXTS } from '../constants/texts'
import { lastNonPlayerRoute } from '../router'
import { usePlayerStore } from '../stores/player'
import { formatArtists, getTrackInitial } from '../utils/track'

const router = useRouter()
const player = usePlayerStore()
const { isDesktop } = useViewportMode()

const { activeLyricIndex, currentQueue, currentQueueSource, currentSong, isCurrentFavorite, lyricLines, playbackMode, playlists } = player

const coverUrl = computed(() => currentSong.value?.album?.picUrl || currentSong.value?.picUrl || '')
const playlistPickerOpen = ref(false)
const playlistPickerError = ref('')
const mobileLyricsOpen = ref(false)
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
const overlayOpen = computed(() => mobileLyricsOpen.value || queueOpen.value || playbackModeOpen.value)

function previewLineClass(index) {
  const distance = Math.abs(index - mobilePreview.value.activeIndex)

  return {
    'player-screen__lyric-preview-line--active': distance === 0,
    'player-screen__lyric-preview-line--near': distance === 1,
    'player-screen__lyric-preview-line--far': distance >= 2,
  }
}

function goBack() {
  router.push(lastNonPlayerRoute.value || { name: 'home' })
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

function openMobileLyrics() {
  if (!lyricLines.value.length) {
    return
  }

  mobileLyricsOpen.value = true
}

function closeMobileLyrics() {
  mobileLyricsOpen.value = false
}

function toggleQueuePanel() {
  if (!currentSong.value?.cid) {
    return
  }

  playbackModeOpen.value = false
  mobileLyricsOpen.value = false
  queueOpen.value = !queueOpen.value
}

function closeQueuePanel() {
  queueOpen.value = false
}

function togglePlaybackModePanel() {
  if (!currentSong.value?.cid) {
    return
  }

  queueOpen.value = false
  mobileLyricsOpen.value = false
  playbackModeOpen.value = !playbackModeOpen.value
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

function seekLyricLine(line) {
  if (typeof line?.time !== 'number') {
    return
  }

  player.playFromTime(line.time)
}

watch(isDesktop, (desktop) => {
  if (desktop) {
    mobileLyricsOpen.value = false
  }
})

watch(currentSong, () => {
  mobileLyricsOpen.value = false

  if (!currentSong.value?.cid) {
    queueOpen.value = false
    playbackModeOpen.value = false
  }
})

watch(overlayOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

watch(mobileLyricsOpen, (open) => {
  document.body.classList.toggle('body--lyrics-open', open && !isDesktop.value)
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  document.body.classList.remove('body--lyrics-open')
})
</script>

<template>
  <div class="page-shell page-shell--player">
    <section class="surface player-screen">
      <header class="player-screen__header">
        <button class="icon-button" type="button" :title="TEXTS.back" :aria-label="TEXTS.back" @click="goBack">
          <ArrowLeft class="button-icon" />
        </button>

        <div class="player-screen__nav">
          <RouterLink class="nav-pill nav-pill--icon" :to="{ name: 'home' }" :title="TEXTS.navHome" :aria-label="TEXTS.navHome">
            <House class="button-icon" />
          </RouterLink>
          <RouterLink
            class="nav-pill nav-pill--icon"
            :to="{ name: 'playlist' }"
            :title="TEXTS.navPlaylist"
            :aria-label="TEXTS.navPlaylist"
          >
            <ListMusic class="button-icon" />
          </RouterLink>
          <RouterLink
            class="nav-pill nav-pill--icon"
            :to="{ name: 'settings' }"
            :title="TEXTS.navSettings"
            :aria-label="TEXTS.navSettings"
          >
            <Settings2 class="button-icon" />
          </RouterLink>
        </div>

        <div class="player-screen__actions">
          <button
            class="icon-button"
            type="button"
            :disabled="!currentSong"
            :title="playbackModeLabel"
            :aria-label="playbackModeLabel"
            @click="togglePlaybackModePanel"
          >
            <component :is="playbackModeIcon" class="button-icon" />
          </button>
          <button
            class="icon-button"
            type="button"
            :disabled="!currentSong"
            :title="TEXTS.queueTitle"
            :aria-label="TEXTS.queueTitle"
            @click="toggleQueuePanel"
          >
            <ListMusic class="button-icon" />
          </button>
          <button
            class="icon-button"
            :class="{ 'icon-button--active': isCurrentFavorite }"
            type="button"
            :title="isCurrentFavorite ? TEXTS.unfavorite : TEXTS.favorite"
            :aria-label="isCurrentFavorite ? TEXTS.unfavorite : TEXTS.favorite"
            @click="player.toggleFavorite()"
          >
            <Heart class="button-icon button-icon--favorite" />
          </button>
          <button
            class="icon-button"
            type="button"
            :disabled="!currentSong"
            :title="TEXTS.playlistAdd"
            :aria-label="TEXTS.playlistAdd"
            @click="openPlaylistPicker"
          >
            <ListPlus class="button-icon" />
          </button>
        </div>
      </header>

        <div v-if="currentSong" class="player-screen__body">
        <div class="player-screen__side">
          <div class="player-screen__hero">
            <div v-if="coverUrl" class="player-screen__cover">
              <img :src="coverUrl" :alt="currentSong.name" />
            </div>
            <div v-else class="player-screen__cover player-screen__cover--fallback">
              {{ getTrackInitial(currentSong) }}
            </div>

            <div class="player-screen__meta">
              <h1>{{ currentSong.name }}</h1>
              <p>{{ formatArtists(currentSong) }}</p>
            </div>
          </div>

          <button
            v-if="!isDesktop"
            class="player-screen__lyric-preview surface"
            type="button"
            @click="openMobileLyrics"
          >
            <template v-if="mobilePreview.lines.length">
              <p
                v-for="(line, index) in mobilePreview.lines"
                :key="line.id"
                class="player-screen__lyric-preview-line"
                :class="previewLineClass(index)"
              >
                {{ line.text }}
              </p>
            </template>
            <p v-else class="player-screen__lyric-preview-line player-screen__lyric-preview-line--empty">
              {{ TEXTS.noLyrics }}
            </p>
          </button>
        </div>

        <section class="player-screen__lyric surface">
          <LyricDisplay :lines="lyricLines" :active-index="activeLyricIndex" />
        </section>
      </div>

      <div v-else class="empty-state empty-state--player">
        {{ TEXTS.noSongSelected }}
      </div>
    </section>

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
                <strong>{{ song.name }}</strong>
                <p>{{ formatArtists(song) }}</p>
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

    <div v-if="mobileLyricsOpen" class="player-mobile-lyrics">
      <button class="player-mobile-lyrics__backdrop" type="button" @click="closeMobileLyrics" />
      <section class="surface player-mobile-lyrics__panel" @click.stop>
        <header class="player-mobile-lyrics__header" @click="closeMobileLyrics">
          <div class="player-mobile-lyrics__meta">
            <strong>{{ currentSong?.name }}</strong>
            <p>{{ currentSong ? formatArtists(currentSong) : '' }}</p>
          </div>
          <button class="icon-button" type="button" :title="TEXTS.close" :aria-label="TEXTS.close" @click.stop="closeMobileLyrics">
            <X class="button-icon" />
          </button>
        </header>

        <div class="player-mobile-lyrics__body">
          <LyricDisplay
            :lines="lyricLines"
            :active-index="activeLyricIndex"
            :interactive="true"
            @seek-line="seekLyricLine"
          />
        </div>
      </section>
    </div>
  </div>
</template>
