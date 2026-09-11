import { globalShortcut } from 'electron'

/** 全局快捷键（PRD M1）：注册失败时由调用方走托盘降级（技术方案 3.6） */
export class ShortcutService {
  private current: string | null = null

  register(shortcut: string, onTrigger: () => void): boolean {
    this.unregister()
    const ok = globalShortcut.register(shortcut, onTrigger)
    if (ok) this.current = shortcut
    return ok
  }

  /** 改键：先注销再注册；失败返回 false（调用方回滚旧键） */
  reRegister(shortcut: string, onTrigger: () => void): boolean {
    return this.register(shortcut, onTrigger)
  }

  unregister(): void {
    if (this.current) {
      globalShortcut.unregister(this.current)
      this.current = null
    }
  }

  get registered(): string | null {
    return this.current
  }
}
