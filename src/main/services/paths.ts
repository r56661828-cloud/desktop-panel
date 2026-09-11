import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

export function userDataDir(): string {
  return app.getPath('userData')
}

export function draftsDir(): string {
  return path.join(userDataDir(), 'drafts')
}

export function pendingAssetsDir(): string {
  return path.join(userDataDir(), 'pending-assets')
}

export function pendingAssetsDirFor(tabId: string): string {
  return path.join(pendingAssetsDir(), tabId)
}

export function settingsFile(): string {
  return path.join(userDataDir(), 'settings.json')
}

export function windowStateFile(): string {
  return path.join(userDataDir(), 'window-state.json')
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
}

/** 路径前缀校验：child 必须等于 parent 或位于 parent 之内 */
export function isUnder(child: string, parent: string): boolean {
  const c = path.resolve(child)
  const p = path.resolve(parent)
  return c === p || c.startsWith(p + path.sep)
}
