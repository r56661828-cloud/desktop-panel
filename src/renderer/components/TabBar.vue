<script setup lang="ts">
import { Plus, X } from '@lucide/vue'
import { NButton, NTooltip } from 'naive-ui'
import { useTabsStore } from '@/stores/tabs'

const tabs = useTabsStore()

function onAuxClick(e: MouseEvent, id: string): void {
  if (e.button === 1) void tabs.closeTab(id)
}
</script>

<template>
  <div class="flex h-9 shrink-0 items-end gap-1 overflow-x-auto bg-panel-bg px-1.5 pt-1">
    <div
      v-for="tab in tabs.tabs"
      :key="tab.id"
      class="group relative flex max-w-44 shrink-0 cursor-pointer items-center gap-1.5 rounded-t-lg px-2.5 py-1.5 text-xs"
      :class="
        tab.id === tabs.activeId
          ? 'bg-panel-card text-panel-text shadow-sm'
          : 'text-panel-text2 hover:bg-panel-bg2'
      "
      :data-testid="tab.id === tabs.activeId ? 'tab-active' : 'tab'"
      @click="tabs.activeId = tab.id"
      @auxclick="onAuxClick($event, tab.id)"
    >
      <span class="truncate">{{ tab.fileName }}</span>
      <span v-if="tab.dirty" class="text-panel-accent">●</span>
      <!-- 关闭按钮常显（UI-PLAN P1-4），hover 仅做底色反馈 -->
      <button
        class="ml-0.5 rounded p-0.5 text-panel-text2 hover:bg-panel-border hover:text-panel-text"
        title="关闭标签（Ctrl+W）"
        :data-testid="'tab-close-' + tab.fileName"
        @click.stop="void tabs.closeTab(tab.id)"
      >
        <X :size="11" />
      </button>
      <span
        v-if="tab.id === tabs.activeId"
        class="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-panel-accent"
      />
    </div>
    <NTooltip trigger="hover" placement="bottom" :show-arrow="false">
      <template #trigger>
        <NButton quaternary size="tiny" class="mb-0.5 shrink-0" data-testid="new-tab-btn" @click="tabs.newTab()">
          <template #icon><Plus :size="14" /></template>
        </NButton>
      </template>
      新建标签（Ctrl+T）
    </NTooltip>
  </div>
</template>
