import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { TextStyleKit } from '@tiptap/extension-text-style'
import type { Extensions } from '@tiptap/core'
import { Markdown } from 'tiptap-markdown'
import { DoodleImage } from './extensions/doodle'
import { resolveAssetSrc } from './assets'

// ---- 带 md 序列化规则的扩展包装（技术方案 3.2：扩展格式以内嵌 HTML 落盘） ----
// tiptap-markdown 约定：扩展 storage.markdown.serialize 提供自定义序列化，
// 其类型未并入 @tiptap/core，此处统一以 as never 断言接入。

/** 下划线 → <u>…</u>（Markdown 无原生语法） */
const SerializableUnderline = Underline.extend({
  storage: {
    markdown: {
      serialize: {
        open: '<u>',
        close: '</u>',
        mixable: true,
        expelEnclosingWhitespace: true
      }
    }
  }
} as never)

/** 颜色/字号/背景色（textStyle mark）→ <span style="…"> */
const SerializableTextStyle = TextStyleKit.configure({ fontFamily: false, lineHeight: false }).extend({
  storage: {
    markdown: {
      serialize: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tiptap-markdown 序列化器无公开类型
        open: (_state: any, mark: any): string => {
          const styles: string[] = []
          if (mark.attrs.color) styles.push(`color:${mark.attrs.color}`)
          if (mark.attrs.fontSize) styles.push(`font-size:${mark.attrs.fontSize}`)
          if (mark.attrs.backgroundColor) styles.push(`background-color:${mark.attrs.backgroundColor}`)
          return styles.length ? `<span style="${styles.join(';')}">` : ''
        },
        close: '</span>',
        mixable: true,
        expelEnclosingWhitespace: true
      }
    }
  }
} as never)

/** 图片：渲染时相对引用转协议 URL；跳过涂鸦节点（有独立 Node） */
const ResolvedImage = Image.extend({
  parseHTML() {
    return [{ tag: 'img[src]:not([data-doodle])' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['img', { ...HTMLAttributes, src: resolveAssetSrc(node.attrs.src as string) }]
  }
})

/** 表格 → GFM 管道表；单元格按段落逐个渲染（保留行内格式含 HTML span） */
const SerializableTable = Table.extend({
  storage: {
    markdown: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tiptap-markdown 序列化器无公开类型
      serialize: (state: any, node: any): void => {
        const lines: string[] = []
        node.content.content.forEach((row: any, ri: number) => {
          const cells = row.content.content.map((cell: any) => {
            const parts: string[] = []
            cell.content.content.forEach((child: any) => {
              try {
                parts.push(String(state.render(child)).trim())
              } catch {
                parts.push(child.textContent ?? '')
              }
            })
            return (parts.join(' ') || ' ').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
          })
          lines.push(`| ${cells.join(' | ')} |`)
          if (ri === 0) lines.push(`| ${cells.map(() => '---').join(' | ')} |`)
        })
        state.write(lines.join('\n'))
        state.closeBlock(node)
      }
    }
  }
} as never)

export function buildExtensions(options: { onEditDoodle?: (attrs: { src: string; dataSrc: string; width: number | null }, pos: number) => void } = {}): Extensions {
  return [
    // StarterKit v3 已内置 link/underline，关掉以使用下方带 md 序列化规则的版本
    StarterKit.configure({ link: false, underline: false }),
    SerializableUnderline,
    Link.configure({ openOnClick: false }),
    ResolvedImage,
    SerializableTable,
    TableRow,
    TableHeader,
    TableCell,
    SerializableTextStyle,
    DoodleImage.configure({ onEdit: options.onEditDoodle ?? (() => {}) }),
    Markdown.configure({ html: true, breaks: false, linkify: false })
  ]
}
