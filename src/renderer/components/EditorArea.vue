<script setup lang="ts">
import { watch } from 'vue'
import { useDoodleStore } from '@/stores/doodle'
import { useTabsStore } from '@/stores/tabs'
import { setAssetContext } from '@/editor/assets'
import TipTapEditor from '@/editor/TipTapEditor.vue'
import PlainEditor from '@/editor/plain/PlainEditor.vue'
import DoodleLayer from '@/doodle/DoodleLayer.vue'

const tabs = useTabsStore()
const doodle = useDoodleStore()

// 活动标签切换时更新资产解析上下文（相对引用 → app-file URL 的基准目录）
watch(
  () => [tabs.activeId, tabs.activeTab?.filePath] as const,
  () => {
    const t = tabs.activeTab
    setAssetContext(t?.id ?? '', t?.filePath ?? null)
  },
  { immediate: true }
)
</script>

<template>
  <div class="relative flex min-h-0 flex-1 gap-0 bg-panel-bg p-1.5">
    <div
      v-if="tabs.activeTab?.conflict"
      class="absolute left-3 right-3 top-3 z-30 flex items-center justify-between rounded-lg bg-amber-500/95 px-3 py-1.5 text-xs text-white shadow-md"
    >
      <span>文件已在磁盘上被修改</span>
      <span class="flex gap-2">
        <button class="rounded bg-white/20 px-2 py-0.5 hover:bg-white/30" @click="tabs.reloadTab(tabs.activeTab!.id)">重新加载</button>
        <button class="rounded bg-white/20 px-2 py-0.5 hover:bg-white/30" @click="tabs.keepMine(tabs.activeTab!.id)">保留我的版本</button>
      </span>
    </div>

    <div
      v-for="tab in tabs.tabs"
      v-show="tab.id === tabs.activeId"
      :key="tab.id"
      class="absolute inset-3 flex"
    >
      <PlainEditor v-if="tab.docType === 'plaintext'" :tab="tab" />
      <TipTapEditor v-else :tab="tab" />
    </div>

    <!-- 涂鸦覆盖画布（PRD M8） -->
    <DoodleLayer v-if="doodle.active" />
  </div>
</template>
