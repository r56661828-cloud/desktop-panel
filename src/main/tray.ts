import { Menu, Tray, app, nativeImage } from 'electron'
import path from 'node:path'
import { IPC } from '@shared/ipc-channels'
import type { WindowManager } from './window'
import type { ShortcutService } from './shortcut'
import type { SettingsService } from './services/settings'

/** 托盘（PRD M1/M9）：常驻入口、快捷键冲突降级、退出确认入口 */
export class TrayService {
  private tray: Tray | null = null

  constructor(
    private winManager: WindowManager,
    private shortcuts: ShortcutService,
    private settings: SettingsService
  ) {}

  create(): void {
    const iconPath = path.join(app.getAppPath(), 'resources/tray.png')
    const icon = nativeImage.createFromPath(iconPath)
    this.tray = new Tray(icon)
    this.tray.setToolTip('Desktop Panel — Ctrl+Q 唤醒')
    this.rebuildMenu()
  }

  rebuildMenu(): void {
    if (!this.tray) return
    const shortcutOk = !!this.shortcuts.registered
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: '显示 / 隐藏面板', click: () => this.winManager.toggle() },
        { type: 'separator' },
        {
          label: '开机自启',
          type: 'checkbox',
          checked: this.settings.current.autoLaunch,
          click: (item) => {
            app.setLoginItemSettings({ openAtLogin: item.checked })
            this.settings.save({ autoLaunch: item.checked })
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          click: () => {
            // 交给渲染进程做未保存确认（PRD FR-9.2），由其回调 app:quit
            this.winManager.browserWindow?.webContents.send(IPC.AppQuitRequest)
            this.winManager.browserWindow?.show()
          }
        }
      ])
    )
    if (!shortcutOk) {
      // 快捷键注册失败降级：托盘气泡引导（FR-1.4）
      try {
        this.tray.displayBalloon({
          title: '全局快捷键注册失败',
          content: 'Ctrl+Q 已被其他应用占用，可从托盘菜单唤起面板，或在设置中修改快捷键。'
        })
      } catch {
        // 非 Windows 平台无 displayBalloon
      }
      this.tray.setToolTip('Desktop Panel — 快捷键不可用，请从托盘唤起')
    }
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}
