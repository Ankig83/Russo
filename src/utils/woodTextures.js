import * as THREE from 'three'

const assetBase = import.meta.env.BASE_URL

/** dark-wood-stain (Unity pack) → 2K web maps, OpenGL normal */
export const WOOD_BASECOLOR_URL = `${assetBase}textures/wood/dark-wood-stain_baseColor.jpg`
export const WOOD_ROUGHNESS_URL = `${assetBase}textures/wood/dark-wood-stain_roughness.jpg`
export const WOOD_NORMAL_URL = `${assetBase}textures/wood/dark-wood-stain_normal.png`
export const WOOD_AO_URL = `${assetBase}textures/wood/dark-wood-stain_ao.jpg`
export const WOOD_HEIGHT_URL = `${assetBase}textures/wood/dark-wood-stain_height.jpg`

/**
 * Материалы корпуса / панелей дверей / обивки ящиков.
 * НЕ: берёста, задняя стенка, латунь, заклёпки (Scratched copper), ножки.
 */
export const WOOD_CORPUS_MATERIALS = [
  'Material.002',
  'base_copper',
  'door_side',
  'door_side.001',
  'door_back',
  'door_back.001',
  'door_back.002',
  'patina_PBR',
  'berestf_insige_M.001',
]

/** Полотна-legacy в корне GLB — не используем (ломают композицию) */
export const WOOD_DOOR_PANEL_MESHES = []

/** @deprecated alias */
export const WOOD_DOOR_MATERIALS = WOOD_CORPUS_MATERIALS

const woodNames = new Set(WOOD_CORPUS_MATERIALS)
const doorPanelMeshNames = new Set(WOOD_DOOR_PANEL_MESHES)
const INSIDE_NAMES = new Set(['berestf_insige_M.001'])

/** Подсветка albedo — dark-stain иначе тонет в hero-свете без HDRI */
const WOOD_COLOR_TINT = '#c9b49b'
const WOOD_NORMAL_SCALE = 1.15
const WOOD_AO_INTENSITY = 0.45
const WOOD_BUMP_SCALE = 0.04
const WOOD_ENV = 0.16
/** Матовый воск вместо лака — боковина не должна ловить белый софтбокс. */
const WOOD_CLEARCOAT = 0.06
const WOOD_CLEARCOAT_ROUGHNESS = 0.82
const WOOD_SPECULAR = 0.16
const WOOD_ROUGHNESS = 0.88

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

export function loadWoodTextures() {
  const loader = new THREE.TextureLoader()
  return Promise.all([
    loadTexture(loader, WOOD_BASECOLOR_URL, THREE.SRGBColorSpace),
    loadTexture(loader, WOOD_ROUGHNESS_URL, THREE.NoColorSpace),
    loadTexture(loader, WOOD_NORMAL_URL, THREE.NoColorSpace),
    loadTexture(loader, WOOD_AO_URL, THREE.NoColorSpace),
    loadTexture(loader, WOOD_HEIGHT_URL, THREE.NoColorSpace),
  ]).then(([map, roughnessMap, normalMap, aoMap, bumpMap]) => ({
    map,
    roughnessMap,
    normalMap,
    aoMap,
    bumpMap,
  }))
}

function ensureUv2(mesh) {
  const geo = mesh.geometry
  if (!geo?.attributes?.uv) return
  if (!geo.attributes.uv2) {
    geo.setAttribute('uv2', geo.attributes.uv)
  }
}

export function ensureWoodUv2(mesh) {
  ensureUv2(mesh)
}

function tuneWoodMaterial(mat, textures, repeat) {
  if (!mat?.isMeshStandardMaterial && !mat?.isMeshPhysicalMaterial) return

  mat.map = cloneTiled(textures.map, repeat)
  mat.color.set(WOOD_COLOR_TINT)
  mat.roughnessMap = cloneTiled(textures.roughnessMap, repeat)
  mat.roughness = WOOD_ROUGHNESS
  mat.normalMap = cloneTiled(textures.normalMap, repeat)
  mat.normalScale.set(WOOD_NORMAL_SCALE, WOOD_NORMAL_SCALE)
  mat.aoMap = cloneTiled(textures.aoMap, repeat)
  mat.aoMapIntensity = WOOD_AO_INTENSITY
  mat.bumpMap = cloneTiled(textures.bumpMap, repeat)
  mat.bumpScale = WOOD_BUMP_SCALE

  mat.metalness = 0
  mat.metalnessMap = null
  mat.emissive.set('#000000')
  mat.emissiveIntensity = 0
  mat.transparent = false
  mat.opacity = 1
  mat.depthWrite = true
  mat.alphaTest = 0

  // Матовый лак: тонкая плёнка + мягкий блик, без «рояльного» глянца
  if ('clearcoat' in mat) mat.clearcoat = WOOD_CLEARCOAT
  if ('clearcoatRoughness' in mat) mat.clearcoatRoughness = WOOD_CLEARCOAT_ROUGHNESS
  if ('envMapIntensity' in mat) mat.envMapIntensity = WOOD_ENV
  if ('specularIntensity' in mat) mat.specularIntensity = WOOD_SPECULAR
  if ('sheen' in mat) {
    mat.sheen = 0.035
    mat.sheenRoughness = 0.9
    if ('sheenColor' in mat) mat.sheenColor.set('#d4c4a8')
  }
  if ('transmission' in mat) mat.transmission = 0

  mat.needsUpdate = true
}

function makeWoodMaterial(textures, repeat, name = 'M_Wood_Stain') {
  const mat = new THREE.MeshPhysicalMaterial({ name })
  tuneWoodMaterial(mat, textures, repeat)
  mat.side = THREE.DoubleSide
  return mat
}

/**
 * Внутренняя сторона — если понадобится отдельный backface.
 */
export function createInnerDoorWoodMaterial(textures, repeat = [1.6, 1.6]) {
  const mat = makeWoodMaterial(textures, repeat, 'M_Wood_Door_Inner')
  mat.side = THREE.BackSide
  mat.polygonOffset = true
  mat.polygonOffsetFactor = -1
  mat.polygonOffsetUnits = -1
  return mat
}

function isDoorPanelMesh(mesh) {
  return doorPanelMeshNames.has(mesh.name)
}

/**
 * dark-wood-stain на корпус + полотна дверей + обивка ящиков.
 */
export function applyWoodDoorMaterials(root, textures, repeat = [1.6, 1.6]) {
  let applied = 0
  const doorPanelMat = makeWoodMaterial(textures, [1.5, 1.5], 'M_Wood_Door_Panel')

  root.traverse((child) => {
    if (!child.isMesh) return
    if (String(child.name).includes('__inner_copper_backface')) return

    // Полотна дверей (часто без материала в GLB)
    if (isDoorPanelMesh(child)) {
      child.material = doorPanelMat
      child.visible = true
      child.castShadow = true
      child.receiveShadow = true
      ensureUv2(child)
      applied += 1
      return
    }

    if (!child.material) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    let touched = false
    materials.forEach((mat) => {
      if (!mat?.name || !woodNames.has(mat.name)) return
      const tile = INSIDE_NAMES.has(mat.name) ? [1.3, 1.3] : repeat
      tuneWoodMaterial(mat, textures, tile)
      // Полотно двери: обе стороны (открытые двери смотрят изнанкой в камеру)
      if (mat.name === 'patina_PBR') mat.side = THREE.DoubleSide
      if (mat.name === 'Material.002') mat.side = THREE.DoubleSide
      touched = true
      applied += 1
    })
    if (touched) ensureUv2(child)
  })
  return applied
}

/** @deprecated alias */
export const applyWoodCorpusMaterials = applyWoodDoorMaterials
