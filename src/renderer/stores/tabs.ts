import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { DocType, DraftItem, FileChangedPayload } from '@shared/types'
import { basenameOf, dirnameOf, extractPendingNames, pendingRef, rewritePendingRefs } from '@/editor/assets'
import { editorRegistry } from '@/editor/editorRegistry'
import { getMarkdown } from '@/editor/markdown'
import { useDoodleStore } from './doodle'
import { useUiStore } from './ui'

export interface Tab {
  id: string
  filePath: string | null
  fileName: string
  docType: DocType
  content: string // md 原文或纯文本
  dirty: boolean
  mtimeMs: number | null
  bom: boolean
  conflict: FileChangedPayload | null
  pendingAssets: string[]
  readonly?: boolean // 升级说明等只读标签：不参与保存/草稿/涂鸦
}

const DRAFT_DEBOUNCE_MS = 800

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/**
 * 多标签文档状态（PRD M10 / 3.4）：
 * 每个标签独立持有文件路径、内容、脏标记、模式；编辑器实例经 editorRegistry 按 tabId 索引。
 */
export const useTabsStore = defineStore('tabs', () => {
  const ui = useUiStore()
  const doodle = useDoodleStore()

  const tabs = ref<Tab[]>([])
  const activeId = ref<string | null>(null)
  const untitledSeq = ref(0)
  const draftsRestored = ref(false)

  const activeTab = computed<Tab | null>(() => tabs.value.find((t) => t.id === activeId.value) ?? null)

  function genId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }

  function nextUntitledName(docType: DocType): string {
    untitledSeq.value += 1
    return `未命名-${untitledSeq.value}.${docType === 'plaintext' ? 'txt' : 'md'}`
  }

  function newTab(docType: DocType = 'markdown', content = '', filePath: string | null = null, fileName?: string, mtimeMs: number | null = null, bom = false): Tab {
    const tab: Tab = {
      id: genId(),
      filePath,
      fileName: fileName ?? nextUntitledName(docType),
      docType,
      content,
      dirty: false,
      mtimeMs,
      bom,
      conflict: null,
      pendingAssets: []
    }
    tabs.value.push(tab)
    activeId.value = tab.id
    return tab
  }

  // ---- 打开（FR-6.1/6.2/6.4） ----
  async function openFiles(multi = false): Promise<void> {
    try {
      const files = await window.api.openFiles(multi)
      let lastId: string | null = null
      for (const f of files) {
        const existing = tabs.value.find((t) => t.filePath && t.filePath.toLowerCase() === f.path.toLowerCase())
        if (existing) {
          lastId = existing.id
          continue // 已打开的聚焦原标签，不重复开（FR-10.3）
        }
        const docType: DocType = f.path.toLowerCase().endsWith('.txt') ? 'plaintext' : 'markdown'
        const tab = newTab(docType, f.content, f.path, basenameOf(f.path), f.mtimeMs, f.bom)
        lastId = tab.id
      }
      if (lastId) activeId.value = lastId
    } catch (e) {
      ui.toast('打开失败：' + errText(e), 'error')
    }
  }

  // ---- 内容同步 ----
  function setContent(id: string, content: string): void {
    const tab = tabs.value.find((t) => t.id === id)
    if (!tab || tab.readonly || tab.content === content) return
    tab.content = content
    tab.dirty = true
    scheduleDraft()
  }

  /** 编辑器 onUpdate 回调入口 */
  function onEditorInput(id: string): void {
    const editor = editorRegistry.get(id)
    const tab = tabs.value.find((t) => t.id === id)
    if (!editor || !tab) return
    setContent(id, getMarkdown(editor))
  }

  // ---- 草稿（PRD 5.9） ----
  let draftTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleDraft(): void {
    if (draftTimer) clearTimeout(draftTimer)
    draftTimer = setTimeout(() => void flushDrafts(), DRAFT_DEBOUNCE_MS)
  }

  function flushDrafts(): Promise<void> {
    draftTimer = null
    const items: DraftItem[] = tabs.value
      .filter((t) => t.dirty)
      .map((t) => ({
        version: 1,
        tabId: t.id,
        filePath: t.filePath,
        fileName: t.fileName,
        docType: t.docType,
        content: t.content,
        savedAt: Date.now()
      }))
    return window.api.saveDrafts(items)
  }

  /** 升级说明只读标签（TECH-DESIGN-UPDATE §3.5） */
  function newChangelogTab(version: string, content: string): void {
    const tab = newTab('markdown', content, null, `更新内容 v${version}`)
    tab.readonly = true
    tab.dirty = false
  }

  async function restoreDrafts(): Promise<void> {
    if (draftsRestored.value) return
    draftsRestored.value = true
    try {
      const items = await window.api.loadDrafts()
      let maxSeq = 0
      for (const d of items) {
        if (!d.filePath) {
          const m = /未命名-(\d+)/.exec(d.fileName)
          if (m) maxSeq = Math.max(maxSeq, Number(m[1]))
        }
        tabs.value.push({
          id: d.tabId,
          filePath: d.filePath,
          fileName: d.fileName,
          docType: d.docType,
          content: d.content,
          dirty: true,
          mtimeMs: null,
          bom: false,
          conflict: null,
          pendingAssets: extractPendingNames(d.content, d.tabId)
        })
      }
      untitledSeq.value = Math.max(untitledSeq.value, maxSeq)
      if (!tabs.value.length) newTab()
      else activeId.value = tabs.value[tabs.value.length - 1].id
    } catch {
      newTab()
    }
  }

  // ---- 保存（PRD M5） ----
  async function saveTab(id: string): Promise<boolean> {
    const tab = tabs.value.find((t) => t.id === id)
    if (!tab) return false
    if (tab.readonly) {
      ui.toast('此标签为只读（升级说明），无需保存')
      return false
    }
    if (!tab.filePath) return saveAs(id)
    let content = tab.content
    if (tab.pendingAssets.length) {
      try {
        const { map } = await window.api.migrateAssets(tab.id, tab.filePath, tab.pendingAssets)
        content = rewritePendingRefs(content, tab.id, map)
      } catch (e) {
        ui.toast('涂鸦资产迁移失败：' + errText(e), 'error')
        return false
      }
    }
    try {
      const { mtimeMs } = await window.api.writeText(tab.filePath, content, tab.bom)
      tab.content = content
      tab.mtimeMs = mtimeMs
      tab.dirty = false
      tab.pendingAssets = []
      tab.conflict = null
      void window.api.clearDraft(tab.id)
      void window.api.addRecent(tab.filePath)
      ui.toast('已保存')
      return true
    } catch (e) {
      ui.toast('保存失败：' + errText(e), 'error')
      return false
    }
  }

  function saveActive(): void {
    if (activeId.value) void saveTab(activeId.value)
  }

  async function saveAs(id: string): Promise<boolean> {
    const tab = tabs.value.find((t) => t.id === id)
    if (!tab) return false
    let target: string | null = null
    try {
      const r = await window.api.saveAsDialog(tab.fileName)
      target = r.path
    } catch (e) {
      ui.toast('另存为失败：' + errText(e), 'error')
      return false
    }
    if (!target) return false // 用户取消
    let content = tab.content
    if (tab.pendingAssets.length) {
      try {
        const { map } = await window.api.migrateAssets(tab.id, target, tab.pendingAssets)
        content = rewritePendingRefs(content, tab.id, map)
      } catch (e) {
        ui.toast('涂鸦资产迁移失败：' + errText(e), 'error')
        return false
      }
    }
    const docType: DocType = target.toLowerCase().endsWith('.txt') ? 'plaintext' : 'markdown'
    try {
      const { mtimeMs } = await window.api.writeText(target, content, tab.bom)
      tab.filePath = target
      tab.fileName = basenameOf(target)
      tab.docType = docType
      tab.content = content
      tab.mtimeMs = mtimeMs
      tab.dirty = false
      tab.pendingAssets = []
      tab.conflict = null
      void window.api.clearDraft(tab.id)
      void window.api.addRecent(target)
      ui.toast('已保存')
      return true
    } catch (e) {
      ui.toast('保存失败：' + errText(e), 'error')
      return false
    }
  }

  function saveActiveAs(): void {
    if (activeId.value) void saveAs(activeId.value)
  }

  // ---- 关闭（FR-10.5/10.6） ----
  async function closeTab(id: string): Promise<void> {
    const idx = tabs.value.findIndex((t) => t.id === id)
    if (idx < 0) return
    const tab = tabs.value[idx]
    if (tab.dirty) {
      const r = await ui.askConfirm('未保存的更改', `「${tab.fileName}」有未保存的修改，保存后关闭吗？`)
      if (r === 'cancel') return
      if (r === 'save') {
        const ok = await saveTab(id)
        if (!ok) return
      }
    }
    void window.api.clearDraft(id)
    editorRegistry.delete(id)
    tabs.value.splice(idx, 1)
    if (activeId.value === id) {
      activeId.value = tabs.value[Math.min(idx, tabs.value.length - 1)]?.id ?? null
    }
    if (!tabs.value.length) newTab() // 关闭最后一个标签兜底（FR-10.6）
  }

  function closeActive(): void {
    if (activeId.value) void closeTab(activeId.value)
  }

  function cycleTab(dir: 1 | -1): void {
    if (tabs.value.length < 2) return
    const idx = tabs.value.findIndex((t) => t.id === activeId.value)
    const next = (idx + dir + tabs.value.length) % tabs.value.length
    activeId.value = tabs.value[next].id
  }

  function stepTab(dir: 1 | -1): void {
    cycleTab(dir)
  }

  // ---- 涂鸦（PRD M8 / 技术方案 3.7） ----
  function enterDoodle(): void {
    const tab = activeTab.value
    if (!tab) return
    if (tab.readonly) {
      ui.toast('只读标签不支持涂鸦')
      return
    }
    if (tab.docType === 'plaintext') {
      ui.toast('纯文本不支持涂鸦，请改用 Markdown 文档', 'error')
      return
    }
    if (!editorRegistry.has(tab.id)) return
    doodle.startCreate()
  }

  async function completeDoodle(payload: { pngBase64: string; json: string; width: number; height: number }): Promise<void> {
    const tab = activeTab.value
    const editor = tab ? editorRegistry.get(tab.id) : undefined
    if (!tab || !editor) {
      doodle.close()
      return
    }
    const editing = doodle.mode === 'edit' ? doodle.editAttrs : null
    let pngName: string
    let jsonName: string
    if (editing) {
      pngName = basenameOf(editing.src)
      jsonName = basenameOf(editing.dataSrc)
    } else {
      pngName = `doodle-${Date.now()}.png`
      jsonName = pngName.replace(/\.png$/, '.json')
    }
    let src: string
    let dataSrc: string
    try {
      if (tab.filePath) {
        const dir = dirnameOf(tab.filePath)
        await window.api.writeBinary(`${dir}/assets/${pngName}`, payload.pngBase64)
        await window.api.writeText(`${dir}/assets/${jsonName}`, payload.json)
        src = `./assets/${pngName}`
        dataSrc = `./assets/${jsonName}`
      } else {
        await window.api.writePending(tab.id, pngName, 'binary', payload.pngBase64)
        await window.api.writePending(tab.id, jsonName, 'text', payload.json)
        src = pendingRef(tab.id, pngName)
        dataSrc = pendingRef(tab.id, jsonName)
        for (const n of [pngName, jsonName]) {
          if (!tab.pendingAssets.includes(n)) tab.pendingAssets.push(n)
        }
      }
    } catch (e) {
      ui.toast('涂鸦保存失败：' + errText(e), 'error')
      return
    }
    const attrs = { src, dataSrc, width: payload.width }
    if (editing && doodle.editPos != null) {
      editor.view.dispatch(editor.state.tr.setNodeMarkup(doodle.editPos, undefined, attrs))
    } else {
      editor.chain().focus().insertContent({ type: 'doodle', attrs }).run()
    }
    doodle.close()
    onEditorInput(tab.id)
  }

  // ---- 外部变更（FR-6.5） ----
  async function checkExternalChanges(): Promise<void> {
    for (const tab of tabs.value) {
      if (!tab.filePath || tab.conflict) continue
      try {
        const m = await window.api.statMtime(tab.filePath)
        if (tab.mtimeMs !== null && Math.abs(m - tab.mtimeMs) > 1) {
          tab.conflict = { path: tab.filePath, mtimeMs: m }
        }
      } catch {
        // 文件可能已被删除，忽略
      }
    }
  }

  function onFileChanged(p: FileChangedPayload): void {
    const tab = tabs.value.find((t) => t.filePath && t.filePath.toLowerCase() === p.path.toLowerCase())
    if (tab) tab.conflict = p
  }

  async function reloadTab(id: string): Promise<void> {
    const tab = tabs.value.find((t) => t.id === id)
    if (!tab?.conflict) return
    try {
      const r = await window.api.readAsset(tab.filePath as string)
      if (r.kind !== 'text') return
      tab.content = r.content
      tab.mtimeMs = tab.conflict.mtimeMs
      tab.conflict = null
      tab.dirty = false
      void window.api.clearDraft(tab.id)
    } catch (e) {
      ui.toast('重新加载失败：' + errText(e), 'error')
    }
  }

  function keepMine(id: string): void {
    const tab = tabs.value.find((t) => t.id === id)
    if (!tab?.conflict) return
    tab.mtimeMs = tab.conflict.mtimeMs
    tab.conflict = null
  }

  return {
    tabs,
    activeId,
    untitledSeq,
    draftsRestored,
    activeTab,
    newTab,
    openFiles,
    setContent,
    onEditorInput,
    restoreDrafts,
    flushDrafts,
    newChangelogTab,
    saveTab,
    saveActive,
    saveActiveAs,
    closeTab,
    closeActive,
    cycleTab,
    stepTab,
    enterDoodle,
    completeDoodle,
    checkExternalChanges,
    onFileChanged,
    reloadTab,
    keepMine
  }
})
