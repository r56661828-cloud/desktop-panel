import type { Editor } from '@tiptap/core'

/**
 * Markdown 序列化/反序列化（技术方案 3.2）：
 * - tiptap-markdown 接管 setContent（识别 md 字符串）与 getMarkdown；
 * - 扩展格式（下划线/字号/颜色/涂鸦/表格）由各扩展的 storage.markdown 规则落盘。
 */
export function getMarkdown(editor: Editor): string {
  return (editor.storage as { markdown?: { getMarkdown?: () => string } }).markdown?.getMarkdown?.() ?? ''
}

export function setMarkdown(editor: Editor, md: string): void {
  editor.commands.setContent(md)
}
