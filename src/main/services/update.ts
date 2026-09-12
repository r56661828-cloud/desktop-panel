import { app } from 'electron'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { autoUpdater } from 'electron-updater'
import type { UpdateState } from '@shared/types'
import { IPC } from '@shared/ipc-channels'
import { isSafeVersion, normalizeReleaseNotes, shouldDownload } from '@shared/update-logic'
import type { SettingsService } from './settings'
import { safeJoin } from './paths'
import type { WindowManager } from '../window'

const CHECK_INITIAL_DELAY_MS = 30 * 1000
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000
const STARTUP_RACE_MS = 5000
const PROGRESS_THROTTLE_MS = 500

/**
 * 在线更新服务（docs/TECH-DESIGN-UPDATE.md §3）：
 * autoDownload 全手动控制（拒绝的版本不下载）；启动静默安装竞速 5s；
 * 绿色版（无 NSIS 卸载器）自动降级为 portable 只提示。
 * 所有文件系统拼接一律走 paths.safeJoin（段白名单 + root 前缀强校验）。
 */
export class UpdateService {
  private state: UpdateState = { phase: 'idle' }
  private downloadedVersion: string | null = null
  private lastCheckManual = false
  private lastProgressPush = 0
  private checkTimer: NodeJS.Timeout | null = null
  private intervalTimer: NodeJS.Timeout | null = null
  private startupResolve: ((ok: boolean) => void) | null = null

  readonly portable: boolean
  readonly enabled: boolean

  constructor(
    private settings: SettingsService,
    private winManager: WindowManager
  ) {
    // 绿色版检测：NSIS 安装目录内必有「Uninstall *.exe」，zip 解压目录没有
    this.portable = app.isPackaged && !this.hasUninstaller()
    this.enabled = (app.isPackaged || process.env.UPDATER_DEV === '1') && !this.portable
  }

  private hasUninstaller(): boolean {
    try {
      const exeDir = path.dirname(app.getPath('exe'))
      if (!path.isAbsolute(exeDir)) return false
      return fs.readdirSync(exeDir).some((f) => /^Uninstall .+\.exe$/i.test(f))
    } catch {
      return false
    }
  }

  /** app ready 后调用一次；返回 true 表示已进入静默安装流程（进程将退出重启，不要再创建窗口） */
  async startupSilentInstall(): Promise<boolean> {
    if (!this.enabled) return false
    this.bindEvents()
    const downloaded = new Promise<boolean>((resolve) => {
      this.startupResolve = resolve
    })
    void this.check(false)
    const ok = await Promise.race([downloaded, new Promise<false>((r) => setTimeout(() => r(false), STARTUP_RACE_MS))])
    this.startupResolve = null
    if (ok && this.downloadedVersion && this.downloadedVersion !== this.settings.current.declinedVersion) {
      this.install(this.downloadedVersion)
      return true
    }
    return false
  }

  /** 窗口创建后启动定时调度 */
  startScheduler(): void {
    if (!this.enabled || this.intervalTimer) return
    this.checkTimer = setTimeout(() => void this.check(false), CHECK_INITIAL_DELAY_MS)
    this.intervalTimer = setInterval(() => void this.check(false), CHECK_INTERVAL_MS)
  }

  stop(): void {
    if (this.checkTimer) clearTimeout(this.checkTimer)
    if (this.intervalTimer) clearInterval(this.intervalTimer)
    this.checkTimer = null
    this.intervalTimer = null
  }

  // ---- 状态 ----

  getState(): UpdateState {
    return this.state
  }

  async check(manual: boolean): Promise<UpdateState> {
    if (!this.enabled) {
      return this.portable ? this.setState({ phase: 'portable' }) : this.state
    }
    this.lastCheckManual = manual
    this.setState({ phase: 'checking' })
    try {
      await autoUpdater.checkForUpdates()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // 静默检查失败不打扰（下次定时再查）；手动检查保留错误供渲染层 toast
      this.setState(manual ? { phase: 'idle', error: msg } : { phase: 'idle' })
    }
    return this.state
  }

  install(version: string): void {
    if (!this.downloadedVersion || version !== this.downloadedVersion) {
      throw new Error(`没有已下载的 v${version} 更新包`)
    }
    this.stop()
    this.setState({ phase: 'installing', version })
    autoUpdater.quitAndInstall(true, true) // NSIS 静默安装 + 完成后自动重启
  }

  async decline(version: string): Promise<UpdateState> {
    if (!isSafeVersion(version)) throw new Error('非法版本号')
    this.settings.save({ declinedVersion: version })
    this.removeCachedInstaller()
    this.downloadedVersion = null
    return this.setState({ phase: 'idle' })
  }

  /** 渲染层就绪后：检测「刚升级完成」→ 推送 changelog 开页（仅一次） */
  onRendererReady(): void {
    if (!app.isPackaged) return
    const current = app.getVersion()
    if (this.settings.current.lastRunVersion === current) return
    this.settings.save({ lastRunVersion: current })
    const content = this.readChangelog(current)
    if (content) {
      this.winManager.browserWindow?.webContents.send(IPC.UpdateChangelog, { version: current, content })
    }
  }

  // ---- 内部 ----

  private bindEvents(): void {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.disableWebInstaller = true
    autoUpdater.allowDowngrade = false
    if (!app.isPackaged) autoUpdater.forceDevUpdateConfig = true
    autoUpdater.logger = console

    autoUpdater.on('checking-for-update', () => this.setState({ phase: 'checking' }))

    autoUpdater.on('update-available', (info) => {
      const version = info.version
      if (!shouldDownload(version, this.settings.current.declinedVersion, this.lastCheckManual)) {
        // D1：已拒绝版本自动检查时不下载；启动竞速也无需等待
        this.startupResolve?.(false)
        this.setState({ phase: 'idle' })
        return
      }
      this.setState({ phase: 'available', version })
      void autoUpdater.downloadUpdate().catch((e) => {
        this.setState({ phase: 'idle', error: e instanceof Error ? e.message : String(e) })
        this.startupResolve?.(false)
      })
    })

    autoUpdater.on('download-progress', (p) => {
      const now = Date.now()
      if (now - this.lastProgressPush < PROGRESS_THROTTLE_MS) return
      this.lastProgressPush = now
      this.setState({ phase: 'downloading', percent: p.percent })
    })

    autoUpdater.on('update-downloaded', (info) => {
      const version = info.version
      this.downloadedVersion = version
      const notes = normalizeReleaseNotes(info.releaseNotes)
      this.writeChangelog(version, notes)
      this.setState({ phase: 'downloaded', version, releaseNotes: notes })
      this.startupResolve?.(this.downloadedVersion !== this.settings.current.declinedVersion)
    })

    autoUpdater.on('error', (e) => {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('[updater]', msg)
      this.startupResolve?.(false)
      if (this.state.phase !== 'idle') this.setState({ phase: 'idle', error: msg })
    })
  }

  private setState(next: UpdateState): UpdateState {
    this.state = next
    this.winManager.browserWindow?.webContents.send(IPC.UpdateState, this.state)
    return this.state
  }

  // ---- changelog 落盘（userData/changelogs/<version>.md，§3.5） ----

  private writeChangelog(version: string, notes: string): void {
    const file = safeJoin(app.getPath('userData'), 'changelogs', `${version}.md`)
    if (!file || !isSafeVersion(version)) return
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      const body = notes.trim() || `# v${version}\n\n详见发布页 Release Notes。`
      fs.writeFileSync(file, body, 'utf-8')
    } catch (e) {
      console.warn('[updater] changelog 写入失败', e)
    }
  }

  private readChangelog(version: string): string | null {
    const file = safeJoin(app.getPath('userData'), 'changelogs', `${version}.md`)
    if (!file || !isSafeVersion(version)) return null
    try {
      return fs.readFileSync(file, 'utf-8')
    } catch {
      return null
    }
  }

  /** 拒绝版本时清理已缓存的安装包（§8.4，防下次启动误装） */
  private removeCachedInstaller(): void {
    const pending = this.updaterPendingDir()
    if (!pending) return
    fsp.rm(pending, { recursive: true, force: true }).catch(() => {})
  }

  /** electron-updater 各平台缓存目录：…/<appName>-updater/pending（经 safeJoin 白名单校验） */
  private updaterPendingDir(): string | null {
    switch (process.platform) {
      case 'win32':
        // %LOCALAPPDATA% ≡ <appData>/../Local
        return safeJoin(path.resolve(app.getPath('appData'), '..', 'Local'), `${app.getName()}-updater`, 'pending')
      case 'darwin':
        return safeJoin(app.getPath('home'), 'Library', 'Caches', `${app.getName()}-updater`, 'pending')
      default:
        return safeJoin(app.getPath('home'), '.cache', `${app.getName()}-updater`, 'pending')
    }
  }
}
