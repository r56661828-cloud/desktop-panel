<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useUiStore } from '@/stores/ui'
import { editorRegistry } from '@/editor/editorRegistry'

const tabs = useTabsStore()
const ui = useUiStore()

const pinned = ref(false)

onMounted(async () => {
  try {
    pinned.value = (await window.api.getState()).pinned
  } catch {
    // 主进程未就绪时保持默认
  }
})

async function togglePin(): Promise<void> {
  pinned.value = !pinned.value
  try {
    await window.api.setPinned(pinned.value)
  } catch (e) {
    pinned.value = !pinned.value
    ui.toast('钉住状态切换失败：' + (e instanceof Error ? e.message : String(e)), 'error')
  }
}

function collapse(): void {
  void window.api.collapse()
}

/** 插入 3×3 表格（FR-3.2） */
function insertTable(): void {
  const tab = tabs.activeTab
  if (!tab || tab.docType === 'plaintext') {
    ui.toast('纯文本不支持表格，请改用 Markdown 文档', 'error')
    return
  }
  editorRegistry.get(tab.id)?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}
</script>

<template>
  <div class="drag-region flex h-10 shrink-0 items-center justify-between border-b border-panel-border bg-panel-bg2 pl-3">
    <div class="flex min-w-0 items-center gap-2">
      <span class="text-xs font-semibold text-panel-accent">≡ Notes</span>
      <span class="truncate text-sm font-medium text-panel-text">
        {{ tabs.activeTab?.fileName ?? '' }}<span v-if="tabs.activeTab?.dirty" class="ml-1 text-panel-accent">●</span>
      </span>
    </div>
    <div class="no-drag flex items-center gap-0.5 pr-1.5">
      <button
        class="rounded px-2 py-1 text-sm hover:bg-panel-bg"
        :class="pinned ? 'text-panel-accent' : 'text-panel-text2'"
        :title="pinned ? '已钉住：面板始终置顶（切换应用后仍在最前）' : '未钉住：普通窗口，可被其他应用遮挡'"
        @click="togglePin"
      >
        📌
      </button>
      <button class="rounded px-2 py-1 text-sm text-panel-text2 hover:bg-panel-bg" title="插入表格（3×3）" @click="insertTable()">▦</button>
      <button class="rounded px-2 py-1 text-sm text-panel-text2 hover:bg-panel-bg" title="涂鸦（Ctrl+D）" @click="tabs.enterDoodle()">✏️</button>
      <button class="rounded px-2 py-1 text-sm text-panel-text2 hover:bg-panel-bg" title="打开文件（Ctrl+O）" @click="tabs.openFiles(true)">📂</button>
      <button class="rounded px-2 py-1 text-sm text-panel-text2 hover:bg-panel-bg" title="保存（Ctrl+S）" @click="tabs.saveActive()">💾</button>
      <button class="rounded px-2 py-1 text-sm text-panel-text2 hover:bg-panel-bg" title="收起面板（Esc）" @click="collapse()">—</button>
    </div>
  </div>
</template>
