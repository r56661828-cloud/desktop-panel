<script setup lang="ts">
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
</script>

<template>
  <div
    v-if="ui.confirmOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
    @keydown.escape="ui.answerConfirm('cancel')"
  >
    <div class="w-72 rounded-lg border border-panel-border bg-panel-bg p-4 shadow-xl">
      <div class="mb-1 text-sm font-semibold text-panel-text">{{ ui.confirmTitle }}</div>
      <div class="mb-4 text-xs text-panel-text2">{{ ui.confirmMessage }}</div>
      <div class="flex justify-end gap-2">
        <button class="rounded border border-panel-border px-2.5 py-1 text-xs text-panel-text hover:bg-panel-bg2" @click="ui.answerConfirm('cancel')">
          取消
        </button>
        <button class="rounded border border-panel-border px-2.5 py-1 text-xs text-panel-text hover:bg-panel-bg2" @click="ui.answerConfirm('discard')">
          不保存
        </button>
        <button class="rounded bg-panel-accent px-2.5 py-1 text-xs text-white hover:opacity-90" @click="ui.answerConfirm('save')">
          保存
        </button>
      </div>
    </div>
  </div>
</template>
