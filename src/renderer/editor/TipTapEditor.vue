<script setup lang="ts">
import { Editor, EditorContent } from '@tiptap/vue-3'
import type { ChainedCommands } from '@tiptap/core'
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { Bold, Code, Eraser, Italic, PaintBucket, Strikethrough, Underline as UnderlineIcon } from '@lucide/vue'
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
const toolbarEl = ref<HTMLElement>()
// 鼠标拖动选区过程中为 true：工具栏延迟到 mouseup 再显隐
let mouseSelecting = false
// 点击工具栏自动收起时记录的选区指纹：同一选区不因后续事务（如撤销）重新弹出
let lastDismissedSelection: string | null = null
let cleanupToolbarListeners: (() => void) | undefined
const TOOLBAR_GAP = 6
const TOOLBAR_EDGE = 4
const FONT_OPTIONS = [12, 14, 16, 18, 20, 24].map((n) => ({ label: String(n), value: String(n) }))
const COLORS = ['#111827', '#ff0000', '#ff9900', '#ffcc00', '#33cc33', '#2563eb', '#9333ea', '#ffffff']
// 颜色按钮色条反映的当前选区颜色（updateToolbar 随事务刷新）
const activeFontColor = ref('#111827')
const activeBgColor = ref('transparent')
// 弹层打开状态：打开期间工具栏强制保持显示（见 updateToolbar）
const selectOpen = ref(false)
const fontPickerOpen = ref(false)
const bgPickerOpen = ref(false)

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

  // 工具栏出现时机：拖选过程中隐藏，鼠标松开且有选区时再弹出
  const onEditorMousedown = (): void => {
    mouseSelecting = true
    lastDismissedSelection = null // 用户重新开始选择，解除自动收起的抑制
    updateToolbar()
  }
  const onWindowMouseup = (): void => {
    if (!mouseSelecting) return
    mouseSelecting = false
    updateToolbar()
  }
  ed.view.dom.addEventListener('mousedown', onEditorMousedown)
  window.addEventListener('mouseup', onWindowMouseup)
  cleanupToolbarListeners = () => {
    ed.view.dom.removeEventListener('mousedown', onEditorMousedown)
    window.removeEventListener('mouseup', onWindowMouseup)
  }
})

onBeforeUnmount(() => {
  cleanupToolbarListeners?.()
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
  const selKey = `${ed.state.selection.from}:${ed.state.selection.to}`
  if (lastDismissedSelection !== null && selKey !== lastDismissedSelection) {
    lastDismissedSelection = null // 选区已变化，解除抑制
  }
  // 面板/下拉打开期间强制保持工具栏：在弹层内 mousedown 会让编辑器失焦、
  // DOM 选区被清除，若此时隐藏工具栏，挂在它下面的弹层会被一并拆除，
  // 用户永远点不到色块/选项
  const panelOpen = selectOpen.value || fontPickerOpen.value || bgPickerOpen.value
  toolbarVisible.value =
    (panelOpen ||
      (lastDismissedSelection === null && !mouseSelecting && ed.isFocused && !ed.state.selection.empty)) &&
    !doodle.active &&
    !props.tab.readonly
  if (!toolbarVisible.value) return
  activeFontColor.value = (ed.getAttributes('textStyle').color as string) || '#111827'
  activeBgColor.value = (ed.getAttributes('textStyle').backgroundColor as string) || 'transparent'
  try {
    const coords = ed.view.coordsAtPos(ed.state.selection.from)
    const wrap = ed.view.dom.closest('.editor-card')?.getBoundingClientRect()
    if (!wrap) return
    // 先粗定位把元素渲染出来，nextTick 后按实测尺寸精定位
    toolbarStyle.value = {
      left: `${coords.left - wrap.left}px`,
      top: `${coords.top - wrap.top - 46}px`
    }
    void nextTick(positionToolbar)
  } catch {
    toolbarVisible.value = false
  }
}

/** 精定位：优先悬浮在选区上方，上方空间不足翻到选区下方，并钳制在卡片内，不遮挡选中文字 */
function positionToolbar(): void {
  const el = toolbarEl.value
  const ed = editor.value
  if (!el || !ed || !toolbarVisible.value) return
  try {
    const coords = ed.view.coordsAtPos(ed.state.selection.from)
    const card = el.parentElement
    if (!card) return
    const rect = card.getBoundingClientRect()
    const scrollY = card.scrollTop
    const left = Math.min(
      Math.max(TOOLBAR_EDGE, coords.left - rect.left),
      Math.max(TOOLBAR_EDGE, rect.width - el.offsetWidth - TOOLBAR_EDGE)
    )
    const above = coords.top - rect.top + scrollY - el.offsetHeight - TOOLBAR_GAP
    const below = coords.bottom - rect.top + scrollY + TOOLBAR_GAP
    const top = above >= TOOLBAR_EDGE ? above : below
    toolbarStyle.value = { left: `${left}px`, top: `${Math.max(TOOLBAR_EDGE, top)}px` }
  } catch {
    /* 选区已失效时保持当前位置 */
  }
}

/** 执行命令；autoClose 时在事务提交（样式确定已生效）后收起工具栏 */
function cmd(fn: (c: ChainedCommands) => ChainedCommands, autoClose = false): void {
  const ed = editor.value
  if (!ed) return
  fn(ed.chain().focus()).run()
  if (autoClose) {
    toolbarVisible.value = false
    lastDismissedSelection = `${ed.state.selection.from}:${ed.state.selection.to}`
    selectOpen.value = false
    fontPickerOpen.value = false
    bgPickerOpen.value = false
  }
}

function clearFormat(): void {
  cmd((c) => c.unsetAllMarks().unsetFontSize().unsetColor().unsetBackgroundColor(), true)
}

function onFontSize(v: string | null): void {
  cmd((c) => (v ? c.setFontSize(`${v}px`) : c.unsetFontSize()), true)
}
</script>

<template>
  <!-- editor-card：卡片视觉 + 点击热区修复的 flex 链（styles/main.css） -->
  <div class="editor-wrap editor-card relative min-w-0 flex-1 overflow-y-auto rounded-xl border border-panel-border shadow-sm">
    <div
      v-if="toolbarVisible"
      ref="toolbarEl"
      class="no-drag absolute z-20 flex items-center gap-0.5 rounded-[10px] border border-panel-border bg-panel-bg p-1 shadow-lg ui-anim-pop"
      :style="toolbarStyle"
      @mousedown.prevent
    >
      <NTooltip trigger="hover" placement="bottom" :show-arrow="false">
        <template #trigger>
          <NButton quaternary size="tiny" @click="cmd((c) => c.toggleBold(), true)"><template #icon><Bold :size="14" /></template></NButton>
        </template>
        加粗 Ctrl+B
      </NTooltip>
      <NTooltip trigger="hover" placement="bottom" :show-arrow="false">
        <template #trigger>
          <NButton quaternary size="tiny" @click="cmd((c) => c.toggleItalic(), true)"><template #icon><Italic :size="14" /></template></NButton>
        </template>
        斜体 Ctrl+I
      </NTooltip>
      <NTooltip trigger="hover" placement="bottom" :show-arrow="false">
        <template #trigger>
          <NButton quaternary size="tiny" @click="cmd((c) => c.toggleUnderline(), true)"><template #icon><UnderlineIcon :size="14" /></template></NButton>
        </template>
        下划线 Ctrl+U
      </NTooltip>
      <NTooltip trigger="hover" placement="bottom" :show-arrow="false">
        <template #trigger>
          <NButton quaternary size="tiny" @click="cmd((c) => c.toggleStrike(), true)"><template #icon><Strikethrough :size="14" /></template></NButton>
        </template>
        删除线 Ctrl+Shift+X
      </NTooltip>
      <NTooltip trigger="hover" placement="bottom" :show-arrow="false">
        <template #trigger>
          <NButton quaternary size="tiny" @click="cmd((c) => c.toggleCode(), true)"><template #icon><Code :size="14" /></template></NButton>
        </template>
        行内代码 Ctrl+E
      </NTooltip>
      <NSelect
        size="tiny"
        clearable
        placeholder="字号"
        :options="FONT_OPTIONS"
        :style="{ width: '76px', flexShrink: 0 }"
        class="mx-0.5"
        @update:show="(v: boolean) => (selectOpen = v)"
        @update:value="onFontSize"
      />
      <NTooltip trigger="hover" placement="bottom" :show-arrow="false">
        <template #trigger>
          <!-- 字体颜色：Word 式 A + 色条；隐形 NColorPicker 只负责点击与弹面板 -->
          <div class="color-face-btn">
            <NColorPicker
              size="small"
              :show-alpha="false"
              :swatches="COLORS"
              :default-value="'#111827'"
              class="color-face-picker"
              @update:show="(v: boolean) => (fontPickerOpen = v)"
              @update:value="(v: string) => cmd((c) => c.setColor(v), true)"
            />
            <span class="color-face" aria-hidden="true">
              <span class="color-face-letter">A</span>
              <span class="color-face-bar" :style="{ background: activeFontColor }" />
            </span>
          </div>
        </template>
        字体颜色
      </NTooltip>
      <NTooltip trigger="hover" placement="bottom" :show-arrow="false">
        <template #trigger>
          <!-- 背景色：Word 式填充图标 + 色条 -->
          <div class="color-face-btn">
            <NColorPicker
              size="small"
              :show-alpha="false"
              :swatches="['transparent', ...COLORS]"
              :default-value="'transparent'"
              class="color-face-picker"
              @update:show="(v: boolean) => (bgPickerOpen = v)"
              @update:value="(v: string) => cmd((c) => c.setBackgroundColor(v === 'transparent' ? '' : v), true)"
            />
            <span class="color-face" aria-hidden="true">
              <PaintBucket :size="12" />
              <span class="color-face-bar" :style="{ background: activeBgColor }" />
            </span>
          </div>
        </template>
        背景色
      </NTooltip>
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

<style scoped>
/* 颜色按钮面：上层自绘图标+色条，下层隐形 NColorPicker 负责点击与面板 */
.color-face-btn {
  position: relative;
  width: 30px;
  height: 22px;
  flex-shrink: 0;
  cursor: pointer;
}
/* naive-ui 组件根上没有父级 scoped 属性，需 :deep 穿透 */
.color-face-btn :deep(.color-face-picker) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
}
.color-face {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  pointer-events: none;
}
.color-face-letter {
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}
.color-face-bar {
  width: 16px;
  height: 3px;
  border-radius: 1px;
  border: 1px solid var(--panel-border);
}
</style>
