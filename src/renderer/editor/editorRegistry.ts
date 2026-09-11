import type { Editor } from '@tiptap/core'

/** tabId → 编辑器实例注册表（涂鸦插图、快捷键聚焦等跨组件访问） */
export const editorRegistry = new Map<string, Editor>()
