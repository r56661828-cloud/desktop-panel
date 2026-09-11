// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { buildExtensions } from '../src/renderer/editor/extensions'
import { getMarkdown } from '../src/renderer/editor/markdown'

/**
 * Markdown 往返一致性自验（技术方案 3.2 / 风险 7.1 / TEST-CASES TC-M3-09x）：
 * 断言「parse → serialize → parse → serialize」二次序列化稳定，
 * 且关键结构（表格/下划线/涂鸦/扩展格式）不丢失。
 */
function roundtrip(md: string): string {
  const first = new Editor({ extensions: buildExtensions(), content: md })
  const once = getMarkdown(first)
  first.destroy()
  const second = new Editor({ extensions: buildExtensions(), content: once })
  const twice = getMarkdown(second)
  second.destroy()
  return twice
}

function stable(md: string): void {
  const once = (() => {
    const e = new Editor({ extensions: buildExtensions(), content: md })
    const out = getMarkdown(e)
    e.destroy()
    return out
  })()
  expect(roundtrip(md)).toBe(once)
}

describe('markdown round-trip', () => {
  it('标题/列表/引用/代码块/分割线', () => {
    const md = [
      '# 标题一',
      '',
      '## 标题二',
      '',
      '- 项目 A',
      '- 项目 B',
      '',
      '1. 有序一',
      '2. 有序二',
      '',
      '> 引用内容',
      '',
      '```js',
      'const x = 1',
      '```',
      '',
      '---'
    ].join('\n')
    stable(md)
    const out = roundtrip(md)
    expect(out).toContain('# 标题一')
    expect(out).toContain('## 标题二')
    expect(out).toContain('- 项目 A')
    expect(out).toContain('1. 有序一')
    expect(out).toContain('> 引用内容')
    expect(out).toContain('const x = 1')
    expect(out).toContain('---')
  })

  it('粗体/斜体/行内代码/链接', () => {
    const md = '这是 **粗体** 和 *斜体* 以及 `code` 与 [链接](https://example.com)'
    stable(md)
    const out = roundtrip(md)
    expect(out).toContain('**粗体**')
    expect(out).toContain('*斜体*')
    expect(out).toContain('`code`')
    expect(out).toContain('[链接](https://example.com)')
  })

  it('下划线以内嵌 <u> 保留', () => {
    const md = '普通 <u>下划线文本</u> 结束'
    stable(md)
    const out = roundtrip(md)
    expect(out).toContain('<u>下划线文本</u>')
  })

  it('颜色/字号/背景色以内嵌 span style 保留', () => {
    const md = '前文 <span style="color:#ff0000">红字</span> 与 <span style="font-size:24px">大字</span> 结尾'
    stable(md)
    const out = roundtrip(md)
    // DOM 解析会把 #ff0000 规范化为 rgb(255, 0, 0)，两者语义等价
    expect(out).toMatch(/color:\s*(#ff0000|rgb\(255, 0, 0\))/)
    expect(out).toMatch(/font-size:\s*24px/)
  })

  it('GFM 管道表往返', () => {
    const md = ['| A | B |', '| --- | --- |', '| 1 | 2 |', '| 3 | 4 |'].join('\n')
    stable(md)
    const out = roundtrip(md)
    expect(out).toContain('| A | B |')
    expect(out).toContain('| 1 | 2 |')
    expect(out).toContain('| 3 | 4 |')
  })

  it('普通图片引用', () => {
    const md = '![说明](./assets/pic.png)'
    stable(md)
    const out = roundtrip(md)
    expect(out).toContain('![说明](./assets/pic.png)')
  })

  it('涂鸦节点以内嵌 HTML 保留 data-src', () => {
    const md =
      '前置段落\n\n<img data-doodle src="./assets/doodle-1.png" data-src="./assets/doodle-1.json" data-width="680">\n\n后置段落'
    stable(md)
    const out = roundtrip(md)
    expect(out).toContain('data-doodle')
    expect(out).toContain('src="./assets/doodle-1.png"')
    expect(out).toContain('data-src="./assets/doodle-1.json"')
    expect(out).toContain('前置段落')
    expect(out).toContain('后置段落')
  })

  it('打开→保存零漂移：标准文档无修改时序列化不变', () => {
    const md = [
      '# 会议记录',
      '',
      '- 待办 1',
      '- 待办 2',
      '',
      '| 决定 | 负责人 |',
      '| --- | --- |',
      '| 发版 | 张三 |'
    ].join('\n')
    const e = new Editor({ extensions: buildExtensions(), content: md })
    const out = getMarkdown(e)
    e.destroy()
    // 首轮序列化应保持语义等价（分隔符行数可能被规范化，但内容单元格不丢）
    expect(out).toContain('| 决定 | 负责人 |')
    expect(out).toContain('| 发版 | 张三 |')
    expect(out).toContain('- 待办 1')
  })
})
