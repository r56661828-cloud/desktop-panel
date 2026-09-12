import { app, protocol } from 'electron'
import { registerIpc } from './ipc'
import { registerAppFileProtocol, registerPendingProtocol } from './protocol'
import { DraftService } from './services/draft'
import { FileService } from './services/file'
import { SettingsService } from './services/settings'
import { UpdateService } from './services/update'
import { ShortcutService } from './shortcut'
import { TrayService } from './tray'
import { WindowManager } from './window'
import { IPC } from '@shared/ipc-channels'

// 单实例锁：二次启动聚焦已有面板（FR-1.5）
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // 本地资产协议需在 ready 前登记
  protocol.registerSchemesAsPrivileged([
    { scheme: 'app-file', privileges: { stream: true } },
    { scheme: 'app-pending', privileges: { stream: true } }
  ])

  const settings = new SettingsService()
  const files = new FileService()
  const drafts = new DraftService()
  const shortcuts = new ShortcutService()
  let windows: WindowManager | undefined
  let tray: TrayService | undefined
  let updater: UpdateService | undefined

  app.on('second-instance', () => windows?.toggle())

  app.whenReady().then(async () => {
    windows = new WindowManager(settings)

    registerAppFileProtocol(files)
    registerPendingProtocol()

    // 外部变更 → 渲染层冲突条（FR-6.5）
    files.onChange = (p, mtimeMs) => {
      windows?.browserWindow?.webContents.send(IPC.FileChanged, { path: p, mtimeMs })
    }

    updater = new UpdateService(settings, windows)
    registerIpc(windows, files, drafts, settings, shortcuts, updater)

    // 启动静默安装（TECH-DESIGN-UPDATE §3.4）：缓存有未拒绝的更新包 → 不建窗直接静默装+重启
    const installing = app.isPackaged ? await updater.startupSilentInstall() : false
    if (installing) return

    windows.create()

    // 全局快捷键（FR-1.1/1.2）；失败时托盘气泡降级（FR-1.4）
    const ok = shortcuts.register(settings.current.shortcut, () => windows?.toggle())
    try {
      tray = new TrayService(windows, shortcuts, settings, updater)
      tray.create()
      if (!ok) tray.rebuildMenu()
    } catch {
      // 无托盘环境（WSLg/部分 Linux WM）：跳过托盘，不阻塞主流程
      tray = undefined
    }

    updater.startScheduler()

    // 刚升级完成 → 渲染层就绪后自动开「更新内容」标签（§3.5）
    windows.browserWindow?.webContents.on('did-finish-load', () => updater?.onRendererReady())
  })

  // 面板关闭不退出，驻留托盘（FR-1.5）
  app.on('window-all-closed', () => {
    // keep resident
  })

  app.on('will-quit', () => {
    shortcuts.unregister()
    updater?.stop()
    tray?.destroy()
  })
}
