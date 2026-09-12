<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useDialog, useMessage } from 'naive-ui'
import TitleBar from './components/TitleBar.vue'
import TabBar from './components/TabBar.vue'
import EditorArea from './components/EditorArea.vue'
import { editorRegistry } from './editor/editorRegistry'
import { useDoodleStore } from './stores/doodle'
import { useTabsStore } from './stores/tabs'
import { useUiStore } from './stores/ui'

// 位于 NMessageProvider/NDialogProvider 子树内，注册 API 给 ui store
const message = useMessage()
const dialog = useDialog()
const tabs = useTabsStore()
const doodle = useDoodleStore()
const ui = useUiStore()

ui.registerMessageApi(message)
ui.registerDialogApi(dialog)

let unsubscribers: (() => void)[] = []

onMounted(async () => {
  await tabs.restoreDrafts()

  // 面板唤醒：外部变更兜底比对 + 聚焦编辑区（FR-1.2 / FR-6.5）
  unsubscribers.push(
    window.api.onEditorFocus(() => {
      void tabs.checkExternalChanges()
      const ed = tabs.activeId ? editorRegistry.get(tabs.activeId) : undefined
      ed?.commands.focus()
    }),
    window.api.onFileChanged((p) => tabs.onFileChanged(p)),
    window.api.onQuitRequest(async () => {
      const dirty = tabs.tabs.filter((t) => t.dirty)
      if (dirty.length) {
        const r = await ui.askConfirm('退出应用', `${dirty.length} 个标签有未保存的修改，保存后退出吗？`)
        if (r === 'cancel') return
        if (r === 'save') {
          for (const t of dirty) {
            const ok = await tabs.saveTab(t.id)
            if (!ok) return
          }
        }
      }
      void window.api.quit(true)
    })
  )
  window.addEventListener('keydown', onKeydown, true)
})

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    if (doodle.active) doodle.close() // 涂鸦模式下 Esc = 取消（FR-8.6）
    else void window.api.collapse()
    return
  }
  if (!e.ctrlKey && !e.metaKey) return
  const k = e.key.toLowerCase()
  if (k === 's' && e.shiftKey) {
    e.preventDefault()
    tabs.saveActiveAs()
  } else if (k === 's') {
    e.preventDefault()
    tabs.saveActive()
  } else if (k === 'o') {
    e.preventDefault()
    void tabs.openFiles(true)
  } else if (k === 't') {
    e.preventDefault()
    tabs.newTab()
  } else if (k === 'w') {
    e.preventDefault()
    void tabs.closeActive()
  } else if (k === 'd') {
    e.preventDefault()
    if (doodle.active) doodle.close()
    else tabs.enterDoodle()
  } else if (e.key === 'Tab') {
    e.preventDefault()
    tabs.cycleTab(e.shiftKey ? -1 : 1)
  } else if (e.key === 'PageUp') {
    e.preventDefault()
    tabs.stepTab(-1)
  } else if (e.key === 'PageDown') {
    e.preventDefault()
    tabs.stepTab(1)
  }
}

onBeforeUnmount(() => {
  unsubscribers.forEach((f) => f())
  unsubscribers = []
  window.removeEventListener('keydown', onKeydown, true)
})
</script>

<template>
  <div class="flex h-full flex-col">
    <TitleBar />
    <TabBar />
    <EditorArea />
  </div>
</template>
