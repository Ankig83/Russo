import * as THREE from 'three'
import { LIGHT_LAYERS } from '../constants/studioScene'

const assetBase = import.meta.env.BASE_URL
const LEATHER_TEX_VERSION = '3'

export const LEATHER_BASECOLOR_URL = `${assetBase}textures/leather/baseColor-cinema-v2.webp?v=${LEATHER_TEX_VERSION}`
export const LEATHER_ROUGHNESS_URL = `${assetBase}textures/leather/roughness.webp?v=${LEATHER_TEX_VERSION}`
/** Реальная grayscale height-карта; подключается только как bumpMap. */
export const LEATHER_NORMAL_URL = `${assetBase}textures/leather/height-detail.webp?v=${LEATHER_TEX_VERSION}`

const RIM_NAME_RE = /кож_обод/i
const HANDLE_NAME_RE = /ручка/i

function loadTexture(loader, url, colorSpace) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = colorSpace
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        tex.anisotropy = 8
        tex.flipY = false
        tex.needsUpdate = true
        resolve(tex)
      },
      undefined,
      reject,
    )
  })
}

function cloneTiled(src, repeat) {
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

export function loadLeatherTextures() {
  const loader = new THREE.TextureLoader()
  return Promise.all([
    loadTexture(loader, LEATHER_BASECOLOR_URL, THREE.SRGBColorSpace),
    loadTexture(loader, LEATHER_ROUGHNESS_URL, THREE.NoColorSpace),
    loadTexture(loader, LEATHER_NORMAL_URL, THREE.NoColorSpace),
  ]).then(([map, roughnessMap, normalMap]) => ({
    map,
    roughnessMap,
    normalMap,
  }))
}

function ensureUv(mesh) {
  const geo = mesh.geometry
  if (!geo?.attributes?.position) return

  // Ободок без UV в GLB; после reshape всегда пересобираем развёртку по кольцу
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

/**
 * Натуральная тёмная кожа — grain + roughness, без clearcoat «пластика».
 * kind: 'rim' | 'handle'
 */
export function createLeatherMaterial(textures, kind = 'rim', name = 'M_Leather_Dark') {
  const isHandle = kind === 'handle'
  // Плотнее тайл — зерно кожи читается на крупном плане ободка/ручек
  const repeat = isHandle ? [1.7, 1.25] : [2.6, 1.15]
  const mat = new THREE.MeshPhysicalMaterial({
    name,
    color: '#ffffff',
    map: cloneTiled(textures.map, repeat),
    roughnessMap: cloneTiled(textures.roughnessMap, repeat),
    // Исходная карта bump_reticular — grayscale height, а не tangent normal.
    // normalMap давал «пластиковые» неверные блики.
    bumpMap: cloneTiled(textures.normalMap, repeat),
    bumpScale: isHandle ? 0.055 : 0.062,
    metalness: 0,
    roughness: isHandle ? 0.84 : 0.88,
    envMapIntensity: isHandle ? 0.12 : 0.1,
    clearcoat: 0,
    sheen: isHandle ? 0.06 : 0.04,
    sheenRoughness: 0.94,
    sheenColor: new THREE.Color('#4d2d20'),
    side: THREE.DoubleSide,
  })
  if ('specularIntensity' in mat) mat.specularIntensity = isHandle ? 0.14 : 0.1
  if ('specularColor' in mat) mat.specularColor.set('#6b4b38')
  return mat
}

function isLeatherAccentMesh(mesh) {
  const name = mesh.name || ''
  return RIM_NAME_RE.test(name) || HANDLE_NAME_RE.test(name)
}

/**
 * Кожа на ободке медальона и ручках (дверные + AI-фасад).
 * Убирает плоский Material.001 / solid color → grain leather.
 */
export function applyLeatherAccentMaterials(root, textures) {
  if (!root || !textures?.map) return 0
  const rimMat = createLeatherMaterial(textures, 'rim', 'M_Leather_Rim')
  const handleMat = createLeatherMaterial(textures, 'handle', 'M_Leather_Handle')
  let applied = 0

  root.traverse((child) => {
    if (!child.isMesh || !isLeatherAccentMesh(child)) return
    ensureUv(child)
    const isRim = RIM_NAME_RE.test(child.name || '')
    child.material = isRim ? rimMat : handleMat
    // Кожа должна жить в общем свете дверей. Узкий accent делал её
    // отдельной «нарисованной» накладкой.
    child.layers.disable(LIGHT_LAYERS.accent)
    child.layers.enable(LIGHT_LAYERS.doors)
    child.castShadow = true
    child.receiveShadow = true
    applied += 1
  })

  return applied
}
