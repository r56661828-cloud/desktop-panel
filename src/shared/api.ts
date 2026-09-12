import type {
  AssetMigrateResult,
  DraftItem,
  FileChangedPayload,
  OpenedFile,
  SaveAsResult,
  Settings,
  WindowState,
  WriteResult
} from './types'

/** 渲染进程唯一可用的 API 面（preload 通过 contextBridge 暴露） */
export interface PanelApi {
  // 窗口
  getState(): Promise<WindowState>
  setPinned(pinned: boolean): Promise<void>
  collapse(): Promise<void>
  minimize(): Promise<void>
  // 文件
  openFiles(multi?: boolean): Promise<OpenedFile[]>
  saveAsDialog(defaultName: string): Promise<SaveAsResult>
  writeText(path: string, content: string, bom?: boolean): Promise<WriteResult>
  writeBinary(path: string, base64: string): Promise<WriteResult>
  readAsset(path: string): Promise<{ kind: 'text' | 'binary'; content: string }>
  statMtime(path: string): Promise<number>
  migrateAssets(tabId: string, targetDocPath: string, names: string[]): Promise<AssetMigrateResult>
  // 草稿
  saveDrafts(items: DraftItem[]): Promise<void>
  loadDrafts(): Promise<DraftItem[]>
  clearDraft(tabId: string): Promise<void>
  // 未命名文档涂鸦资产
  writePending(tabId: string, name: string, kind: 'binary' | 'text', data: string): Promise<void>
  // 设置与最近文件
  getSettings(): Promise<Settings>
  setSettings(patch: Partial<Settings>): Promise<Settings>
  addRecent(path: string): Promise<void>
  // 应用
  quit(force: boolean): Promise<void>
  // 主进程推送事件（返回解绑函数）
  onFileChanged(cb: (payload: FileChangedPayload) => void): () => void
  onEditorFocus(cb: () => void): () => void
  onQuitRequest(cb: () => void): () => void
}

declare global {
  interface Window {
    api: PanelApi
  }
}
