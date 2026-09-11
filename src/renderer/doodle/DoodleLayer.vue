<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  BRUSH_SIZES,
  DOODLE_VERSION,
  genId,
  type BrushSizeKey,
  type DoodleDoc,
  type DoodleStroke,
  type DoodleTool,
  type Point
} from '@shared/doodle-schema'
import { useDoodleStore } from '@/stores/doodle'
import { useTabsStore } from '@/stores/tabs'
import { basenameOf } from '@/editor/assets'

const doodle = useDoodleStore()
const tabs = useTabsStore()

const wrap = ref<HTMLDivElement>()
const canvas = ref<HTMLCanvasElement>()
const tool = ref<DoodleTool>('pen')
const color = ref('#ff0000')
const sizeKey = ref<BrushSizeKey>('medium')
const strokes = ref<DoodleStroke[]>([])
const redoStack = ref<DoodleStroke[]>([])

const TOOLS: { key: DoodleTool; label: string; title: string }[] = [
  { key: 'pen', label: '✎', title: '自由曲线' },
  { key: 'line', label: '／', title: '直线' },
  { key: 'arrow', label: '→', title: '箭头' },
  { key: 'rect', label: '▭', title: '矩形' },
  { key: 'ellipse', label: '◯', title: '圆/椭圆' },
  { key: 'eraser', label: '⌫', title: '橡皮擦' }
]
const COLORS = ['#ff0000', '#ff9900', '#ffcc00', '#33cc33', '#2563eb', '#9333ea', '#111827', '#ffffff']
const SIZES: { key: BrushSizeKey; label: string }[] = [
  { key: 'fine', label: '细' },
  { key: 'medium', label: '中' },
  { key: 'thick', label: '粗' }
]

let ctx: CanvasRenderingContext2D | null = null
let dpr = 1
let cssW = 0
let cssH = 0
let current: DoodleStroke | null = null

const canComplete = computed(() => strokes.value.length > 0)

onMounted(async () => {
  const c = canvas.value
  if (!c) return
  ctx = c.getContext('2d')
  dpr = window.devicePixelRatio || 1
  resize()
  window.addEventListener('resize', resize)
  // 再编辑：读取矢量 JSON 还原笔画（FR-8.8）
  if (doodle.mode === 'edit' && doodle.editAttrs) {
    try {
      const r = await window.api.readAsset(doodle.editAttrs.dataSrc)
      if (r.kind === 'text') {
        const doc = JSON.parse(r.content) as DoodleDoc
        cssW = Math.max(doc.canvas.width, 1)
        cssH = Math.max(doc.canvas.height, 1)
        resize()
        strokes.value = doc.strokes
        redraw()
      }
    } catch {
      // JSON 缺失：按空白画布处理（FR-8.9 由 DoodleNode 双击入口提示）
    }
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
})

function resize(): void {
  const c = canvas.value
  const w = wrap.value
  if (!c || !w) return
  const width = Math.max(cssW || w.clientWidth, 1)
  const height = Math.max(cssH || w.clientHeight, 1)
  c.width = width * dpr
  c.height = height * dpr
  c.style.width = `${width}px`
  c.style.height = `${height}px`
  redraw()
}

// ---- 绘制 ----

function pos(e: PointerEvent): Point {
  const rect = canvas.value!.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function onDown(e: PointerEvent): void {
  if (e.button !== 0) return
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  const p = pos(e)
  const size = BRUSH_SIZES[sizeKey.value]
  if (tool.value === 'eraser') {
    current = { id: genId(), tool: 'eraser', color: '', size: 0, erasedIds: [], points: [p] }
    hitTest(p)
  } else if (tool.value === 'pen') {
    current = { id: genId(), tool: 'pen', color: color.value, size, points: [p] }
  } else {
    current = { id: genId(), tool: tool.value, color: color.value, size, from: p, to: p }
  }
  redraw()
}

function onMove(e: PointerEvent): void {
  if (!current) return
  const p = pos(e)
  if (current.tool === 'pen' || current.tool === 'eraser') {
    current.points!.push(p)
    if (current.tool === 'eraser') hitTest(p)
  } else {
    current.to = p
  }
  redraw()
}

function onUp(): void {
  if (!current) return
  if (current.tool === 'eraser' && !current.erasedIds?.length) {
    current = null
    redraw()
    return
  }
  strokes.value.push(current)
  redoStack.value = []
  current = null
  redraw()
}

/** 橡皮擦命中：与可见笔画几何相交即擦除 */
function hitTest(p: Point): void {
  if (!current) return
  current.erasedIds = current.erasedIds ?? []
  const erased = new Set(erasedIdSet())
  for (const s of strokes.value) {
    if (erased.has(s.id) || current.erasedIds.includes(s.id)) continue
    if (strokeHit(s, p, s.size + 5)) current.erasedIds.push(s.id)
  }
}

function erasedIdSet(): Set<string> {
  const set = new Set<string>()
  const all = current ? [...strokes.value, current] : strokes.value
  for (const s of all) {
    if (s.tool === 'eraser') for (const id of s.erasedIds ?? []) set.add(id)
  }
  return set
}

function segDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function strokeHit(s: DoodleStroke, p: Point, tol: number): boolean {
  if (s.points && s.points.length > 1) {
    for (let i = 1; i < s.points.length; i++) {
      if (segDist(p, s.points[i - 1], s.points[i]) <= tol) return true
    }
    return false
  }
  if (s.from && s.to) {
    const x1 = Math.min(s.from.x, s.to.x)
    const x2 = Math.max(s.from.x, s.to.x)
    const y1 = Math.min(s.from.y, s.to.y)
    const y2 = Math.max(s.from.y, s.to.y)
    if (s.tool === 'rect' || s.tool === 'ellipse') {
      // 命中边框或内部均视为擦除
      return p.x >= x1 - tol && p.x <= x2 + tol && p.y >= y1 - tol && p.y <= y2 + tol
    }
    return segDist(p, s.from, s.to) <= tol
  }
  return false
}

// ---- 渲染 ----

function redraw(): void {
  const c = canvas.value
  if (!c || !ctx) return
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const erased = erasedIdSet()
  for (const s of strokes.value) {
    if (erased.has(s.id)) continue
    drawStroke(ctx, s)
  }
  if (current && current.tool !== 'eraser') drawStroke(ctx, current)
  ctx.restore()
}

function drawStroke(g: CanvasRenderingContext2D, s: DoodleStroke): void {
  g.strokeStyle = s.color
  g.fillStyle = s.color
  g.lineWidth = s.size
  g.lineCap = 'round'
  g.lineJoin = 'round'
  if (s.tool === 'pen' && s.points && s.points.length > 1) {
    // 中点二次贝塞尔平滑
    g.beginPath()
    g.moveTo(s.points[0].x, s.points[0].y)
    for (let i = 1; i < s.points.length - 1; i++) {
      const mx = (s.points[i].x + s.points[i + 1].x) / 2
      const my = (s.points[i].y + s.points[i + 1].y) / 2
      g.quadraticCurveTo(s.points[i].x, s.points[i].y, mx, my)
    }
    g.stroke()
    return
  }
  if (s.from && s.to) {
    const { from: a, to: b } = s
    if (s.tool === 'line' || s.tool === 'arrow') {
      g.beginPath()
      g.moveTo(a.x, a.y)
      g.lineTo(b.x, b.y)
      g.stroke()
      if (s.tool === 'arrow') {
        const angle = Math.atan2(b.y - a.y, b.x - a.x)
        const head = Math.max(8, s.size * 3)
        g.beginPath()
        g.moveTo(b.x, b.y)
        g.lineTo(b.x - head * Math.cos(angle - Math.PI / 6), b.y - head * Math.sin(angle - Math.PI / 6))
        g.moveTo(b.x, b.y)
        g.lineTo(b.x - head * Math.cos(angle + Math.PI / 6), b.y - head * Math.sin(angle + Math.PI / 6))
        g.stroke()
      }
      return
    }
    if (s.tool === 'rect') {
      g.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y))
      return
    }
    if (s.tool === 'ellipse') {
      g.beginPath()
      g.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2)
      g.stroke()
      return
    }
  }
  // 单点点击也留痕
  if (s.points && s.points.length === 1) {
    g.beginPath()
    g.arc(s.points[0].x, s.points[0].y, s.size / 2, 0, Math.PI * 2)
    g.fill()
  }
}

// ---- 撤销/重做（FR-8.3） ----

function undo(): void {
  const s = strokes.value.pop()
  if (s) redoStack.value.push(s)
  redraw()
}

function redo(): void {
  const s = redoStack.value.pop()
  if (s) strokes.value.push(s)
  redraw()
}

// ---- 完成/取消（FR-8.4/8.5） ----

async function complete(): Promise<void> {
  if (!strokes.value.length) {
    doodle.close()
    return
  }
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(cssW * dpr))
  out.height = Math.max(1, Math.round(cssH * dpr))
  const octx = out.getContext('2d')
  if (!octx) return
  octx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const savedCurrent = current
  current = null
  const erased = erasedIdSet()
  for (const s of strokes.value) {
    if (erased.has(s.id)) continue
    drawStroke(octx, s)
  }
  current = savedCurrent
  const pngBase64 = out.toDataURL('image/png').split(',')[1] ?? ''
  const doc: DoodleDoc = {
    version: DOODLE_VERSION,
    canvas: { width: Math.round(cssW), height: Math.round(cssH) },
    strokes: strokes.value
  }
  await tabs.completeDoodle({ pngBase64, json: JSON.stringify(doc), width: Math.round(cssW), height: Math.round(cssH) })
}

function cancel(): void {
  doodle.close() // 丢弃本次涂鸦，不产生任何文件
}

function editingPngName(): string {
  return doodle.editAttrs ? basenameOf(doodle.editAttrs.src) : ''
}
defineExpose({ editingPngName })
</script>

<template>
  <div ref="wrap" class="doodle-cursor absolute inset-0 z-10 bg-black/5" @contextmenu.prevent>
    <canvas
      ref="canvas"
      class="absolute left-0 top-0"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    />
    <!-- 工具条（FR-8.1/8.2） -->
    <div class="no-drag absolute left-1/2 top-2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-md border border-panel-border bg-panel-bg p-1 shadow-lg">
      <button
        v-for="t in TOOLS"
        :key="t.key"
        class="rounded px-1.5 py-0.5 text-xs"
        :class="tool === t.key ? 'bg-panel-accent text-white' : 'text-panel-text2 hover:bg-panel-bg2'"
        :title="t.title"
        @click="tool = t.key"
      >
        {{ t.label }}
      </button>
      <span class="mx-1 h-4 w-px bg-panel-border" />
      <span
        v-for="c in COLORS"
        :key="c"
        class="h-4 w-4 cursor-pointer rounded-full border border-panel-border"
        :style="{ background: c, outline: color === c ? '2px solid var(--panel-accent)' : 'none' }"
        @click="color = c"
      />
      <span class="mx-1 h-4 w-px bg-panel-border" />
      <button
        v-for="s in SIZES"
        :key="s.key"
        class="rounded px-1.5 py-0.5 text-xs"
        :class="sizeKey === s.key ? 'bg-panel-accent text-white' : 'text-panel-text2 hover:bg-panel-bg2'"
        :title="`画笔粗细：${s.label}`"
        @click="sizeKey = s.key"
      >
        {{ s.label }}
      </button>
      <span class="mx-1 h-4 w-px bg-panel-border" />
      <button class="rounded px-1.5 py-0.5 text-xs text-panel-text2 hover:bg-panel-bg2" title="撤销 Ctrl+Z" @click="undo">↶</button>
      <button class="rounded px-1.5 py-0.5 text-xs text-panel-text2 hover:bg-panel-bg2" title="重做 Ctrl+Y" @click="redo">↷</button>
      <span class="mx-1 h-4 w-px bg-panel-border" />
      <button class="rounded px-2 py-0.5 text-xs text-panel-text hover:bg-panel-bg2" title="取消（丢弃）" @click="cancel">取消</button>
      <button
        class="rounded bg-panel-accent px-2 py-0.5 text-xs text-white disabled:opacity-40"
        :disabled="!canComplete"
        title="完成并插入文档"
        @click="complete"
      >
        完成
      </button>
    </div>
  </div>
</template>
