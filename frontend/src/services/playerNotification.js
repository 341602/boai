import { formatArtists } from '../utils/track'
import { getNativeBridge, getRuntimeTarget, invokeNative, RUNTIME_TARGETS } from './runtime'

let notificationListenerHandle = null

function isNativeRuntime() {
  return getRuntimeTarget() === RUNTIME_TARGETS.native
}

export async function initNativePlayerNotification(handlers = {}) {
  if (!isNativeRuntime()) {
    return
  }

  if (notificationListenerHandle) {
    return
  }

  const bridge = getNativeBridge()

  if (!bridge?.addListener) {
    return
  }

  notificationListenerHandle = await bridge.addListener('notificationAction', ({ action }) => {
    if (action === 'previous') {
      void handlers.onPrevious?.()
      return
    }

    if (action === 'toggle') {
      void handlers.onToggle?.()
      return
    }

    if (action === 'next') {
      void handlers.onNext?.()
    }
  })
}

export async function updateNativePlayerNotification({
  currentSong,
  isPlaying = false,
  hasPrevious = false,
  hasNext = false,
} = {}) {
  if (!isNativeRuntime() || !currentSong?.cid) {
    return
  }

  try {
    await invokeNative('updateNowPlaying', {
      title: currentSong.name || 'BoAi Music',
      artist: formatArtists(currentSong),
      isPlaying,
      hasPrevious,
      hasNext,
    })
  } catch {
    // Ignore notification sync failures to avoid affecting playback.
  }
}

export async function clearNativePlayerNotification() {
  if (!isNativeRuntime()) {
    return
  }

  try {
    await invokeNative('clearNowPlaying', {})
  } catch {
    // Ignore notification clear failures.
  }
}
