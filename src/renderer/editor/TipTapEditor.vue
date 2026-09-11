<script setup lang="ts">
import { Editor, EditorContent } from '@tiptap/vue-3'
import type { ChainedCommands } from '@tiptap/core'
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { buildExtensions } from './extensions'
import { getMarkdown, setMarkdown } from './markdown'
import { editorRegistry } from './editorRegistry'
import { useTabsStore } from '@/stores/tabs'
import { useDoodleStore } from '@/stores/doodle'
import type { Tab } from '@/stores/tabs'

const props = defineProps<{ tab: Tab }>()

const tabs = useTabsStore()
const doodle = useDoodleStore()

const editor = shallowRef<Editor>()
let lastEmitted = props.tab.content
let updateTimer: number | undefined

// ---- 浮动格式工具栏（PRD FR-7.2） ----
const toolbarVisible = ref(false)
const toolbarStyle = ref({ left: '0px', top: '0px' })
const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px']

onMounted(() => {
  const ed = new Editor({
    extensions: buildExtensions({
      onEditDoodle: (attrs, pos) => doodle.startEdit(attrs, pos)
    }),
    content: props.tab.content,
    onUpdate: () => scheduleEmit(),
    onSelectionUpdate: () => updateToolbar(),
    onTransaction: () => updateToolbar()
  })
  editor.value = ed
  editorRegistry.set(props.tab.id, ed)
})

onBeforeUnmount(() => {
  editorRegistry.delete(props.tab.id)
  editor.value?.destroy()
  editor.value = undefined
})

function scheduleEmit(): void {
  if (updateTimer) clearTimeout(updateTimer)
  updateTimer = window.setTimeout(() => {
    if (!editor.value) return
    lastEmitted = getMarkdown(editor.value)
    tabs.setContent(props.tab.id, lastEmitted)
  }, 250)
}

// 外部变更内容（冲突重载/保存重写引用）回灌编辑器
watch(
  () => props.tab.content,
  (val) => {
    if (editor.value && val !== lastEmitted) {
      setMarkdown(editor.value, val)
      lastEmitted = val
    }
  }
)

function updateToolbar(): void {
  const ed = editor.value
  if (!ed) {
    toolbarVisible.value = false
    return
  }
  toolbarVisible.value = ed.isFocused && !ed.state.selection.empty && !doodle.active
  if (!toolbarVisible.value) return
  try {
    const coords = ed.view.coordsAtPos(ed.state.selection.from)
    const wrap = ed.view.dom.closest('.editor-wrap')?.getBoundingClientRect()
    if (!wrap) return
    toolbarStyle.value = {
      left: `${Math.max(4, coords.left - wrap.left)}px`,
      top: `${Math.max(4, coords.top - wrap.top - 46)}px`
    }
  } catch {
    toolbarVisible.value = false
  }
}

function cmd(fn: (c: ChainedCommands) => ChainedCommands): void {
  if (!editor.value) return
  fn(editor.value.chain().focus()).run()
}

function clearFormat(): void {
  cmd((c) =>
    c.unsetAllMarks().unsetFontSize().unsetColor().unsetBackgroundColor()
  )
}

function onSizeChange(e: Event): void {
  const v = (e.target as HTMLSelectElement).value
  cmd((c) => (v ? c.setFontSize(v) : c.unsetFontSize()))
}

function onColorInput(e: Event): void {
  const v = (e.target as HTMLInputElement).value
  cmd((c) => c.setColor(v))
}

function onBgColorInput(e: Event): void {
  const v = (e.target as HTMLInputElement).value
  cmd((c) => c.setBackgroundColor(v))
}
</script>

<template>
  <div class="editor-wrap relative flex-1 overflow-y-auto">
    <!-- 浮动格式工具栏 -->
    <div
      v-if="toolbarVisible"
      class="no-drag absolute z-20 flex items-center gap-0.5 rounded-md border border-panel-border bg-panel-bg p-1 shadow-lg"
      :style="toolbarStyle"
    >
      <button class="rounded px-1.5 py-0.5 text-xs font-bold hover:bg-panel-bg2" title="加粗 Ctrl+B" @click="cmd((c) => c.toggleBold())">B</button>
      <button class="rounded px-1.5 py-0.5 text-xs italic hover:bg-panel-bg2" title="斜体 Ctrl+I" @click="cmd((c) => c.toggleItalic())">I</button>
      <button class="rounded px-1.5 py-0.5 text-xs underline hover:bg-panel-bg2" title="下划线 Ctrl+U" @click="cmd((c) => c.toggleUnderline())">U</button>
      <button class="rounded px-1.5 py-0.5 text-xs line-through hover:bg-panel-bg2" title="删除线 Ctrl+Shift+X" @click="cmd((c) => c.toggleStrike())">S</button>
      <button class="rounded px-1.5 py-0.5 font-mono text-xs hover:bg-panel-bg2" title="行内代码 Ctrl+E" @click="cmd((c) => c.toggleCode())">&lt;&gt;</button>
      <select class="rounded border border-panel-border bg-panel-bg px-1 py-0.5 text-xs" title="字号" @change="onSizeChange">
        <option value="">字号</option>
        <option v-for="s in FONT_SIZES" :key="s" :value="s">{{ parseInt(s) }}</option>
      </select>
      <input type="color" class="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" title="字体颜色" @input="onColorInput" />
      <input type="color" class="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" title="背景色" @input="onBgColorInput" />
      <button class="rounded px-1.5 py-0.5 text-xs hover:bg-panel-bg2" title="清除格式" @click="clearFormat">⌫</button>
      <template v-if="editor?.isActive('table')">
        <span class="mx-0.5 h-4 w-px bg-panel-border" />
        <button class="rounded px-1.5 py-0.5 text-xs hover:bg-panel-bg2" title="上方插入行" @click="cmd((c) => c.addRowBefore())">↑行</button>
        <button class="rounded px-1.5 py-0.5 text-xs hover:bg-panel-bg2" title="下方插入行" @click="cmd((c) => c.addRowAfter())">↓行</button>
        <button class="rounded px-1.5 py-0.5 text-xs hover:bg-panel-bg2" title="左侧插入列" @click="cmd((c) => c.addColumnBefore())">←列</button>
        <button class="rounded px-1.5 py-0.5 text-xs hover:bg-panel-bg2" title="右侧插入列" @click="cmd((c) => c.addColumnAfter())">→列</button>
        <button class="rounded px-1.5 py-0.5 text-xs hover:bg-panel-bg2" title="删除行" @click="cmd((c) => c.deleteRow())">删行</button>
        <button class="rounded px-1.5 py-0.5 text-xs hover:bg-panel-bg2" title="删除列" @click="cmd((c) => c.deleteColumn())">删列</button>
      </template>
    </div>

    <EditorContent :editor="editor" class="min-h-full" />
  </div>
</template>
