<script setup>
import { LoaderCircle, Search } from 'lucide-vue-next'
import { TEXTS } from '../constants/texts'

defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'search', 'focus'])

function submit() {
  emit('search')
}
</script>

<template>
  <form class="search-bar" @submit.prevent="submit">
    <label class="search-bar__field">
      <Search class="button-icon" />
      <input
        :value="modelValue"
        type="text"
        :placeholder="TEXTS.searchPlaceholder"
        @focus="emit('focus')"
        @input="emit('update:modelValue', $event.target.value)"
      />
    </label>

    <button
      class="search-bar__button search-bar__button--icon"
      type="submit"
      :disabled="loading"
      :title="loading ? TEXTS.searchLoading : TEXTS.searchAction"
      :aria-label="loading ? TEXTS.searchLoading : TEXTS.searchAction"
    >
      <LoaderCircle v-if="loading" class="button-icon button-icon--spin" />
      <Search v-else class="button-icon" />
    </button>
  </form>
</template>
