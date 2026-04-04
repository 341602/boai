<script setup>
import { computed, ref, watch } from 'vue'
import { Clock3, Disc3, FolderPlus, Heart, House, ListPlus, Play, Settings2, Trash2 } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import MarqueeText from '../components/MarqueeText.vue'
import PlaylistCreateDialog from '../components/PlaylistCreateDialog.vue'
import PlaylistPickerModal from '../components/PlaylistPickerModal.vue'
import { useViewportMode } from '../composables/useViewportMode'
import { TEXTS } from '../constants/texts'
import { usePlayerStore } from '../stores/player'
import { formatAlbum, formatArtists, getTrackInitial } from '../utils/track'

const router = useRouter()
const player = usePlayerStore()
const { isDesktop } = useViewportMode()

const { currentSong, favorites, playlists, recentPlays } = player

const selectedCollectionId = ref('favorites')
const createName = ref('')
const createError = ref('')
const createDialogOpen = ref(false)
const playlistPickerOpen = ref(false)
const playlistPickerSong = ref(null)
const playlistPickerError = ref('')
const deleteDialogOpen = ref(false)

const favoriteIds = computed(() => favorites.value.map((item) => item.cid))
const favoriteSet = computed(() => new Set(favoriteIds.value))
const activePlaylist = computed(
  () => playlists.value.find((playlist) => playlist.id === selectedCollectionId.value) || null,
)
const activeCollectionType = computed(() => {
  if (selectedCollectionId.value === 'favorites') {
    return 'favorites'
  }

  if (selectedCollectionId.value === 'recent') {
    return 'recent'
  }

  return 'playlist'
})
const collectionItems = computed(() => [
  {
    id: 'favorites',
    name: TEXTS.favoritesCollection,
    meta: TEXTS.favoritesCollection,
    type: 'favorites',
    count: favorites.value.length,
  },
  {
    id: 'recent',
    name: TEXTS.recentTitle,
    meta: TEXTS.recentTitle,
    type: 'recent',
    count: recentPlays.value.length,
  },
  ...playlists.value.map((playlist) => ({
    id: playlist.id,
    name: playlist.name,
    meta: TEXTS.playlistEntryTitle,
    type: 'playlist',
    count: playlist.tracks.length,
  })),
])
const systemCollections = computed(() => collectionItems.value.filter((item) => item.type !== 'playlist'))
const customCollections = computed(() => collectionItems.value.filter((item) => item.type === 'playlist'))
const activeSongs = computed(() => {
  if (activeCollectionType.value === 'favorites') {
    return favorites.value
  }

  if (activeCollectionType.value === 'recent') {
    return recentPlays.value
  }

  return activePlaylist.value?.tracks || []
})
const activeTitle = computed(() => {
  if (activeCollectionType.value === 'favorites') {
    return TEXTS.favoritesCollection
  }

  if (activeCollectionType.value === 'recent') {
    return TEXTS.recentTitle
  }

  return activePlaylist.value?.name || TEXTS.playlistPageTitle
})
const activeMeta = computed(() =>
  activeCollectionType.value === 'playlist' ? TEXTS.playlistEntryTitle : activeTitle.value,
)
const activeEmptyText = computed(() => {
  if (activeCollectionType.value === 'favorites') {
    return TEXTS.emptyPlaylist
  }

  if (activeCollectionType.value === 'recent') {
    return TEXTS.emptyRecent
  }

  return TEXTS.playlistTrackEmpty
})
const canDeletePlaylist = computed(() => activeCollectionType.value === 'playlist' && Boolean(activePlaylist.value))
const canRemoveFromCollection = computed(() => activeCollectionType.value !== 'recent')
const selectedPlaylistIds = computed(() =>
  playlistPickerSong.value?.cid
    ? playlists.value
        .filter((playlist) => player.playlistContainsSong(playlist.id, playlistPickerSong.value.cid))
        .map((playlist) => playlist.id)
    : [],
)

watch(
  playlists,
  (list) => {
    if (activeCollectionType.value !== 'playlist') {
      return
    }

    if (!list.some((playlist) => playlist.id === selectedCollectionId.value)) {
      selectedCollectionId.value = 'favorites'
    }
  },
  { immediate: true },
)

async function playActive(song, index) {
  if (activeCollectionType.value === 'favorites') {
    await player.playFavoriteIndex(index)
  } else if (activeCollectionType.value === 'recent') {
    await player.playRecentIndex(index)
  } else {
    await player.playPlaylistIndex(selectedCollectionId.value, index)
  }

  router.push({ name: 'player' })
}

async function playAll() {
  if (!activeSongs.value.length) {
    return
  }

  await playActive(activeSongs.value[0], 0)
}

function selectCollection(collectionId) {
  selectedCollectionId.value = collectionId
}

function openCreateDialog() {
  createError.value = ''
  createDialogOpen.value = true
}

function closeCreateDialog() {
  createDialogOpen.value = false
  createName.value = ''
  createError.value = ''
}

function createPlaylist() {
  const result = player.createPlaylist(createName.value)

  if (!result.ok) {
    createError.value = result.message || ''
    return
  }

  selectedCollectionId.value = result.playlist.id
  closeCreateDialog()
}

function deleteActivePlaylist() {
  if (!activePlaylist.value) {
    return
  }

  player.deletePlaylist(activePlaylist.value.id)
  selectedCollectionId.value = 'favorites'
  deleteDialogOpen.value = false
}

function openDeleteDialog() {
  if (!activePlaylist.value) {
    return
  }

  deleteDialogOpen.value = true
}

function closeDeleteDialog() {
  deleteDialogOpen.value = false
}

function removeFromCollection(song) {
  if (activeCollectionType.value === 'favorites') {
    player.removeFavorite(song)
    return
  }

  if (activeCollectionType.value === 'recent') {
    return
  }

  player.removeSongFromPlaylist(selectedCollectionId.value, song)
}

function openPlaylistPicker(song) {
  playlistPickerSong.value = song
  playlistPickerError.value = ''
  playlistPickerOpen.value = true
}

function closePlaylistPicker() {
  playlistPickerOpen.value = false
  playlistPickerSong.value = null
  playlistPickerError.value = ''
}

function addToPlaylist(playlistId) {
  const result = player.addSongToPlaylist(playlistId, playlistPickerSong.value)

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

  const added = player.addSongToPlaylist(created.playlist.id, playlistPickerSong.value)

  if (!added.ok) {
    playlistPickerError.value = added.message || ''
    return
  }

  closePlaylistPicker()
}

function favoriteLabel(song) {
  return favoriteSet.value.has(song.cid) ? TEXTS.unfavorite : TEXTS.favorite
}
</script>

<template>
  <div class="page-shell page-shell--playlist">
    <header class="page-header page-header--nav-only">
      <div class="page-header__brand-spacer" aria-hidden="true"></div>
      <nav class="page-nav">
        <RouterLink class="nav-pill nav-pill--icon" :to="{ name: 'home' }" :title="TEXTS.navHome" :aria-label="TEXTS.navHome">
          <House class="button-icon" />
        </RouterLink>
        <RouterLink class="nav-pill nav-pill--icon" :to="{ name: 'player' }" :title="TEXTS.navPlayer" :aria-label="TEXTS.navPlayer">
          <Disc3 class="button-icon" />
        </RouterLink>
        <RouterLink
          class="nav-pill nav-pill--icon"
          :to="{ name: 'settings' }"
          :title="TEXTS.navSettings"
          :aria-label="TEXTS.navSettings"
        >
          <Settings2 class="button-icon" />
        </RouterLink>
      </nav>
    </header>

    <div class="playlist-workspace playlist-workspace--redesigned">
      <aside class="surface playlist-sidebar playlist-sidebar--redesigned">
        <div class="playlist-sidebar__top">
          <div class="playlist-sidebar__header">
            <div class="playlist-sidebar__headline">
              <h2>{{ TEXTS.playlistLibraryTitle }}</h2>
            </div>
            <div v-if="isDesktop" class="playlist-sidebar__header-actions">
              <span>{{ collectionItems.length }} {{ TEXTS.playlistUnit }}</span>
              <button
                class="icon-button icon-button--solid playlist-create-button"
                type="button"
                :title="TEXTS.playlistCreateAction"
                :aria-label="TEXTS.playlistCreateAction"
                @click="openCreateDialog"
              >
                <FolderPlus class="button-icon" />
              </button>
            </div>
            <span v-else class="playlist-sidebar__header-count">
              {{ playlists.length }} {{ TEXTS.playlistUnit }}
            </span>
          </div>
        </div>

        <div v-if="isDesktop" class="playlist-sidebar__list">
          <button
            v-for="item in collectionItems"
            :key="item.id"
            class="playlist-sidebar__item"
            :class="{ 'playlist-sidebar__item--active': item.id === selectedCollectionId }"
            type="button"
            @click="selectCollection(item.id)"
          >
            <div class="playlist-sidebar__item-meta">
              <strong>{{ item.name }}</strong>
              <span>{{ item.meta }}</span>
            </div>
            <span>{{ item.count }} {{ TEXTS.trackUnit }}</span>
          </button>
        </div>

        <template v-else>
          <div class="playlist-sidebar__mobile-fixed-row">
            <button
              v-for="item in systemCollections"
              :key="item.id"
              class="playlist-sidebar__item playlist-sidebar__item--fixed"
              :class="{ 'playlist-sidebar__item--active': item.id === selectedCollectionId }"
              type="button"
              @click="selectCollection(item.id)"
            >
              <span class="playlist-sidebar__mobile-icon" aria-hidden="true">
                <Heart v-if="item.id === 'favorites'" class="button-icon" />
                <Clock3 v-else class="button-icon" />
              </span>
              <div class="playlist-sidebar__item-meta">
                <strong>{{ item.name }}</strong>
              </div>
              <span class="playlist-sidebar__item-count">{{ item.count }} {{ TEXTS.trackUnit }}</span>
            </button>

            <button
              class="icon-button icon-button--solid playlist-sidebar__create-icon"
              type="button"
              :title="TEXTS.playlistCreateAction"
              :aria-label="TEXTS.playlistCreateAction"
              @click="openCreateDialog"
            >
              <FolderPlus class="button-icon" />
            </button>
          </div>

          <div class="playlist-sidebar__mobile-custom-header">
            <span>{{ TEXTS.playlistEntryTitle }}</span>
            <span>{{ customCollections.length }} {{ TEXTS.playlistUnit }}</span>
          </div>

          <div class="playlist-sidebar__mobile-custom-row">
            <button
              v-for="item in customCollections"
              :key="item.id"
              class="playlist-sidebar__item playlist-sidebar__item--custom"
              :class="{ 'playlist-sidebar__item--active': item.id === selectedCollectionId }"
              type="button"
              @click="selectCollection(item.id)"
            >
              <div class="playlist-sidebar__item-meta">
                <strong>{{ item.name }}</strong>
                <span>{{ item.meta }}</span>
              </div>
              <span class="playlist-sidebar__item-count">{{ item.count }} {{ TEXTS.trackUnit }}</span>
            </button>

            <div v-if="!customCollections.length" class="playlist-sidebar__mobile-empty">
              {{ TEXTS.playlistEmptyCollection }}
            </div>
          </div>
        </template>
      </aside>

      <section class="surface playlist-stage">
        <header class="playlist-stage__header">
          <div class="playlist-stage__meta">
            <span>{{ activeMeta }}</span>
            <h2>{{ activeTitle }}</h2>
            <p>{{ activeSongs.length }} {{ TEXTS.trackUnit }}</p>
          </div>

          <div class="playlist-stage__actions">
            <button
              class="icon-button icon-button--solid"
              type="button"
              :disabled="!activeSongs.length"
              :title="TEXTS.playAll"
              :aria-label="TEXTS.playAll"
              @click="playAll"
            >
              <Play class="button-icon" />
            </button>
            <button
              v-if="canDeletePlaylist"
              class="icon-button icon-button--danger"
              type="button"
              :title="TEXTS.playlistDelete"
              :aria-label="TEXTS.playlistDelete"
              @click="openDeleteDialog"
            >
              <Trash2 class="button-icon" />
            </button>
          </div>
        </header>

        <div v-if="!activeSongs.length" class="empty-state playlist-stage__empty">
          {{ activeEmptyText }}
        </div>

        <div v-else class="playlist-stage__list">
          <article
            v-for="(song, index) in activeSongs"
            :key="song.cid || `${song.id}-${index}`"
            class="playlist-track-row"
            :class="{ 'playlist-track-row--active': song.cid === currentSong?.cid }"
          >
            <button class="playlist-track-row__main" type="button" @click="playActive(song, index)">
              <span class="playlist-track-row__index">{{ String(index + 1).padStart(2, '0') }}</span>

              <div v-if="song.album?.picUrl || song.picUrl" class="playlist-track-row__cover">
                <img :src="song.album?.picUrl || song.picUrl" :alt="song.name" />
              </div>
              <div v-else class="playlist-track-row__cover playlist-track-row__cover--fallback">
                {{ getTrackInitial(song) }}
              </div>

              <div class="playlist-track-row__meta">
                <MarqueeText tag="strong" :text="song.name" />
                <MarqueeText tag="p" :text="formatArtists(song)" />
                <p>{{ formatAlbum(song) }}</p>
              </div>
            </button>

            <div class="playlist-track-row__actions">
              <button
                class="icon-button"
                :class="{ 'icon-button--active': favoriteSet.has(song.cid) }"
                type="button"
                :title="favoriteLabel(song)"
                :aria-label="favoriteLabel(song)"
                @click="player.toggleFavorite(song)"
              >
                <Heart class="button-icon button-icon--favorite" />
              </button>
              <button
                class="icon-button"
                type="button"
                :title="TEXTS.playlistAdd"
                :aria-label="TEXTS.playlistAdd"
                @click="openPlaylistPicker(song)"
              >
                <ListPlus class="button-icon" />
              </button>
              <button
                v-if="canRemoveFromCollection"
                class="icon-button icon-button--danger"
                type="button"
                :title="TEXTS.remove"
                :aria-label="TEXTS.remove"
                @click="removeFromCollection(song)"
              >
                <Trash2 class="button-icon" />
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>

    <PlaylistPickerModal
      :open="playlistPickerOpen"
      :song="playlistPickerSong"
      :playlists="playlists"
      :selected-ids="selectedPlaylistIds"
      :error-text="playlistPickerError"
      @close="closePlaylistPicker"
      @add="addToPlaylist"
      @create-and-add="createAndAddPlaylist"
    />

    <PlaylistCreateDialog
      v-model="createName"
      :open="createDialogOpen"
      :error-text="createError"
      @close="closeCreateDialog"
      @confirm="createPlaylist"
    />

    <ConfirmDialog
      :open="deleteDialogOpen"
      :title="TEXTS.playlistDeleteConfirmTitle"
      :message="`${TEXTS.playlistDeleteConfirmMessage} ${activePlaylist?.name || ''}`.trim()"
      :confirm-text="TEXTS.playlistDeleteConfirmAction"
      :danger="true"
      @close="closeDeleteDialog"
      @confirm="deleteActivePlaylist"
    />
  </div>
</template>
