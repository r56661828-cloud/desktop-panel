/**
 * 资产引用解析（技术方案 3.4 / 3.7）：
 * - 文档内相对引用（./assets/x.png）在渲染时解析为 app-file:// 绝对 URL；
 * - 未命名文档的涂鸦资产走 app-pending:///<tabId>/<name>；
 * - 序列化进 md 的始终是原始引用串，渲染层的转换不落盘。
 */

let ctx: { tabId: string; filePath: string | null } = { tabId: '', filePath: null }

export function setAssetContext(tabId: string, filePath: string | null): void {
  ctx = { tabId, filePath }
}

export function getAssetContext(): { tabId: string; filePath: string | null } {
  return ctx
}

export function dirnameOf(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i > 0 ? p.slice(0, i) : p
}

export function basenameOf(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i >= 0 ? p.slice(i + 1) : p
}

const REMOTE_RE = /^(https?|data|blob|app-file|app-pending):/i

export function isRemoteSrc(src: string): boolean {
  return REMOTE_RE.test(src)
}

/** 相对/本地引用 → 绝对路径（Windows 语义）；不可解析返回 null */
export function resolveAssetPath(src: string): string | null {
  if (isRemoteSrc(src) || !ctx.filePath) return null
  const base = dirnameOf(ctx.filePath)
  const norm = src.replace(/\//g, '\\')
  if (/^[A-Za-z]:\\/.test(norm)) return norm // 已是绝对路径
  let rel = norm
  while (rel.startsWith('.\\')) rel = rel.slice(2)
  rel = rel.replace(/^\\/, '')
  return `${base.replace(/[\\/]+$/, '')}\\${rel}`
}

export function toAppFileUrl(absPath: string): string {
  // 与主进程 toAppFileUrl 同规则：encodeURI 保留 / 与 :，特殊字符编码
  return 'app-file:///' + encodeURI(absPath.replace(/\\/g, '/'))
}

/** 渲染用：把文档引用转为可加载的 src（不改属性原值） */
export function resolveAssetSrc(src: string | null | undefined): string {
  if (!src) return ''
  if (isRemoteSrc(src)) return src
  const abs = resolveAssetPath(src)
  return abs ? toAppFileUrl(abs) : src
}

export function pendingRef(tabId: string, name: string): string {
  return `app-pending:///${tabId}/${name}`
}

// 静态正则：app-pending:///<tabId>/<name>，tabId 在匹配后过滤（避免动态拼接）
const PENDING_RE = /app-pending:\/\/([A-Za-z0-9-]{8,64})\/([A-Za-z0-9][A-Za-z0-9._-]*)/g

/** 从内容中提取指定 tab 的 pending 资产名清单 */
export function extractPendingNames(content: string, tabId: string): string[] {
  const out = new Set<string>()
  for (const m of content.matchAll(PENDING_RE)) {
    if (m[1] === tabId) out.add(m[2])
  }
  return [...out]
}

/** 另存为成功后：把该 tab 的 pending 引用重写为相对路径（./assets/<name>） */
export function rewritePendingRefs(content: string, tabId: string, map: Record<string, string>): string {
  return content.replace(PENDING_RE, (full, tid: string, name: string) =>
    tid === tabId && map[name] ? map[name] : full
  )
}
