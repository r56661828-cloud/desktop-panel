// 涂鸦矢量数据 Schema（PRD 3.2 / 技术方案 3.7）
export type DoodleTool = 'pen' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'eraser'

export interface Point {
  x: number
  y: number
}

export interface DoodleStroke {
  id: string
  tool: DoodleTool
  color: string
  size: number
  // 自由曲线：采样点序列；规则图形：from/to 两端点
  points?: Point[]
  from?: Point
  to?: Point
  // 橡皮擦：记录本次被擦除的笔画 id
  erasedIds?: string[]
}

export interface DoodleDoc {
  version: number
  canvas: { width: number; height: number }
  strokes: DoodleStroke[]
}

export const DOODLE_VERSION = 1

export const BRUSH_SIZES = { fine: 1, medium: 3, thick: 6 } as const
export type BrushSizeKey = keyof typeof BRUSH_SIZES

export function isDoodleDoc(value: unknown): value is DoodleDoc {
  if (typeof value !== 'object' || value === null) return false
  const d = value as Record<string, unknown>
  if (typeof d.version !== 'number') return false
  if (typeof d.canvas !== 'object' || d.canvas === null) return false
  const c = d.canvas as Record<string, unknown>
  if (typeof c.width !== 'number' || typeof c.height !== 'number') return false
  if (!Array.isArray(d.strokes)) return false
  for (const s of d.strokes) {
    if (typeof s !== 'object' || s === null) return false
    const st = s as Record<string, unknown>
    if (typeof st.id !== 'string' || typeof st.tool !== 'string') return false
    if (typeof st.color !== 'string' || typeof st.size !== 'number') return false
  }
  return true
}

export function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
