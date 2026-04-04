<script setup>
import { computed } from 'vue'
import { Heart, ListPlus, Trash2 } from 'lucide-vue-next'
import MarqueeText from './MarqueeText.vue'
import { TEXTS } from '../constants/texts'
import { formatAlbum, formatArtists, getTrackInitial } from '../utils/track'

const props = defineProps({
  title: {
    type: String,
    default: '',
  },
  subtitle: {
    type: String,
    default: '',
  },
  songs: {
    type: Array,
    default: () => [],
  },
  activeCid: {
    type: String,
    default: '',
  },
  emptyText: {
    type: String,
    default: '',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  favoriteIds: {
    type: Array,
    default: () => [],
  },
  showFavorite: {
    type: Boolean,
    default: true,
  },
  showRemove: {
    type: Boolean,
    default: false,
  },
  showPlaylistAdd: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['play', 'toggle-favorite', 'remove', 'add-to-playlist'])

const favoriteSet = computed(() => new Set(props.favoriteIds))

function favoriteLabel(song) {
  return favoriteSet.value.has(song.cid) ? TEXTS.unfavorite : TEXTS.favorite
}

function favoriteState(song) {
  return favoriteSet.value.has(song.cid)
}
</script>

<template>
  <section class="surface section-card">
    <header class="section-card__header">
      <div>
        <h2>{{ title }}</h2>
        <p v-if="subtitle" class="section-card__subtitle">{{ subtitle }}</p>
      </div>
    </header>

    <div v-if="!songs.length" class="empty-state">
      {{ loading ? TEXTS.searchLoading : emptyText }}
    </div>

    <div v-else class="track-list">
      <article
        v-for="(song, index) in songs"
        :key="song.cid || `${song.id}-${index}`"
        class="track-row"
        :class="{ 'track-row--active': song.cid === activeCid }"
      >
        <button class="track-row__main" type="button" @click="emit('play', song, index)">
          <span class="track-row__index">{{ String(index + 1).padStart(2, '0') }}</span>

          <div v-if="song.album?.picUrl || song.picUrl" class="track-row__cover">
            <img :src="song.album?.picUrl || song.picUrl" :alt="song.name" />
          </div>
          <div v-else class="track-row__cover track-row__cover--fallback">
            {{ getTrackInitial(song) }}
          </div>

          <div class="track-row__meta">
            <MarqueeText tag="strong" :text="song.name" />
            <MarqueeText tag="p" :text="formatArtists(song)" />
            <p>{{ formatAlbum(song) }}</p>
          </div>
        </button>

        <div class="track-row__actions">
          <button
            v-if="showFavorite"
            class="icon-button"
            :class="{ 'icon-button--active': favoriteState(song) }"
            type="button"
            :title="favoriteLabel(song)"
            :aria-label="favoriteLabel(song)"
            @click="emit('toggle-favorite', song)"
          >
            <Heart class="button-icon button-icon--favorite" />
          </button>
          <button
            v-if="showPlaylistAdd"
            class="icon-button"
            type="button"
            :title="TEXTS.playlistAdd"
            :aria-label="TEXTS.playlistAdd"
            @click="emit('add-to-playlist', song)"
          >
            <ListPlus class="button-icon" />
          </button>
          <button
            v-if="showRemove"
            class="icon-button icon-button--danger"
            type="button"
            :title="TEXTS.remove"
            :aria-label="TEXTS.remove"
            @click="emit('remove', song)"
          >
            <Trash2 class="button-icon" />
          </button>
        </div>
      </article>
    </div>

    <footer v-if="$slots.footer" class="section-card__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>
