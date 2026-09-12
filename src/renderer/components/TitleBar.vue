<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Brush, FolderOpen, Minus, Pin, PinOff, Save, Table2, X } from '@lucide/vue'
import { useTabsStore } from '@/stores/tabs'
import { useUiStore } from '@/stores/ui'
import { useUpdateStore } from '@/stores/update'
import { editorRegistry } from '@/editor/editorRegistry'
import TitleBarIcon from './TitleBarIcon.vue'

const tabs = useTabsStore()
const ui = useUiStore()
const update = useUpdateStore()

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

/** 插入 3×3 表格（FR-3.2） */
function insertTable(): void {
  const tab = tabs.activeTab
  if (!tab) return
  if (tab.readonly) {
    ui.toast('只读标签不支持插入表格')
    return
  }
  if (tab.docType === 'plaintext') {
    ui.toast('纯文本不支持表格，请改用 Markdown 文档', 'error')
    return
  }
  editorRegistry.get(tab.id)?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}

function minimize(): void {
  void window.api.minimize()
}

function closePanel(): void {
  void window.api.collapse()
}
</script>

<template>
  <div class="drag-region flex h-10 shrink-0 items-center justify-between border-b border-panel-border bg-panel-bg2 pl-3">
    <div class="flex min-w-0 items-center gap-2">
      <span class="flex h-5 w-5 items-center justify-center rounded bg-panel-accent text-[11px] font-bold text-white">N</span>
      <span class="truncate text-sm font-medium text-panel-text">
        {{ tabs.activeTab?.fileName ?? '' }}<span v-if="tabs.activeTab?.dirty" class="ml-1 text-panel-accent">●</span>
      </span>
    </div>
    <div class="no-drag flex items-center gap-0.5 pr-1.5">
      <TitleBarIcon
        :tooltip="pinned ? '已钉住：面板始终置顶（切换应用后仍在最前）' : '未钉住：普通窗口，可被其他应用遮挡'"
        testid="pin-btn"
        :active="pinned"
        @click="togglePin"
      >
        <template #icon><Pin v-if="pinned" :size="15" /><PinOff v-else :size="15" /></template>
      </TitleBarIcon>
      <TitleBarIcon tooltip="插入表格（3×3）" testid="table-btn" @click="insertTable">
        <template #icon><Table2 :size="15" /></template>
      </TitleBarIcon>
      <TitleBarIcon tooltip="涂鸦（Ctrl+D）" testid="doodle-btn" @click="tabs.enterDoodle()">
        <template #icon><Brush :size="15" /></template>
      </TitleBarIcon>
      <TitleBarIcon tooltip="打开文件（Ctrl+O）" testid="open-btn" @click="tabs.openFiles(true)">
        <template #icon><FolderOpen :size="15" /></template>
      </TitleBarIcon>
      <TitleBarIcon tooltip="保存（Ctrl+S）" testid="save-btn" @click="tabs.saveActive()">
        <template #icon><Save :size="15" /></template>
      </TitleBarIcon>
      <span class="mx-1 h-4 w-px bg-panel-border" />
      <!-- 在线更新入口（TECH-DESIGN-UPDATE §5.1）：仅 downloaded 可点击弹确认框 -->
      <button
        v-if="update.buttonLabel"
        class="rounded-full px-2.5 py-1 text-xs font-medium"
        :class="
          update.buttonClickable
            ? 'bg-panel-accent text-white hover:opacity-90'
            : 'cursor-default bg-panel-bg2 text-panel-text2'
        "
        :data-testid="update.buttonClickable ? 'update-btn' : 'update-progress'"
        @click="update.openConfirm()"
      >
        {{ update.buttonLabel }}
      </button>
      <TitleBarIcon tooltip="最小化" testid="minimize-btn" @click="minimize">
        <template #icon><Minus :size="15" /></template>
      </TitleBarIcon>
      <TitleBarIcon tooltip="关闭面板（驻留托盘，Ctrl+Shift+Q 或点托盘图标可再次唤醒）" testid="close-btn" @click="closePanel">
        <template #icon><X :size="15" /></template>
      </TitleBarIcon>
    </div>
  </div>
</template>
