import { Menu, Tray, app, nativeImage } from 'electron'
import path from 'node:path'
import { IPC } from '@shared/ipc-channels'
import type { WindowManager } from './window'
import type { ShortcutService } from './shortcut'
import type { SettingsService } from './services/settings'
import type { UpdateService } from './services/update'

/** 托盘（PRD M1/M9）：常驻入口、快捷键冲突降级、退出确认入口 */
export class TrayService {
  private tray: Tray | null = null
  private clickTimer: NodeJS.Timeout | null = null

  constructor(
    private winManager: WindowManager,
    private shortcuts: ShortcutService,
    private settings: SettingsService,
    private updater?: UpdateService
  ) {}

  /** 快捷键展示名（Control+Shift+Q → Ctrl+Shift+Q） */
  private shortcutDisplay(): string {
    return this.settings.current.shortcut.replace(/Control\+/g, 'Ctrl+')
  }

  create(): void {
    // 开发态：项目根 resources/；安装包：extraResources 拷贝到 <安装目录>/resources/
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'tray.png')
      : path.join(app.getAppPath(), 'resources/tray.png')
    const icon = nativeImage.createFromPath(iconPath)
    this.tray = new Tray(icon)
    this.tray.setToolTip(`Desktop Panel — ${this.shortcutDisplay()} 唤醒`)

    // Windows 惯例：托盘图标左键单击 = 显示/隐藏切换；双击 = 仅显示聚焦（FR-1.5）
    this.tray.on('click', () => {
      if (this.clickTimer) {
        // 双击的第二段：取消单击的 toggle，由 double-click 处理
        clearTimeout(this.clickTimer)
        this.clickTimer = null
        return
      }
      this.clickTimer = setTimeout(() => {
        this.clickTimer = null
        this.winManager.toggle()
      }, 300)
    })
    this.tray.on('double-click', () => {
      if (this.clickTimer) {
        clearTimeout(this.clickTimer)
        this.clickTimer = null
      }
      const win = this.winManager.browserWindow
      if (win) {
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
      }
    })

    this.rebuildMenu()
  }

  rebuildMenu(): void {
    if (!this.tray) return
    const shortcutOk = !!this.shortcuts.registered
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: '显示 / 隐藏面板', click: () => this.winManager.toggle() },
        {
          label: '检查更新',
          enabled: this.updater?.enabled === true,
          click: () => void this.updater?.check(true)
        },
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
          content: `${this.shortcutDisplay()} 已被其他应用占用，可点击托盘图标唤起面板，或在设置中修改快捷键。`
        })
      } catch {
        // 非 Windows 平台无 displayBalloon
      }
      this.tray.setToolTip('Desktop Panel — 快捷键不可用，请点击托盘图标唤起')
    }
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}
