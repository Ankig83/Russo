import * as THREE from 'three'
import {
  DOOR_PANEL_NODES,
  PATINA_MATERIALS,
  PATINA_METALNESS,
  PATINA_NORMAL_SCALE,
  PATINA_ROUGHNESS,
} from '../constants/shkafNodes'
import { fixGltfTextureColorSpaces } from './gltfColorSpace'

const patinaNames = new Set(PATINA_MATERIALS)

function isPatinaMaterial(mat) {
  return mat?.name && patinaNames.has(mat.name)
}

function applyPatinaMaps(mat, patinaTex, useLeftNormal) {
  if (patinaTex?.diffuse) {
    mat.map = patinaTex.diffuse
    mat.map.colorSpace = THREE.SRGBColorSpace
    mat.color.set('#ffffff')
  }

  if (patinaTex?.metalness) {
    mat.metalnessMap = patinaTex.metalness
    mat.metalnessMap.colorSpace = THREE.NoColorSpace
  }

  const normalTex = useLeftNormal ? patinaTex?.normalLeft : patinaTex?.normal
  if (normalTex && PATINA_NORMAL_SCALE > 0) {
    mat.normalMap = normalTex
    mat.normalMap.colorSpace = THREE.NoColorSpace
    mat.normalScale = mat.normalScale ?? new THREE.Vector2(1, 1)
    mat.normalScale.set(PATINA_NORMAL_SCALE, PATINA_NORMAL_SCALE)
  } else {
    mat.normalMap = null
  }

  if (patinaTex?.roughness) {
    mat.roughnessMap = patinaTex.roughness
    mat.roughnessMap.colorSpace = THREE.NoColorSpace
    mat.roughness = PATINA_ROUGHNESS
  } else {
    mat.roughnessMap = null
    mat.roughness = 0.82
  }
}

function tuneDoorPanelMaterial(mat) {
  if (!mat.isMeshStandardMaterial && !mat.isMeshPhysicalMaterial) return

  mat.metalness = PATINA_METALNESS
  mat.emissive.set('#000000')
  mat.emissiveIntensity = 0

  if ('envMapIntensity' in mat) mat.envMapIntensity = 0.45
  if ('specularIntensity' in mat) mat.specularIntensity = 0.05
  if ('clearcoat' in mat) mat.clearcoat = 0
  if ('sheen' in mat) mat.sheen = 0

  mat.side = THREE.FrontSide
  mat.needsUpdate = true
}

/**
 * Патина только на mesh-панелях дверей.
 * Normal/roughness — из public/textures/patina/, не из GLB (избегаем sRGB-артефактов).
 */
export function applyDoorPanelPatinaFixups(root, patinaTex) {
  const panels = [
    { name: DOOR_PANEL_NODES.left, useLeftNormal: true },
    { name: DOOR_PANEL_NODES.right, useLeftNormal: false },
  ]

  panels.forEach(({ name, useLeftNormal }) => {
    const mesh = root.getObjectByName(name)
    if (!mesh?.isMesh || !mesh.material) return

    const src = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    if (!isPatinaMaterial(src)) return

    const mat = src.clone()
    applyPatinaMaps(mat, patinaTex, useLeftNormal)
    tuneDoorPanelMaterial(mat)
    mesh.material = mat
  })

  fixGltfTextureColorSpaces(root)
}
