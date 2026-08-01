import * as THREE from 'three'
import { GLB_LEG_NODES, SHKAF_ROOT_NAME } from '../constants/shkafNodes'
import { findByName } from './cabinetBounds'

const assetBase = import.meta.env.BASE_URL

export const BRONZE_BASECOLOR_URL = `${assetBase}textures/bronze/bronze_baseColor.jpg`
export const BRONZE_ROUGHNESS_URL = `${assetBase}textures/bronze/bronze_roughness.jpg`
export const BRONZE_METALLIC_URL = `${assetBase}textures/bronze/bronze_metallic.jpg`
export const BRONZE_NORMAL_URL = `${assetBase}textures/bronze/bronze_normal.png`
export const BRONZE_AO_URL = `${assetBase}textures/bronze/bronze_ao.jpg`
export const BRONZE_HEIGHT_URL = `${assetBase}textures/bronze/bronze_height.jpg`

/** Обод медальона вокруг берёсты (не ручки с Material.001) */
// matching via NFD strip in isBerestaRingMesh
const BRONZE_REPEAT_LEGS = [2.4, 2.4]
const BRONZE_REPEAT_RING = [1.8, 1.8]

function loadTexture(loader, url, colorSpace) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = colorSpace
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        tex.anisotropy = 8
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
  tex.needsUpdate = true
  return tex
}

export function loadBronzeTextures() {
  const loader = new THREE.TextureLoader()
  return Promise.all([
    loadTexture(loader, BRONZE_BASECOLOR_URL, THREE.SRGBColorSpace),
    loadTexture(loader, BRONZE_ROUGHNESS_URL, THREE.NoColorSpace),
    loadTexture(loader, BRONZE_METALLIC_URL, THREE.NoColorSpace),
    loadTexture(loader, BRONZE_NORMAL_URL, THREE.NoColorSpace),
    loadTexture(loader, BRONZE_AO_URL, THREE.NoColorSpace),
    loadTexture(loader, BRONZE_HEIGHT_URL, THREE.NoColorSpace),
  ]).then(([map, roughnessMap, metalnessMap, normalMap, aoMap, bumpMap]) => ({
    map,
    roughnessMap,
    metalnessMap,
    normalMap,
    aoMap,
    bumpMap,
  }))
}

function ensureUv2(mesh) {
  const geo = mesh.geometry
  if (!geo?.attributes?.uv) return
  if (!geo.attributes.uv2) geo.setAttribute('uv2', geo.attributes.uv)
}

function tuneBronzeMaterial(mat, textures, repeat) {
  if (!mat?.isMeshStandardMaterial && !mat?.isMeshPhysicalMaterial) return

  mat.map = cloneTiled(textures.map, repeat)
  mat.color.set('#ffffff')
  mat.roughnessMap = cloneTiled(textures.roughnessMap, repeat)
  mat.roughness = 1
  mat.metalnessMap = cloneTiled(textures.metalnessMap, repeat)
  mat.metalness = 1
  mat.normalMap = cloneTiled(textures.normalMap, repeat)
  mat.normalScale.set(0.55, 0.55)
  mat.aoMap = cloneTiled(textures.aoMap, repeat)
  mat.aoMapIntensity = 0.7
  mat.bumpMap = cloneTiled(textures.bumpMap, repeat)
  mat.bumpScale = 0.03

  mat.emissive.set('#000000')
  mat.emissiveIntensity = 0
  mat.transparent = false
  mat.opacity = 1
  mat.alphaMap = null
  mat.alphaTest = 0
  mat.depthWrite = true

  if ('envMapIntensity' in mat) mat.envMapIntensity = 0.22
  if ('specularIntensity' in mat) mat.specularIntensity = 0.12
  if ('specularColor' in mat) mat.specularColor.set('#e8c878')
  if ('clearcoat' in mat) mat.clearcoat = 0
  if ('clearcoatRoughness' in mat) mat.clearcoatRoughness = 1
  if ('sheen' in mat) mat.sheen = 0
  if ('transmission' in mat) mat.transmission = 0

  mat.needsUpdate = true
}

export function createBronzeMaterial(textures, repeat, name = 'M_Bronze_PBR') {
  const mat = new THREE.MeshPhysicalMaterial({
    name,
    side: THREE.DoubleSide,
    transparent: false,
    opacity: 1,
    depthWrite: true,
  })
  tuneBronzeMaterial(mat, textures, repeat)
  return mat
}

function isBerestaRingMesh(mesh) {
  const ascii = (mesh.name ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
  return /^(beziercircle|circle)(\.\d+)?$/.test(ascii)
}

/** Бронза на обод вокруг берёсты (BézierCircle / Circle*) */
export function applyBronzeBerestaRingMaterials(root, textures) {
  const shared = createBronzeMaterial(textures, BRONZE_REPEAT_RING, 'M_Bronze_BerestaRing')
  let applied = 0
  root.traverse((child) => {
    if (!child.isMesh || !isBerestaRingMesh(child)) return
    child.material = shared
    child.visible = true
    ensureUv2(child)
    applied += 1
  })
  return applied
}

/** Бронза на ножки leg_front_o / leg_letter_o */
export function applyBronzeLegMaterials(root, textures) {
  const shkafRoot = findByName(root, SHKAF_ROOT_NAME) ?? root
  const shared = createBronzeMaterial(textures, BRONZE_REPEAT_LEGS, 'M_Bronze_Legs')
  let applied = 0
  GLB_LEG_NODES.forEach((name) => {
    const leg = shkafRoot.getObjectByName(name)
    if (!leg) return
    leg.traverse((child) => {
      if (!child.isMesh) return
      child.material = shared
      child.castShadow = true
      child.receiveShadow = true
      ensureUv2(child)
      applied += 1
    })
  })
  return applied
}

/** Только ножки; обод берёсты остаётся на Material.001 из GLB */
export function applyBronzeMetalMaterials(root, textures) {
  const legs = applyBronzeLegMaterials(root, textures)
  return { rings: 0, legs }
}
