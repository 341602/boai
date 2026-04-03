export const RUNTIME_TARGETS = {
  web: 'web',
  native: 'native',
}

function getWindowObject() {
  return typeof window !== 'undefined' ? window : null
}

function getCapacitorBridge() {
  const win = getWindowObject()
  return win?.Capacitor?.Plugins?.BoAiMusic || null
}

function getCustomBridge() {
  const win = getWindowObject()
  return win?.BoAiMusicNative || win?.__BOAI_NATIVE__ || null
}

export function getNativeBridge() {
  return getCustomBridge() || getCapacitorBridge()
}

export function hasNativeBridge() {
  return Boolean(getNativeBridge())
}

export function getRuntimeTarget() {
  return hasNativeBridge() ? RUNTIME_TARGETS.native : RUNTIME_TARGETS.web
}

export async function invokeNative(method, payload = {}) {
  const bridge = getNativeBridge()

  if (!bridge) {
    throw new Error('Native bridge unavailable')
  }

  if (typeof bridge[method] === 'function') {
    return bridge[method](payload)
  }

  if (typeof bridge.invoke === 'function') {
    return bridge.invoke(method, payload)
  }

  throw new Error(`Native bridge method is missing: ${method}`)
}
