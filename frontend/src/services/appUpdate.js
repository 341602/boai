import { getRuntimeTarget, RUNTIME_TARGETS } from './runtime'

const REPOSITORY = '341602/boai'
const RELEASES_LATEST_API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`
const RELEASES_LATEST_UPDATE_JSON = `https://github.com/${REPOSITORY}/releases/latest/download/update.json`
const REPOSITORY_UPDATE_JSON = `https://raw.githubusercontent.com/${REPOSITORY}/main/app-updates/update.json`
const JSDELIVR_UPDATE_JSON = `https://cdn.jsdelivr.net/gh/${REPOSITORY}@main/app-updates/update.json`

const DEFAULT_PROXY_PREFIXES = [
  'https://ghproxy.net/',
  'https://mirror.ghproxy.com/',
  'https://gh-proxy.com/',
  'https://moeyy.cn/gh-proxy/',
  'https://ghp.ci/',
]

function getRuntimeConfig() {
  if (typeof window === 'undefined') {
    return {}
  }

  return window.__BOAI_CONFIG__ || {}
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean)
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()]
  }

  return []
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function withTimeout(promise, timeoutMs = 15000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeoutId)
    },
  }
}

export function getUpdateManifestSources() {
  const config = getRuntimeConfig()
  const configured = toArray(config.UPDATE_MANIFEST_URLS)
  const mirrored = DEFAULT_PROXY_PREFIXES.map((prefix) => `${prefix}${RELEASES_LATEST_UPDATE_JSON}`)
  const mirroredStable = DEFAULT_PROXY_PREFIXES.flatMap((prefix) => [
    `${prefix}${REPOSITORY_UPDATE_JSON}`,
    `${prefix}${JSDELIVR_UPDATE_JSON}`,
  ])

  return unique([
    ...configured,
    JSDELIVR_UPDATE_JSON,
    REPOSITORY_UPDATE_JSON,
    ...mirroredStable,
    ...mirrored,
    RELEASES_LATEST_UPDATE_JSON,
  ])
}

export function getReleaseApiSources() {
  const config = getRuntimeConfig()
  const configured = toArray(config.UPDATE_RELEASE_API_URLS)
  const mirrored = DEFAULT_PROXY_PREFIXES.map((prefix) => `${prefix}${RELEASES_LATEST_API}`)

  return unique([
    ...configured,
    ...mirrored,
    RELEASES_LATEST_API,
  ])
}

export function buildDownloadCandidates(downloadUrl = '') {
  if (!downloadUrl) {
    return []
  }

  const config = getRuntimeConfig()
  const configuredPrefixes = toArray(config.UPDATE_DOWNLOAD_PROXY_PREFIXES)
  const prefixes = unique([...configuredPrefixes, ...DEFAULT_PROXY_PREFIXES])

  const mirroredCandidates = prefixes.map((prefix) => `${prefix}${downloadUrl}`)

  return unique([
    ...toArray(config.UPDATE_DOWNLOAD_URLS),
    ...mirroredCandidates,
    downloadUrl,
  ])
}

async function fetchJson(url) {
  const timeout = withTimeout(null)

  try {
    const response = await fetch(url, {
      signal: timeout.signal,
      headers: {
        Accept: 'application/json, application/vnd.github+json',
      },
    })

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`)
    }

    return await response.json()
  } finally {
    timeout.cleanup()
  }
}

function normalizeVersion(rawVersion = '') {
  return String(rawVersion).trim().replace(/^v/i, '')
}

function pickApkAsset(assets = []) {
  const apkAssets = assets.filter((asset) => /\.apk$/i.test(asset.name || ''))

  return (
    apkAssets.find((asset) => /release/i.test(asset.name || '')) ||
    apkAssets.find((asset) => /boai/i.test(asset.name || '')) ||
    apkAssets[0] ||
    null
  )
}

export async function fetchLatestReleaseInfo() {
  let lastError = null

  for (const source of getUpdateManifestSources()) {
    try {
      const payload = await fetchJson(source)
      const versionName = normalizeVersion(payload.versionName || payload.tag_name || '')
      const apkUrl = payload.apkUrl || ''

      if (!versionName || !apkUrl) {
        throw new Error('Update manifest is missing versionName or apkUrl')
      }

      return {
        versionName,
        versionCode: Number(payload.versionCode || 0),
        releaseNotes: String(payload.notes || payload.body || '').trim(),
        fileName: payload.fileName || `boai-music-v${versionName}.apk`,
        source,
        downloadCandidates: buildDownloadCandidates(apkUrl),
      }
    } catch (error) {
      lastError = error
    }
  }

  for (const source of getReleaseApiSources()) {
    try {
      const payload = await fetchJson(source)
      const versionName = normalizeVersion(payload.tag_name || payload.name || '')
      const apkAsset = pickApkAsset(payload.assets || [])

      if (!versionName || !apkAsset?.browser_download_url) {
        throw new Error('Release response is missing apk asset')
      }

      return {
        versionName,
        versionCode: 0,
        releaseNotes: String(payload.body || '').trim(),
        fileName: apkAsset.name || `boai-music-v${versionName}.apk`,
        source,
        downloadCandidates: buildDownloadCandidates(apkAsset.browser_download_url),
      }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('检查更新失败，请稍后重试')
}

export function isNativeAppRuntime() {
  return getRuntimeTarget() === RUNTIME_TARGETS.native
}
