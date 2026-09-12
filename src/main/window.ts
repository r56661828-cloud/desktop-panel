import { BrowserWindow, screen } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { IPC } from '@shared/ipc-channels'
import type { WindowState } from '@shared/types'
import type { SettingsService } from './services/settings'
import { ensureDir, userDataDir, windowStateFile } from './services/paths'

const DEFAULT_WIDTH = 720
const DEFAULT_HEIGHT = 560
const MIN_WIDTH = 400
const MIN_HEIGHT = 300

/**
 * 窗口管理（PRD M2）：
 * - 无边框自绘标题栏；未钉住 = 普通窗口层级（决策 D1）；
 * - 钉住 = setAlwaysOnTop('screen-saver')，Alt+Tab 切换后仍置顶（决策 D3）；
 * - 位置尺寸持久化 + 多显示器可见性校验（技术方案 3.1）。
 */
export class WindowManager {
  private win: BrowserWindow | null = null
  private saveTimer: NodeJS.Timeout | null = null

  constructor(private settings: SettingsService) {}

  create(): BrowserWindow {
    const state = this.loadWindowState()
    this.win = new BrowserWindow({
      width: state.bounds.width,
      height: state.bounds.height,
      x: state.bounds.x,
      y: state.bounds.y,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      frame: false,
      show: false,
      title: 'Desktop Panel',
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    // 位置无效（显示器断开等）时回落主屏居中偏上
    if (!this.isBoundsVisible(state)) {
      const wa = screen.getPrimaryDisplay().workArea
      this.win.setPosition(wa.x + (wa.width - DEFAULT_WIDTH) / 2, wa.y + Math.round(wa.height * 0.12))
      this.win.setSize(DEFAULT_WIDTH, DEFAULT_HEIGHT)
    }

    if (process.env['ELECTRON_RENDERER_URL']) {
      void this.win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      void this.win.loadFile(path.join(__dirname, '../renderer/index.html'))
    }

    this.win.once('ready-to-show', () => {
      const pinned = this.settings.current.pinned
      this.applyPinned(pinned)
      this.win?.show()
    })

    // 尺寸/位置持久化（防抖 500ms）
    const persist = (): void => {
      if (this.saveTimer) clearTimeout(this.saveTimer)
      this.saveTimer = setTimeout(() => this.saveWindowState(), 500)
    }
    this.win.on('resize', persist)
    this.win.on('move', persist)
    this.win.on('closed', () => {
      this.win = null
    })

    return this.win
  }

  get browserWindow(): BrowserWindow | null {
    return this.win
  }

  /** Ctrl+Q toggle：显示（还原+聚焦+通知渲染聚焦编辑区）/ 隐藏 */
  toggle(): void {
    if (!this.win) return
    if (this.win.isVisible() && !this.win.isMinimized()) {
      this.win.hide()
    } else {
      if (this.win.isMinimized()) this.win.restore()
      this.win.show()
      this.win.focus()
      this.win.webContents.send(IPC.EditorFocus)
    }
  }

  collapse(): void {
    this.win?.hide()
  }

  minimize(): void {
    this.win?.minimize()
  }

  /** 钉住 = 始终置顶（screen-saver 级，覆盖普通置顶应用）；状态跨会话记忆 */
  setPinned(pinned: boolean): void {
    this.applyPinned(pinned)
    this.settings.save({ pinned })
  }

  private applyPinned(pinned: boolean): void {
    if (!this.win) return
    this.win.setAlwaysOnTop(pinned, 'screen-saver')
  }

  get pinned(): boolean {
    return this.settings.current.pinned
  }

  getState(): WindowState {
    const b = this.win?.getBounds()
    return {
      pinned: this.pinned,
      bounds: b ?? { x: 0, y: 0, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }
    }
  }

  private isBoundsVisible(s: WindowState): boolean {
    if (s.bounds.x === undefined || s.bounds.y === undefined) return false
    const display = screen.getDisplayMatching(s.bounds)
    const wa = display.workArea
    const b = s.bounds
    return b.x + b.width > wa.x && b.y + b.height > wa.y && b.x < wa.x + wa.width && b.y < wa.y + wa.height
  }

  private loadWindowState(): WindowState {
    let bounds: WindowState['bounds'] = { x: undefined as unknown as number, y: undefined as unknown as number, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }
    try {
      const raw = JSON.parse(fs.readFileSync(windowStateFile(), 'utf-8'))
      if (typeof raw?.width === 'number' && typeof raw?.height === 'number') bounds = raw
    } catch {
      // 首次启动
    }
    return { pinned: this.settings.current.pinned, bounds }
  }

  private saveWindowState(): void {
    if (!this.win) return
    try {
      ensureDir(userDataDir())
      const b = this.win.getBounds()
      fs.writeFileSync(windowStateFile(), JSON.stringify(b), 'utf-8')
    } catch {
      // 持久化失败不阻塞
    }
  }
}
