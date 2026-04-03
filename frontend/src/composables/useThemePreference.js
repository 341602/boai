import { computed, ref } from 'vue'
import { readStorageString, writeStorageString } from '../utils/storage'

export const THEME_MODES = {
  system: 'system',
  light: 'light',
  dark: 'dark',
}

const STORAGE_KEY = 'boai:theme-mode'
const themePreference = ref(THEME_MODES.system)
const systemTheme = ref(THEME_MODES.light)
const resolvedTheme = computed(() =>
  themePreference.value === THEME_MODES.system ? systemTheme.value : themePreference.value,
)

let initialized = false
let mediaQuery = null
let mediaQueryHandler = null

function normalizeThemeMode(value) {
  return Object.values(THEME_MODES).includes(value) ? value : THEME_MODES.system
}

function resolveThemeColor(theme) {
  return theme === THEME_MODES.dark ? '#111827' : '#dce4e7'
}

function applyTheme(theme) {
  if (typeof document === 'undefined') {
    return
  }

  const normalizedTheme = theme === THEME_MODES.dark ? THEME_MODES.dark : THEME_MODES.light
  const root = document.documentElement
  root.setAttribute('data-theme', normalizedTheme)
  root.style.colorScheme = normalizedTheme

  const metaThemeColor = document.querySelector('meta[name="theme-color"]')

  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', resolveThemeColor(normalizedTheme))
  }
}

function updateSystemTheme(nextTheme) {
  systemTheme.value = nextTheme === THEME_MODES.dark ? THEME_MODES.dark : THEME_MODES.light
  applyTheme(resolvedTheme.value)
}

function detectSystemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return THEME_MODES.light
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEME_MODES.dark : THEME_MODES.light
}

export function initThemePreference() {
  if (initialized) {
    applyTheme(resolvedTheme.value)
    return
  }

  initialized = true
  themePreference.value = normalizeThemeMode(readStorageString(STORAGE_KEY, THEME_MODES.system))
  updateSystemTheme(detectSystemTheme())

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return
  }

  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQueryHandler = (event) => {
    updateSystemTheme(event.matches ? THEME_MODES.dark : THEME_MODES.light)
  }

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', mediaQueryHandler)
    return
  }

  mediaQuery.addListener(mediaQueryHandler)
}

export function setThemePreference(mode) {
  themePreference.value = normalizeThemeMode(mode)
  writeStorageString(STORAGE_KEY, themePreference.value)
  applyTheme(resolvedTheme.value)
}

export function useThemePreference() {
  initThemePreference()

  return {
    themePreference,
    resolvedTheme,
    systemTheme,
    setThemePreference,
  }
}
