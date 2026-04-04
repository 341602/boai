<script setup>
import { ref, watch } from 'vue'
import { Check, ListPlus, X } from 'lucide-vue-next'
import MarqueeText from './MarqueeText.vue'
import { TEXTS } from '../constants/texts'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  song: {
    type: Object,
    default: null,
  },
  playlists: {
    type: Array,
    default: () => [],
  },
  selectedIds: {
    type: Array,
    default: () => [],
  },
  errorText: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close', 'add', 'create-and-add'])
const draftName = ref('')

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      draftName.value = ''
    }
  },
)

function submitCreate() {
  emit('create-and-add', draftName.value)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
      <section class="surface playlist-modal">
        <header class="playlist-modal__header">
          <div>
            <h2>{{ TEXTS.playlistPickerTitle }}</h2>
            <MarqueeText tag="p" :text="song?.name || TEXTS.noSongSelected" />
          </div>
          <button class="icon-button" type="button" :title="TEXTS.close" :aria-label="TEXTS.close" @click="emit('close')">
            <X class="button-icon" />
          </button>
        </header>

        <div class="playlist-modal__create">
          <label class="playlist-modal__field">
            <span>{{ TEXTS.playlistCreateLabel }}</span>
            <input
              v-model.trim="draftName"
              type="text"
              :placeholder="TEXTS.playlistCreatePlaceholder"
              @keydown.enter.prevent="submitCreate"
            />
          </label>
          <button class="solid-button" type="button" @click="submitCreate">
            {{ TEXTS.playlistCreateAndAddAction }}
          </button>
        </div>

        <p v-if="errorText" class="error-banner">{{ errorText }}</p>

        <div v-if="playlists.length" class="playlist-modal__list">
          <button
            v-for="playlist in playlists"
            :key="playlist.id"
            class="playlist-modal__item"
            type="button"
            :disabled="selectedIds.includes(playlist.id)"
            @click="emit('add', playlist.id)"
          >
            <div class="playlist-modal__item-meta">
              <strong>{{ playlist.name }}</strong>
              <span>{{ playlist.tracks.length }} {{ TEXTS.trackUnit }}</span>
            </div>
            <span
              class="playlist-modal__item-action"
              :title="selectedIds.includes(playlist.id) ? TEXTS.playlistAdded : TEXTS.playlistAdd"
              :aria-label="selectedIds.includes(playlist.id) ? TEXTS.playlistAdded : TEXTS.playlistAdd"
            >
              <Check v-if="selectedIds.includes(playlist.id)" class="button-icon" />
              <ListPlus v-else class="button-icon" />
            </span>
          </button>
        </div>

        <div v-else class="empty-state empty-state--modal">
          {{ TEXTS.playlistEmptyCollection }}
        </div>
      </section>
    </div>
  </Teleport>
</template>
