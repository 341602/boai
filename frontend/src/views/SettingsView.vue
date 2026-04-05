<script setup>
import { computed, ref } from 'vue'
import { Check, Disc3, House, ListMusic, Monitor, MoonStar, Settings2, SunMedium } from 'lucide-vue-next'
import appPackage from '../../package.json'
import { THEME_MODES, useThemePreference } from '../composables/useThemePreference'
import { TEXTS } from '../constants/texts'

const { resolvedTheme, setThemePreference, systemTheme, themePreference } = useThemePreference()

const themeOptions = [
  {
    value: THEME_MODES.system,
    label: TEXTS.settingsThemeSystem,
    copy: TEXTS.settingsThemeSystemCopy,
    icon: Monitor,
  },
  {
    value: THEME_MODES.light,
    label: TEXTS.settingsThemeLight,
    copy: TEXTS.settingsThemeLightCopy,
    icon: SunMedium,
  },
  {
    value: THEME_MODES.dark,
    label: TEXTS.settingsThemeDark,
    copy: TEXTS.settingsThemeDarkCopy,
    icon: MoonStar,
  },
]

const themeLabelMap = {
  [THEME_MODES.system]: TEXTS.settingsResolvedSystem,
  [THEME_MODES.light]: TEXTS.settingsResolvedLight,
  [THEME_MODES.dark]: TEXTS.settingsResolvedDark,
}

const currentThemeLabel = computed(() => themeLabelMap[resolvedTheme.value] || TEXTS.settingsResolvedLight)
const systemThemeLabel = computed(() => themeLabelMap[systemTheme.value] || TEXTS.settingsResolvedLight)
const versionLabel = computed(() => `v${appPackage.version || '0.0.0'}`)

// 更新检查相关状态
const isCheckingUpdate = ref(false)
const updateAvailable = ref(false)
const latestVersion = ref('')
const updateError = ref('')

async function checkForUpdates() {
  isCheckingUpdate.value = true
  updateError.value = ''
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    
    // 尝试直接访问 GitHub
    let response
    try {
      response = await fetch('https://api.github.com/repos/341602/boai/releases/latest', {
        signal: controller.signal
      })
    } catch (directError) {
      console.log('直接访问 GitHub 失败，尝试使用镜像...')
      // 如果直接访问失败，尝试使用镜像
      response = await fetch('https://gh.api.99988866.xyz/https://api.github.com/repos/341602/boai/releases/latest', {
        signal: controller.signal
      })
    }
    
    clearTimeout(timeoutId)
    
    if (response.status === 404) {
      // 没有发布的 releases
      alert(TEXTS.settingsUpdateNoReleases)
      return
    }
    
    if (!response.ok) {
      throw new Error('Network response was not ok')
    }
    
    const data = await response.json()
    const latestTag = data.tag_name.replace('v', '')
    const currentVersion = appPackage.version || '0.0.0'
    
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
  // 刷新页面获取最新版本
  location.reload()
}

function dismissUpdate() {
  updateAvailable.value = false
  latestVersion.value = ''
}

// 版本号比较函数
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
        <header class="section-card__header settings-section__header">
          <div>
            <h2>{{ TEXTS.settingsAppearanceTitle }}</h2>
            <p class="section-card__subtitle">{{ TEXTS.settingsAppearanceCopy }}</p>
          </div>
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
            <span class="settings-choice__icon">
              <component :is="option.icon" class="button-icon" />
            </span>
            <div class="settings-choice__meta">
              <strong>{{ option.label }}</strong>
              <p>{{ option.copy }}</p>
            </div>
            <Check v-if="themePreference === option.value" class="button-icon" />
          </button>
        </div>
      </section>

      <section class="surface section-card settings-section">
        <header class="section-card__header settings-section__header">
          <div>
            <h2>{{ TEXTS.settingsStatusTitle }}</h2>
            <p class="section-card__subtitle">{{ TEXTS.settingsStatusCopy }}</p>
          </div>
        </header>

        <div class="settings-row-list">
          <div class="settings-row">
            <div class="settings-row__meta">
              <strong>{{ TEXTS.settingsCurrentTheme }}</strong>
              <p>{{ TEXTS.settingsCurrentThemeCopy }}</p>
            </div>
            <span class="settings-row__value">{{ currentThemeLabel }}</span>
          </div>

          <div class="settings-row">
            <div class="settings-row__meta">
              <strong>{{ TEXTS.settingsSystemTheme }}</strong>
              <p>{{ TEXTS.settingsSystemThemeCopy }}</p>
            </div>
            <span class="settings-row__value">{{ systemThemeLabel }}</span>
          </div>

          <div class="settings-row">
            <div class="settings-row__meta">
              <strong>{{ TEXTS.settingsVersionLabel }}</strong>
              <p>{{ TEXTS.settingsVersionCopy }}</p>
            </div>
            <span class="settings-row__value">{{ versionLabel }}</span>
          </div>

          <div class="settings-row">
            <div class="settings-row__meta">
              <strong>{{ TEXTS.settingsUpdateLabel }}</strong>
              <p>{{ TEXTS.settingsUpdateCopy }}</p>
            </div>
            <button 
              class="plain-button" 
              :disabled="isCheckingUpdate"
              @click="checkForUpdates"
            >
              {{ isCheckingUpdate ? TEXTS.settingsUpdateChecking : TEXTS.settingsUpdateButton }}
            </button>
          </div>

          <!-- 更新提示 -->
          <div v-if="updateAvailable" class="settings-row settings-row--update">
            <div class="settings-row__meta">
              <strong>{{ TEXTS.settingsUpdateAvailable }}: v{{ latestVersion }}</strong>
              <p>{{ versionLabel }} → v{{ latestVersion }}</p>
            </div>
            <div class="settings-row__actions">
              <button class="plain-button" @click="dismissUpdate">
                {{ TEXTS.settingsUpdateButtonLater }}
              </button>
              <button class="solid-button" @click="updateApp">
                {{ TEXTS.settingsUpdateButtonUpdate }}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
