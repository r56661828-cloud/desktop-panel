import { BrowserWindow, dialog } from 'electron'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import type { AssetMigrateResult, OpenedFile } from '@shared/types'
import { draftsDir, ensureDir, isUnder, pendingAssetsDir, userDataDir } from './paths'

const TEXT_EXTS = new Set(['.md', '.markdown', '.txt'])
const MAX_ASSET_BYTES = 20 * 1024 * 1024
// 资产文件名白名单：不含路径分隔符、不允许 . / ..
const SAFE_NAME = /^(?!\.\.?$)[A-Za-z0-9][A-Za-z0-9._-]{0,128}$/

/**
 * 文件服务：对话框、原子写、本地资产白名单、外部变更监听。
 * 安全基线（技术方案 5.3）：渲染进程可触达的读写路径必须落在
 * 「已打开文档目录 / 最近对话框目录 / userData 白名单」内。
 */
export class FileService {
  private openedDirs = new Set<string>()
  private allowedDirs = new Set<string>()
  private watchers = new Map<string, fs.FSWatcher>()
  private watchDebounce = new Map<string, NodeJS.Timeout>()
  private lastSelfWrite = new Map<string, number>()

  onChange: ((path: string, mtimeMs: number) => void) | null = null

  private allowDir(dir: string): void {
    this.allowedDirs.add(path.resolve(dir))
  }

  /** 打开/保存对话框选中的目录自动进入白名单 */
  registerOpenedFile(absPath: string): void {
    this.allowDir(path.dirname(absPath))
  }

  isPathAllowed(p: string): boolean {
    const abs = path.resolve(p)
    for (const dir of this.allowedDirs) {
      if (isUnder(abs, dir)) return true
    }
    return false
  }

  // ---------- 对话框 ----------

  async openDialog(win: BrowserWindow, multi: boolean): Promise<OpenedFile[]> {
    const ret = await dialog.showOpenDialog(win, {
      title: '打开文件',
      properties: [multi ? 'multiSelections' : 'openFile', 'openFile'],
      filters: [{ name: 'Markdown / Text', extensions: ['md', 'markdown', 'txt'] }]
    })
    if (ret.canceled) return []
    const out: OpenedFile[] = []
    for (const p of ret.filePaths) {
      if (!TEXT_EXTS.has(path.extname(p).toLowerCase())) continue
      out.push({ path: p, ...(await this.readText(p)) })
      this.registerOpenedFile(p)
      this.watchFile(p)
    }
    return out
  }

  async saveDialog(win: BrowserWindow, defaultName: string): Promise<string | null> {
    const ret = await dialog.showSaveDialog(win, {
      title: '保存文件',
      defaultPath: defaultName,
      filters:
        path.extname(defaultName).toLowerCase() === '.txt'
          ? [{ name: 'Text', extensions: ['txt'] }]
          : [{ name: 'Markdown', extensions: ['md', 'markdown'] }, { name: 'Text', extensions: ['txt'] }]
    })
    if (ret.canceled || !ret.filePath) return null
    this.allowDir(path.dirname(ret.filePath))
    return ret.filePath
  }

  // ---------- 读写 ----------

  async readText(p: string): Promise<{ content: string; mtimeMs: number; bom: boolean }> {
    const buf = await fsp.readFile(p)
    const bom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
    let content = buf.toString('utf-8')
    if (bom) content = content.slice(1)
    const st = await fsp.stat(p)
    return { content, mtimeMs: st.mtimeMs, bom }
  }

  async writeText(p: string, content: string, bom = false): Promise<number> {
    if (!this.isPathAllowed(p)) throw new Error('路径不在允许的写入范围内')
    const abs = path.resolve(p)
    ensureDir(path.dirname(abs)) // 涂鸦等新资产目录可能尚不存在
    const data = Buffer.from((bom ? '\uFEFF' : '') + content, 'utf-8')
    await this.atomicWrite(abs, data)
    return this.afterOwnWrite(abs)
  }

  async writeBinary(p: string, base64: string): Promise<number> {
    if (!this.isPathAllowed(p)) throw new Error('路径不在允许的写入范围内')
    const abs = path.resolve(p)
    ensureDir(path.dirname(abs))
    await this.atomicWrite(abs, Buffer.from(base64, 'base64'))
    return this.afterOwnWrite(abs)
  }

  /** 先写临时文件再原子替换，失败时清掉临时文件（技术方案 3.4） */
  private async atomicWrite(abs: string, data: Buffer): Promise<void> {
    const tmp = `${abs}.tmp-${process.pid}-${Date.now()}`
    try {
      await fsp.writeFile(tmp, data)
      try {
        await fsp.rename(tmp, abs)
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code
        if (code === 'EPERM' || code === 'EEXIST') {
          await fsp.rm(abs, { force: true })
          await fsp.rename(tmp, abs)
        } else {
          throw e
        }
      }
    } finally {
      await fsp.rm(tmp, { force: true }).catch(() => {})
    }
  }

  private async afterOwnWrite(p: string): Promise<number> {
    const abs = path.resolve(p)
    this.lastSelfWrite.set(abs, Date.now())
    const st = await fsp.stat(abs)
    return st.mtimeMs
  }

  // ---------- 资产（涂鸦 PNG/JSON）读取 ----------

  async readAsset(p: string): Promise<{ kind: 'text' | 'binary'; content: string }> {
    // 支持 app-pending:/// 引用（未命名文档的涂鸦 JSON，FR-8.8 再编辑读取）
    if (p.startsWith('app-pending://')) {
      const u = new URL(p)
      const segs = u.pathname.replace(/^\//, '').split('/')
      if (segs.length !== 2 || !/^[A-Za-z0-9-]{8,64}$/.test(segs[0])) throw new Error('非法 pending 引用')
      const name = decodeURIComponent(segs[1])
      if (!/^(?!\.\.?$)[A-Za-z0-9][A-Za-z0-9._-]{0,128}$/.test(name)) throw new Error('非法 pending 引用')
      const root = pendingAssetsDir()
      const abs = path.resolve(root, segs[0], name)
      if (!(abs === root || abs.startsWith(root + path.sep)) || path.basename(abs) !== name) {
        throw new Error('非法 pending 引用')
      }
      return { kind: 'text', content: await fsp.readFile(abs, 'utf-8') }
    }
    const abs = path.resolve(p)
    const whitelisted =
      this.isPathAllowed(abs) ||
      isUnder(abs, pendingAssetsDir()) ||
      isUnder(abs, draftsDir()) ||
      isUnder(abs, userDataDir())
    if (!whitelisted) throw new Error('路径不在允许的读取范围内')
    const st = await fsp.stat(abs)
    if (st.size > MAX_ASSET_BYTES) throw new Error('资产文件过大')
    const ext = path.extname(abs).toLowerCase()
    if (ext === '.json' || ext === '.txt' || ext === '.md' || ext === '.markdown') {
      return { kind: 'text', content: await fsp.readFile(abs, 'utf-8') }
    }
    const buf = await fsp.readFile(abs)
    return { kind: 'binary', content: buf.toString('base64') }
  }

  // ---------- 未命名文档的涂鸦资产（userData/pending-assets/<tabId>/，技术方案 3.7） ----------

  /** 未命名文档的涂鸦 PNG/JSON 先落 pending 目录，另存为成功后由 migrateAssets 迁移 */
  async writePending(tabId: string, name: string, kind: 'binary' | 'text', data: string): Promise<void> {
    if (!/^[A-Za-z0-9-]{8,64}$/.test(tabId)) throw new Error('非法 tabId')
    if (!SAFE_NAME.test(name)) throw new Error('非法文件名')
    const dir = path.resolve(pendingAssetsDir(), tabId)
    if (!isUnder(dir, pendingAssetsDir())) throw new Error('非法 tabId')
    ensureDir(dir)
    const file = path.resolve(dir, name)
    if (!isUnder(file, dir)) throw new Error('非法文件名')
    const buf = kind === 'binary' ? Buffer.from(data, 'base64') : Buffer.from(data, 'utf-8')
    await this.atomicWrite(file, buf)
  }

  async migrateAssets(tabId: string, targetDocPath: string, names: string[]): Promise<AssetMigrateResult> {
    const fromDir = path.resolve(pendingAssetsDir(), tabId)
    if (!isUnder(fromDir, pendingAssetsDir()) || path.basename(fromDir) !== tabId) {
      throw new Error('非法的 tabId')
    }
    const assetsDir = path.resolve(path.dirname(path.resolve(targetDocPath)), 'assets')
    ensureDir(assetsDir)
    const map: Record<string, string> = {}
    for (const name of names) {
      if (!SAFE_NAME.test(name)) continue
      const from = path.resolve(fromDir, name)
      const to = path.resolve(assetsDir, name)
      if (!isUnder(from, fromDir) || !isUnder(to, assetsDir)) continue
      try {
        await fsp.copyFile(from, to)
        map[name] = `./assets/${name}`
      } catch {
        // 单个资产缺失不阻塞保存，保留 pending 引用
      }
    }
    this.allowDir(path.dirname(path.resolve(targetDocPath)))
    return { map }
  }

  // ---------- 外部变更监听（watch + 唤起时 mtime 比对兜底，技术方案 3.4/7.6） ----------

  watchFile(p: string): void {
    const abs = path.resolve(p)
    if (this.watchers.has(abs)) return
    try {
      const w = fs.watch(abs, () => this.scheduleChange(abs))
      this.watchers.set(abs, w)
    } catch {
      // 网络盘/权限受限目录 watch 不可用：依赖 mtime 兜底
    }
  }

  unwatchFile(p: string): void {
    const abs = path.resolve(p)
    this.watchers.get(abs)?.close()
    this.watchers.delete(abs)
  }

  /** 唤起时兜底比对：返回 mtime，由调用方与标签缓存值比较 */
  async statMtime(p: string): Promise<number> {
    const st = await fsp.stat(p)
    return st.mtimeMs
  }

  private scheduleChange(abs: string): void {
    const last = this.lastSelfWrite.get(abs)
    if (last && Date.now() - last < 1500) return // 忽略自身写入触发的抖动
    const t = this.watchDebounce.get(abs)
    if (t) clearTimeout(t)
    this.watchDebounce.set(
      abs,
      setTimeout(async () => {
        this.watchDebounce.delete(abs)
        try {
          const st = await fsp.stat(abs)
          this.onChange?.(abs, st.mtimeMs)
        } catch {
          // 文件可能已被删除
        }
      }, 300)
    )
  }
}
