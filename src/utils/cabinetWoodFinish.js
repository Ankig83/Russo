import * as THREE from 'three'
import { CABINET_LOOK } from '../constants/cabinetStudio'

const WALNUT_RE = /walnut/i
const assetBase = import.meta.env.BASE_URL

function lightmapEntryFor(mesh) {
  let node = mesh
  while (node) {
    const entry = CABINET_LOOK.lightmaps[node.name]
    if (entry) return entry
    node = node.parent
  }
  return null
}

/**
 * Шпон в GLB — «Dark Walnut»: JPEG-нормаль и SpecularMap в слоте roughness.
 * SpecularMap (синий канал = 255) даёт белые искры, нормаль 1+ даёт шум и пересвет кромок.
 * Здесь шпон сглаживается до ровного тёплого рисунка, без этой карты.
 */
const WOOD_BODY = {
  color: '#ffe0c4',
  emissive: '#000000',
  emissiveIntensity: 0,
  roughness: 0.72,
  env: 0.28,
  sheen: 0.06,
  repeat: 2,
}

const WOOD_DRAWER = {
  color: '#ffe7c8',
  emissive: '#4e301c',
  emissiveIntensity: 0.14,
  roughness: 0.66,
  env: 0.26,
  sheen: 0.08,
  repeat: 2,
}

const WOOD_BOX = {
  ...WOOD_BODY,
  repeat: 0,
  sheen: 0.08,
  emissiveIntensity: 0,
}

function retile(tex, repeat) {
  if (!tex) return null
  const next = tex.clone()
  next.wrapS = THREE.RepeatWrapping
  next.wrapT = THREE.RepeatWrapping
  if (repeat) next.repeat.set(repeat, repeat)
  next.anisotropy = 4
  next.needsUpdate = true
  return next
}

function softenWalnut(mat, opts) {
  mat.map = retile(mat.map, opts.repeat)
  // JPEG-нормаль на шпоне: под spot каждый блок сжатия становится белой точкой.
  mat.normalMap = null
  mat.bumpMap = null
  mat.roughnessMap = null
  mat.metalnessMap = null
  mat.aoMap = null
  mat.alphaMap = null
  if ('specularIntensityMap' in mat) mat.specularIntensityMap = null
  if ('specularColorMap' in mat) mat.specularColorMap = null
  if ('specularIntensity' in mat) mat.specularIntensity = 0.2
  mat.metalness = 0
  mat.roughness = Math.max(opts.roughness, CABINET_LOOK.walnut.roughnessFloor)
  mat.color.set(opts.color)
  mat.emissive.set(opts.emissive)
  mat.emissiveIntensity = opts.emissiveIntensity
  if (mat.normalScale) mat.normalScale.set(0, 0)
  if ('envMapIntensity' in mat) mat.envMapIntensity = opts.env
  if ('sheen' in mat) {
    mat.sheen = opts.sheen
    mat.sheenRoughness = 0.85
    if ('sheenColor' in mat) mat.sheenColor.set('#e6c49a')
  }
  if ('clearcoat' in mat) mat.clearcoat = 0
  mat.transparent = false
  mat.opacity = 1
  mat.alphaTest = 0
  mat.depthWrite = true
  mat.blending = THREE.NormalBlending
  mat.needsUpdate = true
}

function woodPreset(meshName) {
  if (/^drawer_[12]$/.test(meshName)) return WOOD_DRAWER
  if (/modul_drawer/.test(meshName)) return WOOD_BOX
  return WOOD_BODY
}

/** Lightmap уже несёт свет. Цвет и emissive не трогаем, нормаль и SpecularMap сняты. */
function softenBakedWalnut(mat) {
  mat.map = retile(mat.map, 0)
  mat.normalMap = null
  mat.bumpMap = null
  mat.roughnessMap = null
  mat.metalnessMap = null
  mat.aoMap = null
  mat.alphaMap = null
  if ('specularIntensityMap' in mat) mat.specularIntensityMap = null
  if ('specularColorMap' in mat) mat.specularColorMap = null
  mat.metalness = 0
  mat.roughness = Math.max(CABINET_LOOK.walnut.roughness, CABINET_LOOK.walnut.roughnessFloor)
  mat.emissive.set('#000000')
  mat.emissiveIntensity = 0
  if (mat.normalScale) mat.normalScale.set(0, 0)
  mat.needsUpdate = true
}

function applyWalnut(mesh) {
  const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  if (!list.some((mat) => WALNUT_RE.test(mat?.name || ''))) return false
  const baked = Boolean(lightmapEntryFor(mesh))
  const opts = baked ? null : woodPreset(mesh.name || '')
  const next = list.map((mat) => {
    if (!WALNUT_RE.test(mat?.name || '')) return mat
    const cloned = mat.clone()
    if (baked) softenBakedWalnut(cloned)
    else softenWalnut(cloned, opts)
    return cloned
  })
  mesh.material = Array.isArray(mesh.material) ? next : next[0]
  return true
}

let walnutBakeWarned = false

function walnutBakeUrls() {
  const base = `${assetBase}${CABINET_LOOK.walnut.dir}`
  const files = CABINET_LOOK.walnut.files
  return {
    baseColor: `${base}${files.baseColor}`,
    roughness: `${base}${files.roughness}`,
    normal: `${base}${files.normal}`,
  }
}

/** PNG 2048: base color sRGB, roughness и normal линейные. Пока файлов нет — текущий шпон. */
export function loadWalnutBake() {
  const urls = walnutBakeUrls()
  return Promise.all(
    Object.entries(urls).map(async ([key, url]) => {
      try {
        const res = await fetch(url, { method: 'HEAD' })
        const type = res.headers.get('content-type') || ''
        const png = res.ok && !type.includes('text/html')
        return [key, png ? url : null]
      } catch {
        return [key, null]
      }
    }),
  ).then(async (pairs) => {
    const missing = pairs.filter(([, url]) => !url).map(([key]) => CABINET_LOOK.walnut.files[key])
    if (missing.length) {
      if (!walnutBakeWarned) {
        walnutBakeWarned = true
        console.warn(
          `[walnut] нет PNG в ${CABINET_LOOK.walnut.dir}: ${missing.join(', ')}. Оставлен текущий шпон, JPEG-нормаль и SpecularMap сняты.`,
        )
      }
      return null
    }
    const loader = new THREE.TextureLoader()
    const [baseColor, roughness, normal] = await Promise.all([
      loader.loadAsync(urls.baseColor),
      loader.loadAsync(urls.roughness),
      loader.loadAsync(urls.normal),
    ])
    baseColor.colorSpace = THREE.SRGBColorSpace
    roughness.colorSpace = THREE.NoColorSpace
    normal.colorSpace = THREE.NoColorSpace
    for (const tex of [baseColor, roughness, normal]) {
      tex.wrapS = THREE.RepeatWrapping
      tex.wrapT = THREE.RepeatWrapping
      tex.generateMipmaps = true
      tex.minFilter = THREE.LinearMipmapLinearFilter
      tex.anisotropy = 16
      tex.needsUpdate = true
    }
    return { baseColor, roughness, normal }
  })
}

export function applyWalnutBake(root, textures) {
  if (!root || !textures) return 0
  let applied = 0
  root.traverse((mesh) => {
    if (!mesh.isMesh) return
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    if (!list.some((mat) => WALNUT_RE.test(mat?.name || ''))) return
    const next = list.map((mat) => {
      if (!WALNUT_RE.test(mat?.name || '')) return mat
      const cloned = mat.clone()
      cloned.map = textures.baseColor
      cloned.color.set('#ffffff')
      cloned.roughnessMap = textures.roughness
      cloned.normalMap = textures.normal
      cloned.metalnessMap = null
      cloned.metalness = 0
      cloned.roughness = 1
      cloned.needsUpdate = true
      applied += 1
      return cloned
    })
    mesh.material = Array.isArray(mesh.material) ? next : next[0]
  })
  return applied
}

/** Обод был #5c3a28 — тот же коричневый, что шпон, полоска пропадала. */
function tuneLeatherRim(mat, baked) {
  if (!mat) return
  mat.metalness = 0
  if (baked) {
    mat.emissive.set('#000000')
    mat.emissiveIntensity = 0
    mat.roughness = Math.max(mat.roughness ?? 0, CABINET_LOOK.walnut.roughnessFloor)
  } else {
    mat.color.set('#1a100c')
    mat.roughness = Math.max(0.42, CABINET_LOOK.walnut.roughnessFloor)
    mat.emissive.set('#2a140c')
    mat.emissiveIntensity = 0.18
    if ('envMapIntensity' in mat) mat.envMapIntensity = 0.55
  }
  mat.roughnessMap = null
  mat.metalnessMap = null
  if (mat.normalScale) mat.normalScale.set(0.75, 0.75)
  if (mat.normalMap) {
    mat.normalMap.anisotropy = 8
    mat.normalMap.colorSpace = THREE.NoColorSpace
    mat.normalMap.needsUpdate = true
  }
  if ('specularIntensity' in mat) mat.specularIntensity = 0.45
  if ('sheen' in mat) {
    mat.sheen = 0.35
    mat.sheenRoughness = 0.45
    if ('sheenColor' in mat) mat.sheenColor.set('#8a5a38')
  }
  if ('clearcoat' in mat) mat.clearcoat = 0.12
  if ('clearcoatRoughness' in mat) mat.clearcoatRoughness = 0.4
  mat.polygonOffset = true
  mat.polygonOffsetFactor = -1
  mat.polygonOffsetUnits = -1
  mat.transparent = false
  mat.opacity = 1
  mat.depthWrite = true
  mat.side = THREE.DoubleSide
  mat.needsUpdate = true
}

/**
 * Прошивка — материал white без карты. При env=1 нитка срывается в белые точки
 * и пропадает как линия. Нить льняная, чуть над кожей, без блика.
 */
function tuneStitch(mat) {
  if (!mat) return
  mat.color.set('#f3e6c8')
  mat.roughness = 0.7
  mat.metalness = 0
  mat.emissive.set('#a88858')
  mat.emissiveIntensity = 0.55
  mat.roughnessMap = null
  mat.metalnessMap = null
  if ('envMapIntensity' in mat) mat.envMapIntensity = 0.08
  if ('clearcoat' in mat) mat.clearcoat = 0
  if ('sheen' in mat) mat.sheen = 0
  mat.polygonOffset = true
  mat.polygonOffsetFactor = -2
  mat.polygonOffsetUnits = -2
  mat.transparent = false
  mat.opacity = 1
  mat.depthWrite = true
  mat.side = THREE.DoubleSide
  mat.needsUpdate = true
}

function tuneList(mesh, fn) {
  const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  list.forEach(fn)
}

/**
 * Шпон корпуса/дверей/ящиков, кожаная окантовка и прошивка.
 * Остальные материалы не трогает — вызывающий сам ставит env.
 */
export function finishCabinetWood(mesh) {
  const name = mesh.name || ''
  if (/leather_rim/i.test(name)) {
    const baked = Boolean(lightmapEntryFor(mesh))
    tuneList(mesh, (mat) => tuneLeatherRim(mat, baked))
    return 'leather'
  }
  if (/stitch/i.test(name)) {
    tuneList(mesh, tuneStitch)
    return 'stitch'
  }
  if (applyWalnut(mesh)) return 'walnut'
  return null
}
