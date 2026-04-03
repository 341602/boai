<script setup>
import { TEXTS } from '../constants/texts'

defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
  message: {
    type: String,
    default: '',
  },
  confirmText: {
    type: String,
    default: TEXTS.confirm,
  },
  cancelText: {
    type: String,
    default: TEXTS.cancel,
  },
  danger: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'confirm'])
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
      <section class="surface confirm-dialog">
        <header class="confirm-dialog__header">
          <h2>{{ title }}</h2>
          <p>{{ message }}</p>
        </header>

        <footer class="confirm-dialog__actions">
          <button class="plain-button" type="button" @click="emit('close')">
            {{ cancelText }}
          </button>
          <button
            class="solid-button"
            :class="{ 'solid-button--danger': danger }"
            type="button"
            @click="emit('confirm')"
          >
            {{ confirmText }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
