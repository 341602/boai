import { nativeMusicApi } from './adapters/nativeMusicApi'
import { webMusicApi } from './adapters/webMusicApi'
import { getRuntimeTarget, RUNTIME_TARGETS } from './runtime'

function getAdapter() {
  return getRuntimeTarget() === RUNTIME_TARGETS.native ? nativeMusicApi : webMusicApi
}

export const API_BASE_URL = getAdapter().apiBaseUrl
export const MUSIC_RUNTIME_TARGET = getAdapter().target

export function searchSongs(keyword, options = {}) {
  return getAdapter().searchSongs(keyword, options)
}

export function getSongDetail(cid) {
  return getAdapter().getSongDetail(cid)
}

export function getSongUrl(cid) {
  return getAdapter().getSongUrl(cid)
}

export function getLyric(cid) {
  return getAdapter().getLyric(cid)
}

export function resolveStreamUrl(cid, options = {}) {
  return getAdapter().resolveStreamUrl(cid, options)
}
