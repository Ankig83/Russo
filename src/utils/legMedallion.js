import * as THREE from 'three'
import { LIGHT_LAYERS } from '../constants/studioScene'
import { collectRibbonLegMeshes } from './legDetail'

const assetBase = import.meta.env.BASE_URL
export const LEG_MEDALLION_TEX_VERSION = '9'
/** Бесшовная медь корпуса — не круглая «бляха» (она давала кольца на лентах). */
export const LEG_FORGE_BASECOLOR_URL =
  `${assetBase}textures/doors-ai/doors_ai_baseColor.webp?v=${LEG_MEDALLION_TEX_VERSION}`
export const LEG_FORGE_MR_URL =
  `${assetBase}textures/doors-ai/doors_ai_metallicRoughness.webp?v=${LEG_MEDALLION_TEX_VERSION}`
export const LEG_FORGE_NORMAL_URL =
  `${assetBase}textures/doors-ai/doors_ai_normal.webp?v=${LEG_MEDALLION_TEX_VERSION}`
export const LEG_MEDALLION_LOGO_URL =
  `${assetBase}textures/leg-medallion/logo.png?v=${LEG_MEDALLION_TEX_VERSION}`

/**
 * Медальон: radius + forwardBias зафиксированы.
 * Меняем только профиль / лого / материал.
 */
export const LEG_MEDALLION = {
  name: 'leg_cross_medallion',
  logoName: 'leg_cross_medallion_logo',
  /** LOCK */
  radius: 0.125,
  /** LOCK */
  forwardBias: 0.024,
  /** 15–20 мм */
  thickness: 0.019,
  /** бортик 8–10 мм */
  rimWidth: 0.01,
  /** глубокий уступ */
  recessDepth: 0.0085,
  rivetRadius: 0.0155,
  rivetHeight: 0.01,
  logoScale: 0.48,
  /** 4–6 мм */
  logoRelief: 0.006,
  logoChamfer: 0.0022,
  logoSegments: 112,
  /** Тайлинг forge-карт по world-UV ленты */
  legRepeat: [3.4, 3.4],
  normalScale: 2.35,
  metalness: 0.88,
  roughness: 0.68,
  env: 1.15,
  colorTint: '#8f623c',
  bumpScale: 0.065,
  emissive: '#100805',
  emissiveIntensity: 0.04,
  logoHighlight: '#e2a868',
  patina: '#1a4534',
}

function loadTex(url, colorSpace, repeat = null) {
  const loader = new THREE.TextureLoader()
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = colorSpace
        tex.anisotropy = 8
        if (repeat) {
          tex.wrapS = THREE.RepeatWrapping
          tex.wrapT = THREE.RepeatWrapping
          tex.repeat.set(repeat[0], repeat[1])
        } else {
          tex.wrapS = THREE.ClampToEdgeWrapping
          tex.wrapT = THREE.ClampToEdgeWrapping
        }
        tex.needsUpdate = true
        resolve(tex)
      },
      undefined,
      reject,
    )
  })
}

function cloneTiled(src, repeat) {
  if (!src) return null
  const tex = src.clone()
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat[0], repeat[1])
  tex.colorSpace = src.colorSpace
  tex.anisotropy = src.anisotropy ?? 8
  tex.flipY = src.flipY
  tex.needsUpdate = true
  return tex
}

/** Патина в тёмных зонах + потёртости на светлых — поверх doors-ai. */
function ageForgeAlbedo(baseTex) {
  const img = baseTex.image
  if (!img?.width) return baseTex
  const w = img.width
  const h = img.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, w, h)
  const { data } = imageData
  const patina = new THREE.Color(LEG_MEDALLION.patina)
  const wear = new THREE.Color(LEG_MEDALLION.logoHighlight)

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]
    const luma = (r * 0.299 + g * 0.587 + b * 0.114) / 255
    if (luma < 0.3) {
      const t = (0.3 - luma) / 0.3
      r = THREE.MathUtils.lerp(r, patina.r * 255, t * 0.4)
      g = THREE.MathUtils.lerp(g, patina.g * 255, t * 0.4)
      b = THREE.MathUtils.lerp(b, patina.b * 255, t * 0.4)
    } else if (luma > 0.58) {
      const t = (luma - 0.58) / 0.42
      r = THREE.MathUtils.lerp(r, wear.r * 255, t * 0.28)
      g = THREE.MathUtils.lerp(g, wear.g * 255, t * 0.28)
      b = THREE.MathUtils.lerp(b, wear.b * 255, t * 0.28)
    }
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
  }
  ctx.putImageData(imageData, 0, 0)
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8
  map.wrapS = THREE.RepeatWrapping
  map.wrapT = THREE.RepeatWrapping
  map.flipY = baseTex.flipY
  map.needsUpdate = true
  return map
}

/** Литая фактура: ковка + патина в ямах + потёртости на кромках круга. */
function makeMedallionFaceMaps(forgeMap) {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  ctx.fillStyle = '#1a100c'
  ctx.fillRect(0, 0, size, size)
  ctx.save()
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size * 0.498, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(forgeMap.image, 0, 0, size, size)

  // микрошум ковки
  const img = ctx.getImageData(0, 0, size, size)
  const { data } = img
  const patina = new THREE.Color(LEG_MEDALLION.patina)
  const wear = new THREE.Color(LEG_MEDALLION.logoHighlight)
  const cx = size * 0.5
  const cy = size * 0.5
  const R = size * 0.49

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy) / R
      if (dist > 1) continue

      let r = data[i]
      let g = data[i + 1]
      let b = data[i + 2]
      // зерно ковки
      const n = ((Math.sin(x * 0.37) * Math.cos(y * 0.29) + 1) * 0.5)
      const pit = ((Math.sin(x * 1.7 + y * 0.9) + 1) * 0.5)
      r = THREE.MathUtils.clamp(r * (0.88 + n * 0.18) - pit * 14, 0, 255)
      g = THREE.MathUtils.clamp(g * (0.86 + n * 0.16) - pit * 12, 0, 255)
      b = THREE.MathUtils.clamp(b * (0.84 + n * 0.14) - pit * 10, 0, 255)

      const luma = (r * 0.299 + g * 0.587 + b * 0.114) / 255
      if (luma < 0.32 || pit > 0.72) {
        const t = pit > 0.72 ? 0.35 : (0.32 - luma) / 0.32 * 0.5
        r = THREE.MathUtils.lerp(r, patina.r * 255, t)
        g = THREE.MathUtils.lerp(g, patina.g * 255, t)
        b = THREE.MathUtils.lerp(b, patina.b * 255, t)
      }
      // потёртый обод
      if (dist > 0.82) {
        const t = (dist - 0.82) / 0.18
        r = THREE.MathUtils.lerp(r, wear.r * 255, t * 0.4)
        g = THREE.MathUtils.lerp(g, wear.g * 255, t * 0.4)
        b = THREE.MathUtils.lerp(b, wear.b * 255, t * 0.4)
      }
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
    }
  }
  ctx.putImageData(img, 0, 0)
  ctx.restore()

  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8
  map.flipY = true
  map.needsUpdate = true

  // roughness: ямы матовые, кромки/блики глаже
  const rc = document.createElement('canvas')
  rc.width = size
  rc.height = size
  const rctx = rc.getContext('2d', { willReadFrequently: true })
  rctx.drawImage(canvas, 0, 0)
  const rd = rctx.getImageData(0, 0, size, size)
  for (let i = 0; i < rd.data.length; i += 4) {
    const l = (rd.data[i] * 0.299 + rd.data[i + 1] * 0.587 + rd.data[i + 2] * 0.114) / 255
    const v = THREE.MathUtils.clamp(0.82 - l * 0.4, 0.28, 0.92) * 255
    rd.data[i] = v
    rd.data[i + 1] = v
    rd.data[i + 2] = v
  }
  rctx.putImageData(rd, 0, 0)
  const roughnessMap = new THREE.CanvasTexture(rc)
  roughnessMap.colorSpace = THREE.NoColorSpace
  roughnessMap.flipY = true
  roughnessMap.needsUpdate = true

  const normalMap = makeNormalFromLuma(map, 3.8)
  return { map, roughnessMap, normalMap }
}

function makeNormalFromLuma(sourceTex, strength = 2.5) {
  const img = sourceTex.image
  if (!img?.width) return null
  const w = img.width
  const h = img.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, w, h)
  const out = ctx.createImageData(w, h)
  const lum = (i) => (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dx = lum((y * w + Math.min(x + 1, w - 1)) * 4) - lum((y * w + Math.max(x - 1, 0)) * 4)
      const dy = lum((Math.min(y + 1, h - 1) * w + x) * 4) - lum((Math.max(y - 1, 0) * w + x) * 4)
      const i = (y * w + x) * 4
      out.data[i] = THREE.MathUtils.clamp(-dx * strength * 0.5 + 0.5, 0, 1) * 255
      out.data[i + 1] = THREE.MathUtils.clamp(-dy * strength * 0.5 + 0.5, 0, 1) * 255
      out.data[i + 2] = 255
      out.data[i + 3] = 255
    }
  }
  ctx.putImageData(out, 0, 0)
  const normal = new THREE.CanvasTexture(canvas)
  normal.colorSpace = THREE.NoColorSpace
  normal.anisotropy = 8
  normal.flipY = true
  normal.needsUpdate = true
  return normal
}

function loadTexWithFallback(urls, colorSpace) {
  const tryOne = (i) => loadTex(urls[i], colorSpace).catch((err) => {
    if (i + 1 >= urls.length) throw err
    return tryOne(i + 1)
  })
  return tryOne(0)
}

/** Лёгкая загрузка PBR для лент ∞ — без logo/medallion face (те тяжёлые и ломали Promise). */
export function loadLegSideCopperTextures() {
  const v = LEG_MEDALLION_TEX_VERSION
  const base = assetBase
  return Promise.all([
    loadTexWithFallback([
      `${base}textures/doors-ai/doors_ai_baseColor.webp?v=${v}`,
      `${base}textures/doors-ai/doors_ai_baseColor.png?v=${v}`,
    ], THREE.SRGBColorSpace),
    loadTexWithFallback([
      `${base}textures/doors-ai/doors_ai_metallicRoughness.webp?v=${v}`,
      `${base}textures/doors-ai/doors_ai_metallicRoughness.png?v=${v}`,
    ], THREE.NoColorSpace),
    loadTexWithFallback([
      `${base}textures/doors-ai/doors_ai_normal.webp?v=${v}`,
      `${base}textures/doors-ai/doors_ai_normal.png?v=${v}`,
    ], THREE.NoColorSpace),
  ]).then(([baseMap, mr, normal]) => ({
    // без ageForgeAlbedo — CPU-петля на 3K² вешала main thread на секунды
    legMap: baseMap,
    legNormalMap: normal,
    legRoughnessMap: mr,
    legMetalnessMap: mr,
  }))
}

export function loadLegMedallionTextures() {
  return Promise.all([
    loadTex(LEG_FORGE_BASECOLOR_URL, THREE.SRGBColorSpace),
    loadTex(LEG_FORGE_MR_URL, THREE.NoColorSpace),
    loadTex(LEG_FORGE_NORMAL_URL, THREE.NoColorSpace),
    loadTex(LEG_MEDALLION_LOGO_URL, THREE.NoColorSpace),
  ]).then(([base, mr, normal, logo]) => {
    const aged = ageForgeAlbedo(base)
    const face = makeMedallionFaceMaps(aged)
    return {
      map: face.map,
      normalMap: face.normalMap,
      roughnessMap: face.roughnessMap,
      metalnessMap: null,
      legMap: aged,
      legNormalMap: normal,
      legRoughnessMap: mr,
      legMetalnessMap: mr,
      logo,
    }
  })
}

function createForgedMetalMaterial({
  name,
  map,
  normalMap,
  roughnessMap,
  metalnessMap = null,
  color = LEG_MEDALLION.colorTint,
  metalness = LEG_MEDALLION.metalness,
  roughness = LEG_MEDALLION.roughness,
  env = LEG_MEDALLION.env,
  side = THREE.FrontSide,
}) {
  const mat = new THREE.MeshPhysicalMaterial({
    name,
    map,
    normalMap,
    normalScale: new THREE.Vector2(LEG_MEDALLION.normalScale, LEG_MEDALLION.normalScale),
    roughnessMap,
    metalnessMap: metalnessMap || undefined,
    color,
    metalness,
    roughness,
    envMapIntensity: env,
    bumpMap: map,
    bumpScale: LEG_MEDALLION.bumpScale,
    emissive: LEG_MEDALLION.emissive,
    emissiveIntensity: LEG_MEDALLION.emissiveIntensity,
    clearcoat: 0.05,
    clearcoatRoughness: 0.7,
    side,
  })
  if ('specularIntensity' in mat) mat.specularIntensity = 0.16
  if ('specularColor' in mat) mat.specularColor.set('#c8965a')
  return mat
}

function mergeGeometries(geos) {
  let vertexCount = 0
  let indexCount = 0
  geos.forEach((g) => {
    vertexCount += g.attributes.position.count
    indexCount += g.index ? g.index.count : g.attributes.position.count
  })
  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)
  const uvs = new Float32Array(vertexCount * 2)
  const indices = new Uint32Array(indexCount)
  let vOff = 0
  let iOff = 0
  geos.forEach((g) => {
    const pos = g.attributes.position
    const nrm = g.attributes.normal
    const uv = g.attributes.uv
    for (let i = 0; i < pos.count; i += 1) {
      positions[(vOff + i) * 3] = pos.getX(i)
      positions[(vOff + i) * 3 + 1] = pos.getY(i)
      positions[(vOff + i) * 3 + 2] = pos.getZ(i)
      if (nrm) {
        normals[(vOff + i) * 3] = nrm.getX(i)
        normals[(vOff + i) * 3 + 1] = nrm.getY(i)
        normals[(vOff + i) * 3 + 2] = nrm.getZ(i)
      }
      if (uv) {
        uvs[(vOff + i) * 2] = uv.getX(i)
        uvs[(vOff + i) * 2 + 1] = uv.getY(i)
      }
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i += 1) indices[iOff + i] = g.index.getX(i) + vOff
      iOff += g.index.count
    } else {
      for (let i = 0; i < pos.count; i += 1) indices[iOff + i] = vOff + i
      iOff += pos.count
    }
    vOff += pos.count
  })
  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  merged.setIndex(new THREE.BufferAttribute(indices, 1))
  merged.computeVertexNormals()
  return merged
}

/**
 * Объёмное лого с фаской: верх чуть уже низа → блики на скосах.
 */
function buildLogoReliefGeometry(logoTex) {
  const img = logoTex.image
  if (!img?.width) return null

  const seg = LEG_MEDALLION.logoSegments
  const size = LEG_MEDALLION.radius * LEG_MEDALLION.logoScale * 2
  const relief = LEG_MEDALLION.logoRelief
  const chamfer = LEG_MEDALLION.logoChamfer
  const half = size / 2

  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  const { data, width: w, height: h } = ctx.getImageData(0, 0, img.width, img.height)

  const sample = (u, v) => {
    const px = Math.min(w - 1, Math.floor(u * (w - 1)))
    const py = Math.min(h - 1, Math.floor(v * (h - 1)))
    return data[(py * w + px) * 4] / 255
  }

  const grid = []
  for (let iy = 0; iy <= seg; iy += 1) {
    const row = []
    for (let ix = 0; ix <= seg; ix += 1) {
      const u = ix / seg
      const v = iy / seg
      const luma = sample(u, v)
      const solid = luma > 0.28
      // край ячейки — ниже (фаска), центр штриха — полный рельеф
      const edge = solid ? Math.min(
        sample(Math.max(0, u - 0.012), v),
        sample(Math.min(1, u + 0.012), v),
        sample(u, Math.max(0, v - 0.012)),
        sample(u, Math.min(1, v + 0.012)),
      ) : 0
      const bevel = solid && edge < 0.35 ? chamfer : 0
      row.push({
        x: -half + u * size,
        y: half - v * size,
        zTop: solid ? relief * (0.55 + luma * 0.45) - bevel : 0,
        solid,
        u,
        v,
      })
    }
    grid.push(row)
  }

  const positions = []
  const uvs = []
  const indices = []
  const add = (x, y, z, u, v) => {
    const i = positions.length / 3
    positions.push(x, y, z)
    uvs.push(u, v)
    return i
  }

  for (let iy = 0; iy < seg; iy += 1) {
    for (let ix = 0; ix < seg; ix += 1) {
      const a = grid[iy][ix]
      const b = grid[iy][ix + 1]
      const c = grid[iy + 1][ix + 1]
      const d = grid[iy + 1][ix]
      if (!(a.solid || b.solid || c.solid || d.solid)) continue

      const z = (p) => (p.solid ? Math.max(p.zTop, 0.0004) : 0.0002)
      const t0 = add(a.x, a.y, z(a), a.u, a.v)
      const t1 = add(b.x, b.y, z(b), b.u, b.v)
      const t2 = add(c.x, c.y, z(c), c.u, c.v)
      const t3 = add(d.x, d.y, z(d), d.u, d.v)
      indices.push(t0, t1, t2, t0, t2, t3)

      ;[[a, b], [b, c], [c, d], [d, a]].forEach(([p0, p1]) => {
        if (!p0.solid && !p1.solid) return
        if (z(p0) < 0.0015 && z(p1) < 0.0015) return
        const s0 = add(p0.x, p0.y, z(p0), p0.u, p0.v)
        const s1 = add(p1.x, p1.y, z(p1), p1.u, p1.v)
        const s2 = add(p1.x, p1.y, 0, p1.u, p1.v)
        const s3 = add(p0.x, p0.y, 0, p0.u, p0.v)
        indices.push(s0, s1, s2, s0, s2, s3)
      })
    }
  }

  if (!positions.length) return null
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/**
 * Литой медальон: Lathe-профиль (бортик + глубокий уступ), лицо в +Z.
 * radius снаружи не меняется.
 */
function buildMedallionGeometry() {
  const {
    radius, thickness, rimWidth, recessDepth, rivetRadius, rivetHeight,
  } = LEG_MEDALLION

  const rim = rimWidth
  const segs = 96
  // Спина на z=0 (позиция LOCK), лицо в +Z
  const faceZ = thickness
  const wellZ = thickness - recessDepth
  const innerR = radius - rim * 1.9

  // тело: толстый диск
  const body = new THREE.CylinderGeometry(radius, radius, thickness, segs)
  body.rotateX(Math.PI / 2)
  body.translate(0, 0, thickness * 0.5)

  // массивный бортик (тор) — выступает над лицом
  const rimTor = new THREE.TorusGeometry(radius - rim * 0.5, rim * 0.58, 20, segs)
  rimTor.translate(0, 0, faceZ + rim * 0.15)

  // гребень бортика под блик
  const bead = new THREE.TorusGeometry(radius - rim * 0.32, rim * 0.34, 16, segs)
  bead.translate(0, 0, faceZ + rim * 0.42)

  // площадка уступа (ниже бортика)
  const well = new THREE.CylinderGeometry(innerR, innerR * 1.04, recessDepth * 0.55, segs)
  well.rotateX(Math.PI / 2)
  well.translate(0, 0, wellZ + recessDepth * 0.22)

  // теневое кольцо на дне уступа
  const shadowRing = new THREE.TorusGeometry(innerR * 0.9, rim * 0.16, 12, segs)
  shadowRing.translate(0, 0, wellZ + 0.001)

  return mergeGeometries([body, rimTor, bead, well, shadowRing])
}

function attachRivets(parent, textures) {
  const { radius, rivetRadius, rivetHeight, thickness, recessDepth, logoScale } = LEG_MEDALLION
  const wellZ = thickness - recessDepth
  const rivetX = radius * logoScale + rivetRadius * 1.75
  const rivetZ = wellZ + 0.0015

  const mat = createForgedMetalMaterial({
    name: 'M_Leg_Medallion_Rivet',
    map: textures.map,
    normalMap: textures.normalMap,
    roughnessMap: textures.roughnessMap,
    color: LEG_MEDALLION.logoHighlight,
    metalness: 0.94,
    roughness: 0.32,
    env: 1.45,
  })
  mat.normalScale.set(1.1, 1.1)
  mat.clearcoat = 0.22
  mat.clearcoatRoughness = 0.28
  if ('specularIntensity' in mat) mat.specularIntensity = 0.42

  ;[-1, 1].forEach((sign, idx) => {
    // полусфера лицом в +Z, вытянута по высоте — читается купол, не «шайба»
    const dome = new THREE.SphereGeometry(rivetRadius, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.5)
    dome.rotateX(-Math.PI / 2)
    dome.scale(1, 1, 1.35)
    dome.translate(0, 0, rivetHeight * 0.15)
    const washer = new THREE.CylinderGeometry(rivetRadius * 1.85, rivetRadius * 2.1, 0.0032, 32)
    washer.rotateX(Math.PI / 2)
    washer.translate(0, 0, 0.0004)
    const geo = mergeGeometries([washer, dome])
    const mesh = new THREE.Mesh(geo, mat)
    mesh.name = `${LEG_MEDALLION.name}_rivet_${idx}`
    mesh.position.set(sign * rivetX, 0, rivetZ)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.renderOrder = 4
    mesh.layers.enable(LIGHT_LAYERS.doors)
    mesh.layers.enable(LIGHT_LAYERS.accent)
    parent.add(mesh)
  })
}

/**
 * World-triplanar UV для лент.
 * Root cause «8-bit»: в GLB UV.u ≈ world X (−0.5…0.5), не 0…1 → текстура пикселится.
 */
export function ensureLegUv(mesh, { force = false } = {}) {
  const geo = mesh.geometry
  if (!geo?.attributes?.position) return

  const existing = geo.attributes.uv
  let broken = !existing
  if (existing && !force) {
    const arr = existing.array
    let minU = Infinity
    let maxU = -Infinity
    let minV = Infinity
    let maxV = -Infinity
    for (let i = 0; i < arr.length; i += 2) {
      minU = Math.min(minU, arr[i])
      maxU = Math.max(maxU, arr[i])
      minV = Math.min(minV, arr[i + 1])
      maxV = Math.max(maxV, arr[i + 1])
    }
    // нормальный 0…1 (с небольшим запасом) — ок; иначе пересобираем
    broken = minU < -0.05 || maxU > 1.05 || minV < -0.05 || maxV > 1.05
      || (maxU - minU) < 0.15
      || (maxV - minV) < 0.15
  }

  if (!broken && existing) {
    if (!geo.attributes.uv2) geo.setAttribute('uv2', existing.clone())
    return
  }

  if (!geo.attributes.normal) geo.computeVertexNormals()
  const pos = geo.attributes.position
  const nrm = geo.attributes.normal
  const uvs = new Float32Array(pos.count * 2)
  // масштаб: ~метры → тайлы под RepeatWrapping + legRepeat
  const scale = 2.8
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const nx = Math.abs(nrm.getX(i))
    const ny = Math.abs(nrm.getY(i))
    const nz = Math.abs(nrm.getZ(i))
    let u
    let v
    if (nz >= nx && nz >= ny) {
      u = x * scale
      v = y * scale
    } else if (nx >= ny) {
      u = z * scale
      v = y * scale
    } else {
      u = x * scale
      v = z * scale
    }
    uvs[i * 2] = u
    uvs[i * 2 + 1] = v
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geo.setAttribute('uv2', geo.attributes.uv.clone())
}

function findFacadeCopperMaterial(facade) {
  if (!facade) return null
  let sourceMat = null
  facade.traverse((child) => {
    if (sourceMat || !child.isMesh || !child.material) return
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    for (const mat of mats) {
      if (!mat?.map) continue
      if (
        mat.name === 'M_ClosedDoors_AI'
        || mat.name === 'M_AiDoor_left'
        || mat.name === 'M_AiDoor_right'
        || mat.name === 'Material.002'
        || child.name === 'node_0'
      ) {
        sourceMat = mat
        break
      }
    }
  })
  return sourceMat
}

function assignLegMetalMaterial(root, mat, { touchUv = false, forceUv = false } = {}) {
  let applied = 0
  const apply = (mesh) => {
    if (touchUv) ensureLegUv(mesh, { force: forceUv })
    mesh.material = mat
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.layers.enable(LIGHT_LAYERS.doors)
    mesh.layers.enable(LIGHT_LAYERS.corpus)
    mesh.layers.enable(LIGHT_LAYERS.accent)
    applied += 1
  }

  collectRibbonLegMeshes(root).forEach(apply)

  ;['Table_Top_Frame', 'Table_Top_Frame_back'].forEach((name) => {
    const frame = root.getObjectByName(name)
    if (frame?.isMesh) apply(frame)
  })
  return applied
}

/**
 * Клон материала AI-фасада/боковины на ленты ∞ — те же GPU-карты,
 * без re-UV/тайлинга (force UV давал «клетку» на лентах).
 */
export function applyLegSideCopperFromFacade(root, facade) {
  const src = findFacadeCopperMaterial(facade)
  if (!root || !src?.map) return 0

  const physical = new THREE.MeshPhysicalMaterial()
  physical.copy(src)
  physical.name = 'M_Leg_SideCopper'
  physical.side = THREE.DoubleSide
  physical.color.set('#ffffff')
  physical.metalness = Math.max(0.94, src.metalness ?? 0.7)
  physical.roughness = Math.min(0.32, src.roughness ?? 0.45)
  physical.envMapIntensity = 2.0
  physical.clearcoat = 0.42
  physical.clearcoatRoughness = 0.22
  physical.transparent = false
  physical.opacity = 1
  physical.depthWrite = true
  physical.alphaMap = null
  if ('transmission' in physical) physical.transmission = 0
  if ('specularIntensity' in physical) physical.specularIntensity = 0.5
  if ('specularColor' in physical) physical.specularColor.set('#f2d2a4')
  physical.emissive.set('#140806')
  physical.emissiveIntensity = 0.06
  if (physical.normalScale) physical.normalScale.set(1.55, 1.55)
  physical.needsUpdate = true
  // GLB UV лент оставляем как есть — ensureLegUv давал «клетку»
  return assignLegMetalMaterial(root, physical, { touchUv: false })
}

/**
 * Ленты ∞ — doors-ai PBR (fallback, если фасад недоступен).
 *
 * textures: { legMap, legNormalMap, legRoughnessMap, legMetalnessMap }
 *   или facade-maps: { map, normalMap, metalRoughnessMap }
 */
export function applyLegDirtyCopper(root, textures) {
  if (!root || !textures) return 0
  const legMap = textures.legMap || textures.map
  if (!legMap) return 0
  const legNormal = textures.legNormalMap || textures.normalMap || null
  const legMr = textures.legRoughnessMap || textures.metalRoughnessMap || textures.roughnessMap || null
  const legMetal = textures.legMetalnessMap || textures.metalRoughnessMap || legMr

  const repeat = LEG_MEDALLION.legRepeat
  const mat = createForgedMetalMaterial({
    name: 'M_Leg_SideCopper',
    map: cloneTiled(legMap, repeat),
    normalMap: cloneTiled(legNormal, repeat),
    roughnessMap: cloneTiled(legMr, repeat),
    metalnessMap: cloneTiled(legMetal, repeat),
    metalness: 0.96,
    roughness: 0.34,
    env: 1.85,
    color: '#ffffff',
    side: THREE.DoubleSide,
  })
  mat.normalScale.set(1.85, 1.85)
  mat.bumpScale = 0.022
  mat.clearcoat = 0.38
  mat.clearcoatRoughness = 0.26
  mat.emissive.set('#120805')
  mat.emissiveIntensity = 0.05
  if ('specularIntensity' in mat) mat.specularIntensity = 0.45
  if ('specularColor' in mat) mat.specularColor.set('#f0d0a0')
  ;[mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap, mat.bumpMap].forEach((tex) => {
    if (!tex) return
    tex.anisotropy = 16
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.needsUpdate = true
  })

  // doors-ai fallback: world-UV + тайлинг
  return assignLegMetalMaterial(root, mat, { touchUv: true, forceUv: true })
}

/** Снести baked/runtime медальоны на ножках. */
export function removeLegMedallions(root) {
  if (!root) return 0
  const stale = []
  root.traverse((o) => {
    if (/^leg_cross_medallion/i.test(o.name || '')) stale.push(o)
  })
  stale.forEach((o) => {
    o.traverse((child) => child.geometry?.dispose?.())
    o.parent?.remove(o)
  })
  return stale.length
}

function attachLogoRelief(parent, textures) {
  const stale = parent.getObjectByName(LEG_MEDALLION.logoName)
  if (stale) {
    stale.parent?.remove(stale)
    stale.geometry?.dispose?.()
  }
  if (!textures?.logo) return null

  const geo = buildLogoReliefGeometry(textures.logo)
  if (!geo) return null

  const mat = createForgedMetalMaterial({
    name: 'M_Leg_Medallion_Logo',
    map: textures.map,
    normalMap: textures.normalMap,
    roughnessMap: textures.roughnessMap,
    color: LEG_MEDALLION.logoHighlight,
    metalness: 0.95,
    roughness: 0.28,
    env: 1.5,
  })
  mat.clearcoat = 0.28
  mat.clearcoatRoughness = 0.26
  mat.normalScale.set(1.5, 1.5)
  mat.emissive = new THREE.Color('#2a1408')
  mat.emissiveIntensity = 0.12
  if ('specularIntensity' in mat) mat.specularIntensity = 0.48
  if ('specularColor' in mat) mat.specularColor.set('#f0c090')

  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = LEG_MEDALLION.logoName
  // на дне уступа — тень вокруг объёмного лого (спина медальона = z:0)
  const zFace = LEG_MEDALLION.thickness - LEG_MEDALLION.recessDepth + 0.0015
  mesh.position.z = zFace
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.renderOrder = 3
  mesh.layers.enable(LIGHT_LAYERS.doors)
  mesh.layers.enable(LIGHT_LAYERS.accent)
  parent.add(mesh)
  return mesh
}

function removeStaleMedallions(root) {
  const stale = []
  root.traverse((o) => {
    if (/^leg_cross_medallion/i.test(o.name || '')) stale.push(o)
  })
  stale.forEach((o) => {
    o.traverse((child) => child.geometry?.dispose?.())
    o.parent?.remove(o)
  })
}

function attachOneLegMedallion(root, textures, ribbons, { suffix, faceSign }) {
  if (!ribbons?.length) return null

  root.updateMatrixWorld(true)
  const box = new THREE.Box3()
  ribbons.forEach((m) => box.expandByObject(m))
  if (box.isEmpty()) return null

  const centerWorld = box.getCenter(new THREE.Vector3())
  const worldPos = new THREE.Vector3(
    centerWorld.x,
    centerWorld.y,
    faceSign >= 0
      ? box.max.z + LEG_MEDALLION.forwardBias
      : box.min.z - LEG_MEDALLION.forwardBias,
  )

  const castMat = createForgedMetalMaterial({
    name: `M_Leg_Medallion_Cast_${suffix}`,
    map: textures.map,
    normalMap: textures.normalMap,
    roughnessMap: textures.roughnessMap,
    metalness: LEG_MEDALLION.metalness,
    roughness: LEG_MEDALLION.roughness,
    env: LEG_MEDALLION.env,
  })
  castMat.normalScale.set(LEG_MEDALLION.normalScale, LEG_MEDALLION.normalScale)
  castMat.bumpScale = LEG_MEDALLION.bumpScale
  castMat.clearcoat = 0.1
  castMat.clearcoatRoughness = 0.55
  if ('specularIntensity' in castMat) castMat.specularIntensity = 0.28
  castMat.side = THREE.DoubleSide

  const mesh = new THREE.Mesh(buildMedallionGeometry(), castMat)
  mesh.name = `${LEG_MEDALLION.name}_${suffix}`
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.layers.enable(LIGHT_LAYERS.doors)
  mesh.layers.enable(LIGHT_LAYERS.accent)
  mesh.layers.enable(LIGHT_LAYERS.corpus)

  const anchor = root
  anchor.add(mesh)
  const local = worldPos.clone()
  anchor.worldToLocal(local)
  mesh.position.copy(local)
  mesh.quaternion.identity()
  if (faceSign < 0) mesh.rotation.y = Math.PI
  mesh.renderOrder = 2

  attachLogoRelief(mesh, textures)
  attachRivets(mesh, textures)
  mesh.updateMatrixWorld(true)
  return mesh
}

/** Медальон на передней и задней паре ∞. */
export function attachLegMedallion(root, textures) {
  if (!root || !textures?.map) return null

  removeStaleMedallions(root)

  const front = collectRibbonLegMeshes(root, { pair: 'front' })
  const back = collectRibbonLegMeshes(root, { pair: 'back' })
  const frame = root.getObjectByName('Table_Top_Frame')
  if (!front.length && !back.length && !frame) return null

  const placed = []
  if (front.length) {
    const m = attachOneLegMedallion(root, textures, front, { suffix: 'front', faceSign: 1 })
    if (m) placed.push(m)
  } else if (frame) {
    // fallback: одна пара как раньше
    const m = attachOneLegMedallion(root, textures, [frame], { suffix: 'front', faceSign: 1 })
    if (m) placed.push(m)
  }
  if (back.length) {
    const m = attachOneLegMedallion(root, textures, back, { suffix: 'back', faceSign: -1 })
    if (m) placed.push(m)
  }

  return placed[0] || null
}
