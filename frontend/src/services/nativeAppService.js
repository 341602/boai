import { CapacitorHttp } from '@capacitor/core'
import { pinyin } from 'pinyin-pro'

const SEARCH_SWITCH = JSON.stringify({
  song: 1,
  album: 0,
  singer: 0,
  tagSong: 0,
  mvSong: 0,
  songlist: 0,
  bestShow: 1,
})

const DEFAULT_HEADERS = {
  'user-agent': 'Mozilla/5.0',
  referer: 'https://music.migu.cn/',
}

const LISTEN_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Linux; U; Android 9; zh-cn; MI 6 Build/PKQ1.190118.001) AppleWebKit/533.1 (KHTML, like Gecko) Version/5.0 Mobile Safari/533.1',
  channel: '0146921',
}

const REQUEST_TIMEOUT_MS = 12000

function parseJsonPayload(data) {
  if (typeof data === 'string') {
    return JSON.parse(data)
  }

  return data
}

async function requestJson(url, headers = {}) {
  const response = await CapacitorHttp.get({
    url,
    headers: {
      ...DEFAULT_HEADERS,
      ...headers,
    },
    connectTimeout: REQUEST_TIMEOUT_MS,
    readTimeout: REQUEST_TIMEOUT_MS,
    responseType: 'json',
  })

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return parseJsonPayload(response.data)
}

async function requestText(url, headers = {}) {
  const response = await CapacitorHttp.get({
    url,
    headers: {
      ...DEFAULT_HEADERS,
      ...headers,
    },
    connectTimeout: REQUEST_TIMEOUT_MS,
    readTimeout: REQUEST_TIMEOUT_MS,
    responseType: 'text',
  })

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return typeof response.data === 'string' ? response.data : String(response.data || '')
}

function normalizeArtists(artists = []) {
  return artists.map((item) => ({
    id: item.id || item.artistId || '',
    name: item.name || item.artistName || '',
  }))
}

function pickCover(items = []) {
  return items.find((item) => item.imgSizeType === '02')?.img || items[0]?.img || ''
}

function parseDuration(length = '00:00:00') {
  return String(length)
    .split(':')
    .map((item) => Number(item || 0))
    .reduce((total, value) => total * 60 + value, 0)
}

function mapFormats(resource, playInfo = null) {
  const formats = [...(resource.newRateFormats || []), ...(resource.rateFormats || [])]
  const flags = new Set(formats.map((item) => item.formatType))
  const url = playInfo?.url || ''

  return {
    '128': playInfo?.audioFormatType === 'PQ' ? url : '',
    '320': playInfo?.audioFormatType === 'HQ' ? url : '',
    flac: playInfo?.audioFormatType === 'SQ' ? url : '',
    hasHQ: flags.has('HQ'),
    hasPQ: flags.has('PQ'),
    hasSQ: flags.has('SQ'),
  }
}

function normalizeSearchSong(item) {
  return {
    id: item.id,
    songId: item.id,
    cid: item.copyrightId,
    name: item.name,
    albumId: item.albums?.[0]?.id || '',
    album: {
      id: item.albums?.[0]?.id || '',
      name: item.albums?.[0]?.name || '',
      picUrl: pickCover(item.imgItems),
    },
    artists: normalizeArtists(item.singers),
    lyricUrl: item.lyricUrl || '',
  }
}

function normalizeSongDetail(resource, playInfo, lyric) {
  const cover = pickCover(resource.albumImgs)
  const formats = mapFormats(resource, playInfo)

  return {
    id: resource.songId,
    songId: resource.songId,
    cid: resource.copyrightId,
    name: resource.songName,
    albumId: resource.albumId || '',
    picUrl: cover,
    bigPicUrl: cover,
    url: playInfo?.url || formats['128'] || formats['320'] || formats.flac || '',
    toneFlag: playInfo?.audioFormatType || '',
    lyric: lyric || '',
    duration: parseDuration(resource.length),
    album: {
      id: resource.albumId || '',
      name: resource.album || '',
      picUrl: cover,
    },
    artists: normalizeArtists(resource.artists || []),
    ...formats,
  }
}

async function getResourceInfoByCid(cid) {
  if (!cid) {
    throw new Error('cid is required')
  }

  const url = `https://c.musicapp.migu.cn/MIGUM2.0/v1.0/content/resourceinfo.do?copyrightId=${encodeURIComponent(
    cid,
  )}&resourceType=2`
  const payload = await requestJson(url)
  const resource = payload.resource?.[0]

  if (!resource) {
    throw new Error('Song resource not found')
  }

  return resource
}

function resolveToneFlag(resource, preferLossless) {
  const formats = [...(resource.newRateFormats || []), ...(resource.rateFormats || [])].map(
    (item) => item.formatType,
  )
  const has = (flag) => formats.includes(flag)

  if (preferLossless && has('SQ')) {
    return 'SQ'
  }
  if (has('PQ')) {
    return 'PQ'
  }
  if (has('HQ')) {
    return 'HQ'
  }
  return 'PQ'
}

async function getPlayableInfo(resource, preferLossless = false) {
  const params = new URLSearchParams({
    albumId: resource.albumId || '',
    lowerQualityContentId: resource.copyrightId,
    netType: '00',
    resourceType: '2',
    songId: resource.songId,
    toneFlag: resolveToneFlag(resource, preferLossless),
  })
  const payload = await requestJson(`http://app.c.nf.migu.cn/MIGUM2.0/strategy/listen-url/v2.4?${params.toString()}`, LISTEN_HEADERS)
  const info = payload.data || {}

  if (!info.url) {
    throw new Error(info.dialogInfo?.text || 'Playable url not found')
  }

  return {
    url: info.url,
    audioFormatType: info.audioFormatType || resolveToneFlag(resource, preferLossless),
    lrcUrl: info.lrcUrl || resource.lrcUrl || '',
  }
}

async function fetchLyricByUrl(url) {
  if (!url) {
    return ''
  }

  return requestText(url)
}

function resolveLyricUrl(resource, playInfo = null) {
  return playInfo?.lrcUrl || resource?.lrcUrl || ''
}

async function searchSongs(payload = {}) {
  const { keyword, pageNo = 1, pageSize = 20 } = payload

  if (!keyword) {
    throw new Error('keyword is required')
  }

  const runSearch = async (text) => {
    const params = new URLSearchParams({
      ua: 'Android_migu',
      version: '5.0.1',
      text,
      pageNo: String(pageNo),
      pageSize: String(pageSize),
      searchSwitch: SEARCH_SWITCH,
    })

    return requestJson(`https://pd.musicapp.migu.cn/MIGUM2.0/v1.0/content/search_all.do?${params.toString()}`)
  }

  const containsChinese = /[\u3400-\u9fff]/.test(keyword)
  let resultPayload = await runSearch(keyword)
  let result = resultPayload.songResultData?.result || []

  if (containsChinese) {
    const previewText = result
      .slice(0, 5)
      .map((item) => `${item.name}${(item.singers || []).map((artist) => artist.name).join('')}`)
      .join('')
    const looksBroken = !result.length || previewText.includes('???') || !previewText.includes(keyword)

    if (looksBroken) {
      const fallbackKeyword = pinyin(keyword, {
        toneType: 'none',
        type: 'array',
      })
        .join('')
        .replace(/\s+/g, '')
        .toLowerCase()

      if (fallbackKeyword) {
        resultPayload = await runSearch(fallbackKeyword)
        result = resultPayload.songResultData?.result || []
      }
    }
  }

  return {
    list: result.map(normalizeSearchSong),
    total: Number(resultPayload.songResultData?.totalCount || result.length),
  }
}

async function getSongUrl(payload = {}) {
  const { cid, flac = '0' } = payload
  const resource = await getResourceInfoByCid(cid)
  const playInfo = await getPlayableInfo(resource, Number(flac) === 1)
  return playInfo.url
}

async function getLyric(payload = {}) {
  const { cid } = payload
  const resource = await getResourceInfoByCid(cid)
  let playInfo = null

  try {
    playInfo = await getPlayableInfo(resource, false)
  } catch {
    playInfo = null
  }

  return fetchLyricByUrl(resolveLyricUrl(resource, playInfo))
}

async function getSongDetail(payload = {}) {
  const { cid, flac = '0' } = payload
  const resource = await getResourceInfoByCid(cid)
  const playInfo = await getPlayableInfo(resource, Number(flac) === 1)
  const lyric = await fetchLyricByUrl(resolveLyricUrl(resource, playInfo))

  return normalizeSongDetail(resource, playInfo, lyric)
}

export function createNativeAppService() {
  return {
    searchSongs,
    getSongDetail,
    getSongUrl,
    getLyric,
    resolveStreamUrl: getSongUrl,
  }
}
