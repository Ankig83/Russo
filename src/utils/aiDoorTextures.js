import * as THREE from 'three'
import { findDoorPivotNode } from '../constants/shkafNodes'
import { CORPUS_PBR } from '../constants/studioScene'

const assetBase = import.meta.env.BASE_URL
/** bump при пересжатии / смене разрешения */
const AI_DOOR_TEX_VERSION = '4'

/** WebP ~3K — вместо PNG 4K (~46MB) и вместо doors-closed.glb (~90MB) */
export const AI_DOOR_BASECOLOR_URL = `${assetBase}textures/doors-ai/doors_ai_baseColor.webp?v=${AI_DOOR_TEX_VERSION}`
export const AI_DOOR_MR_URL = `${assetBase}textures/doors-ai/doors_ai_metallicRoughness.webp?v=${AI_DOOR_TEX_VERSION}`
export const AI_DOOR_NORMAL_URL = `${assetBase}textures/doors-ai/doors_ai_normal.webp?v=${AI_DOOR_TEX_VERSION}`

export const AI_DOOR_TEXTURE_URLS = [
  AI_DOOR_BASECOLOR_URL,
  AI_DOOR_MR_URL,
  AI_DOOR_NORMAL_URL,
]

/**
 * Планарный UV: локальные X/Y полотна → половина AI-атласа.
 * left: u∈[0,0.5], right: u∈[0.5,1].
 */
export const AI_DOOR_UV = {
  flipV: false,
}

export function configureAiDoorTexture(tex, colorSpace) {
  if (!tex) return tex
  tex.colorSpace = colorSpace
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.anisotropy = 8
  tex.flipY = false
  tex.needsUpdate = true
  return tex
}

/** Собирает { map, metalRoughnessMap, normalMap } из массива useLoader. */
export function packAiDoorTextures([map, metalRoughnessMap, normalMap]) {
  return {
    map: configureAiDoorTexture(map, THREE.SRGBColorSpace),
    metalRoughnessMap: configureAiDoorTexture(metalRoughnessMap, THREE.NoColorSpace),
    normalMap: configureAiDoorTexture(normalMap, THREE.NoColorSpace),
  }
}

function loadTexture(loader, url, colorSpace) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => resolve(configureAiDoorTexture(tex, colorSpace)),
      undefined,
      reject,
    )
  })
}

/** Fallback, если useLoader недоступен */
export function loadAiDoorTextures() {
  const loader = new THREE.TextureLoader()
  return Promise.all([
    loadTexture(loader, AI_DOOR_BASECOLOR_URL, THREE.SRGBColorSpace),
    loadTexture(loader, AI_DOOR_MR_URL, THREE.NoColorSpace),
    loadTexture(loader, AI_DOOR_NORMAL_URL, THREE.NoColorSpace),
  ]).then(([map, metalRoughnessMap, normalMap]) => ({
    map,
    metalRoughnessMap,
    normalMap,
  }))
}

function applyPlanarFacadeUv(mesh, side) {
  const geo = mesh.geometry
  const pos = geo.attributes.position
  if (!pos) return

  geo.computeBoundingBox()
  const box = geo.boundingBox
  const minX = box.min.x
  const maxX = box.max.x
  const minY = box.min.y
  const maxY = box.max.y
  const spanX = Math.max(maxX - minX, 1e-6)
  const spanY = Math.max(maxY - minY, 1e-6)
  const flipV = AI_DOOR_UV.flipV

  const uvs = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const nx = (x - minX) / spanX
    const ny = (y - minY) / spanY
    const u = side === 'left' ? nx * 0.5 : 0.5 + nx * 0.5
    const v = flipV ? 1 - ny : ny
    uvs[i * 2] = u
    uvs[i * 2 + 1] = v
  }

  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  if (geo.attributes.uv1) {
    geo.setAttribute('uv1', new THREE.BufferAttribute(uvs.slice(), 2))
  }
  if (geo.attributes.uv2) {
    geo.setAttribute('uv2', new THREE.BufferAttribute(uvs.slice(), 2))
  }
}

function createAiDoorFrontMaterial(textures, name) {
  return new THREE.MeshPhysicalMaterial({
    name,
    map: textures.map,
    metalnessMap: textures.metalRoughnessMap,
    roughnessMap: textures.metalRoughnessMap,
    normalMap: textures.normalMap,
    metalness: 1,
    roughness: 1,
    envMapIntensity: 0.45,
    clearcoat: 0.12,
    clearcoatRoughness: 0.45,
    side: THREE.FrontSide,
  })
}

/** Изнанка створки — простая тёмная медь (как корпус). */
export function createInnerDoorDarkCopperMaterial(name = 'M_Door_Inner_Copper') {
  const p = CORPUS_PBR.plainDarkCopper
  const mat = new THREE.MeshPhysicalMaterial({
    name,
    color: p.color,
    metalness: p.metalness,
    roughness: p.roughness,
    envMapIntensity: p.env ?? 0.26,
    side: THREE.BackSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })
  if ('specularIntensity' in mat) mat.specularIntensity = p.specular ?? 0.07
  return mat
}

function applyInnerCopperBackfaces(door, sharedInnerMat) {
  const suffix = '__inner_copper_backface'
  let found = 0
  door.traverse((child) => {
    if (!child.isMesh) return
    if (!String(child.name).includes(suffix)) return
    child.material = sharedInnerMat
    child.material.needsUpdate = true
    found += 1
  })

  if (found === 0 && door.isMesh) {
    const inner = new THREE.Mesh(door.geometry, sharedInnerMat)
    inner.name = `${door.name}${suffix}_0`
    inner.raycast = () => null
    inner.castShadow = false
    inner.receiveShadow = true
    inner.renderOrder = 1
    inner.visible = false
    door.add(inner)
  }
}

/**
 * Достаёт PBR-карты с уже загруженного AI-фасада (M_ClosedDoors_AI / Material.002).
 * Без повторной загрузки doors-ai/* — те же GPU-текстуры, что на закрытых дверках.
 */
export function extractAiDoorTexturesFromFacade(facade) {
  if (!facade) return null
  let sourceMat = null
  facade.traverse((child) => {
    if (sourceMat || !child.isMesh || !child.material) return
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    for (const mat of mats) {
      if (!mat?.map) continue
      if (mat.name === 'M_ClosedDoors_AI' || mat.name === 'Material.002' || child.name === 'node_0') {
        sourceMat = mat
        break
      }
    }
  })
  if (!sourceMat?.map) return null
  return {
    map: sourceMat.map,
    metalRoughnessMap: sourceMat.metalnessMap || sourceMat.roughnessMap || null,
    normalMap: sourceMat.normalMap || null,
  }
}

/**
 * AI PBR на лице door_left / door_right (для open / анимации).
 * Берёста / ручки / карманы остаются отдельными мешами.
 */
export function applyAiDoorFacadeTextures(model, textures) {
  if (!model || !textures?.map) return 0
  let applied = 0
  const innerMat = createInnerDoorDarkCopperMaterial()

  ;(['left', 'right']).forEach((side) => {
    const door = findDoorPivotNode(model, side)
    if (!door?.isMesh) return

    applyPlanarFacadeUv(door, side)
    door.material = createAiDoorFrontMaterial(textures, `M_AiDoor_${side}`)
    door.castShadow = true
    door.receiveShadow = true
    applyInnerCopperBackfaces(door, innerMat)
    applied += 1
  })

  return applied
}
