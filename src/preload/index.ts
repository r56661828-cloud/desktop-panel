import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { PanelApi } from '@shared/api'
import type { DraftItem, FileChangedPayload, Settings } from '@shared/types'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: PanelApi = {
  // 窗口
  getState: () => ipcRenderer.invoke(IPC.WinGetState),
  setPinned: (pinned) => ipcRenderer.invoke(IPC.WinSetPinned, pinned),
  collapse: () => ipcRenderer.invoke(IPC.WinCollapse),
  minimize: () => ipcRenderer.invoke(IPC.WinMinimize),
  // 文件
  openFiles: (multi) => ipcRenderer.invoke(IPC.DialogOpenFile, multi),
  saveAsDialog: (defaultName) => ipcRenderer.invoke(IPC.DialogSaveAs, defaultName),
  writeText: (path, content, bom) => ipcRenderer.invoke(IPC.FileWrite, { path, content, bom }),
  writeBinary: (path, base64) => ipcRenderer.invoke(IPC.FileWriteBinary, { path, base64 }),
  readAsset: (path) => ipcRenderer.invoke(IPC.FileReadAsset, path),
  statMtime: (path) => ipcRenderer.invoke(IPC.FileStatMtime, path),
  migrateAssets: (tabId, targetDocPath, names) => ipcRenderer.invoke(IPC.FileMigrateAssets, { tabId, targetDocPath, names }),
  // 草稿
  saveDrafts: (items: DraftItem[]) => ipcRenderer.invoke(IPC.DraftSave, items),
  loadDrafts: () => ipcRenderer.invoke(IPC.DraftLoad),
  clearDraft: (tabId) => ipcRenderer.invoke(IPC.DraftClear, tabId),
  // 未命名文档涂鸦资产
  writePending: (tabId, name, kind, data) => ipcRenderer.invoke(IPC.PendingWrite, { tabId, name, kind, data }),
  // 设置与最近文件
  getSettings: () => ipcRenderer.invoke(IPC.SettingsGet),
  setSettings: (patch: Partial<Settings>) => ipcRenderer.invoke(IPC.SettingsSet, patch),
  addRecent: (path) => ipcRenderer.invoke(IPC.RecentAdd, path),
  // 应用
  quit: (force) => ipcRenderer.invoke(IPC.AppQuit, force),
  // 推送事件
  onFileChanged: (cb: (p: FileChangedPayload) => void) => subscribe<FileChangedPayload>(IPC.FileChanged, cb),
  onEditorFocus: (cb) => subscribe(IPC.EditorFocus, cb),
  onQuitRequest: (cb) => subscribe(IPC.AppQuitRequest, cb)
}

contextBridge.exposeInMainWorld('api', api)
