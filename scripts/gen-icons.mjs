// 生成 resources/tray.png 与 resources/icon.png（纯 Node 实现，无图像依赖）
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function makePng(size, pixelFn) {
  const raw = Buffer.alloc(size * (1 + size * 4))
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 4)
    raw[row] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size)
      const off = row + 1 + x * 4
      raw[off] = r
      raw[off + 1] = g
      raw[off + 2] = b
      raw[off + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// 圆形徽标：蓝底 + 白色面板条（模拟便签）
function logoPixel(x, y, size) {
  const cx = size / 2 - 0.5
  const cy = size / 2 - 0.5
  const r = size * 0.46
  const d = Math.hypot(x - cx, y - cy)
  if (d > r) return [0, 0, 0, 0]
  // 白色横条代表笔记内容
  const bandTop = size * 0.3
  const bandBottom = size * 0.7
  const inset = size * 0.2
  if (y >= bandTop && y <= bandBottom && x >= inset && x <= size - inset && Math.floor(y / (size * 0.1)) % 2 === 1) {
    return [255, 255, 255, 255]
  }
  return [37, 99, 235, 255] // #2563EB
}

mkdirSync(join(root, 'resources'), { recursive: true })
writeFileSync(join(root, 'resources', 'tray.png'), makePng(32, logoPixel))
writeFileSync(join(root, 'resources', 'icon.png'), makePng(256, logoPixel))
console.log('icons generated: resources/tray.png, resources/icon.png')
