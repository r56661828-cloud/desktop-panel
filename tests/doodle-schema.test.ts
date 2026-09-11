import { describe, expect, it } from 'vitest'
import { BRUSH_SIZES, DOODLE_VERSION, genId, isDoodleDoc, type DoodleDoc, type DoodleStroke } from '@shared/doodle-schema'

/** 涂鸦矢量 Schema 编解码与校验（TEST-CASES L1 自验，技术方案 3.7） */
describe('doodle-schema', () => {
  const validDoc: DoodleDoc = {
    version: DOODLE_VERSION,
    canvas: { width: 680, height: 320 },
    strokes: [
      { id: 's1', tool: 'pen', color: '#ff0000', size: BRUSH_SIZES.medium, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
      { id: 's2', tool: 'arrow', color: '#2563eb', size: BRUSH_SIZES.thick, from: { x: 0, y: 0 }, to: { x: 100, y: 50 } },
      { id: 's3', tool: 'eraser', color: '', size: 0, erasedIds: ['s1'] }
    ]
  }

  it('合法文档通过校验', () => {
    expect(isDoodleDoc(validDoc)).toBe(true)
  })

  it('JSON 序列化往返保持等价', () => {
    const parsed = JSON.parse(JSON.stringify(validDoc)) as DoodleDoc
    expect(parsed).toEqual(validDoc)
    expect(isDoodleDoc(parsed)).toBe(true)
  })

  it('拒绝非法结构', () => {
    expect(isDoodleDoc(null)).toBe(false)
    expect(isDoodleDoc({})).toBe(false)
    expect(isDoodleDoc({ version: 1, canvas: { width: 1 }, strokes: [] })).toBe(false) // canvas 缺 height
    expect(isDoodleDoc({ ...validDoc, strokes: 'nope' })).toBe(false)
    expect(isDoodleDoc({ ...validDoc, strokes: [{ id: 'x' }] })).toBe(false) // 笔画缺 tool/color/size
  })

  it('橡皮擦以 erasedIds 记录被擦笔画', () => {
    const strokes: DoodleStroke[] = validDoc.strokes
    const erased = new Set<string>()
    for (const s of strokes) if (s.tool === 'eraser') for (const id of s.erasedIds ?? []) erased.add(id)
    const visible = strokes.filter((s) => s.tool !== 'eraser' && !erased.has(s.id))
    expect(visible.map((s) => s.id)).toEqual(['s2'])
  })

  it('genId 生成不重复 id', () => {
    const ids = new Set(Array.from({ length: 200 }, () => genId()))
    expect(ids.size).toBe(200)
    expect(genId()).toMatch(/^[a-z0-9-]+$/)
  })
})
