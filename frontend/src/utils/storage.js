function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function readStorageArray(key, fallback = []) {
  if (!isBrowser()) {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(key)

    if (!raw) {
      return fallback
    }

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

export function writeStorageArray(key, value) {
  if (!isBrowser()) {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

export function readStorageObject(key, fallback = {}) {
  if (!isBrowser()) {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(key)

    if (!raw) {
      return fallback
    }

    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

export function writeStorageObject(key, value) {
  if (!isBrowser()) {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

export function readStorageNumber(key, fallback = 0) {
  if (!isBrowser()) {
    return fallback
  }

  const value = Number(window.localStorage.getItem(key))
  return Number.isFinite(value) ? value : fallback
}

export function writeStorageNumber(key, value) {
  if (!isBrowser()) {
    return
  }

  window.localStorage.setItem(key, String(value))
}

export function readStorageString(key, fallback = '') {
  if (!isBrowser()) {
    return fallback
  }

  const raw = window.localStorage.getItem(key)

  if (typeof raw !== 'string') {
    return fallback
  }

  const trimmed = raw.trim()
  return trimmed || fallback
}

export function writeStorageString(key, value) {
  if (!isBrowser()) {
    return
  }

  window.localStorage.setItem(key, String(value ?? ''))
}
