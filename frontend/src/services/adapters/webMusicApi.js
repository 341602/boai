function resolveDefaultApiBaseUrl() {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000'
  }

  const runtimeApiBaseUrl = window.__BOAI_CONFIG__?.API_BASE_URL

  if (runtimeApiBaseUrl) {
    return runtimeApiBaseUrl
  }

  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }

  const locationOrigin = window.location?.origin
  const isHttpOrigin = typeof locationOrigin === 'string' && /^https?:\/\//i.test(locationOrigin)

  if (isHttpOrigin) {
    return locationOrigin
  }

  return 'http://localhost:3000'
}

const API_BASE_URL = resolveDefaultApiBaseUrl().replace(/\/$/, '')
const REQUEST_TIMEOUT_MS = 10000

function buildApiUrl(path, params = {}) {
  const url = new URL(`${API_BASE_URL}${path}`)

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value)
    }
  })

  return url
}

async function request(path, params = {}) {
  const url = buildApiUrl(path, params)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok || payload.result !== 100) {
      throw new Error(payload.errMsg || `Request failed: ${response.status}`)
    }

    return payload.data
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('请求超时，请稍后再试')
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export const webMusicApi = {
  target: 'web',
  apiBaseUrl: API_BASE_URL,
  searchSongs(keyword, options = {}) {
    return request('/search', {
      keyword,
      type: 'song',
      pageNo: 1,
      pageSize: 20,
      ...options,
    })
  },
  getSongDetail(cid) {
    return request('/song', { cid })
  },
  getSongUrl(cid) {
    return request('/song/url', { cid })
  },
  getLyric(cid) {
    return request('/lyric', { cid })
  },
  async resolveStreamUrl(cid, options = {}) {
    return buildApiUrl('/song/stream', { cid, ...options }).toString()
  },
}
