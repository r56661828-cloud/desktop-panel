export type DocType = 'markdown' | 'plaintext'

export interface OpenedFile {
  path: string
  content: string
  mtimeMs: number
  bom: boolean
}

export interface WindowState {
  pinned: boolean
  bounds: { x: number; y: number; width: number; height: number }
}

export interface DraftItem {
  version: number
  tabId: string
  filePath: string | null
  fileName: string
  docType: DocType
  content: string
  savedAt: number
}

export interface Settings {
  shortcut: string
  pinned: boolean
  autoLaunch: boolean
  lastSaveDir: string | null
  recentFiles: string[]
  declinedVersion: string | null // 更新确认框点「暂不」的版本（D1：该版本内不再自动下载/安装）
  lastRunVersion: string // 升级说明 tab 触发标记（≠ app.getVersion() 时开页一次）
}

export const DEFAULT_SETTINGS: Settings = {
  shortcut: 'Control+Shift+Q',
  pinned: false,
  autoLaunch: false,
  lastSaveDir: null,
  recentFiles: [],
  declinedVersion: null,
  lastRunVersion: ''
}

// ---- 在线更新（docs/TECH-DESIGN-UPDATE.md） ----

export type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error' | 'portable'

export interface UpdateState {
  phase: UpdatePhase
  version?: string
  percent?: number
  releaseNotes?: string
  error?: string
}

export interface WriteResult {
  mtimeMs: number
}

export interface SaveAsResult {
  path: string | null
}

export interface AssetMigrateResult {
  map: Record<string, string> // 原文件名 -> 目标相对路径
}

export interface FileChangedPayload {
  path: string
  mtimeMs: number
}
