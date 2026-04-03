<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Heart, History, House, ListMusic, ListPlus, Settings2, Trash2, X } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import PlaylistPickerModal from '../components/PlaylistPickerModal.vue'
import SearchBar from '../components/SearchBar.vue'
import { useViewportMode } from '../composables/useViewportMode'
import { TEXTS } from '../constants/texts'
import { usePlayerStore } from '../stores/player'
import { formatAlbum, formatArtists, getTrackInitial } from '../utils/track'

const router = useRouter()
const player = usePlayerStore()
const { isDesktop } = useViewportMode()

const {
  canLoadMoreSearchResults,
  currentSong,
  errorMessage,
  favorites,
  keyword,
  loadingMoreSearch,
  loadingSearch,
  playlists,
  recentSearchKeywords,
  searchPage,
  searchResults,
} = player

const favoriteSet = computed(() => new Set(favorites.value.map((item) => item.cid)))
const playlistPickerOpen = ref(false)
const playlistPickerSong = ref(null)
const playlistPickerError = ref('')
const searchInteractionRef = ref(null)
const searchTableRef = ref(null)
const searchStatusRef = ref(null)
const searchAutoLoadArmed = ref(false)
const searchHistoryOpen = ref(false)
let searchStatusObserver = null
const selectedPlaylistIds = computed(() =>
  playlistPickerSong.value?.cid
    ? playlists.value
        .filter((playlist) => player.playlistContainsSong(playlist.id, playlistPickerSong.value.cid))
        .map((playlist) => playlist.id)
    : [],
)

async function playSearch(song, index) {
  await player.playSearchIndex(index)
  searchHistoryOpen.value = false
  router.push({ name: 'player' })
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

function openRecentSearches() {
  searchHistoryOpen.value = true
}

function submitSearch() {
  searchHistoryOpen.value = false
  player.runSearch()
}

function runRecentSearch(item) {
  keyword.value = item
  searchHistoryOpen.value = false
  player.runSearch(item)
}

function removeRecentKeyword(item) {
  player.removeRecentSearchKeyword(item)
}

function clearRecentKeywords() {
  player.clearRecentSearchKeywords()
  searchHistoryOpen.value = false
}

function handleDocumentPointerDown(event) {
  if (!searchInteractionRef.value) {
    return
  }

  const target = event.target

  if (target instanceof Node && searchInteractionRef.value.contains(target)) {
    return
  }

  searchHistoryOpen.value = false
}

function favoriteLabel(song) {
  return favoriteSet.value.has(song.cid) ? TEXTS.unfavorite : TEXTS.favorite
}

function disconnectSearchObserver() {
  if (searchStatusObserver) {
    searchStatusObserver.disconnect()
    searchStatusObserver = null
  }
}

function requestMoreSearchResults() {
  if (
    !searchAutoLoadArmed.value ||
    loadingSearch.value ||
    loadingMoreSearch.value ||
    !canLoadMoreSearchResults.value
  ) {
    return
  }

  player.loadMoreSearchResults()
}

function handleSearchScroll(event) {
  if (!isDesktop.value) {
    return
  }

  const target = event.currentTarget

  if (!target) {
    return
  }

  if (target.scrollTop > 0) {
    searchAutoLoadArmed.value = true
  }

  const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight

  if (distanceToBottom < 120) {
    requestMoreSearchResults()
  }
}

function handleWindowScroll() {
  if (isDesktop.value || typeof window === 'undefined') {
    return
  }

  if (window.scrollY > 0) {
    searchAutoLoadArmed.value = true
  }

  if (!searchStatusRef.value) {
    return
  }

  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
  const rect = searchStatusRef.value.getBoundingClientRect()

  if (rect.top - viewportHeight < 160) {
    requestMoreSearchResults()
  }
}

async function setupSearchObserver() {
  await nextTick()
  disconnectSearchObserver()

  if (
    typeof window === 'undefined' ||
    !('IntersectionObserver' in window) ||
    !searchStatusRef.value ||
    !searchResults.value.length
  ) {
    return
  }

  if (isDesktop.value && !searchTableRef.value) {
    return
  }

  searchStatusObserver = new IntersectionObserver(
    (entries) => {
      if (!searchAutoLoadArmed.value) {
        return
      }

      if (entries.some((entry) => entry.isIntersecting)) {
        requestMoreSearchResults()
      }
    },
    {
      root: isDesktop.value ? searchTableRef.value : null,
      rootMargin: '0px 0px 180px 0px',
      threshold: 0.1,
    },
  )

  searchStatusObserver.observe(searchStatusRef.value)
}

watch(
  searchPage,
  async (page) => {
    if (page !== 1) {
      return
    }

    searchAutoLoadArmed.value = false
    await nextTick()
    searchTableRef.value?.scrollTo({ top: 0, behavior: 'auto' })
  },
)

watch(
  [() => searchResults.value.length, canLoadMoreSearchResults, loadingSearch, loadingMoreSearch],
  async () => {
    await setupSearchObserver()
  },
  { flush: 'post' },
)

watch(
  isDesktop,
  async () => {
    searchAutoLoadArmed.value = false
    await setupSearchObserver()
  },
  { flush: 'post' },
)

onMounted(async () => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  window.addEventListener('scroll', handleWindowScroll, { passive: true })
  await player.ensureInitialSearch()
  await setupSearchObserver()
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  window.removeEventListener('scroll', handleWindowScroll)
  disconnectSearchObserver()
})
</script>

<template>
  <div class="page-shell page-shell--home">
    <header class="page-header page-header--nav-only">
      <div class="page-header__brand-spacer" aria-hidden="true"></div>
      <nav class="page-nav">
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
      </nav>
    </header>

    <section class="surface hero-panel">
      <div ref="searchInteractionRef" class="hero-panel__search">
        <SearchBar v-model="keyword" :loading="loadingSearch" @focus="openRecentSearches" @search="submitSearch" />
        <section v-if="searchHistoryOpen && recentSearchKeywords.length" class="recent-searches">
        <header class="recent-searches__header">
          <div class="recent-searches__title">
            <History class="button-icon" />
            <span>{{ TEXTS.recentSearchTitle }}</span>
          </div>
          <button
            class="icon-button recent-searches__clear"
            type="button"
            :title="TEXTS.recentSearchClear"
            :aria-label="TEXTS.recentSearchClear"
            @click="clearRecentKeywords"
          >
            <Trash2 class="button-icon" />
          </button>
        </header>

        <div class="recent-searches__list">
          <div v-for="item in recentSearchKeywords" :key="item" class="recent-searches__item">
            <button class="recent-searches__chip" type="button" @click="runRecentSearch(item)">
              <span>{{ item }}</span>
            </button>
            <button
              class="recent-searches__remove"
              type="button"
              :title="TEXTS.recentSearchRemove"
              :aria-label="TEXTS.recentSearchRemove"
              @click="removeRecentKeyword(item)"
            >
              <X class="button-icon" />
            </button>
          </div>
        </div>
        </section>
      </div>
      <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>
    </section>

    <section class="surface section-card search-table-panel">
      <header class="section-card__header search-table-panel__header">
        <div>
          <h2>{{ TEXTS.resultTitle }}</h2>
        </div>
      </header>

      <div v-if="!searchResults.length" class="empty-state">
        {{ loadingSearch ? TEXTS.searchLoading : TEXTS.emptyResults }}
      </div>

      <div
        v-else
        ref="searchTableRef"
        class="search-table"
        @scroll.passive="handleSearchScroll"
      >
        <div class="search-table__head">
          <span>{{ TEXTS.searchColumnTrack }}</span>
          <span>{{ TEXTS.searchColumnArtist }}</span>
          <span>{{ TEXTS.searchColumnAlbum }}</span>
          <span></span>
        </div>

        <article
          v-for="(song, index) in searchResults"
          :key="song.cid || `${song.id}-${index}`"
          class="search-table__row"
          :class="{ 'search-table__row--active': song.cid === currentSong?.cid }"
        >
          <button class="search-table__main" type="button" @click="playSearch(song, index)">
            <div class="search-table__track">
              <span class="search-table__index">{{ String(index + 1).padStart(2, '0') }}</span>
              <div v-if="song.album?.picUrl || song.picUrl" class="search-table__cover">
                <img :src="song.album?.picUrl || song.picUrl" :alt="song.name" />
              </div>
              <div v-else class="search-table__cover search-table__cover--fallback">
                {{ getTrackInitial(song) }}
              </div>
              <div class="search-table__title">
                <strong>{{ song.name }}</strong>
                <p>{{ formatArtists(song) }}</p>
              </div>
            </div>

            <span class="search-table__artist">{{ formatArtists(song) }}</span>
            <span class="search-table__album">{{ formatAlbum(song) }}</span>
          </button>

          <div class="search-table__actions">
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
          </div>
        </article>

        <div ref="searchStatusRef" class="search-table__status">
          <span v-if="loadingMoreSearch">{{ TEXTS.searchLoadingMore }}</span>
          <span v-else-if="canLoadMoreSearchResults">{{ TEXTS.searchAutoLoad }}</span>
          <span v-else>{{ TEXTS.searchLoadedAll }}</span>
        </div>
      </div>
    </section>

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
  </div>
</template>
