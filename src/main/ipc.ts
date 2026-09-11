import { app, ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { DEFAULT_SETTINGS, type DraftItem, type Settings } from '@shared/types'
import type { WindowManager } from './window'
import type { FileService } from './services/file'
import type { DraftService } from './services/draft'
import type { SettingsService } from './services/settings'
import type { ShortcutService } from './shortcut'

/**
 * IPC 注册中心：全部通道在 @shared/ipc-channels 白名单内，
 * 入参做最小校验；文件路径一律由 FileService 白名单把关。
 */
export function registerIpc(
  winManager: WindowManager,
  files: FileService,
  drafts: DraftService,
  settings: SettingsService,
  shortcuts: ShortcutService
): void {
  const win = (): Electron.BrowserWindow => {
    const w = winManager.browserWindow
    if (!w) throw new Error('窗口未就绪')
    return w
  }

  // ---- 窗口 ----
  ipcMain.handle(IPC.WinGetState, () => winManager.getState())

  ipcMain.handle(IPC.WinSetPinned, (_e, pinned: unknown) => {
    winManager.setPinned(pinned === true)
  })

  ipcMain.handle(IPC.WinCollapse, () => winManager.collapse())

  ipcMain.handle(IPC.WinToggle, () => winManager.toggle())

  // ---- 文件 ----
  ipcMain.handle(IPC.DialogOpenFile, async (_e, multi: unknown) => files.openDialog(win(), multi === true))

  ipcMain.handle(IPC.DialogSaveAs, async (_e, defaultName: unknown) => {
    const name = typeof defaultName === 'string' && defaultName.trim() ? defaultName.trim() : '未命名-1.md'
    const target = await files.saveDialog(win(), name)
    if (target) settings.save({ lastSaveDir: target })
    return { path: target }
  })

  ipcMain.handle(IPC.FileWrite, (_e, args: { path: string; content: string; bom?: boolean }) => {
    if (!args || typeof args.path !== 'string' || typeof args.content !== 'string') throw new Error('非法参数')
    return files.writeText(args.path, args.content, args.bom === true)
  })

  ipcMain.handle(IPC.FileWriteBinary, (_e, args: { path: string; base64: string }) => {
    if (!args || typeof args.path !== 'string' || typeof args.base64 !== 'string') throw new Error('非法参数')
    return files.writeBinary(args.path, args.base64)
  })

  ipcMain.handle(IPC.FileReadAsset, (_e, p: unknown) => {
    if (typeof p !== 'string') throw new Error('非法参数')
    return files.readAsset(p)
  })

  ipcMain.handle(IPC.FileStatMtime, (_e, p: unknown) => {
    if (typeof p !== 'string') throw new Error('非法参数')
    return files.statMtime(p)
  })

  ipcMain.handle(
    IPC.FileMigrateAssets,
    (_e, args: { tabId: string; targetDocPath: string; names: string[] }) => {
      if (!args || typeof args.tabId !== 'string' || typeof args.targetDocPath !== 'string' || !Array.isArray(args.names)) {
        throw new Error('非法参数')
      }
      return files.migrateAssets(args.tabId, args.targetDocPath, args.names)
    }
  )

  // ---- 草稿 ----
  ipcMain.handle(IPC.DraftSave, (_e, items: unknown) => {
    if (!Array.isArray(items)) throw new Error('非法参数')
    drafts.save(items as DraftItem[])
  })

  ipcMain.handle(IPC.DraftLoad, () => drafts.loadAll())

  ipcMain.handle(IPC.DraftClear, (_e, tabId: unknown) => {
    if (typeof tabId !== 'string') throw new Error('非法参数')
    drafts.clear(tabId)
  })

  // ---- 未命名文档涂鸦资产 ----
  ipcMain.handle(IPC.PendingWrite, (_e, args: { tabId: string; name: string; kind: 'binary' | 'text'; data: string }) => {
    if (!args || typeof args.tabId !== 'string' || typeof args.name !== 'string' || typeof args.data !== 'string') {
      throw new Error('非法参数')
    }
    if (args.kind !== 'binary' && args.kind !== 'text') throw new Error('非法参数')
    return files.writePending(args.tabId, args.name, args.kind, args.data)
  })

  // ---- 设置与最近文件 ----
  ipcMain.handle(IPC.SettingsGet, () => settings.current)

  ipcMain.handle(IPC.SettingsSet, (_e, patch: unknown) => {
    if (typeof patch !== 'object' || patch === null) return settings.current
    const next = settings.save(sanitizeSettings(patch as Partial<Settings>))
    // 快捷键变更即时生效，失败回滚（FR-1.4）
    if (typeof (patch as Partial<Settings>).shortcut === 'string') {
      const ok = shortcuts.reRegister(next.shortcut, () => winManager.toggle())
      if (!ok) {
        shortcuts.reRegister(DEFAULT_SETTINGS.shortcut, () => winManager.toggle())
        return settings.save({ shortcut: DEFAULT_SETTINGS.shortcut })
      }
    }
    return next
  })

  ipcMain.handle(IPC.RecentAdd, (_e, p: unknown) => {
    if (typeof p !== 'string') return settings.current.recentFiles
    const cur = settings.current.recentFiles.filter((f) => f.toLowerCase() !== p.toLowerCase())
    cur.unshift(p)
    settings.save({ recentFiles: cur.slice(0, 10) })
    return settings.current.recentFiles
  })

  // ---- 应用 ----
  ipcMain.handle(IPC.AppQuit, (_e, force: unknown) => {
    if (force === true) app.quit()
  })
}

function sanitizeSettings(patch: Partial<Settings>): Partial<Settings> {
  const out: Partial<Settings> = {}
  if (typeof patch.shortcut === 'string' && patch.shortcut) out.shortcut = patch.shortcut
  if (typeof patch.pinned === 'boolean') out.pinned = patch.pinned
  if (typeof patch.autoLaunch === 'boolean') out.autoLaunch = patch.autoLaunch
  if (typeof patch.lastSaveDir === 'string' || patch.lastSaveDir === null) out.lastSaveDir = patch.lastSaveDir ?? null
  if (Array.isArray(patch.recentFiles)) out.recentFiles = patch.recentFiles.filter((f) => typeof f === 'string').slice(0, 10)
  return out
}
