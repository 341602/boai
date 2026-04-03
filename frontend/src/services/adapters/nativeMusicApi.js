import { invokeNative } from '../runtime'

async function resolveBridgeResponse(method, payload = {}) {
  try {
    return await invokeNative(method, payload)
  } catch (error) {
    throw new Error(error?.message || `${method} failed`)
  }
}

export const nativeMusicApi = {
  target: 'native',
  apiBaseUrl: 'native://boai-music',
  searchSongs(keyword, options = {}) {
    return resolveBridgeResponse('searchSongs', {
      keyword,
      type: 'song',
      pageNo: 1,
      pageSize: 20,
      ...options,
    })
  },
  getSongDetail(cid) {
    return resolveBridgeResponse('getSongDetail', { cid })
  },
  getSongUrl(cid) {
    return resolveBridgeResponse('getSongUrl', { cid })
  },
  getLyric(cid) {
    return resolveBridgeResponse('getLyric', { cid })
  },
  async resolveStreamUrl(cid, options = {}) {
    try {
      return await resolveBridgeResponse('resolveStreamUrl', { cid, ...options })
    } catch {
      return resolveBridgeResponse('getSongUrl', { cid, ...options })
    }
  },
}
