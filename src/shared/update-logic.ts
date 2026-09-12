/**
 * 更新逻辑纯函数（无 electron 依赖，供主进程与单测共用）
 */

/**
 * 是否对发现的新版本执行后台下载（D1 取消语义）：
 * - 已拒绝版本：仅手动检查时放行（允许用户改主意），自动检查一律跳过
 */
export function shouldDownload(version: string, declinedVersion: string | null, manual: boolean): boolean {
  if (version === declinedVersion && !manual) return false
  return true
}

/** electron-updater releaseNotes 归一化（GitHub Release 正文，可能为 string 或分段数组） */
export function normalizeReleaseNotes(notes: unknown): string {
  if (typeof notes === 'string') return notes
  if (Array.isArray(notes)) {
    return notes
      .map((n) => (typeof n === 'string' ? n : n && typeof n === 'object' && typeof (n as { note?: unknown }).note === 'string' ? (n as { note: string }).note : ''))
      .filter(Boolean)
      .join('\n\n')
  }
  return ''
}

/** 版本号作为文件名片段的白名单校验（changelog 落盘） */
export function isSafeVersion(v: string): boolean {
  return /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v)
}
