import { protocol } from 'electron'
import { pathToFileURL } from 'node:url'
import fsp from 'node:fs/promises'
import path from 'node:path'
import type { FileService } from './services/file'
import { pendingAssetsDir } from './services/paths'

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.json': 'application/json'
}

// tabId / 文件名白名单（与 FileService.writePending 一致）
const SAFE_TAB_ID = /^[A-Za-z0-9-]{8,64}$/
const SAFE_NAME = /^(?!\.\.?$)[A-Za-z0-9][A-Za-z0-9._-]{0,128}$/

/**
 * 本地资产协议：app-file:///<url-encoded 绝对路径>
 * 文档内相对路径图片（./assets/xxx.png）在渲染前由渲染层解析为绝对路径走本协议，
 * 仅放行 FileService 白名单内的路径（技术方案 3.4 / 5.3）。
 */
export function registerAppFileProtocol(files: FileService): void {
  protocol.handle('app-file', async (request) => {
    try {
      const u = new URL(request.url)
      const rel = decodeURIComponent(u.pathname.replace(/^\//, ''))
      const abs = path.resolve(rel)
      if (!files.isPathAllowed(abs)) {
        return new Response('forbidden', { status: 403 })
      }
      const ext = path.extname(abs).toLowerCase()
      const mime = MIME[ext] ?? 'application/octet-stream'
      const res = await fetch(pathToFileURL(abs).toString())
      const buf = Buffer.from(await res.arrayBuffer())
      return new Response(buf, { headers: { 'content-type': mime } })
    } catch {
      return new Response('not found', { status: 404 })
    }
  })
}

/**
 * 未命名文档的涂鸦资产协议：app-pending:///<tabId>/<name>
 * 根目录锁定 pendingAssetsDir()，tabId 与文件名走白名单，
 * resolve 后以「根前缀 + basename 一致」双重复核，杜绝路径穿越。
 */
export function registerPendingProtocol(): void {
  protocol.handle('app-pending', async (request) => {
    try {
      const u = new URL(request.url)
      const segs = u.pathname.replace(/^\//, '').split('/')
      if (segs.length !== 2 || !SAFE_TAB_ID.test(segs[0])) {
        return new Response('forbidden', { status: 403 })
      }
      const name = decodeURIComponent(segs[1])
      if (!SAFE_NAME.test(name)) {
        return new Response('forbidden', { status: 403 })
      }
      const root = pendingAssetsDir()
      // 根内边界：resolve 结果必须以 root + 分隔符开头（或即为根）
      const abs = path.resolve(root, segs[0], name)
      if (abs === root || !abs.startsWith(root + path.sep)) {
        return new Response('forbidden', { status: 403 })
      }
      if (path.basename(abs) !== name) {
        return new Response('forbidden', { status: 403 })
      }
      const ext = path.extname(abs).toLowerCase()
      const mime = MIME[ext] ?? 'application/octet-stream'
      const buf = Buffer.from(await fsp.readFile(abs))
      return new Response(buf, { headers: { 'content-type': mime } })
    } catch {
      return new Response('not found', { status: 404 })
    }
  })
}

/** 渲染层同一规则：相对引用解析为绝对路径后转 app-file URL */
export function toAppFileUrl(absPath: string): string {
  return pathToFileURL(path.resolve(absPath)).toString().replace(/^file:\/\//, 'app-file://')
}
