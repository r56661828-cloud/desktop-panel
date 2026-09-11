<script setup lang="ts">
import { useTabsStore } from '@/stores/tabs'

const tabs = useTabsStore()

function onAuxClick(e: MouseEvent, id: string): void {
  if (e.button === 1) void tabs.closeTab(id)
}
</script>

<template>
  <div class="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b border-panel-border bg-panel-bg px-1.5">
    <button
      v-for="tab in tabs.tabs"
      :key="tab.id"
      class="group flex max-w-44 shrink-0 items-center gap-1.5 rounded-t-md border border-b-0 px-2.5 py-1.5 text-xs"
      :class="
        tab.id === tabs.activeId
          ? 'border-panel-border bg-panel-bg text-panel-text'
          : 'border-transparent text-panel-text2 hover:bg-panel-bg2'
      "
      @click="tabs.activeId = tab.id"
      @auxclick="onAuxClick($event, tab.id)"
    >
      <span class="truncate">{{ tab.fileName }}</span>
      <span v-if="tab.dirty" class="text-panel-accent">●</span>
      <span
        class="ml-0.5 hidden rounded px-0.5 text-[10px] hover:bg-panel-border group-hover:inline"
        title="关闭标签（Ctrl+W）"
        @click.stop="void tabs.closeTab(tab.id)"
      >
        ✕
      </span>
    </button>
    <button
      class="shrink-0 rounded px-2 py-1 text-sm text-panel-text2 hover:bg-panel-bg2"
      title="新建标签（Ctrl+T）"
      @click="tabs.newTab()"
    >
      ＋
    </button>
  </div>
</template>
