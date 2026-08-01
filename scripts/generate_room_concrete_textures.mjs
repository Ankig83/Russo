/**
 * Генерирует бесшовный PBR-бетон для комнаты:
 * Base Color (sRGB), Roughness (linear), Normal OpenGL (linear).
 *
 * node scripts/generate_room_concrete_textures.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../public/textures/room-concrete')
const SIZE = 1024
const SEED = 1741

function hash2(x, y) {
  let n = (x * 374761393 + y * 668265263 + SEED * 69069) | 0
  n = (n ^ (n >>> 13)) * 1274126177
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}

function smooth(t) {
  return t * t * (3 - 2 * t)
}

function periodicNoise(x, y, cells) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = smooth(x - x0)
  const ty = smooth(y - y0)
  const wrap = (v) => ((v % cells) + cells) % cells
  const a = hash2(wrap(x0), wrap(y0))
  const b = hash2(wrap(x0 + 1), wrap(y0))
  const c = hash2(wrap(x0), wrap(y0 + 1))
  const d = hash2(wrap(x0 + 1), wrap(y0 + 1))
  const ab = a + (b - a) * tx
  const cd = c + (d - c) * tx
  return ab + (cd - ab) * ty
}

function fbm(u, v) {
  let value = 0
  let weight = 0
  let amplitude = 1
  for (const cells of [4, 9, 21, 47, 103]) {
    value += periodicNoise(u * cells, v * cells, cells) * amplitude
    weight += amplitude
    amplitude *= 0.5
  }
  return value / weight
}

const height = new Float32Array(SIZE * SIZE)
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    const u = x / SIZE
    const v = y / SIZE
    const broad = fbm(u, v)
    const pores = periodicNoise(u * 151, v * 151, 151)
    height[y * SIZE + x] = broad * 0.78 + pores * 0.22
  }
}

const base = Buffer.alloc(SIZE * SIZE * 3)
const roughness = Buffer.alloc(SIZE * SIZE)
const normal = Buffer.alloc(SIZE * SIZE * 3)
const clamp255 = (n) => Math.max(0, Math.min(255, Math.round(n)))
const at = (x, y) => height[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)]

for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    const i = y * SIZE + x
    const h = height[i] - 0.5
    const grain = hash2(x, y) - 0.5

    // Серо-зелёный бетон без baked света.
    base[i * 3] = clamp255(119 + h * 44 + grain * 5)
    base[i * 3 + 1] = clamp255(126 + h * 42 + grain * 5)
    base[i * 3 + 2] = clamp255(123 + h * 38 + grain * 4)
    roughness[i] = clamp255(224 + h * 24 + grain * 7)

    const dx = at(x + 1, y) - at(x - 1, y)
    const dy = at(x, y + 1) - at(x, y - 1)
    const strength = 2.8
    let nx = -dx * strength
    let ny = dy * strength
    let nz = 1
    const len = Math.hypot(nx, ny, nz)
    nx /= len
    ny /= len
    nz /= len
    normal[i * 3] = clamp255((nx * 0.5 + 0.5) * 255)
    normal[i * 3 + 1] = clamp255((ny * 0.5 + 0.5) * 255)
    normal[i * 3 + 2] = clamp255((nz * 0.5 + 0.5) * 255)
  }
}

fs.mkdirSync(outDir, { recursive: true })
await Promise.all([
  sharp(base, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .webp({ quality: 88, effort: 5 })
    .toFile(path.join(outDir, 'concrete_baseColor.webp')),
  sharp(roughness, { raw: { width: SIZE, height: SIZE, channels: 1 } })
    .webp({ quality: 90, effort: 5 })
    .toFile(path.join(outDir, 'concrete_roughness.webp')),
  sharp(normal, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .webp({ quality: 92, effort: 5 })
    .toFile(path.join(outDir, 'concrete_normal.webp')),
])

console.log(`Room concrete PBR written: ${outDir}`)
