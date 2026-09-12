import fs from 'node:fs'
import { settingsFile, ensureDir, userDataDir } from './paths'
import { DEFAULT_SETTINGS, type Settings } from '@shared/types'

export class SettingsService {
  private cache: Settings | null = null

  load(): Settings {
    if (this.cache) return this.cache
    let stored: Partial<Settings> = {}
    try {
      stored = JSON.parse(fs.readFileSync(settingsFile(), 'utf-8'))
    } catch {
      // 首次启动或文件损坏：使用默认值
    }
    // 迁移：旧版默认快捷键 Control+Q 统一切到新默认（v0.1.0 实测调整）
    if (stored.shortcut === 'Control+Q') stored.shortcut = DEFAULT_SETTINGS.shortcut
    this.cache = { ...DEFAULT_SETTINGS, ...stored }
    return this.cache
  }

  save(patch: Partial<Settings>): Settings {
    const next = { ...this.load(), ...patch }
    this.cache = next
    ensureDir(userDataDir())
    fs.writeFileSync(settingsFile(), JSON.stringify(next, null, 2), 'utf-8')
    return next
  }

  get current(): Settings {
    return this.load()
  }
}
