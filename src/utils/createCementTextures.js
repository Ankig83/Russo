import * as THREE from 'three'

function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123
  return s - Math.floor(s)
}

function smoothstep(t) {
  return t * t * (3 - 2 * t)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function noise2(x, y) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = smoothstep(x - ix)
  const fy = smoothstep(y - iy)
  const a = hash(ix, iy)
  const b = hash(ix + 1, iy)
  const c = hash(ix, iy + 1)
  const d = hash(ix + 1, iy + 1)
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy)
}

function fbm(x, y, octaves = 5) {
  let amp = 0.5
  let freq = 1
  let sum = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * freq, y * freq)
    freq *= 2.05
    amp *= 0.5
  }
  return sum
}

/** Крупные «облака» и зерно бетона */
function cementField(x, y, variant) {
  const macro = fbm(x * 0.011, y * 0.011, 5)
  const patch = fbm(x * 0.028 + 17, y * 0.028 + 43, 4)
  const fine = fbm(x * 0.19 + 5, y * 0.19 + 91, 3) * 0.28
  const grain = (hash(x * 3.1, y * 4.7) - 0.5) * 0.06

  if (variant === 'wall') {
    const streak = fbm(x * 0.07, y * 0.022 + 60, 3) * 0.22
    return macro * 0.48 + patch * 0.34 + streak + fine + grain
  }

  const swirl = fbm(x * 0.019 - y * 0.014, x * 0.013 + y * 0.021 + 33, 4)
  return macro * 0.42 + patch * 0.3 + swirl * 0.28 + fine + grain
}

function heightAt(x, y, variant) {
  const field = cementField(x, y, variant)
  const pores = fbm(x * 0.75 + 22, y * 0.75 + 8, 2) * 0.07
  return field + pores
}

/**
 * Процедурный бетон по референсу.
 * wall — матовая штукатурка; floor — полированный/закрытый бетон.
 */
export function createCementTextures(baseHex, opts = {}) {
  const size = opts.size ?? 1024
  const contrast = opts.contrast ?? 1
  const variant = opts.variant ?? 'wall'
  const base = new THREE.Color(baseHex)

  const colorCanvas = document.createElement('canvas')
  colorCanvas.width = size
  colorCanvas.height = size
  const cCtx = colorCanvas.getContext('2d')
  const colorData = cCtx.createImageData(size, size)

  const normalCanvas = document.createElement('canvas')
  normalCanvas.width = size
  normalCanvas.height = size
  const nCtx = normalCanvas.getContext('2d')
  const normalData = nCtx.createImageData(size, size)

  const roughCanvas = document.createElement('canvas')
  roughCanvas.width = size
  roughCanvas.height = size
  const rCtx = roughCanvas.getContext('2d')
  const roughData = rCtx.createImageData(size, size)

  const step = 1 / size
  const isWall = variant === 'wall'
  const normalStrength = isWall ? 2.4 : 1.35

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x * step
      const v = y * step
      const px = u * size
      const py = v * size
      const field = cementField(px, py, variant)

      const tone = (field - 0.5) * (isWall ? 0.28 : 0.32) * contrast
      const mul = 1 + tone

      const i = (y * size + x) * 4
      const r = base.r * 255 * (isWall ? mul * 0.99 : mul * 1.01)
      const g = base.g * 255 * mul
      const b = base.b * 255 * (isWall ? mul * 1.02 : mul * 0.99)
      colorData.data[i]     = Math.min(255, Math.max(0, r))
      colorData.data[i + 1] = Math.min(255, Math.max(0, g))
      colorData.data[i + 2] = Math.min(255, Math.max(0, b))
      colorData.data[i + 3] = 255

      const hL = heightAt(px - 1, py, variant)
      const hR = heightAt(px + 1, py, variant)
      const hD = heightAt(px, py - 1, variant)
      const hU = heightAt(px, py + 1, variant)
      let nx = (hL - hR) * normalStrength
      let ny = (hD - hU) * normalStrength
      let nz = 1
      const len = Math.hypot(nx, ny, nz) || 1
      nx /= len
      ny /= len
      nz /= len
      normalData.data[i]     = Math.round((nx * 0.5 + 0.5) * 255)
      normalData.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255)
      normalData.data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255)
      normalData.data[i + 3] = 255

      const roughBase = isWall ? 0.88 + field * 0.1 : 0.38 + field * 0.14
      const rough = Math.min(255, Math.max(0, roughBase * 255))
      roughData.data[i] = rough
      roughData.data[i + 1] = rough
      roughData.data[i + 2] = rough
      roughData.data[i + 3] = 255
    }
  }

  cCtx.putImageData(colorData, 0, 0)
  nCtx.putImageData(normalData, 0, 0)
  rCtx.putImageData(roughData, 0, 0)

  const map = new THREE.CanvasTexture(colorCanvas)
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8

  const normalMap = new THREE.CanvasTexture(normalCanvas)
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping

  const roughnessMap = new THREE.CanvasTexture(roughCanvas)
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping

  return { map, normalMap, roughnessMap }
}

export function disposeCementTextures(textures) {
  textures?.map?.dispose()
  textures?.normalMap?.dispose()
  textures?.roughnessMap?.dispose()
}
