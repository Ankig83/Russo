import * as THREE from 'three'
import {
  BERESTA_MATERIALS,
  BERESTA_MATERIAL_PROFILES,
  BRASS_HANDLE_MATERIALS,
  DOOR_PANEL_NODES,
  PATINA_MATERIALS,
  PATINA_METALNESS,
  PATINA_NORMAL_SCALE,
  PATINA_ROUGHNESS,
  PLAIN_COPPER_MATERIALS,
  PLAIN_DARK_COPPER_MATERIALS,
  DOOR_PANEL_SURFACE_MATERIALS,
  PLAQUE_MATERIALS,
  BODY_SHELL_MATERIALS,
  CORPUS_REFLECTIVE_MATERIALS,
} from '../constants/shkafNodes'
import { fixGltfTextureColorSpaces } from './gltfColorSpace'
import { assignShkafLightLayers } from './shkafLightLayers'
import {
  MATERIAL_ENV_INTENSITY,
  MATERIAL_SPECULAR_CAP,
  CORPUS_PBR,
  BERESTA_PBR,
  USE_MATERIAL_FIXUPS,
  getEffectiveSplitCorpusLight,
} from '../constants/studioScene'

/** Мин. roughness без roughnessMap — патина/медь */
const PATINA_MIN_ROUGHNESS = 0.25
const PLAIN_COPPER_MIN_ROUGHNESS = 0.25
const berestaNames = new Set(BERESTA_MATERIALS)
const corpusReflectiveNames = new Set(CORPUS_REFLECTIVE_MATERIALS)
const patinaNames = new Set(PATINA_MATERIALS)
const bodyShellNames = new Set(BODY_SHELL_MATERIALS)
const plainCopperNames = new Set(PLAIN_COPPER_MATERIALS)
const plainDarkCopperNames = new Set(PLAIN_DARK_COPPER_MATERIALS)
const doorPanelNames = new Set(DOOR_PANEL_SURFACE_MATERIALS)
const brassHandleNames = new Set(BRASS_HANDLE_MATERIALS)
const plaqueNames = new Set(PLAQUE_MATERIALS)
const rimAndHandleHighlightNames = new Set(['Material.001', 'Материал.003'])

const warnedRoughness = new Set()

function warnMissingRoughnessMap(mat, meshName) {
  if (mat.roughnessMap) return

  const corpusLike =
    corpusReflectiveNames.has(mat.name) ||
    brassHandleNames.has(mat.name) ||
    plainCopperNames.has(mat.name)

  if (!corpusLike) return

  const key = `${mat.name}|${meshName}`
  if (warnedRoughness.has(key)) return
  warnedRoughness.add(key)

  console.warn(
    `РУССО: material "${mat.name}" mesh "${meshName}" — нет roughnessMap, roughness=${(mat.roughness ?? 0).toFixed(2)}`,
  )
}

function clampRoughnessWithoutMap(mat, meshName, minRoughness) {
  if (mat.roughnessMap) return
  if ((mat.roughness ?? 1) >= minRoughness) return

  console.warn(
    `РУССО: material "${mat.name}" mesh "${meshName}" — roughness ${(mat.roughness ?? 0).toFixed(2)} < ${minRoughness}, clamp`,
  )
  mat.roughness = minRoughness
}

export function validateMaterialRoughness(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((mat) => {
      if (!mat?.name) return
      warnMissingRoughnessMap(mat, child.name || child.uuid)

      if (patinaNames.has(mat.name)) clampRoughnessWithoutMap(mat, child.name, PATINA_MIN_ROUGHNESS)
      else if (plainCopperNames.has(mat.name) || mat.name === 'base_copper') {
        clampRoughnessWithoutMap(mat, child.name, PLAIN_COPPER_MIN_ROUGHNESS)
      } else if (brassHandleNames.has(mat.name)) {
        clampRoughnessWithoutMap(mat, child.name, 0.15)
      } else if (bodyShellNames.has(mat.name)) {
        clampRoughnessWithoutMap(mat, child.name, 0.35)
      }
    })
  })
}

export function isBerestaMaterial(mat) {
  return mat?.name && berestaNames.has(mat.name)
}

function isPlainCopperMaterial(mat) {
  return mat?.name && plainCopperNames.has(mat.name)
}

function isBrassHandleMaterial(mat) {
  return mat?.name && brassHandleNames.has(mat.name)
}

function isPlaqueMaterial(mat) {
  return mat?.name && plaqueNames.has(mat.name)
}

/** Делим только одинаковые mat.name (Beresta_L + Beresta_R), не все бересты сразу */
function shareBerestaMaterialsByName(root) {
  const byName = new Map()

  root.traverse((child) => {
    if (!child.isMesh || !child.material) return

    const pick = (mat) => {
      if (!isBerestaMaterial(mat)) return mat
      if (!byName.has(mat.name)) byName.set(mat.name, mat)
      return byName.get(mat.name)
    }

    if (Array.isArray(child.material)) {
      child.material = child.material.map(pick)
      return
    }

    child.material = pick(child.material)
  })
}

function applyMapRepeat(map, repeat) {
  if (!map || !repeat) return map
  const tex = map.clone()
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat[0], repeat[1])
  tex.needsUpdate = true
  return tex
}

function applyBerestaEnv(mat) {
  const env = MATERIAL_ENV_INTENSITY[mat.name] ?? BERESTA_PBR.env
  if ('envMapIntensity' in mat) mat.envMapIntensity = env
  if ('specularIntensity' in mat) mat.specularIntensity = BERESTA_PBR.specular
  if ('sheen' in mat) mat.sheen = 0
}

/** Круги на дверях — береста_темная, bump + normal из GLB */
function tuneBerestaDoorMaterial(mat, profile) {
  if (!mat.isMeshStandardMaterial && !mat.isMeshPhysicalMaterial) return

  const albedo = mat.map
  const normal = mat.normalMap
  const roughnessSrc = mat.roughnessMap

  mat.metalness = 0
  mat.metalnessMap = null
  mat.emissive.set('#000000')
  mat.emissiveIntensity = 0
  mat.transparent = false
  mat.opacity = 1
  if ('clearcoat' in mat) mat.clearcoat = 0
  if ('transmission' in mat) mat.transmission = 0
  if ('ior' in mat) mat.ior = 1.45
  if ('sheen' in mat) mat.sheen = 0

  if (albedo) {
    mat.color.set(BERESTA_PBR.color)
    mat.map = applyMapRepeat(albedo, profile.repeat) ?? albedo
    mat.bumpMap = cloneLinearFromMap(albedo)
    mat.bumpScale = profile.bumpScale ?? BERESTA_PBR.bumpScale
    mat.roughness = BERESTA_PBR.roughness
    if (profile.useRoughnessMap && roughnessSrc) {
      mat.roughnessMap = cloneLinearFromMap(roughnessSrc)
      mat.roughness = 1
    } else {
      mat.roughnessMap = null
    }
  } else {
    mat.roughnessMap = null
    mat.roughness = 0.9
  }

  if (profile.useNormalMap && normal) {
    mat.normalMap = cloneLinearFromMap(normal)
    const ns = profile.normalScale ?? BERESTA_PBR.normalScale ?? 1
    mat.normalScale.set(ns, ns)
  } else {
    mat.normalMap = null
  }

  if ('sheen' in mat) {
    mat.sheen = BERESTA_PBR.sheen ?? 0
    mat.sheenRoughness = BERESTA_PBR.sheenRoughness ?? 0.65
    if ('sheenColor' in mat) mat.sheenColor.set(BERESTA_PBR.sheenColor ?? '#e8c078')
  }

  boostTextureDetail(mat, 16)
  applyBerestaEnv(mat)
  mat.needsUpdate = true
}

/** Beck_W, внутренности ящиков — своя albedo из GLB, UV не трогаем */
function tuneBerestaSurfaceMaterial(mat, profile) {
  if (!mat.isMeshStandardMaterial && !mat.isMeshPhysicalMaterial) return

  mat.metalness = 0
  mat.metalnessMap = null
  mat.normalMap = null
  mat.roughnessMap = null
  mat.bumpMap = null
  mat.emissive.set('#000000')
  mat.emissiveIntensity = 0
  mat.transparent = false
  mat.opacity = 1
  if ('clearcoat' in mat) mat.clearcoat = 0
  if ('transmission' in mat) mat.transmission = 0
  if ('ior' in mat) mat.ior = 1.45
  if ('sheen' in mat) mat.sheen = 0

  if (mat.map) {
    mat.color.set('#ffffff')
    mat.map = applyMapRepeat(mat.map, profile.repeat) ?? mat.map
  }

  mat.roughness = profile.roughness ?? BERESTA_PBR.roughness
  applyBerestaEnv(mat)
  mat.needsUpdate = true
}

function tuneBerestaMaterialByProfile(mat) {
  const profile = BERESTA_MATERIAL_PROFILES[mat.name]
  if (!profile) return
  if (profile.kind === 'door') tuneBerestaDoorMaterial(mat, profile)
  else tuneBerestaSurfaceMaterial(mat, profile)
}

/**
 * @deprecated используй shareBerestaMaterialsByName
 */
export function shareBerestaMaterials(root) {
  shareBerestaMaterialsByName(root)
}

function cloneLinearFromMap(map) {
  if (!map) return null
  const tex = map.clone()
  tex.colorSpace = THREE.NoColorSpace
  return tex
}

function boostTextureDetail(mat, anisotropy = 16) {
  ;['map', 'normalMap', 'bumpMap', 'roughnessMap', 'metalnessMap'].forEach((slot) => {
    const tex = mat[slot]
    if (!tex) return
    tex.anisotropy = Math.max(tex.anisotropy ?? 0, anisotropy)
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.needsUpdate = true
  })
}

function isMedallionLeatherRimMesh(meshName = '') {
  return /circle/i.test(meshName)
}

function isMedallionLeatherHandleMesh(meshName = '') {
  return /ручка/i.test(meshName)
}

/** Патина — только панели дверей (delit + metallic v2, без normal/ORM из GLB) */
function tuneDoorPatinaMaterial(mat) {
  if (!mat.isMeshStandardMaterial && !mat.isMeshPhysicalMaterial) return

  if (mat.map) mat.color.set('#ffffff')

  mat.metalness = PATINA_METALNESS
  mat.normalMap = null
  mat.roughnessMap = null
  mat.roughness = PATINA_ROUGHNESS

  mat.emissive.set('#000000')
  mat.emissiveIntensity = 0

  if ('envMapIntensity' in mat) mat.envMapIntensity = 0.45
  if ('specularIntensity' in mat) mat.specularIntensity = 0.05
  if ('clearcoat' in mat) mat.clearcoat = 0
  if ('sheen' in mat) mat.sheen = 0

  mat.side = THREE.FrontSide
  mat.needsUpdate = true
}

export function applyDoorPatinaMaterialFixups(root) {
  Object.values(DOOR_PANEL_NODES).forEach((panelName) => {
    const mesh = root.getObjectByName(panelName)
    if (!mesh?.isMesh || !mesh.material) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    materials.forEach(tuneDoorPatinaMaterial)
  })
}

/** Ручки — полированная латунь, читаемый блеск как на рефе */
function tuneBrassHandleMaterial(mat, meshName = '') {
  if (!mat.isMeshStandardMaterial && !mat.isMeshPhysicalMaterial) return

  warnMissingRoughnessMap(mat, meshName)

  mat.color.set('#c9a24a')
  mat.metalness = 0.9
  mat.roughness = mat.roughnessMap ? 1.0 : 0.24
  mat.metalnessMap = null

  if ('envMapIntensity' in mat) mat.envMapIntensity = 1.1
  if ('specularIntensity' in mat) mat.specularIntensity = 0.16
  if ('specularColor' in mat) mat.specularColor.set('#e8c878')
  if ('clearcoat' in mat) mat.clearcoat = 0.14
  if ('clearcoatRoughness' in mat) mat.clearcoatRoughness = 0.42
  if ('sheen' in mat) mat.sheen = 0

  clampRoughnessWithoutMap(mat, meshName, 0.15)
  boostTextureDetail(mat, 12)
  mat.needsUpdate = true
}

/**
 * Натуральная кожа: сохраняем цветовую карту почти без затемняющего tint,
 * смягчаем normal и возвращаем широкий, приглушённый блик вместо пластика.
 */
function tuneMedallionRimLeatherMaterial(mat) {
  if (!mat.isMeshStandardMaterial && !mat.isMeshPhysicalMaterial) return

  if (mat.map) {
    mat.color.set('#bda58f')
    mat.map = mat.map.clone()
    mat.map.colorSpace = THREE.SRGBColorSpace
  } else {
    mat.color.set('#4b3022')
  }

  if (mat.normalMap) {
    mat.normalMap = cloneLinearFromMap(mat.normalMap)
    mat.normalScale.set(0.48, 0.48)
  }

  mat.metalness = 0
  mat.metalnessMap = null
  mat.roughnessMap = null
  mat.roughness = 0.72
  mat.emissive.set('#000000')
  mat.emissiveIntensity = 0
  mat.transparent = false
  mat.opacity = 1
  mat.alphaMap = null

  if ('ior' in mat) mat.ior = 1.46
  if ('envMapIntensity' in mat) mat.envMapIntensity = 0.24
  if ('specularIntensity' in mat) mat.specularIntensity = 0.26
  if ('specularColor' in mat) mat.specularColor.set('#8a6a55')
  if ('clearcoat' in mat) mat.clearcoat = 0.015
  if ('clearcoatRoughness' in mat) mat.clearcoatRoughness = 0.82
  if ('sheen' in mat) {
    mat.sheen = 0.18
    mat.sheenRoughness = 0.84
    mat.sheenColor.set('#6f4934')
  }

  boostTextureDetail(mat, 16)
  mat.needsUpdate = true
}

/** Ручки — слегка отполированная прикосновениями кожа, но без лакированного блеска. */
function tuneMedallionHandleLeatherMaterial(mat) {
  if (!mat.isMeshStandardMaterial && !mat.isMeshPhysicalMaterial) return

  if (mat.map) {
    mat.color.set('#cbb096')
    mat.map = mat.map.clone()
    mat.map.colorSpace = THREE.SRGBColorSpace
  } else {
    mat.color.set('#62412d')
  }

  if (mat.normalMap) {
    mat.normalMap = cloneLinearFromMap(mat.normalMap)
    mat.normalScale.set(0.56, 0.56)
  }

  mat.metalness = 0
  mat.metalnessMap = null
  mat.roughnessMap = null
  mat.roughness = 0.66
  mat.emissive.set('#000000')
  mat.emissiveIntensity = 0
  mat.transparent = false
  mat.opacity = 1
  mat.alphaMap = null

  if ('ior' in mat) mat.ior = 1.46
  if ('envMapIntensity' in mat) mat.envMapIntensity = 0.28
  if ('specularIntensity' in mat) mat.specularIntensity = 0.3
  if ('specularColor' in mat) mat.specularColor.set('#96745d')
  if ('clearcoat' in mat) mat.clearcoat = 0.02
  if ('clearcoatRoughness' in mat) mat.clearcoatRoughness = 0.76
  if ('sheen' in mat) {
    mat.sheen = 0.22
    mat.sheenRoughness = 0.78
    mat.sheenColor.set('#80543a')
  }

  boostTextureDetail(mat, 16)
  mat.needsUpdate = true
}

/** Ободок медальона и чёрные кривые ручек — мягкий тёплый объём без белых полос. */
function tuneRimAndHandleHighlightMaterial(mat, meshName = '') {
  if (!mat.isMeshStandardMaterial && !mat.isMeshPhysicalMaterial) return

  if (mat.name === 'Материал.003') {
    mat.color.set('#513628')
    mat.metalness = 0
    mat.metalnessMap = null
    mat.roughnessMap = null
    mat.normalMap = null
    mat.roughness = 0.7
    mat.emissive.set('#000000')
    mat.emissiveIntensity = 0
    if ('ior' in mat) mat.ior = 1.46
    if ('envMapIntensity' in mat) mat.envMapIntensity = 0.22
    if ('specularIntensity' in mat) mat.specularIntensity = 0.24
    if ('specularColor' in mat) mat.specularColor.set('#876651')
    if ('clearcoat' in mat) mat.clearcoat = 0
    if ('sheen' in mat) {
      mat.sheen = 0.16
      mat.sheenRoughness = 0.84
      mat.sheenColor.set('#684533')
    }
    mat.needsUpdate = true
    return
  }

  if (isMedallionLeatherRimMesh(meshName)) {
    tuneMedallionRimLeatherMaterial(mat)
    return
  }

  if (isMedallionLeatherHandleMesh(meshName)) {
    tuneMedallionHandleLeatherMaterial(mat)
    return
  }

  tuneMedallionRimLeatherMaterial(mat)
}

function isRimOrHandleHighlightMaterial(mat) {
  return mat?.name && rimAndHandleHighlightNames.has(mat.name)
}

function applyRimAndHandleHighlightFixups(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((mat, slot) => {
      if (!isRimOrHandleHighlightMaterial(mat)) return
      const needsClone =
        isMedallionLeatherRimMesh(child.name) || isMedallionLeatherHandleMesh(child.name)
      const tuned = needsClone ? mat.clone() : mat
      tuneRimAndHandleHighlightMaterial(tuned, child.name)
      if (needsClone) {
        if (Array.isArray(child.material)) child.material[slot] = tuned
        else child.material = tuned
      }
    })
  })
}

/** door_side / door_back / base_copper — satin, roughnessMap из GLB сохраняем */
function tunePlainCopperMaterial(mat, meshName = '') {
  if (!mat.isMeshStandardMaterial && !mat.isMeshPhysicalMaterial) return

  const p = CORPUS_PBR.baseCopper

  warnMissingRoughnessMap(mat, meshName)
  mat.metalnessMap = null
  mat.emissive.set('#000000')
  mat.emissiveIntensity = 0
  if ('sheen' in mat) mat.sheen = 0
  if ('clearcoat' in mat) mat.clearcoat = 0

  mat.metalness = Math.min(mat.metalness ?? 1, p.metalness)
  if (mat.roughnessMap) {
    mat.roughness = 1.0
  } else {
    mat.roughness = Math.max(mat.roughness ?? 0, p.roughness, PLAIN_COPPER_MIN_ROUGHNESS)
  }

  if (!mat.map) mat.color.set(p.color)
  if ('envMapIntensity' in mat) mat.envMapIntensity = p.env
  if ('specularIntensity' in mat) {
    mat.specularIntensity = Math.min(p.specular, MATERIAL_SPECULAR_CAP)
  }
  if ('specularColor' in mat) mat.specularColor.setScalar(0.35)

  clampRoughnessWithoutMap(mat, meshName, PLAIN_COPPER_MIN_ROUGHNESS)
  mat.needsUpdate = true
}

export function applyPlainCopperMaterialFixups(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((mat) => {
      if (!mat?.name) return
      if (mat.name === 'base_copper' || isPlainCopperMaterial(mat)) {
        tunePlainCopperMaterial(mat, child.name)
      }
    })
  })
}

/** Корпус shkaf (Material.002) и ножки (Material.004) — простая тёмная медь */
function tunePlainDarkCopperMaterial(mat) {
  if (!mat.isMeshStandardMaterial && !mat.isMeshPhysicalMaterial) return

  const p = CORPUS_PBR.plainDarkCopper

  // Плоская медь без текстур
  mat.map = null
  mat.metalnessMap = null
  mat.roughnessMap = null
  mat.normalMap = null
  mat.aoMap = null
  mat.bumpMap = null

  mat.color.set(p.color)
  mat.metalness = p.metalness
  mat.roughness = p.roughness

  mat.emissive.set('#000000')
  mat.emissiveIntensity = 0

  if ('envMapIntensity' in mat) mat.envMapIntensity = p.env
  if ('specularIntensity' in mat) {
    mat.specularIntensity = Math.min(p.specular, MATERIAL_SPECULAR_CAP)
  }
  if ('clearcoat' in mat) mat.clearcoat = 0
  if ('sheen' in mat) mat.sheen = 0

  mat.needsUpdate = true
}

export function applyPlainDarkCopperMaterialFixups(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((mat) => {
      if (mat?.name && plainDarkCopperNames.has(mat.name)) {
        tunePlainDarkCopperMaterial(mat)
      }
    })
  })
}

/**
 * Панель двери (patina_PBR) — гладкий матовый премиум как в референсе.
 * Снимаем relief-карты (normal/bump/roughnessMap) — источник зерна, свет ложится ровно.
 * Берёста и круг (M_Beresta_Final.001) НЕ затрагиваются — это отдельный материал.
 */
function tuneDoorPanelMaterial(mat) {
  if (!mat.isMeshStandardMaterial && !mat.isMeshPhysicalMaterial) return

  const p = CORPUS_PBR.doorPanel

  mat.normalMap = null
  mat.bumpMap = null
  mat.roughnessMap = null
  mat.metalnessMap = null
  mat.aoMap = null

  mat.emissive.set('#000000')
  mat.emissiveIntensity = 0

  if (p.useAlbedo && mat.map) {
    mat.color.set('#ffffff')
  } else {
    mat.map = null
    mat.color.set(p.color)
  }

  mat.metalness = p.metalness
  mat.roughness = p.roughness

  if ('envMapIntensity' in mat) mat.envMapIntensity = p.env
  if ('specularIntensity' in mat) {
    mat.specularIntensity = Math.min(p.specular, MATERIAL_SPECULAR_CAP)
  }
  if ('clearcoat' in mat) mat.clearcoat = 0
  if ('sheen' in mat) mat.sheen = 0

  mat.side = THREE.FrontSide
  mat.needsUpdate = true
}

export function applyDoorPanelMaterialFixups(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((mat) => {
      if (mat?.name && doorPanelNames.has(mat.name)) {
        tuneDoorPanelMaterial(mat)
      }
    })
  })
}

/** Таблички ящиков — читаемый текст, без сильных бликов */
function tunePlaqueMaterial(mat) {
  if (!mat.isMeshStandardMaterial && !mat.isMeshPhysicalMaterial) return

  if (mat.map) mat.color.set('#ffffff')

  mat.metalness = 0.15
  mat.roughness = 0.72
  mat.metalnessMap = null
  mat.roughnessMap = null
  mat.normalMap = null

  mat.emissive.set('#000000')
  mat.emissiveIntensity = 0

  if ('envMapIntensity' in mat) mat.envMapIntensity = 0.35
  if ('specularIntensity' in mat) mat.specularIntensity = 0.08

  mat.needsUpdate = true
}

export function applyBerestaMaterialFixups(root) {
  shareBerestaMaterialsByName(root)

  const tuned = new Set()
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((mat) => {
      if (!isBerestaMaterial(mat) || tuned.has(mat.uuid)) return
      tuned.add(mat.uuid)
      tuneBerestaMaterialByProfile(mat)
    })
  })
}

export function applyCopperMaterialFixups(root) {
  applyPlainCopperMaterialFixups(root)
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((mat) => {
      if (isPlaqueMaterial(mat)) tunePlaqueMaterial(mat)
      else if (isBrassHandleMaterial(mat)) tuneBrassHandleMaterial(mat, child.name)
      else if (isRimOrHandleHighlightMaterial(mat)) tuneRimAndHandleHighlightMaterial(mat)
    })
  })
}

/**
 * Патина на дверях — только снятие metalness/normal map, roughnessMap из GLB.
 */
function tuneRawPatinaMaterial(mat, meshName = '') {
  if (!mat.isMeshStandardMaterial && !mat.isMeshPhysicalMaterial) return

  warnMissingRoughnessMap(mat, meshName)
  mat.normalMap = null
  mat.metalnessMap = null
  mat.emissive.set('#000000')
  mat.emissiveIntensity = 0

  if (mat.map) mat.color.set('#ffffff')
  if ('sheen' in mat) mat.sheen = 0
  if ('clearcoat' in mat) mat.clearcoat = 0

  const p = CORPUS_PBR.patina
  mat.metalness = Math.min(mat.metalness ?? p.metalness, p.metalness)
  mat.roughness = mat.roughnessMap ? 1.0 : Math.max(p.roughness, PATINA_MIN_ROUGHNESS)
  if ('envMapIntensity' in mat) mat.envMapIntensity = p.env
  if ('specularIntensity' in mat) {
    mat.specularIntensity = Math.min(p.specular, MATERIAL_SPECULAR_CAP)
  }

  clampRoughnessWithoutMap(mat, meshName, PATINA_MIN_ROUGHNESS)
  mat.needsUpdate = true
}

/** Scratched copper metal — metal02, roughnessMap сохраняем */
function tuneRawBodyShellMaterial(mat, meshName = '') {
  if (!mat.isMeshStandardMaterial && !mat.isMeshPhysicalMaterial) return

  const p = CORPUS_PBR.bodyShell

  warnMissingRoughnessMap(mat, meshName)
  mat.normalMap = null
  mat.metalnessMap = null
  mat.emissive.set('#000000')
  mat.emissiveIntensity = 0
  if ('sheen' in mat) mat.sheen = 0
  if ('clearcoat' in mat) mat.clearcoat = 0

  if (mat.map) mat.color.set(p.colorTint ?? '#8a7058')

  mat.metalness = p.metalness
  mat.roughness = mat.roughnessMap ? 1.0 : p.roughness
  if ('envMapIntensity' in mat) mat.envMapIntensity = p.env
  if ('specularIntensity' in mat) {
    mat.specularIntensity = Math.min(p.specular, MATERIAL_SPECULAR_CAP)
  }
  if ('specularColor' in mat) mat.specularColor.setScalar(0.55)

  clampRoughnessWithoutMap(mat, meshName, 0.35)
  mat.needsUpdate = true
}

function tuneRawCorpusMaterial(mat, meshName = '') {
  if (patinaNames.has(mat.name)) tuneRawPatinaMaterial(mat, meshName)
  else if (bodyShellNames.has(mat.name)) tuneRawBodyShellMaterial(mat, meshName)
}

export function applyRawCorpusMaterialFixups(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((mat) => {
      if (!mat?.name || !corpusReflectiveNames.has(mat.name)) return
      tuneRawCorpusMaterial(mat, child.name)
    })
  })
}

/** @deprecated — используй applyRawCorpusMaterialFixups */
export function applyRawPatinaNormalFixups(root) {
  if (PATINA_NORMAL_SCALE > 0) return
  applyRawCorpusMaterialFixups(root)
}

/** Только envMap + cap specular — для USE_RAW_GLB_MATERIALS */
export function applyEnvMapIntensityFixups(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((mat) => {
      if (!mat?.isMeshStandardMaterial && !mat?.isMeshPhysicalMaterial) return
      if (corpusReflectiveNames.has(mat.name)) return

      const env =
        MATERIAL_ENV_INTENSITY[mat.name] ?? MATERIAL_ENV_INTENSITY.default
      if ('envMapIntensity' in mat) mat.envMapIntensity = env

      if ('specularIntensity' in mat) {
        mat.specularIntensity = Math.min(mat.specularIntensity, MATERIAL_SPECULAR_CAP)
      }

      mat.needsUpdate = true
    })
  })
}

export function applyRawMaterialPipeline(root) {
  fixGltfTextureColorSpaces(root)

  if (!USE_MATERIAL_FIXUPS) {
    if (getEffectiveSplitCorpusLight()) assignShkafLightLayers(root)
    return
  }

  applyEnvMapIntensityFixups(root)
  applyRawCorpusMaterialFixups(root)
  applyDoorPanelMaterialFixups(root)
  applyPlainCopperMaterialFixups(root)
  applyPlainDarkCopperMaterialFixups(root)
  applyRimAndHandleHighlightFixups(root)
  applyBerestaMaterialFixups(root)
  validateMaterialRoughness(root)
  if (getEffectiveSplitCorpusLight()) assignShkafLightLayers(root)
}

export function applyStudioMaterialFixups(root) {
  applyRawCorpusMaterialFixups(root)
  applyCopperMaterialFixups(root)
  applyPlainDarkCopperMaterialFixups(root)
  applyRimAndHandleHighlightFixups(root)
  applyBerestaMaterialFixups(root)
  applyDoorPatinaMaterialFixups(root)
  validateMaterialRoughness(root)
  fixGltfTextureColorSpaces(root)
}
