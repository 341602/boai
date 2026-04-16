import { CapacitorHttp } from '@capacitor/core'
import { getRuntimeTarget, RUNTIME_TARGETS } from './runtime'

const REPOSITORY = '341602/boai'
const RELEASES_LATEST_API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`
const RELEASES_LATEST_UPDATE_JSON = `https://github.com/${REPOSITORY}/releases/latest/download/update.json`
const REPOSITORY_UPDATE_JSON = `https://raw.githubusercontent.com/${REPOSITORY}/main/app-updates/update.json`
const JSDELIVR_UPDATE_JSON = `https://cdn.jsdelivr.net/gh/${REPOSITORY}@main/app-updates/update.json`

const PRIMARY_REQUEST_TIMEOUT_MS = 5000
const FALLBACK_REQUEST_TIMEOUT_MS = 8000

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

function withCacheBust(url) {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}_=${Date.now()}`
}

function normalizeVersion(rawVersion = '') {
  return String(rawVersion).trim().replace(/^v/i, '')
}

function compareVersions(version1, version2) {
  const left = normalizeVersion(version1).split('.').map((item) => Number(item || 0))
  const right = normalizeVersion(version2).split('.').map((item) => Number(item || 0))

  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const leftValue = left[index] || 0
    const rightValue = right[index] || 0

    if (leftValue > rightValue) return 1
    if (leftValue < rightValue) return -1
  }

  return 0
}

export function isNativeAppRuntime() {
  return getRuntimeTarget() === RUNTIME_TARGETS.native
}

export function getUpdateManifestSources() {
  const config = getRuntimeConfig()
  const configured = toArray(config.UPDATE_MANIFEST_URLS)
  const mirroredStable = DEFAULT_PROXY_PREFIXES.flatMap((prefix) => [
    `${prefix}${JSDELIVR_UPDATE_JSON}`,
    `${prefix}${REPOSITORY_UPDATE_JSON}`,
  ])
  const mirroredLatest = DEFAULT_PROXY_PREFIXES.map((prefix) => `${prefix}${RELEASES_LATEST_UPDATE_JSON}`)

  return unique([
    ...configured,
    JSDELIVR_UPDATE_JSON,
    REPOSITORY_UPDATE_JSON,
    ...mirroredStable,
    ...mirroredLatest,
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

function parseJsonPayload(data) {
  if (typeof data === 'string') {
    return JSON.parse(data)
  }

  return data
}

async function nativeRequestJson(url, timeoutMs) {
  const response = await CapacitorHttp.get({
    url: withCacheBust(url),
    headers: {
      Accept: 'application/json, application/vnd.github+json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
    connectTimeout: timeoutMs,
    readTimeout: timeoutMs,
    responseType: 'json',
  })

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return parseJsonPayload(response.data)
}

async function webRequestJson(url, timeoutMs) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(withCacheBust(url), {
      signal: controller.signal,
      headers: {
        Accept: 'application/json, application/vnd.github+json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    })

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`)
    }

    return await response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchJson(url, timeoutMs) {
  if (isNativeAppRuntime()) {
    return nativeRequestJson(url, timeoutMs)
  }

  return webRequestJson(url, timeoutMs)
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

function asManifestCandidate(payload, source) {
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
}

function asReleaseCandidate(payload, source) {
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
}

async function collectCandidates(sources, toCandidate, timeoutMs) {
  if (!sources.length) {
    return []
  }

  const settled = await Promise.allSettled(
    sources.map((source) =>
      fetchJson(source, timeoutMs).then((payload) => toCandidate(payload, source)),
    ),
  )

  return settled
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
}

function pickLatestCandidate(candidates) {
  if (!candidates.length) {
    return null
  }

  return candidates.reduce((latest, candidate) => {
    if (!latest) return candidate

    const versionCompare = compareVersions(candidate.versionName, latest.versionName)
    if (versionCompare > 0) return candidate
    if (versionCompare < 0) return latest

    const latestCode = Number(latest.versionCode || 0)
    const candidateCode = Number(candidate.versionCode || 0)

    if (candidateCode > latestCode) return candidate
    if (candidateCode < latestCode) return latest

    return latest
  }, null)
}

export async function fetchLatestReleaseInfo() {
  const manifestSources = getUpdateManifestSources()
  const releaseApiSources = getReleaseApiSources()

  const manifestCandidates = await collectCandidates(manifestSources, asManifestCandidate, PRIMARY_REQUEST_TIMEOUT_MS)

  if (manifestCandidates.length) {
    return pickLatestCandidate(manifestCandidates)
  }

  const releaseCandidates = await collectCandidates(releaseApiSources, asReleaseCandidate, FALLBACK_REQUEST_TIMEOUT_MS)

  if (releaseCandidates.length) {
    return pickLatestCandidate(releaseCandidates)
  }

  throw new Error('Failed to check updates, please try again later.')
}
