<script setup>
import { computed } from 'vue'
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
            <span class="settings-row__value settings-row__value--muted">{{ TEXTS.settingsComingSoon }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
