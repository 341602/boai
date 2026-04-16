import { computed, reactive, toRefs, watch } from 'vue'
import { TEXTS, buildSearchLoadedLabel, buildSearchPageLabel, buildSearchSummary } from '../constants/texts'
import { getLyric, getSongDetail, resolveStreamUrl, searchSongs } from '../services/musicApi'
import {
  clearNativePlayerNotification,
  initNativePlayerNotification,
  updateNativePlayerNotification,
} from '../services/playerNotification'
import { findActiveLyricIndex, parseLyric } from '../utils/lyrics'
import {
  readStorageArray,
  readStorageObject,
  readStorageString,
  writeStorageArray,
  writeStorageObject,
  writeStorageString,
} from '../utils/storage'

const STORAGE_KEYS = {
  favorites: 'migu-player:favorites',
  recent: 'migu-player:recent',
  playlists: 'migu-player:playlists',
  keyword: 'migu-player:keyword',
  recentKeywords: 'migu-player:recent-keywords',
  playbackMode: 'migu-player:playback-mode',
  playbackState: 'migu-player:playback-state',
}

const MAX_RECENT = 18
const MAX_RECENT_KEYWORDS = 8
const PLAYBACK_MODES = {
  order: 'order',
  shuffle: 'shuffle',
  single: 'single',
}
const audio = new Audio()
audio.preload = 'metadata'

function createPlaylistId() {
  return `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeTrack(song = {}) {
  return {
    id: song.id || song.songId || '',
    songId: song.songId || song.id || '',
    cid: song.cid || '',
    name: song.name || '',
    albumId: song.albumId || song.album?.id || '',
    picUrl: song.picUrl || song.album?.picUrl || '',
    streamUrl: song.streamUrl || '',
    duration: song.duration || 0,
    album: {
      id: song.album?.id || song.albumId || '',
      name: song.album?.name || '',
      picUrl: song.album?.picUrl || song.picUrl || '',
    },
    artists: Array.isArray(song.artists) ? song.artists : [],
  }
}

function normalizePlaylist(playlist = {}) {
  const rawTracks = Array.isArray(playlist.tracks)
    ? playlist.tracks
    : Array.isArray(playlist.songs)
      ? playlist.songs
      : []

  return {
    id: playlist.id || createPlaylistId(),
    name: String(playlist.name || TEXTS.playlistUntitled).trim() || TEXTS.playlistUntitled,
    tracks: rawTracks.map(normalizeTrack).filter((track) => track.cid),
    createdAt: Number(playlist.createdAt) || Date.now(),
    updatedAt: Number(playlist.updatedAt) || Date.now(),
  }
}

function normalizeKeyword(keyword = '') {
  return String(keyword || '').trim()
}

function normalizeKeywordList(list = []) {
  return list
    .map(normalizeKeyword)
    .filter(Boolean)
    .filter((keyword, index, array) => array.indexOf(keyword) === index)
    .slice(0, MAX_RECENT_KEYWORDS)
}

function normalizePlaybackMode(mode = PLAYBACK_MODES.order) {
  return Object.values(PLAYBACK_MODES).includes(mode) ? mode : PLAYBACK_MODES.order
}

function normalizePlaybackSnapshot(snapshot = {}) {
  const currentSong = snapshot.currentSong?.cid
    ? normalizeTrack({
        ...snapshot.currentSong,
        streamUrl: snapshot.currentSong.streamUrl || '',
      })
    : null
  let currentQueue = Array.isArray(snapshot.currentQueue)
    ? snapshot.currentQueue.map(normalizeTrack).filter((track) => track.cid)
    : []

  if (currentSong?.cid && !currentQueue.some((track) => track.cid === currentSong.cid)) {
    currentQueue = [currentSong, ...currentQueue]
  }

  let currentIndex = Number(snapshot.currentIndex)

  if (!Number.isFinite(currentIndex)) {
    currentIndex = currentSong?.cid ? currentQueue.findIndex((track) => track.cid === currentSong.cid) : -1
  }

  if (currentIndex < 0 && currentSong?.cid) {
    currentIndex = currentQueue.findIndex((track) => track.cid === currentSong.cid)
  }

  return {
    currentSong,
    currentQueue,
    currentQueueSource: typeof snapshot.currentQueueSource === 'string' ? snapshot.currentQueueSource : 'search',
    currentIndex: currentIndex >= 0 ? currentIndex : -1,
    currentTime: Math.max(0, Number(snapshot.currentTime) || 0),
    lyricRaw: typeof snapshot.lyricRaw === 'string' ? snapshot.lyricRaw : '',
    wasPlaying: Boolean(snapshot.wasPlaying),
  }
}

const initialPlayback = normalizePlaybackSnapshot(readStorageObject(STORAGE_KEYS.playbackState, {}))
const initialLyricLines = parseLyric(initialPlayback.lyricRaw)

const state = reactive({
  keyword: readStorageString(STORAGE_KEYS.keyword, TEXTS.defaultKeyword),
  searchResults: [],
  totalResults: 0,
  searchPage: 1,
  searchPageSize: 20,
  loadingSearch: false,
  loadingMoreSearch: false,
  loadingTrack: false,
  errorMessage: '',
  currentSong: initialPlayback.currentSong,
  currentQueue: initialPlayback.currentQueue,
  currentQueueSource: initialPlayback.currentQueueSource,
  currentIndex: initialPlayback.currentIndex,
  currentTime: initialPlayback.currentTime,
  duration: 0,
  volume: 1,
  isPlaying: false,
  lyricRaw: initialPlayback.lyricRaw,
  lyricLines: initialLyricLines,
  activeLyricIndex: findActiveLyricIndex(initialLyricLines, initialPlayback.currentTime),
  playbackMode: normalizePlaybackMode(readStorageString(STORAGE_KEYS.playbackMode, PLAYBACK_MODES.order)),
  recentSearchKeywords: normalizeKeywordList(readStorageArray(STORAGE_KEYS.recentKeywords, [])),
  favorites: readStorageArray(STORAGE_KEYS.favorites, []).map(normalizeTrack),
  recentPlays: readStorageArray(STORAGE_KEYS.recent, []).map(normalizeTrack),
  playlists: readStorageArray(STORAGE_KEYS.playlists, []).map(normalizePlaylist),
})

audio.volume = state.volume
audio.autoplay = false
if (state.currentSong?.cid) {
  if (state.currentSong.streamUrl) {
    audio.src = state.currentSong.streamUrl
  }
}

let searchRequestId = 0
let trackRequestId = 0
let bootstrapped = false
let lastProgressPersistTime = state.currentTime

function delay(ms = 0) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function waitForAudioReady(timeout = 800) {
  return new Promise((resolve) => {
    let settled = false
    let timer = null

    const cleanup = () => {
      audio.removeEventListener('canplay', finish)
      audio.removeEventListener('loadeddata', finish)
      audio.removeEventListener('playing', finish)

      if (timer) {
        window.clearTimeout(timer)
      }
    }

    const finish = () => {
      if (settled) {
        return
      }

      settled = true
      cleanup()
      resolve()
    }

    audio.addEventListener('canplay', finish, { once: true })
    audio.addEventListener('loadeddata', finish, { once: true })
    audio.addEventListener('playing', finish, { once: true })
    timer = window.setTimeout(finish, timeout)
  })
}

async function requestAudioPlayback({ requestId = trackRequestId, retries = 1, silent = false } = {}) {
  let lastError = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (requestId !== trackRequestId) {
      return false
    }

    try {
      await audio.play()
      state.isPlaying = true
      setError('')
      return true
    } catch (error) {
      lastError = error

      if (attempt >= retries) {
        break
      }

      await waitForAudioReady(700 + attempt * 350)
      await delay(120)
    }
  }

  if (requestId === trackRequestId) {
    state.isPlaying = false

    if (!silent) {
      setError(lastError?.message || TEXTS.playFailed)
    }
  }

  return false
}

function syncLyrics(rawLyric = '') {
  state.lyricRaw = rawLyric
  state.lyricLines = parseLyric(rawLyric)
  state.activeLyricIndex = 0
}

function resetTrackState() {
  state.currentTime = 0
  state.duration = 0
  syncLyrics('')
}

function setError(message = '') {
  state.errorMessage = message
}

function persistPlaybackState() {
  writeStorageObject(
    STORAGE_KEYS.playbackState,
    state.currentSong?.cid
      ? {
          currentSong: normalizeTrack(state.currentSong),
          currentQueue: state.currentQueue.map(normalizeTrack),
          currentQueueSource: state.currentQueueSource,
          currentIndex: state.currentIndex,
          currentTime: state.currentTime,
          lyricRaw: state.lyricRaw,
          wasPlaying: state.isPlaying,
        }
      : {},
  )
}

function rememberSearchKeyword(keyword) {
  const normalized = normalizeKeyword(keyword)

  if (!normalized) {
    return
  }

  state.recentSearchKeywords = [normalized, ...state.recentSearchKeywords.filter((item) => item !== normalized)].slice(
    0,
    MAX_RECENT_KEYWORDS,
  )
}

function removeRecentSearchKeyword(keyword) {
  const normalized = normalizeKeyword(keyword)

  if (!normalized) {
    return
  }

  state.recentSearchKeywords = state.recentSearchKeywords.filter((item) => item !== normalized)
}

function clearRecentSearchKeywords() {
  state.recentSearchKeywords = []
}

function persistTrackList(key, list) {
  writeStorageArray(key, list.map(normalizeTrack))
}

function persistPlaylistList(list) {
  writeStorageArray(STORAGE_KEYS.playlists, list.map(normalizePlaylist))
}

function upsertTrack(list, song) {
  const normalized = normalizeTrack(song)
  return [normalized, ...list.filter((item) => item.cid !== normalized.cid)]
}

function mergeTrackLists(currentList, incomingList) {
  const merged = [...currentList]

  incomingList.forEach((song) => {
    if (!merged.some((item) => item.cid === song.cid)) {
      merged.push(song)
    }
  })

  return merged
}

function clearCurrentPlayback() {
  audio.autoplay = false
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
  state.currentSong = null
  state.currentQueue = []
  state.currentQueueSource = 'search'
  state.currentIndex = -1
  state.isPlaying = false
  resetTrackState()
  void clearNativePlayerNotification()
}

function rememberRecent(song) {
  state.recentPlays = upsertTrack(state.recentPlays, song).slice(0, MAX_RECENT)
}

function getPlaylistById(playlistId) {
  return state.playlists.find((playlist) => playlist.id === playlistId) || null
}

function playlistContainsSong(playlistId, cid) {
  if (!playlistId || !cid) {
    return false
  }

  return Boolean(
    state.playlists.find(
      (playlist) => playlist.id === playlistId && playlist.tracks.some((track) => track.cid === cid),
    ),
  )
}

function createPlaylist(name) {
  const trimmedName = String(name || '').trim()

  if (!trimmedName) {
    return {
      ok: false,
      message: TEXTS.playlistCreateEmpty,
    }
  }

  if (state.playlists.some((playlist) => playlist.name.toLowerCase() === trimmedName.toLowerCase())) {
    return {
      ok: false,
      message: TEXTS.playlistCreateDuplicate,
    }
  }

  const playlist = normalizePlaylist({
    id: createPlaylistId(),
    name: trimmedName,
    tracks: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })

  state.playlists = [playlist, ...state.playlists]

  return {
    ok: true,
    playlist,
  }
}

function deletePlaylist(playlistId) {
  state.playlists = state.playlists.filter((playlist) => playlist.id !== playlistId)
}

function addSongToPlaylist(playlistId, song = state.currentSong) {
  if (!song?.cid) {
    return {
      ok: false,
      message: TEXTS.noSongSelected,
    }
  }

  const targetPlaylist = getPlaylistById(playlistId)

  if (!targetPlaylist) {
    return {
      ok: false,
      message: TEXTS.playlistMissing,
    }
  }

  if (playlistContainsSong(playlistId, song.cid)) {
    return {
      ok: true,
      duplicate: true,
    }
  }

  const nextTrack = normalizeTrack(song)
  state.playlists = state.playlists.map((playlist) =>
    playlist.id === playlistId
      ? {
          ...playlist,
          tracks: [nextTrack, ...playlist.tracks],
          updatedAt: Date.now(),
        }
      : playlist,
  )

  return {
    ok: true,
  }
}

function removeSongFromPlaylist(playlistId, songOrCid) {
  const cid = typeof songOrCid === 'string' ? songOrCid : songOrCid?.cid

  if (!cid) {
    return
  }

  state.playlists = state.playlists.map((playlist) =>
    playlist.id === playlistId
      ? {
          ...playlist,
          tracks: playlist.tracks.filter((track) => track.cid !== cid),
          updatedAt: Date.now(),
        }
      : playlist,
  )
}

function queueSongNext(index) {
  const targetIndex = Number(index)

  if (
    !Number.isFinite(targetIndex) ||
    !state.currentQueue.length ||
    targetIndex < 0 ||
    targetIndex >= state.currentQueue.length ||
    targetIndex === state.currentIndex
  ) {
    return
  }

  let insertIndex = state.currentIndex >= 0 ? state.currentIndex + 1 : 0

  if (targetIndex === insertIndex) {
    return
  }

  const nextQueue = [...state.currentQueue]
  const [song] = nextQueue.splice(targetIndex, 1)
  let nextCurrentIndex = state.currentIndex

  if (targetIndex < insertIndex) {
    insertIndex -= 1
  }

  if (targetIndex < state.currentIndex) {
    nextCurrentIndex -= 1
  }

  nextQueue.splice(insertIndex, 0, song)
  state.currentQueue = nextQueue
  state.currentIndex = nextCurrentIndex
}

async function removeQueueItem(index) {
  const targetIndex = Number(index)

  if (!Number.isFinite(targetIndex) || targetIndex < 0 || targetIndex >= state.currentQueue.length) {
    return
  }

  if (state.currentQueue.length === 1) {
    clearCurrentPlayback()
    return
  }

  const nextQueue = state.currentQueue.filter((_, queueIndex) => queueIndex !== targetIndex)

  if (targetIndex === state.currentIndex) {
    const nextIndex = Math.min(targetIndex, nextQueue.length - 1)
    const shouldAutoPlay = state.isPlaying
    await loadSong(nextQueue[nextIndex], {
      queue: nextQueue,
      index: nextIndex,
      source: state.currentQueueSource,
      autoPlay: shouldAutoPlay,
    })
    return
  }

  state.currentQueue = nextQueue

  if (targetIndex < state.currentIndex) {
    state.currentIndex -= 1
  }
}

async function runSearch(nextKeyword = state.keyword, options = {}) {
  const requestedPage = Math.max(1, Number(options.page || 1) || 1)
  const requestedPageSize = Math.max(1, Number(options.pageSize || state.searchPageSize) || state.searchPageSize)
  const append = Boolean(options.append && requestedPage > 1)
  const trimmedKeyword = String(nextKeyword || '').trim()
  state.keyword = trimmedKeyword

  if (!trimmedKeyword) {
    state.searchResults = []
    state.totalResults = 0
    state.searchPage = 1
    state.loadingMoreSearch = false
    setError(TEXTS.emptyKeyword)
    return
  }

  const requestId = ++searchRequestId
  state.loadingSearch = !append
  state.loadingMoreSearch = append
  setError('')
  writeStorageString(STORAGE_KEYS.keyword, trimmedKeyword)
  rememberSearchKeyword(trimmedKeyword)

  try {
    const response = await searchSongs(trimmedKeyword, {
      pageNo: requestedPage,
      pageSize: requestedPageSize,
    })

    if (requestId !== searchRequestId) {
      return
    }

    const nextList = (response.list || []).map(normalizeTrack)
    state.searchResults = append ? mergeTrackLists(state.searchResults, nextList) : nextList
    state.totalResults = Number(response.total || state.searchResults.length)
    state.searchPage = requestedPage
    state.searchPageSize = requestedPageSize

    if (!state.searchResults.length) {
      setError(TEXTS.emptyResults)
    }
  } catch (error) {
    if (requestId !== searchRequestId) {
      return
    }

    if (!append) {
      state.searchResults = []
      state.totalResults = 0
    }
    setError(error?.message || TEXTS.loadFailed)
  } finally {
    if (requestId === searchRequestId) {
      state.loadingSearch = false
      state.loadingMoreSearch = false
    }
  }
}

async function goToSearchPage(page) {
  const nextPage = Math.max(1, Number(page) || 1)

  if (state.loadingSearch || nextPage === state.searchPage) {
    return
  }

  await runSearch(state.keyword, {
    page: nextPage,
    pageSize: state.searchPageSize,
  })
}

async function nextSearchPage() {
  if (!canSearchNextPage.value) {
    return
  }

  await goToSearchPage(state.searchPage + 1)
}

async function previousSearchPage() {
  if (!canSearchPreviousPage.value) {
    return
  }

  await goToSearchPage(state.searchPage - 1)
}

async function loadMoreSearchResults() {
  if (!canLoadMoreSearchResults.value) {
    return
  }

  await runSearch(state.keyword, {
    page: state.searchPage + 1,
    pageSize: state.searchPageSize,
    append: true,
  })
}

async function loadSong(song, { queue = [], index = 0, source = 'search', autoPlay = true, continuation = false } = {}) {
  if (!song?.cid) {
    return
  }

  const normalizedQueue = queue.length ? queue.map(normalizeTrack) : [normalizeTrack(song)]
  const nextIndex =
    normalizedQueue[index]?.cid === song.cid ? index : normalizedQueue.findIndex((item) => item.cid === song.cid)
  const safeNextIndex = nextIndex >= 0 ? nextIndex : 0
  const requestId = ++trackRequestId
  state.loadingTrack = true
  setError('')

  try {
    const [detail, lyric, streamUrl] = await Promise.all([
      getSongDetail(song.cid),
      getLyric(song.cid).catch(() => ''),
      resolveStreamUrl(song.cid).catch(() => ''),
    ])

    if (requestId !== trackRequestId) {
      return
    }

    const mergedSong = normalizeTrack({
      ...song,
      ...detail,
      streamUrl: streamUrl || detail.url || song.streamUrl || '',
      album: {
        ...(song.album || {}),
        ...(detail.album || {}),
        picUrl: detail.picUrl || detail.bigPicUrl || song.album?.picUrl || '',
      },
      artists: detail.artists || song.artists || [],
    })

    state.currentQueue = normalizedQueue
    state.currentQueueSource = source
    state.currentIndex = safeNextIndex
    state.currentSong = mergedSong
    state.currentTime = 0
    state.duration = 0
    syncLyrics(lyric || detail.lyric || '')
    rememberRecent(mergedSong)
    lastProgressPersistTime = 0

    if (!continuation) {
      audio.pause()
    }

    audio.autoplay = Boolean(autoPlay)
    audio.src = mergedSong.streamUrl || detail.url || ''
    audio.currentTime = 0
    audio.load()

    if (autoPlay) {
      if (continuation) {
        state.isPlaying = true
      }

      await requestAudioPlayback({
        requestId,
        retries: continuation ? 4 : 1,
        silent: continuation,
      })
    }
  } catch (error) {
    if (requestId !== trackRequestId) {
      return
    }

    setError(error?.message || TEXTS.loadFailed)
  } finally {
    if (requestId === trackRequestId) {
      state.loadingTrack = false
    }
  }
}

async function ensureCurrentSongStream() {
  const currentCid = state.currentSong?.cid

  if (!currentCid || state.currentSong?.streamUrl) {
    return
  }

  try {
    const streamUrl = await resolveStreamUrl(currentCid)

    if (!streamUrl || state.currentSong?.cid !== currentCid) {
      return
    }

    state.currentSong = normalizeTrack({
      ...state.currentSong,
      streamUrl,
    })

    if (!audio.src) {
      audio.src = streamUrl
      audio.load()
    }
  } catch {
    // Ignore resume stream failures and wait for explicit playback actions.
  }
}

async function playCollection(list, index, source) {
  const queue = (list || []).map(normalizeTrack)
  const song = queue[index]

  if (!song) {
    return
  }

  await loadSong(song, {
    queue,
    index,
    source,
    autoPlay: true,
  })
}

async function playQueueIndex(index, options = {}) {
  const nextIndex = Number(index)

  if (!state.currentQueue.length || !Number.isFinite(nextIndex) || nextIndex < 0 || nextIndex >= state.currentQueue.length) {
    return
  }

  await loadSong(state.currentQueue[nextIndex], {
    queue: state.currentQueue,
    index: nextIndex,
    source: state.currentQueueSource,
    autoPlay: true,
    continuation: Boolean(options.continuation),
  })
}

async function playSearchIndex(index) {
  await playCollection(state.searchResults, index, 'search')
}

async function playFavoriteIndex(index) {
  await playCollection(state.favorites, index, 'favorites')
}

async function playRecentIndex(index) {
  await playCollection(state.recentPlays, index, 'recent')
}

async function playPlaylistIndex(playlistId, index) {
  const playlist = getPlaylistById(playlistId)

  if (!playlist) {
    return
  }

  await playCollection(playlist.tracks, index, `playlist:${playlistId}`)
}

async function togglePlayback() {
  if (!state.currentSong?.cid) {
    if (state.searchResults.length) {
      await playSearchIndex(0)
    }
    return
  }

  if (audio.paused) {
    await requestAudioPlayback({
      retries: 1,
    })
    return
  }

  audio.pause()
  audio.autoplay = false
  state.isPlaying = false
}

async function playNext(options = {}) {
  if (!state.currentQueue.length) {
    return
  }

  let nextIndex = -1

  if (state.playbackMode === PLAYBACK_MODES.shuffle) {
    if (state.currentQueue.length === 1) {
      nextIndex = 0
    } else {
      do {
        nextIndex = Math.floor(Math.random() * state.currentQueue.length)
      } while (nextIndex === state.currentIndex)
    }
  } else {
    nextIndex = state.currentIndex >= 0 ? (state.currentIndex + 1) % state.currentQueue.length : 0
  }

  if (nextIndex < 0 || nextIndex >= state.currentQueue.length) {
    return
  }

  await playQueueIndex(nextIndex, {
    continuation: Boolean(options.continuation),
  })
}

async function playPrevious() {
  if (!state.currentQueue.length) {
    return
  }

  if (state.currentTime > 3) {
    audio.currentTime = 0
    state.currentTime = 0
    return
  }

  let previousIndex = 0

  if (state.playbackMode === PLAYBACK_MODES.shuffle) {
    if (state.currentQueue.length === 1) {
      previousIndex = 0
    } else {
      do {
        previousIndex = Math.floor(Math.random() * state.currentQueue.length)
      } while (previousIndex === state.currentIndex)
    }
  } else {
    previousIndex =
      state.currentIndex > 0
        ? state.currentIndex - 1
        : Math.max(0, state.currentQueue.length - 1)
  }

  await playQueueIndex(previousIndex)
}

function seekTo(value) {
  const nextTime = Number(value) || 0
  audio.currentTime = nextTime
  state.currentTime = nextTime
  state.activeLyricIndex = findActiveLyricIndex(state.lyricLines, nextTime)
}

async function playFromTime(value) {
  seekTo(value)

  if (!state.currentSong?.cid || !audio.paused) {
    return
  }

  await requestAudioPlayback({
    retries: 1,
  })
}

function isFavorite(cid) {
  return state.favorites.some((item) => item.cid === cid)
}

function toggleFavorite(song = state.currentSong) {
  if (!song?.cid) {
    return
  }

  if (isFavorite(song.cid)) {
    state.favorites = state.favorites.filter((item) => item.cid !== song.cid)
    return
  }

  state.favorites = upsertTrack(state.favorites, song)
}

function removeFavorite(songOrCid) {
  const cid = typeof songOrCid === 'string' ? songOrCid : songOrCid?.cid

  if (!cid) {
    return
  }

  state.favorites = state.favorites.filter((item) => item.cid !== cid)
}

function setPlaybackMode(mode) {
  state.playbackMode = normalizePlaybackMode(mode)
}

function cyclePlaybackMode() {
  if (state.playbackMode === PLAYBACK_MODES.order) {
    state.playbackMode = PLAYBACK_MODES.shuffle
    return
  }

  if (state.playbackMode === PLAYBACK_MODES.shuffle) {
    state.playbackMode = PLAYBACK_MODES.single
    return
  }

  state.playbackMode = PLAYBACK_MODES.order
}

function updateProgress() {
  state.currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0
  state.duration = Number.isFinite(audio.duration) ? audio.duration : 0
  state.activeLyricIndex = findActiveLyricIndex(state.lyricLines, state.currentTime)

  if (Math.abs(state.currentTime - lastProgressPersistTime) >= 1.5) {
    lastProgressPersistTime = state.currentTime
    persistPlaybackState()
  }
}

function handleAudioError() {
  state.isPlaying = false
  setError(TEXTS.playFailed)
}

function getNativeNotificationActionState() {
  const hasMultipleTracks = state.currentQueue.length > 1

  return {
    hasPrevious: state.currentTime > 3 || hasMultipleTracks,
    hasNext: hasMultipleTracks,
  }
}

async function handleAudioEnded() {
  if (!state.currentQueue.length) {
    audio.autoplay = false
    state.isPlaying = false
    return
  }

  if (state.playbackMode === PLAYBACK_MODES.single) {
    state.isPlaying = true
    await playQueueIndex(state.currentIndex >= 0 ? state.currentIndex : 0, {
      continuation: true,
    })
    return
  }

  if (state.playbackMode === PLAYBACK_MODES.shuffle) {
    state.isPlaying = true
    await playNext({
      continuation: true,
    })
    return
  }

  const nextIndex = state.currentIndex + 1

  if (nextIndex >= state.currentQueue.length) {
    audio.autoplay = false
    state.isPlaying = false
    return
  }

  state.isPlaying = true
  await playQueueIndex(nextIndex, {
    continuation: true,
  })
}

function attachAudioListeners() {
  audio.addEventListener('timeupdate', updateProgress)
  audio.addEventListener('loadedmetadata', updateProgress)
  audio.addEventListener('play', () => {
    state.isPlaying = true
  })
  audio.addEventListener('pause', () => {
    state.isPlaying = false
  })
  audio.addEventListener('ended', () => {
    void handleAudioEnded()
  })
  audio.addEventListener('error', handleAudioError)
}

attachAudioListeners()
void initNativePlayerNotification({
  onPrevious: playPrevious,
  onToggle: togglePlayback,
  onNext: playNext,
})

if (initialPlayback.currentSong?.cid) {
  const resumeTime = initialPlayback.currentTime
  const resumePlayback = initialPlayback.wasPlaying

  const restoreTime = () => {
    if (resumeTime <= 0) {
      return
    }

    try {
      audio.currentTime = resumeTime
      state.currentTime = resumeTime
      state.activeLyricIndex = findActiveLyricIndex(state.lyricLines, resumeTime)
      lastProgressPersistTime = resumeTime
    } catch {
      // Ignore range assignment failures until metadata is ready.
    }
  }

  audio.addEventListener('loadedmetadata', restoreTime, { once: true })

  if (resumePlayback) {
    audio.addEventListener(
      'canplay',
      () => {
        audio
          .play()
          .then(() => {
            state.isPlaying = true
          })
          .catch(() => {
            state.isPlaying = false
            persistPlaybackState()
          })
      },
      { once: true },
    )
  }

  audio.load()
  void ensureCurrentSongStream()
}

watch(
  () => state.favorites,
  (list) => {
    persistTrackList(STORAGE_KEYS.favorites, list)
  },
  { deep: true },
)

watch(
  () => state.recentPlays,
  (list) => {
    persistTrackList(STORAGE_KEYS.recent, list)
  },
  { deep: true },
)

watch(
  () => state.playlists,
  (list) => {
    persistPlaylistList(list)
  },
  { deep: true },
)

watch(
  () => state.recentSearchKeywords,
  (list) => {
    writeStorageArray(STORAGE_KEYS.recentKeywords, normalizeKeywordList(list))
  },
  { deep: true },
)

watch(
  () => state.playbackMode,
  (mode) => {
    writeStorageString(STORAGE_KEYS.playbackMode, normalizePlaybackMode(mode))
    persistPlaybackState()
  },
)

watch(
  () => state.currentSong,
  () => {
    persistPlaybackState()
  },
  { deep: true },
)

watch(
  () => state.currentQueue,
  () => {
    persistPlaybackState()
  },
  { deep: true },
)

watch(
  () => [state.currentQueueSource, state.currentIndex, state.isPlaying, state.lyricRaw],
  () => {
    persistPlaybackState()
  },
)

watch(
  () => [
    state.currentSong?.cid,
    state.currentSong?.name,
    state.isPlaying,
    state.currentIndex,
    state.currentQueue.length,
    state.currentTime,
    state.playbackMode,
  ],
  () => {
    if (!state.currentSong?.cid) {
      void clearNativePlayerNotification()
      return
    }

    const { hasPrevious, hasNext } = getNativeNotificationActionState()

    void updateNativePlayerNotification({
      currentSong: state.currentSong,
      isPlaying: state.isPlaying,
      hasPrevious,
      hasNext,
    })
  },
  { immediate: true },
)

const searchSummary = computed(() =>
  buildSearchSummary({
    loading: state.loadingSearch,
    total: state.totalResults,
    count: state.searchResults.length,
  }),
)

const searchTotalPages = computed(() => Math.max(1, Math.ceil(state.totalResults / state.searchPageSize) || 1))

const searchPageLabel = computed(() =>
  buildSearchPageLabel({
    loading: state.loadingSearch,
    page: state.searchPage,
    totalPages: searchTotalPages.value,
    count: state.searchResults.length,
  }),
)

const canSearchPreviousPage = computed(() => state.searchPage > 1 && !state.loadingSearch)
const canSearchNextPage = computed(
  () => state.searchPage < searchTotalPages.value && !state.loadingSearch && state.searchResults.length > 0,
)
const canLoadMoreSearchResults = computed(
  () => state.searchPage < searchTotalPages.value && !state.loadingSearch && !state.loadingMoreSearch,
)
const searchLoadedLabel = computed(() =>
  buildSearchLoadedLabel({
    count: state.searchResults.length,
    total: state.totalResults,
  }),
)

const isCurrentFavorite = computed(() => Boolean(state.currentSong?.cid && isFavorite(state.currentSong.cid)))

async function ensureInitialSearch() {
  if (bootstrapped || state.loadingSearch || state.searchResults.length) {
    return
  }

  bootstrapped = true
  await runSearch(state.keyword)
}

const store = {
  ...toRefs(state),
  PLAYBACK_MODES,
  searchSummary,
  searchLoadedLabel,
  searchPageLabel,
  searchTotalPages,
  canSearchNextPage,
  canSearchPreviousPage,
  canLoadMoreSearchResults,
  isCurrentFavorite,
  addSongToPlaylist,
  clearRecentSearchKeywords,
  cyclePlaybackMode,
  createPlaylist,
  deletePlaylist,
  ensureInitialSearch,
  getPlaylistById,
  goToSearchPage,
  isFavorite,
  loadMoreSearchResults,
  nextSearchPage,
  playlistContainsSong,
  playCollection,
  playFavoriteIndex,
  playNext,
  playPlaylistIndex,
  playPrevious,
  playQueueIndex,
  playRecentIndex,
  playSearchIndex,
  previousSearchPage,
  playFromTime,
  removeRecentSearchKeyword,
  removeFavorite,
  removeQueueItem,
  removeSongFromPlaylist,
  runSearch,
  seekTo,
  setPlaybackMode,
  queueSongNext,
  toggleFavorite,
  togglePlayback,
}

export function usePlayerStore() {
  return store
}
