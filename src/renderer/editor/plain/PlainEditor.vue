<script setup lang="ts">
import { useTabsStore } from '@/stores/tabs'
import type { Tab } from '@/stores/tabs'

const props = defineProps<{ tab: Tab }>()
const tabs = useTabsStore()

function onInput(e: Event): void {
  tabs.setContent(props.tab.id, (e.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <!-- 纯文本模式（PRD M4）：无格式渲染、不注入任何标签 -->
  <div class="editor-card min-w-0 flex-1 overflow-hidden rounded-xl border border-panel-border shadow-sm">
    <textarea
      class="h-full w-full resize-none bg-transparent p-4 font-mono text-sm leading-6 text-panel-text outline-none"
      :value="tab.content"
      spellcheck="false"
      @input="onInput"
    />
  </div>
</template>
