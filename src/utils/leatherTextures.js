import * as THREE from 'three'
import { LIGHT_LAYERS } from '../constants/studioScene'
import { seatHandlesOnBeresta } from './attachLeatherRim'

const assetBase = import.meta.env.BASE_URL
/** v9 — крупнее/темнее contact на бересте; имена фасада ручка_левая (без _1) */
const LEATHER_TEX_VERSION = '9'
export const LEATHER_APPLY_VERSION = 11

export const LEATHER_BASECOLOR_URL = `${assetBase}textures/leather/baseColor-cinema-v2.webp?v=${LEATHER_TEX_VERSION}`
export const LEATHER_ROUGHNESS_URL = `${assetBase}textures/leather/roughness.webp?v=${LEATHER_TEX_VERSION}`
export const LEATHER_NORMAL_URL = `${assetBase}textures/leather/normal.webp?v=${LEATHER_TEX_VERSION}`
export const LEATHER_BUMP_URL = `${assetBase}textures/leather/height-detail.webp?v=${LEATHER_TEX_VERSION}`

const RIM_NAME_RE = /кож_обод/i
const HANDLE_NAME_RE = /ручка/i
const LEATHER_MAT_RE = /^M_Leather_(Rim|Handle)$/i

function loadTexture(loader, url, colorSpace) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = colorSpace
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        tex.anisotropy = 16
        tex.flipY = false
        tex.needsUpdate = true
        resolve(tex)
      },
      undefined,
      (err) => reject(new Error(`leather tex fail: ${url} (${err})`)),
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
  tex.anisotropy = src.anisotropy
  tex.flipY = src.flipY
  tex.needsUpdate = true
  return tex
}

/** Один промис на сессию — текстуры готовы к моменту apply. */
let leatherTexPromise = null

export function loadLeatherTextures() {
  if (!leatherTexPromise) {
    const loader = new THREE.TextureLoader()
    leatherTexPromise = Promise.all([
      loadTexture(loader, LEATHER_BASECOLOR_URL, THREE.SRGBColorSpace),
      loadTexture(loader, LEATHER_ROUGHNESS_URL, THREE.NoColorSpace),
      loadTexture(loader, LEATHER_NORMAL_URL, THREE.NoColorSpace),
      loadTexture(loader, LEATHER_BUMP_URL, THREE.NoColorSpace),
    ])
      .then(([map, roughnessMap, normalMap, bumpMap]) => ({
        map,
        roughnessMap,
        normalMap,
        bumpMap,
      }))
      .catch((err) => {
        leatherTexPromise = null
        throw err
      })
  }
  return leatherTexPromise
}

// Старт загрузки сразу при импорте модуля (не ждать mount Shkaf)
loadLeatherTextures().catch(() => {})

function ensureUv(mesh) {
  const geo = mesh.geometry
  if (!geo?.attributes?.position) return

  const forceRingUv = /кож_обод/i.test(mesh.name || '')
  if (geo.attributes.uv && !forceRingUv) return

  geo.computeBoundingBox()
  const box = geo.boundingBox
  const pos = geo.attributes.position
  let rMin = Infinity
  let rMax = -Infinity
  for (let i = 0; i < pos.count; i += 1) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i))
    rMin = Math.min(rMin, r)
    rMax = Math.max(rMax, r)
  }
  const rSpan = Math.max(rMax - rMin, 1e-6)
  const uvs = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    if (forceRingUv || (box.max.z - box.min.z) >= (box.max.y - box.min.y)) {
      const u = (Math.atan2(z, x) / Math.PI + 1) * 0.5
      const r = Math.hypot(x, z)
      const v = (r - rMin) / rSpan
      uvs[i * 2] = u
      uvs[i * 2 + 1] = v
    } else {
      const spanX = Math.max(box.max.x - box.min.x, 1e-6)
      const spanY = Math.max(box.max.y - box.min.y, 1e-6)
      uvs[i * 2] = (x - box.min.x) / spanX
      uvs[i * 2 + 1] = (y - box.min.y) / spanY
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
}

function makeContactShadowTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  // Смещение пятна — key/handleShadow слева-сверху → тень вправо-вниз
  const g = ctx.createRadialGradient(
    size * 0.42,
    size * 0.38,
    size * 0.04,
    size * 0.55,
    size * 0.58,
    size * 0.52,
  )
  g.addColorStop(0, 'rgba(0,0,0,0.92)')
  g.addColorStop(0.35, 'rgba(0,0,0,0.55)')
  g.addColorStop(0.7, 'rgba(0,0,0,0.22)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  return tex
}

let contactShadowMap = null
function getContactShadowMap() {
  if (!contactShadowMap) contactShadowMap = makeContactShadowTexture()
  return contactShadowMap
}

let strapShadowMap = null
function getStrapShadowMap() {
  if (strapShadowMap) return strapShadowMap
  const w = 64
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, w, h)
  ctx.filter = 'blur(9px)'
  ctx.fillStyle = 'rgba(0,0,0,0.95)'
  ctx.beginPath()
  ctx.roundRect(16, 22, 32, 212, 16)
  ctx.fill()
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  strapShadowMap = tex
  return tex
}

const _shadowBox = new THREE.Box3()
const _shadowCenter = new THREE.Vector3()
const _shadowScale = new THREE.Vector3()
const _shadowQuat = new THREE.Quaternion()

/** Ремни — это вершины ручки, которые торчат вперёд. Кольцо круга в тот же меш не берём. */
function strapClusters(handle) {
  const attr = handle.geometry?.attributes?.position
  if (!attr) return []
  _shadowBox.setFromObject(handle)
  if (_shadowBox.isEmpty()) return []
  const zCut = _shadowBox.max.z - 0.038
  const m = handle.matrixWorld.elements
  const bin = 0.008
  const buckets = new Map()
  for (let i = 0; i < attr.count; i += 1) {
    const x = attr.getX(i)
    const y = attr.getY(i)
    const z = attr.getZ(i)
    const wz = m[2] * x + m[6] * y + m[10] * z + m[14]
    if (wz < zCut) continue
    const wx = m[0] * x + m[4] * y + m[8] * z + m[12]
    const wy = m[1] * x + m[5] * y + m[9] * z + m[13]
    const key = Math.round(wx / bin)
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { key, n: 0, minx: wx, maxx: wx, miny: wy, maxy: wy }
      buckets.set(key, bucket)
    }
    bucket.n += 1
    bucket.minx = Math.min(bucket.minx, wx)
    bucket.maxx = Math.max(bucket.maxx, wx)
    bucket.miny = Math.min(bucket.miny, wy)
    bucket.maxy = Math.max(bucket.maxy, wy)
  }
  // Редкие бины между ремнями — заклёпки. Их выкидываем, иначе два ремня склеиваются.
  const dense = [...buckets.values()].filter((bucket) => bucket.n >= 40)
  dense.sort((a, b) => a.key - b.key)
  const clusters = []
  for (const bucket of dense) {
    const last = clusters[clusters.length - 1]
    if (!last || bucket.key - last.lastKey > 1) {
      clusters.push({
        minx: bucket.minx,
        maxx: bucket.maxx,
        miny: bucket.miny,
        maxy: bucket.maxy,
        lastKey: bucket.key,
      })
    } else {
      last.maxx = Math.max(last.maxx, bucket.maxx)
      last.minx = Math.min(last.minx, bucket.minx)
      last.miny = Math.min(last.miny, bucket.miny)
      last.maxy = Math.max(last.maxy, bucket.maxy)
      last.lastKey = bucket.key
    }
  }
  return clusters.filter((cluster) => cluster.maxx - cluster.minx > 0.008)
}

/**
 * Прямой свет выключен, shadow map пустой.
 * Берёза — door_*_wood в отверстии створки. Пятно кладём на неё, чуть ниже-левее ремня.
 */
export function addDoorHandleShadows(root) {
  if (!root) return 0
  root.updateWorldMatrix(true, true)
  const stale = []
  root.traverse((obj) => {
    if (obj.name?.startsWith('__handle_shadow_')) stale.push(obj)
  })
  for (const obj of stale) {
    obj.parent?.remove(obj)
    obj.geometry?.dispose?.()
    obj.material?.dispose?.()
  }
  let added = 0
  for (const side of ['left', 'right']) {
    const handle = root.getObjectByName(`door_${side}_handle`)
    const wood = root.getObjectByName(`door_${side}_wood`)
    if (!handle?.isMesh || !wood?.isMesh) continue
    const clusters = strapClusters(handle)
    if (!clusters.length) continue
    const woodBox = new THREE.Box3().setFromObject(wood)
    wood.getWorldScale(_shadowScale)
    wood.getWorldQuaternion(_shadowQuat)
    const sx = Math.max(Math.abs(_shadowScale.x), 1e-6)
    const sy = Math.max(Math.abs(_shadowScale.y), 1e-6)
    clusters.forEach((cluster, index) => {
      const width = cluster.maxx - cluster.minx
      const height = cluster.maxy - cluster.miny
      _shadowCenter.set(
        (cluster.minx + cluster.maxx) / 2 - 0.011,
        (cluster.miny + cluster.maxy) / 2 - 0.016,
        woodBox.max.z + 0.0022,
      )
      wood.worldToLocal(_shadowCenter)
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry((width * 2.15) / sx, (height * 1.12) / sy),
        new THREE.MeshBasicMaterial({
          map: getStrapShadowMap(),
          color: '#120c09',
          transparent: true,
          opacity: 0.82,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
      )
      plane.name = `__handle_shadow_${side}_${index}`
      plane.position.copy(_shadowCenter)
      plane.quaternion.copy(_shadowQuat).invert()
      plane.renderOrder = 4
      plane.castShadow = false
      plane.receiveShadow = false
      plane.raycast = () => null
      wood.add(plane)
      added += 1
    })
  }
  return added
}

function findBerestaNear(mesh) {
  let scope = mesh.parent
  while (scope) {
    const l = scope.getObjectByName('Beresta_L')
    const r = scope.getObjectByName('Beresta_R')
    if (l?.isMesh || r?.isMesh) {
      if (l?.isMesh && r?.isMesh) {
        mesh.updateWorldMatrix(true, false)
        const cx = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld).x
        const lx = new THREE.Vector3().setFromMatrixPosition(l.matrixWorld).x
        const rx = new THREE.Vector3().setFromMatrixPosition(r.matrixWorld).x
        const pick = Math.abs(cx - lx) <= Math.abs(cx - rx) ? l : r
        // Если нашли скрытую door-бересту — ищем дальше у предка (facade)
        if (pick.visible) return pick
      } else {
        const only = l?.isMesh ? l : r
        if (only.visible) return only
      }
    }
    scope = scope.parent
  }
  return null
}

/**
 * Contact-decal НА плоскости бересты (не ребёнок ручки).
 * Root cause «игры 2000-х»: decal жил за geometry ручки → с фронтальной
 * камеры полностью закрыт, ручки «парят» без тени на круге.
 */
function ensureLeatherContactDecal(mesh, isRim) {
  const decalName = `__leather_contact_${mesh.uuid}`
  const staleOnMesh = mesh.getObjectByName('__leather_contact_shadow')
  if (staleOnMesh) {
    mesh.remove(staleOnMesh)
    staleOnMesh.geometry?.dispose?.()
    staleOnMesh.material?.dispose?.()
  }

  const beresta = findBerestaNear(mesh)
  const parent = beresta || mesh.parent || mesh
  if (parent.getObjectByName(decalName)) return

  mesh.updateWorldMatrix(true, false)
  if (beresta) beresta.updateWorldMatrix(true, false)

  const worldBox = new THREE.Box3().setFromObject(mesh)
  if (worldBox.isEmpty()) return
  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  worldBox.getCenter(center)
  worldBox.getSize(size)

  let faceZ = center.z - size.z * 0.5 - 0.002
  if (beresta) {
    const bBox = new THREE.Box3().setFromObject(beresta)
    if (!bBox.isEmpty()) faceZ = bBox.max.z + 0.0012
  }

  // Drop-shadow: смещение от key (справа-сверху → тень влево-вниз)
  if (!isRim) {
    center.x -= 0.01
    center.y -= 0.014
  }
  center.z = faceZ

  const local = parent.worldToLocal(center.clone())
  const parentScale = new THREE.Vector3()
  parent.getWorldScale(parentScale)
  const sx = Math.max(size.x / Math.max(Math.abs(parentScale.x), 1e-6), 0.02)
  const sy = Math.max(size.y / Math.max(Math.abs(parentScale.y), 1e-6), 0.02)

  const mat = new THREE.MeshBasicMaterial({
    map: getContactShadowMap(),
    color: '#000000',
    transparent: true,
    opacity: isRim ? 0.78 : 0.92,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  })
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(
      isRim ? sx * 1.2 : sx * 3.2,
      isRim ? sy * 1.2 : sy * 2.8,
    ),
    mat,
  )
  plane.name = decalName
  plane.position.copy(local)
  plane.renderOrder = 2
  plane.castShadow = false
  plane.receiveShadow = false
  plane.raycast = () => null
  parent.add(plane)
}

/**
 * Satin-кожа с крупным зерном. Принудительно поверх baked M_Leather_* из GLB.
 */
export function createLeatherMaterial(textures, kind = 'rim', name = 'M_Leather_Dark') {
  const isHandle = kind === 'handle'
  /** Крупнее tile — на ручке/ободке зерно читается как кожа, не «краска» */
  const repeat = isHandle ? [3.6, 2.6] : [5.2, 2.4]
  const mat = new THREE.MeshPhysicalMaterial({
    name,
    color: isHandle ? '#5a3424' : '#4a2a1c',
    map: cloneTiled(textures.map, repeat),
    roughnessMap: cloneTiled(textures.roughnessMap, repeat),
    normalMap: cloneTiled(textures.normalMap, repeat),
    normalScale: new THREE.Vector2(isHandle ? 2.8 : 3.0, isHandle ? 2.8 : 3.0),
    bumpMap: cloneTiled(textures.bumpMap, repeat),
    bumpScale: isHandle ? 0.11 : 0.12,
    metalness: 0,
    roughness: isHandle ? 0.58 : 0.62,
    envMapIntensity: isHandle ? 0.62 : 0.55,
    clearcoat: 0.06,
    clearcoatRoughness: 0.48,
    sheen: isHandle ? 0.62 : 0.55,
    sheenRoughness: 0.48,
    sheenColor: new THREE.Color('#b87048'),
    side: THREE.DoubleSide,
  })
  if ('specularIntensity' in mat) mat.specularIntensity = isHandle ? 0.62 : 0.55
  if ('specularColor' in mat) mat.specularColor.set('#e0c098')
  mat.userData.leatherApplyVersion = LEATHER_APPLY_VERSION
  return mat
}

function isLeatherAccentMesh(mesh) {
  const name = mesh.name || ''
  if (RIM_NAME_RE.test(name) || HANDLE_NAME_RE.test(name)) return true
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  return !!(mat?.name && LEATHER_MAT_RE.test(mat.name))
}

/**
 * Force-replace кожи на ободке/ручках (facade + door_*), включая baked M_Leather_*.
 * Root cause «ничего не меняется»: на экране был GLB M_Leather_Handle без normal,
 * а async apply не успевал / не перебивал baked материал заметно.
 */
/** Обод ящика: своя карта кожи, не плоский коричневый. Цвет белый — иначе фото кожи гаснет. */
export function applyDrawerLeatherRims(root, textures) {
  if (!root || !textures?.map) return 0
  const repeat = [10, 2.6]
  const map = cloneTiled(textures.map, repeat)
  const mat = new THREE.MeshPhysicalMaterial({
    name: 'M_Drawer_Leather',
    // Внутри шкафа прямого света нет: env даёт серый обод, без него — чёрная рамка.
    // Зерно кожи держит emissiveMap, env только на мягкий блик по ребру.
    color: '#6a3e28',
    map,
    roughnessMap: cloneTiled(textures.roughnessMap, repeat),
    roughness: 0.72,
    metalness: 0,
    normalMap: cloneTiled(textures.normalMap, repeat),
    normalScale: new THREE.Vector2(2.1, 2.1),
    bumpMap: cloneTiled(textures.bumpMap, repeat),
    bumpScale: 0.07,
    envMapIntensity: 0.12,
    specularColor: new THREE.Color('#4a2818'),
    specularIntensity: 0.35,
    lightMap: null,
    emissive: new THREE.Color('#5a301c'),
    emissiveMap: map,
    emissiveIntensity: 0.12,
    sheen: 0.28,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color('#4a2818'),
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })
  let applied = 0
  root.traverse((child) => {
    if (!child.isMesh || !/leather_rim/i.test(child.name || '')) return
    child.material = mat
    child.castShadow = true
    child.receiveShadow = true
    applied += 1
  })
  return applied
}

export function applyLeatherAccentMaterials(root, textures) {
  if (!root || !textures?.map) return 0
  if (!textures.normalMap) {
    console.warn('РУССО: leather normalMap missing — grain будет плоским')
  }

  const rimMat = createLeatherMaterial(textures, 'rim', 'M_Leather_Rim')
  const handleMat = createLeatherMaterial(textures, 'handle', 'M_Leather_Handle')
  let applied = 0

  root.traverse((child) => {
    if (!child.isMesh || !isLeatherAccentMesh(child)) return

    // Уже применили эту версию — всё равно обновляем mat/lift (идемпотентно)
    const prev = Array.isArray(child.material) ? child.material[0] : child.material

    ensureUv(child)
    const isRim = RIM_NAME_RE.test(child.name || '')
      || /^M_Leather_Rim$/i.test(prev?.name || '')
    child.material = isRim ? rimMat : handleMat
    // accent: handleShadow light только на LIGHT_LAYERS.accent
    child.layers.enable(LIGHT_LAYERS.accent)
    child.layers.enable(LIGHT_LAYERS.doors)
    child.castShadow = true
    child.receiveShadow = true

    // Ободок — локальный lift. Ручки: Group `ручка_*` сажаем через seatHandles
    // (у ремня mesh без имени, child.position.z ≠ world +Z из‑за rotation).
    if (isRim) {
      if (child.userData.leatherBaseZ == null) {
        child.userData.leatherBaseZ = child.position.z
      }
      child.position.z = child.userData.leatherBaseZ + 0.0035
      child.userData.leatherZLifted = true
    }
    applied += 1
  })

  seatHandlesOnBeresta(root)

  root.traverse((child) => {
    if (!child.isMesh || !isLeatherAccentMesh(child)) return
    if (child.visible) {
      const isRim = RIM_NAME_RE.test(child.name || '')
        || /^M_Leather_Rim$/i.test(
          (Array.isArray(child.material) ? child.material[0] : child.material)?.name || '',
        )
      ensureLeatherContactDecal(child, isRim)
    }
  })

  root.traverse((child) => {
    if (!child.isMesh) return
    if (/Beresta|node_0|Circle|BézierCircle|patina/i.test(child.name || '')) {
      child.receiveShadow = true
    }
  })

  return applied
}
