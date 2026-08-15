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
