import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import type { DraftItem } from '@shared/types'
import { draftsDir, ensureDir, isUnder } from './paths'

const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 天过期（技术方案 3.5）

// tabId 白名单：uuid 风格，杜绝路径片段
function isValidId(id: string): boolean {
  return typeof id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(id)
}

export class DraftService {
  private draftPath(tabId: string): string {
    const p = path.resolve(draftsDir(), `${tabId}.json`)
    if (!isUnder(p, draftsDir())) throw new Error('非法的草稿路径')
    return p
  }

  save(items: DraftItem[]): void {
    ensureDir(draftsDir())
    for (const item of items) {
      if (!isValidId(item.tabId)) continue
      try {
        fs.writeFileSync(this.draftPath(item.tabId), JSON.stringify(item), 'utf-8')
      } catch {
        // 单条草稿失败不影响其余
      }
    }
  }

  loadAll(): DraftItem[] {
    let files: string[] = []
    try {
      files = fs.readdirSync(draftsDir())
    } catch {
      return []
    }
    const out: DraftItem[] = []
    for (const f of files) {
      if (!f.endsWith('.json') || !isValidId(f.slice(0, -5))) continue
      const p = this.draftPath(f.slice(0, -5))
      try {
        const item = JSON.parse(fs.readFileSync(p, 'utf-8')) as DraftItem
        if (typeof item.savedAt !== 'number' || Date.now() - item.savedAt > DRAFT_MAX_AGE_MS) {
          fsp.rm(p, { force: true }).catch(() => {})
          continue
        }
        if (item.tabId && typeof item.content === 'string') out.push(item)
      } catch {
        // 跳过损坏草稿
      }
    }
    return out
  }

  clear(tabId: string): void {
    if (!isValidId(tabId)) return
    fsp.rm(this.draftPath(tabId), { force: true }).catch(() => {})
  }
}
