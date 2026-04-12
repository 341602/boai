import { ref, watch } from 'vue'

const STORAGE_PREFIX = 'boai_'

function getStorageKey(key) {
  return `${STORAGE_PREFIX}${key}`
}

export function useLocalStorage(key, defaultValue) {
  const storageKey = getStorageKey(key)
  const data = ref(defaultValue)

  function load() {
    try {
      if (typeof window === 'undefined') return
      const stored = localStorage.getItem(storageKey)
      if (stored !== null) {
        data.value = JSON.parse(stored)
      }
    } catch (error) {
      console.error(`Failed to load localStorage key "${key}":`, error)
    }
  }

  function save() {
    try {
      if (typeof window === 'undefined') return
      localStorage.setItem(storageKey, JSON.stringify(data.value))
    } catch (error) {
      console.error(`Failed to save localStorage key "${key}":`, error)
    }
  }

  function clear() {
    try {
      if (typeof window === 'undefined') return
      localStorage.removeItem(storageKey)
      data.value = defaultValue
    } catch (error) {
      console.error(`Failed to clear localStorage key "${key}":`, error)
    }
  }

  load()

  watch(
    data,
    () => {
      save()
    },
    { deep: true }
  )

  return {
    data,
    save,
    load,
    clear,
  }
}

export function usePlayHistory(maxHistory = 50) {
  const { data: history, save, load, clear } = useLocalStorage('playHistory', [])

  function addToHistory(song) {
    if (!song?.cid) return

    const filteredHistory = history.value.filter(item => item.cid !== song.cid)
    const newHistory = [
      {
        ...song,
        playedAt: Date.now(),
      },
      ...filteredHistory,
    ]

    history.value = newHistory.slice(0, maxHistory)
  }

  function getRecent(count = 10) {
    return history.value.slice(0, count)
  }

  function removeFromHistory(cid) {
    history.value = history.value.filter(item => item.cid !== cid)
  }

  return {
    history,
    addToHistory,
    getRecent,
    removeFromHistory,
    clearHistory: clear,
  }
}

export function useLyricsSettings() {
  const { data: settings, save, load, clear } = useLocalStorage('lyricsSettings', {
    fontSize: 1,
    fontSizeMin: 0.7,
    fontSizeMax: 1.5,
    fontSizeStep: 0.1,
  })

  function increaseFontSize() {
    settings.value.fontSize = Math.min(
      settings.value.fontSizeMax,
      settings.value.fontSize + settings.value.fontSizeStep
    )
  }

  function decreaseFontSize() {
    settings.value.fontSize = Math.max(
      settings.value.fontSizeMin,
      settings.value.fontSize - settings.value.fontSizeStep
    )
  }

  function resetFontSize() {
    settings.value.fontSize = 1
  }

  function getFontSizeStyle() {
    return {
      fontSize: `${settings.value.fontSize}rem`,
    }
  }

  return {
    settings,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    getFontSizeStyle,
    clearSettings: clear,
  }
}
