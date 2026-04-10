<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  Check,
  Disc3,
  Download,
  House,
  Info,
  ListMusic,
  MoonStar,
  Palette,
  Settings2,
  SunMedium,
  X,
} from 'lucide-vue-next'
import appPackage from '../../package.json'
import { THEME_MODES, useThemePreference } from '../composables/useThemePreference'
import { TEXTS } from '../constants/texts'
import { fetchLatestReleaseInfo, isNativeAppRuntime } from '../services/appUpdate'
import { getNativeBridge, invokeNative } from '../services/runtime'

const { setThemePreference, themePreference } = useThemePreference()

const themeOptions = [
  { value: THEME_MODES.system, label: TEXTS.settingsThemeSystem, icon: Palette },
  { value: THEME_MODES.light, label: TEXTS.settingsThemeLight, icon: SunMedium },
  { value: THEME_MODES.dark, label: TEXTS.settingsThemeDark, icon: MoonStar },
]

const isNativeApp = computed(() => isNativeAppRuntime())
const versionLabel = ref(`v${appPackage.version || '0.0.0'}`)
const versionCode = ref(0)
const isDebugBuild = ref(false)
const isCheckingUpdate = ref(false)
const isStartingUpdate = ref(false)
const isOpeningInstaller = ref(false)
const updateAvailable = ref(false)
const hasDownloadedUpdate = ref(false)
const latestVersion = ref('')
const latestDownloadCandidates = ref([])
const latestDownloadName = ref('')
const latestReleaseNotes = ref('')
const latestSourceLabel = ref('')
const showAboutModal = ref(false)
const appUpdateMessage = ref('')

let updateListenerHandle = null
let updatePollingTimer = null

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

function currentVersion() {
  return normalizeVersion(versionLabel.value) || normalizeVersion(appPackage.version) || '0.0.0'
}

function clearUpdateStatusPolling() {
  if (updatePollingTimer) {
    clearInterval(updatePollingTimer)
    updatePollingTimer = null
  }
}

function dismissUpdate() {
  updateAvailable.value = false
  latestVersion.value = ''
  latestDownloadCandidates.value = []
  latestDownloadName.value = ''
  latestReleaseNotes.value = ''
  latestSourceLabel.value = ''
  appUpdateMessage.value = ''
  hasDownloadedUpdate.value = false
}

async function loadNativeAppInfo() {
  if (!isNativeApp.value) {
    return
  }

  try {
    const info = await invokeNative('getAppInfo', {})
    versionLabel.value = `v${info.versionName || appPackage.version || '0.0.0'}`
    versionCode.value = Number(info.versionCode || 0)
    isDebugBuild.value = Boolean(info.debuggable)
  } catch (error) {
    console.warn('Failed to load native app info:', error)
  }
}

async function openDownloadedUpdate() {
  if (!isNativeApp.value || !hasDownloadedUpdate.value) {
    return
  }

  isOpeningInstaller.value = true

  try {
    await invokeNative('openDownloadedUpdate', {})
    appUpdateMessage.value = '请在系统安装界面确认升级。'
  } catch (error) {
    console.error('打开安装界面失败:', error)
    alert(error?.message || '打开安装界面失败，请稍后重试')
  } finally {
    isOpeningInstaller.value = false
  }
}

async function syncNativeUpdateStatus() {
  if (!isNativeApp.value) {
    return
  }

  try {
    const payload = await invokeNative('getUpdateStatus', {})
    const status = payload?.status || 'idle'
    const message = payload?.message || ''
    const readyToInstall = Boolean(payload?.hasDownloadedUpdate)

    if (status === 'downloading') {
      hasDownloadedUpdate.value = false
      appUpdateMessage.value = '正在下载更新包，请稍候。'
      return
    }

    if (status === 'downloaded') {
      hasDownloadedUpdate.value = readyToInstall
      appUpdateMessage.value = '更新包已下载完成，正在打开安装界面。'

      if (readyToInstall) {
        await openDownloadedUpdate()
      }

      clearUpdateStatusPolling()
      return
    }

    if (status === 'installing') {
      hasDownloadedUpdate.value = readyToInstall
      appUpdateMessage.value = '请在系统安装界面确认升级。'
      clearUpdateStatusPolling()
      return
    }

    if (status === 'failed') {
      hasDownloadedUpdate.value = readyToInstall
      appUpdateMessage.value = message || '更新失败，请稍后重试。'
      clearUpdateStatusPolling()
    }
  } catch (error) {
    console.warn('同步更新状态失败:', error)
  }
}

function startUpdateStatusPolling() {
  clearUpdateStatusPolling()
  updatePollingTimer = setInterval(() => {
    void syncNativeUpdateStatus()
  }, 1000)
}

async function checkForUpdates() {
  isCheckingUpdate.value = true
  appUpdateMessage.value = ''

  try {
    const releaseInfo = await fetchLatestReleaseInfo()

    if (compareVersions(releaseInfo.versionName, currentVersion()) <= 0) {
      updateAvailable.value = false
      alert(TEXTS.settingsUpdateUpToDate)
      return
    }

    latestVersion.value = releaseInfo.versionName
    latestDownloadCandidates.value = releaseInfo.downloadCandidates || []
    latestDownloadName.value = releaseInfo.fileName || `boai-music-v${releaseInfo.versionName}.apk`
    latestReleaseNotes.value = releaseInfo.releaseNotes || ''
    latestSourceLabel.value = releaseInfo.source || ''
    updateAvailable.value = true
  } catch (error) {
    console.error('检查更新失败:', error)
    alert(error?.message || TEXTS.settingsUpdateFailed)
  } finally {
    isCheckingUpdate.value = false
  }
}

async function updateApp() {
  if (!latestDownloadCandidates.value.length) {
    return
  }

  if (!isNativeApp.value) {
    window.open(latestDownloadCandidates.value[0], '_blank', 'noopener')
    return
  }

  if (isDebugBuild.value) {
    alert('当前安装的是调试包，应用内更新仅支持正式 release 包。请先安装正式包后再使用。')
    return
  }

  isStartingUpdate.value = true
  appUpdateMessage.value = ''
  hasDownloadedUpdate.value = false

  try {
    const permission = await invokeNative('ensureInstallPermission', {})

    if (!permission?.granted) {
      alert('请先允许“安装未知应用”权限，然后再次点击“立即更新”。')
      return
    }

    await invokeNative('downloadAndInstallUpdate', {
      urls: latestDownloadCandidates.value,
      fileName: latestDownloadName.value || `boai-music-v${latestVersion.value}.apk`,
    })

    startUpdateStatusPolling()
    appUpdateMessage.value = '更新包开始下载，完成后会自动打开安装界面。'
  } catch (error) {
    console.error('启动更新失败:', error)
    alert(error?.message || '启动更新失败，请稍后重试')
  } finally {
    isStartingUpdate.value = false
  }
}

async function setupUpdateStatusListener() {
  if (!isNativeApp.value) {
    return
  }

  const bridge = getNativeBridge()

  if (!bridge?.addListener) {
    return
  }

  updateListenerHandle = await bridge.addListener('appUpdateStatus', ({ status, message }) => {
    if (status === 'downloading') {
      hasDownloadedUpdate.value = false
      appUpdateMessage.value = '正在下载更新包，请稍候。'
      return
    }

    if (status === 'downloaded') {
      hasDownloadedUpdate.value = true
      appUpdateMessage.value = '更新包已下载完成，正在打开安装界面。'
      openDownloadedUpdate().catch(console.error)
      return
    }

    if (status === 'installing') {
      appUpdateMessage.value = '请在系统安装界面确认升级。'
      return
    }

    if (status === 'failed') {
      const nextMessage = message || '更新失败，请稍后重试。'
      appUpdateMessage.value = nextMessage
      alert(nextMessage)
    }
  })
}

onMounted(async () => {
  await loadNativeAppInfo()
  await setupUpdateStatusListener()
  await syncNativeUpdateStatus()
})

onBeforeUnmount(async () => {
  clearUpdateStatusPolling()

  if (updateListenerHandle?.remove) {
    await updateListenerHandle.remove()
  }

  updateListenerHandle = null
})
</script>

<template>
  <div class="page-shell page-shell--settings">
    <header class="page-header page-header--nav-only">
      <div>
        <h1>{{ TEXTS.settingsPageTitle }}</h1>
      </div>
      <nav class="page-nav">
        <RouterLink class="nav-pill nav-pill--icon" :to="{ name: 'home' }" :title="TEXTS.navHome" :aria-label="TEXTS.navHome">
          <House class="button-icon" />
        </RouterLink>
        <RouterLink class="nav-pill nav-pill--icon" :to="{ name: 'playlist' }" :title="TEXTS.navPlaylist" :aria-label="TEXTS.navPlaylist">
          <ListMusic class="button-icon" />
        </RouterLink>
        <RouterLink class="nav-pill nav-pill--icon" :to="{ name: 'player' }" :title="TEXTS.navPlayer" :aria-label="TEXTS.navPlayer">
          <Disc3 class="button-icon" />
        </RouterLink>
        <RouterLink class="nav-pill nav-pill--icon" :to="{ name: 'settings' }" :title="TEXTS.navSettings" :aria-label="TEXTS.navSettings">
          <Settings2 class="button-icon" />
        </RouterLink>
      </nav>
    </header>

    <div class="settings-layout">
      <section class="surface section-card settings-section">
        <header class="section-card__header">
          <Palette class="button-icon" />
          <h2>{{ TEXTS.settingsAppearanceTitle }}</h2>
        </header>

        <div class="settings-choice-list">
          <button
            v-for="option in themeOptions"
            :key="option.value"
            class="settings-choice"
            :class="{ 'settings-choice--active': themePreference === option.value }"
            type="button"
            @click="setThemePreference(option.value)"
          >
            <component :is="option.icon" class="button-icon" />
            <span>{{ option.label }}</span>
            <Check v-if="themePreference === option.value" class="button-icon" />
          </button>
        </div>
      </section>

      <section class="surface section-card settings-section about-section" @click="showAboutModal = true">
        <header class="section-card__header">
          <Info class="button-icon" />
          <h2>关于应用</h2>
        </header>
      </section>
    </div>

    <div v-if="showAboutModal" class="modal-overlay" @click.self="showAboutModal = false">
      <div class="modal">
        <header class="modal-header">
          <h2>关于应用</h2>
          <button class="plain-button" type="button" @click="showAboutModal = false">
            <X class="button-icon" />
          </button>
        </header>

        <div class="modal-content">
          <div class="app-info">
            <div class="app-icon">
              <Disc3 class="button-icon" />
            </div>
            <h3 class="app-name">博爱音乐</h3>
            <p class="app-version">
              {{ versionLabel }}
              <span v-if="versionCode" class="app-version-code">({{ versionCode }})</span>
            </p>
            <p v-if="isDebugBuild" class="app-debug-tip">当前安装的是调试包，应用内更新只支持正式 release 包。</p>
          </div>

          <div class="app-actions">
            <button class="solid-button update-button" type="button" :disabled="isCheckingUpdate" @click="checkForUpdates">
              <Download v-if="!isCheckingUpdate" class="button-icon" />
              <span>{{ isCheckingUpdate ? TEXTS.settingsUpdateChecking : TEXTS.settingsUpdateButton }}</span>
            </button>

            <div v-if="updateAvailable" class="update-info">
              <p><strong>{{ TEXTS.settingsUpdateAvailable }}: v{{ latestVersion }}</strong></p>
              <p v-if="latestSourceLabel" class="update-meta">更新源：{{ latestSourceLabel }}</p>
              <p v-if="latestReleaseNotes" class="update-notes">{{ latestReleaseNotes }}</p>
              <div class="update-actions">
                <button class="plain-button" type="button" @click="dismissUpdate">
                  {{ TEXTS.settingsUpdateButtonLater }}
                </button>
                <button class="solid-button" type="button" :disabled="isStartingUpdate" @click="updateApp">
                  {{ isStartingUpdate ? '准备中...' : TEXTS.settingsUpdateButtonUpdate }}
                </button>
                <button
                  v-if="hasDownloadedUpdate"
                  class="solid-button"
                  type="button"
                  :disabled="isOpeningInstaller"
                  @click="openDownloadedUpdate"
                >
                  {{ isOpeningInstaller ? '打开中...' : '立即安装' }}
                </button>
              </div>
            </div>

            <p v-if="appUpdateMessage" class="update-message">{{ appUpdateMessage }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-card__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.section-card__header .button-icon {
  color: var(--text-subtle);
}

.settings-choice-list {
  display: grid;
  gap: 0.75rem;
}

.settings-choice {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 0.75rem;
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.settings-choice:hover {
  background: var(--surface-hover);
}

.settings-choice:active {
  transform: scale(0.985);
}

.settings-choice--active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.settings-choice--active .button-icon:last-child {
  color: var(--accent);
}

.about-section {
  cursor: pointer;
  transition: background 0.2s ease;
}

.about-section:hover {
  background: var(--surface-hover);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 18, 38, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal {
  background: color-mix(in srgb, var(--surface-strong) 88%, transparent);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-radius: 1rem;
  max-width: 420px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: var(--shadow-soft);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-subtle);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.modal-content {
  padding: 1.5rem 1.25rem;
}

.app-info {
  text-align: center;
  margin-bottom: 1.5rem;
}

.app-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 5rem;
  height: 5rem;
  background: var(--accent-soft);
  border-radius: 1.5rem;
  margin-bottom: 1rem;
}

.app-icon .button-icon {
  width: 2.5rem;
  height: 2.5rem;
  color: var(--accent);
}

.app-name {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
  font-weight: 700;
}

.app-version,
.app-debug-tip,
.update-meta,
.update-message {
  margin: 0;
  color: var(--text-subtle);
  font-size: 0.875rem;
}

.app-version-code {
  opacity: 0.76;
}

.app-debug-tip {
  margin-top: 0.75rem;
}

.app-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.update-button {
  width: auto;
  min-width: 8rem;
  padding: 0.75rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin: 0 auto;
}

.update-info {
  padding: 1rem;
  background: color-mix(in srgb, var(--surface-strong) 78%, rgba(var(--accent-rgb), 0.16));
  border: 1px solid rgba(var(--accent-rgb), 0.28);
  border-radius: 0.875rem;
}

.update-info p {
  margin: 0 0 0.75rem;
}

.update-notes {
  white-space: pre-wrap;
  line-height: 1.6;
  color: var(--text-secondary);
}

.update-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  flex-wrap: wrap;
}
</style>
