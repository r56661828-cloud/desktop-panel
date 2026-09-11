<script setup lang="ts">
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
</script>

<template>
  <div class="pointer-events-none fixed bottom-3 right-3 z-50 flex flex-col gap-1.5">
    <div
      v-for="t in ui.toasts"
      :key="t.id"
      class="rounded-md px-3 py-1.5 text-xs shadow-lg"
      :class="t.type === 'error' ? 'bg-red-600 text-white' : 'bg-panel-text text-panel-bg'"
    >
      {{ t.msg }}
    </div>
  </div>
</template>
