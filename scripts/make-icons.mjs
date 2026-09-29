// Generates the extension PNG icons from code, so the repo carries no binaries
// and the artwork stays editable. Pure Node: zlib + a minimal PNG writer.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SIZES = [16, 32, 48, 128]
const OUT_DIR = join(import.meta.dirname, '..', 'public', 'icons')

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

const crc32 = (buf) => {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const encodePng = (width, height, rgba) => {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: truecolour + alpha
  const stride = width * 4
  // Each scanline is prefixed with its filter byte (0 = none).
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const mix = (a, b, t) => a + (b - a) * t
const clamp01 = (v) => Math.min(1, Math.max(0, v))

// Signed distance to a rounded rectangle, used for anti-aliased edges.
const roundedRectCoverage = (x, y, left, top, right, bottom, radius) => {
  const cx = Math.max(left + radius, Math.min(x, right - radius))
  const cy = Math.max(top + radius, Math.min(y, bottom - radius))
  const dist = Math.hypot(x - cx, y - cy) - radius
  const inside = x >= left && x <= right && y >= top && y <= bottom
  if (dist <= 0) return 1
  if (!inside && dist > 1) return clamp01(1 - dist)
  return clamp01(1 - dist)
}

const TOP = [0x63, 0x66, 0xf1] // indigo-500
const BOTTOM = [0x8b, 0x5c, 0xf6] // violet-500

const drawIcon = (size) => {
  const rgba = Buffer.alloc(size * size * 4)
  const s = size / 128 // design the artwork at 128px, then scale
  const pad = 6 * s
  const radius = 28 * s
  // Three bars of different widths, evoking a stack of grouped tabs.
  const bars = [
    { x: 28, y: 36, w: 72, h: 12 },
    { x: 28, y: 58, w: 52, h: 12 },
    { x: 28, y: 80, w: 62, h: 12 },
  ]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5
      const py = y + 0.5
      const bg = roundedRectCoverage(px, py, pad, pad, size - pad, size - pad, radius)
      if (bg <= 0) continue

      const t = (py - pad) / (size - pad * 2)
      let r = mix(TOP[0], BOTTOM[0], clamp01(t))
      let g = mix(TOP[1], BOTTOM[1], clamp01(t))
      let b = mix(TOP[2], BOTTOM[2], clamp01(t))

      for (const bar of bars) {
        const coverage = roundedRectCoverage(
          px, py,
          bar.x * s, bar.y * s,
          (bar.x + bar.w) * s, (bar.y + bar.h) * s,
          (bar.h / 2) * s,
        )
        if (coverage > 0) {
          r = mix(r, 255, coverage)
          g = mix(g, 255, coverage)
          b = mix(b, 255, coverage)
        }
      }

      const i = (y * size + x) * 4
      rgba[i] = Math.round(r)
      rgba[i + 1] = Math.round(g)
      rgba[i + 2] = Math.round(b)
      rgba[i + 3] = Math.round(bg * 255)
    }
  }
  return encodePng(size, size, rgba)
}

mkdirSync(OUT_DIR, { recursive: true })
for (const size of SIZES) {
  writeFileSync(join(OUT_DIR, `icon${size}.png`), drawIcon(size))
}
console.log(`icons: wrote ${SIZES.map((s) => `icon${s}.png`).join(', ')} to public/icons`)
