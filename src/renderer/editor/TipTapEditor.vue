<script setup lang="ts">
import { Editor, EditorContent } from '@tiptap/vue-3'
import type { ChainedCommands } from '@tiptap/core'
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { Bold, Code, Eraser, Italic, Strikethrough, Underline as UnderlineIcon } from '@lucide/vue'
import { NButton, NColorPicker, NSelect, NTooltip } from 'naive-ui'
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

// ---- 浮动格式工具栏（PRD FR-7.2 / UI-PLAN P1-5） ----
const toolbarVisible = ref(false)
const toolbarStyle = ref({ left: '0px', top: '0px' })
const FONT_OPTIONS = [12, 14, 16, 18, 20, 24].map((n) => ({ label: String(n), value: String(n) }))
const COLORS = ['#111827', '#ff0000', '#ff9900', '#ffcc00', '#33cc33', '#2563eb', '#9333ea', '#ffffff']

onMounted(() => {
  const ed = new Editor({
    extensions: buildExtensions({
      onEditDoodle: (attrs, pos) => doodle.startEdit(attrs, pos)
    }),
    content: props.tab.content,
    editable: !props.tab.readonly,
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
  toolbarVisible.value = ed.isFocused && !ed.state.selection.empty && !doodle.active && !props.tab.readonly
  if (!toolbarVisible.value) return
  try {
    const coords = ed.view.coordsAtPos(ed.state.selection.from)
    const wrap = ed.view.dom.closest('.editor-card')?.getBoundingClientRect()
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
  cmd((c) => c.unsetAllMarks().unsetFontSize().unsetColor().unsetBackgroundColor())
}

function onFontSize(v: string | null): void {
  cmd((c) => (v ? c.setFontSize(`${v}px`) : c.unsetFontSize()))
}
</script>

<template>
  <!-- editor-card：卡片视觉 + 点击热区修复的 flex 链（styles/main.css） -->
  <div class="editor-wrap editor-card relative min-w-0 flex-1 overflow-y-auto rounded-xl border border-panel-border shadow-sm">
    <div
      v-if="toolbarVisible"
      class="no-drag absolute z-20 flex items-center gap-0.5 rounded-[10px] border border-panel-border bg-panel-bg p-1 shadow-lg"
      :style="toolbarStyle"
    >
      <NTooltip trigger="hover" placement="bottom" :show-arrow="false">
        <template #trigger>
          <NButton quaternary size="tiny" @click="cmd((c) => c.toggleBold())"><template #icon><Bold :size="14" /></template></NButton>
        </template>
        加粗 Ctrl+B
      </NTooltip>
      <NTooltip trigger="hover" placement="bottom" :show-arrow="false">
        <template #trigger>
          <NButton quaternary size="tiny" @click="cmd((c) => c.toggleItalic())"><template #icon><Italic :size="14" /></template></NButton>
        </template>
        斜体 Ctrl+I
      </NTooltip>
      <NTooltip trigger="hover" placement="bottom" :show-arrow="false">
        <template #trigger>
          <NButton quaternary size="tiny" @click="cmd((c) => c.toggleUnderline())"><template #icon><UnderlineIcon :size="14" /></template></NButton>
        </template>
        下划线 Ctrl+U
      </NTooltip>
      <NTooltip trigger="hover" placement="bottom" :show-arrow="false">
        <template #trigger>
          <NButton quaternary size="tiny" @click="cmd((c) => c.toggleStrike())"><template #icon><Strikethrough :size="14" /></template></NButton>
        </template>
        删除线 Ctrl+Shift+X
      </NTooltip>
      <NTooltip trigger="hover" placement="bottom" :show-arrow="false">
        <template #trigger>
          <NButton quaternary size="tiny" @click="cmd((c) => c.toggleCode())"><template #icon><Code :size="14" /></template></NButton>
        </template>
        行内代码 Ctrl+E
      </NTooltip>
      <NSelect
        size="tiny"
        clearable
        placeholder="字号"
        :options="FONT_OPTIONS"
        :width="76"
        class="mx-0.5"
        @update:value="onFontSize"
      />
      <NColorPicker
        size="small"
        :show-alpha="false"
        :swatches="COLORS"
        :default-value="'#111827'"
        :style="{ width: '30px', height: '22px' }"
        title="字体颜色"
        @update:value="(v: string) => cmd((c) => c.setColor(v))"
      />
      <NColorPicker
        size="small"
        :show-alpha="false"
        :swatches="['transparent', ...COLORS]"
        :default-value="'transparent'"
        :style="{ width: '30px', height: '22px' }"
        title="背景色"
        @update:value="(v: string) => cmd((c) => c.setBackgroundColor(v === 'transparent' ? '' : v))"
      />
      <NTooltip trigger="hover" placement="bottom" :show-arrow="false">
        <template #trigger>
          <NButton quaternary size="tiny" data-testid="clear-format" @click="clearFormat"><template #icon><Eraser :size="14" /></template></NButton>
        </template>
        清除格式
      </NTooltip>

      <!-- 表格上下文操作（FR-3.2） -->
      <template v-if="editor?.isActive('table')">
        <span class="mx-0.5 h-4 w-px bg-panel-border" />
        <NButton quaternary size="tiny" @click="cmd((c) => c.addRowBefore())">↑行</NButton>
        <NButton quaternary size="tiny" @click="cmd((c) => c.addRowAfter())">↓行</NButton>
        <NButton quaternary size="tiny" @click="cmd((c) => c.addColumnBefore())">←列</NButton>
        <NButton quaternary size="tiny" @click="cmd((c) => c.addColumnAfter())">→列</NButton>
        <NButton quaternary size="tiny" @click="cmd((c) => c.deleteRow())">删行</NButton>
        <NButton quaternary size="tiny" @click="cmd((c) => c.deleteColumn())">删列</NButton>
      </template>
    </div>

    <EditorContent :editor="editor" class="tiptap-holder prose prose-sm dark:prose-invert max-w-none" />
  </div>
</template>
