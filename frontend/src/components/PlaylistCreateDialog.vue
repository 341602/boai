<script setup>
import { nextTick, ref, watch } from 'vue'
import { FolderPlus, X } from 'lucide-vue-next'
import { TEXTS } from '../constants/texts'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  modelValue: {
    type: String,
    default: '',
  },
  errorText: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close', 'confirm', 'update:modelValue'])
const inputRef = ref(null)

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      return
    }

    await nextTick()
    inputRef.value?.focus()
    inputRef.value?.select?.()
  },
)

function submit() {
  emit('confirm')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
      <section class="surface playlist-modal playlist-create-dialog">
        <header class="playlist-modal__header playlist-create-dialog__header">
          <div class="playlist-create-dialog__title">
            <FolderPlus class="button-icon" />
            <h2>{{ TEXTS.playlistCreateLabel }}</h2>
          </div>
          <button class="icon-button" type="button" :title="TEXTS.close" :aria-label="TEXTS.close" @click="emit('close')">
            <X class="button-icon" />
          </button>
        </header>

        <div class="playlist-modal__create">
          <label class="playlist-modal__field">
            <span>{{ TEXTS.playlistCreateLabel }}</span>
            <input
              ref="inputRef"
              :value="modelValue"
              type="text"
              :placeholder="TEXTS.playlistCreatePlaceholder"
              @input="emit('update:modelValue', $event.target.value)"
              @keydown.enter.prevent="submit"
            />
          </label>
        </div>

        <p v-if="errorText" class="error-banner">{{ errorText }}</p>

        <footer class="playlist-create-dialog__actions">
          <button class="plain-button" type="button" @click="emit('close')">
            {{ TEXTS.cancel }}
          </button>
          <button class="solid-button" type="button" @click="submit">
            {{ TEXTS.confirm }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
