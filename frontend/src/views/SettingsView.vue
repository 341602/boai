<script setup>
import { computed, ref } from 'vue'
import { Check, Disc3, Download, House, Info, ListMusic, Palette, MoonStar, Settings2, SunMedium, X } from 'lucide-vue-next'
import appPackage from '../../package.json'
import { THEME_MODES, useThemePreference } from '../composables/useThemePreference'
import { TEXTS } from '../constants/texts'

const { resolvedTheme, setThemePreference, themePreference } = useThemePreference()

const themeOptions = [
  {
    value: THEME_MODES.system,
    label: TEXTS.settingsThemeSystem,
    icon: Palette,
  },
  {
    value: THEME_MODES.light,
    label: TEXTS.settingsThemeLight,
    icon: SunMedium,
  },
  {
    value: THEME_MODES.dark,
    label: TEXTS.settingsThemeDark,
    icon: MoonStar,
  },
]

const versionLabel = computed(() => `v${appPackage.version || '0.0.0'}`)

const isCheckingUpdate = ref(false)
const updateAvailable = ref(false)
const latestVersion = ref('')
const showAboutModal = ref(false)

async function checkForUpdates() {
  isCheckingUpdate.value = true
  
  const mirrors = [
    { name: 'ghproxy.net', url: 'https://ghproxy.net/https://api.github.com/repos/341602/boai/releases/latest' },
    { name: 'mirror.ghproxy.com', url: 'https://mirror.ghproxy.com/https://api.github.com/repos/341602/boai/releases/latest' },
    { name: 'gh-proxy.com', url: 'https://gh-proxy.com/https://api.github.com/repos/341602/boai/releases/latest' },
    { name: 'moeyy.cn', url: 'https://moeyy.cn/gh-proxy/https://api.github.com/repos/341602/boai/releases/latest' },
    { name: 'ghp.ci', url: 'https://ghp.ci/https://api.github.com/repos/341602/boai/releases/latest' },
    { name: 'GitHub 直接', url: 'https://api.github.com/repos/341602/boai/releases/latest' },
  ]
  
  try {
    let response
    let lastError
    let usedMirror = ''
    
    for (const mirror of mirrors) {
      try {
        console.log(`尝试使用 ${mirror.name}...`)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)
        
        response = await fetch(mirror.url, { signal: controller.signal })
        clearTimeout(timeoutId)
        
        console.log(`${mirror.name} 响应状态:`, response.status)
        
        if (response.ok) {
          usedMirror = mirror.name
          break
        }
      } catch (err) {
        console.log(`${mirror.name} 失败:`, err)
        lastError = err
        continue
      }
    }
    
    if (!response || !response.ok) {
      if (lastError) throw lastError
      throw new Error('所有镜像都无法访问')
    }
    
    console.log(`成功使用: ${usedMirror}`)
    
    if (response.status === 404) {
      alert(TEXTS.settingsUpdateNoReleases)
      return
    }
    
    const data = await response.json()
    console.log('Release 数据:', data)
    
    const latestTag = data.tag_name.replace('v', '')
    const currentVersion = appPackage.version || '0.0.0'
    
    console.log('最新版本:', latestTag, '当前版本:', currentVersion)
    
    if (compareVersions(latestTag, currentVersion) > 0) {
      updateAvailable.value = true
      latestVersion.value = latestTag
    } else {
      alert(TEXTS.settingsUpdateUpToDate)
    }
  } catch (error) {
    console.error('检查更新失败:', error)
    if (error.name === 'AbortError') {
      alert('请求超时，请稍后重试')
    } else {
      alert(TEXTS.settingsUpdateFailed)
    }
  } finally {
    isCheckingUpdate.value = false
  }
}

function updateApp() {
  location.reload()
}

function dismissUpdate() {
  updateAvailable.value = false
  latestVersion.value = ''
}

function compareVersions(version1, version2) {
  const v1 = version1.split('.').map(Number)
  const v2 = version2.split('.').map(Number)
  
  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const num1 = v1[i] || 0
    const num2 = v2[i] || 0
    
    if (num1 > num2) return 1
    if (num1 < num2) return -1
  }
  
  return 0
}
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
        <RouterLink
          class="nav-pill nav-pill--icon"
          :to="{ name: 'playlist' }"
          :title="TEXTS.navPlaylist"
          :aria-label="TEXTS.navPlaylist"
        >
          <ListMusic class="button-icon" />
        </RouterLink>
        <RouterLink class="nav-pill nav-pill--icon" :to="{ name: 'player' }" :title="TEXTS.navPlayer" :aria-label="TEXTS.navPlayer">
          <Disc3 class="button-icon" />
        </RouterLink>
        <RouterLink
          class="nav-pill nav-pill--icon"
          :to="{ name: 'settings' }"
          :title="TEXTS.navSettings"
          :aria-label="TEXTS.navSettings"
        >
          <Settings2 class="button-icon" />
        </RouterLink>
      </nav>
    </header>

    <div class="settings-layout">
      <section class="surface section-card settings-section">
        <header class="section-card__header">
          <Palette class="button-icon" />
          <h2>主题</h2>
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
          <button class="plain-button" @click="showAboutModal = false">
            <X class="button-icon" />
          </button>
        </header>

        <div class="modal-content">
          <div class="app-info">
            <div class="app-icon">
              <Disc3 class="button-icon" />
            </div>
            <h3 class="app-name">博爱音乐</h3>
            <p class="app-version">{{ versionLabel }}</p>
          </div>

          <div class="app-actions">
            <button 
              class="solid-button update-button" 
              :disabled="isCheckingUpdate"
              @click="checkForUpdates"
            >
              <Download v-if="!isCheckingUpdate" class="button-icon" />
              <span>{{ isCheckingUpdate ? TEXTS.settingsUpdateChecking : TEXTS.settingsUpdateButton }}</span>
            </button>

            <div v-if="updateAvailable" class="update-info">
              <p><strong>{{ TEXTS.settingsUpdateAvailable }}: v{{ latestVersion }}</strong></p>
              <div class="update-actions">
                <button class="plain-button" @click="dismissUpdate">
                  {{ TEXTS.settingsUpdateButtonLater }}
                </button>
                <button class="solid-button" @click="updateApp">
                  {{ TEXTS.settingsUpdateButtonUpdate }}
                </button>
              </div>
            </div>
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
  transition: all 0.2s ease;
}

.settings-choice:hover {
  background: var(--surface-hover);
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
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal {
  background: color-mix(in srgb, var(--surface) 85%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 1rem;
  max-width: 400px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
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
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.app-version {
  margin: 0;
  color: var(--text-subtle);
  font-size: 0.875rem;
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
  background: var(--accent-soft);
  border: 1px solid var(--accent);
  border-radius: 0.75rem;
}

.update-info p {
  margin: 0 0 0.75rem 0;
}

.update-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}
</style>
