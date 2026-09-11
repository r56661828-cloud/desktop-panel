import { Node, mergeAttributes } from '@tiptap/core'
import { resolveAssetSrc } from '../assets'

export interface DoodleOptions {
  onEdit: (attrs: { src: string; dataSrc: string; width: number | null }, pos: number) => void
}

/**
 * 涂鸦节点（技术方案 3.7）：块级原子节点，渲染为 <img data-doodle>。
 * 文档内引用串（相对路径或 app-pending）存于 src/dataSrc 属性原值，
 * 渲染时经 resolveAssetSrc 转协议 URL；双击进入再编辑。
 */
export const DoodleImage = Node.create<DoodleOptions>({
  name: 'doodle',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return { onEdit: () => {} }
  },

  addAttributes() {
    return {
      src: { default: null },
      dataSrc: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-src'),
        renderHTML: (attrs) => ({ 'data-src': attrs.dataSrc })
      },
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-width'),
        renderHTML: (attrs) => ({ 'data-width': attrs.width })
      }
    }
  },

  parseHTML() {
    return [{ tag: 'img[data-doodle]' }]
  },

  renderHTML({ node }) {
    return [
      'img',
      mergeAttributes(
        {
          'data-doodle': '',
          src: resolveAssetSrc(node.attrs.src as string),
          'data-src': node.attrs.dataSrc as string,
          'data-width': node.attrs.width as number | null
        }
      )
    ]
  },

  addNodeView() {
    return ({ node, getPos }) => {
      const dom = document.createElement('img')
      dom.setAttribute('data-doodle', '')
      dom.style.maxWidth = '100%'
      dom.title = '双击编辑涂鸦'

      const refresh = (): void => {
        const base = resolveAssetSrc(node.attrs.src as string)
        dom.src = base + (base.includes('?') ? '&' : '?') + 'v=' + Date.now()
      }
      refresh()

      dom.addEventListener('dblclick', (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.options.onEdit(
          { src: node.attrs.src as string, dataSrc: node.attrs.dataSrc as string, width: node.attrs.width as number | null },
          typeof getPos === 'function' ? (getPos() ?? 0) : 0
        )
      })

      return {
        dom,
        update: (n) => {
          if (n.type.name !== 'doodle') return false
          node = n
          refresh()
          return true
        }
      }
    }
  },

  // md 序列化：以内嵌 HTML 保留 dataSrc（再编辑指针），第三方阅读器降级为普通图片
  // @ts-expect-error tiptap-markdown 的 storage.markdown 约定未并入 @tiptap/core 类型
  storage: {
    markdown: {
      serialize: (state: { write: (s: string) => void; closeBlock: (n: unknown) => void }, node: { attrs: Record<string, unknown> }): void => {
        state.write(
          `<img data-doodle src="${node.attrs.src}" data-src="${node.attrs.dataSrc ?? ''}" data-width="${node.attrs.width ?? ''}">`
        )
        state.closeBlock(node)
      }
    }
  }
})
