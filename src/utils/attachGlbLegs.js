import * as THREE from 'three'
import {
  GLB_LEG_NODES,
  GLB_LEG_TRANSFORMS,
  SHKAF_ROOT_NAME,
} from '../constants/shkafNodes'
import { findByName } from './cabinetBounds'

/** Карты корпуса дают ножкам мелкую фактуру, но цвет настраивается как отдельная латунь. */
const LEG_MATERIAL_REFERENCE_ORDER = [
  'Scratched copper metal',
  'Material.002',
]

const AGED_BRASS = {
  color: '#b89a55',
  metalness: 0.9,
  roughness: 0.42,
  envMapIntensity: 0.72,
  clearcoat: 0.04,
  clearcoatRoughness: 0.58,
}

function findCabinetReferenceMaterial(shkafRoot) {
  for (const materialName of LEG_MATERIAL_REFERENCE_ORDER) {
    let reference = null
    shkafRoot.traverse((child) => {
      if (reference || !child.isMesh || !child.material) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      const hit = materials.find((mat) => mat?.name === materialName)
      if (hit) reference = hit
    })
    if (reference) return reference
  }
  return null
}

/**
 * Состаренная латунь как в референсе:
 * тёплый золотисто-оливковый тон + roughness/normal фактура корпуса.
 * Alpha намеренно отключена — тонкая геометрия ножек остаётся целой.
 */
function prepareLegMaterial(reference) {
  const material = new THREE.MeshPhysicalMaterial({
    name: 'M_AgedBrass_Legs',
    color: AGED_BRASS.color,
    metalness: AGED_BRASS.metalness,
    roughness: AGED_BRASS.roughness,
    envMapIntensity: AGED_BRASS.envMapIntensity,
    clearcoat: AGED_BRASS.clearcoat,
    clearcoatRoughness: AGED_BRASS.clearcoatRoughness,
    side: THREE.DoubleSide,
    transparent: false,
    opacity: 1,
    alphaTest: 0,
    depthWrite: true,
  })

  // Цветовая карта добавляет естественную неоднородность и потемнение патины.
  material.map = reference.map ?? null
  material.roughnessMap = reference.roughnessMap ?? null
  material.normalMap = reference.normalMap ?? null
  material.aoMap = reference.aoMap ?? null
  material.bumpMap = reference.bumpMap ?? null
  material.alphaMap = null

  if (reference.normalScale && material.normalMap) {
    material.normalScale.copy(reference.normalScale).multiplyScalar(0.35)
  }
  if (reference.bumpScale != null && material.bumpMap) {
    material.bumpScale = Math.min(Math.abs(reference.bumpScale), 0.08)
  }

  material.needsUpdate = true
  return material
}

/** Применяет состаренную латунь ко всем mesh ножек. */
export function syncLegMaterialsFromCabinet(model) {
  const shkafRoot = findByName(model, SHKAF_ROOT_NAME)
  if (!shkafRoot) return false

  const reference = findCabinetReferenceMaterial(shkafRoot)
  if (!reference) return false

  let applied = 0
  GLB_LEG_NODES.forEach((name) => {
    const leg = shkafRoot.getObjectByName(name)
    if (!leg) return
    leg.traverse((child) => {
      if (!child.isMesh) return
      child.material = prepareLegMaterial(reference)
      applied += 1
    })
  })

  return applied > 0
}

/**
 * Ножки из shkaf-legs.glb — синхронно, до placement.
 * Трансформы из GLB_LEG_TRANSFORMS (не [0,0,-0.0192] — у extract другая геометрия).
 */
export function attachGlbLegs(model, legsScene) {
  if (!model || !legsScene) return false

  const shkafRoot = findByName(model, SHKAF_ROOT_NAME)
  if (!shkafRoot) return false

  GLB_LEG_NODES.forEach((name) => {
    const legacy = shkafRoot.getObjectByName(name) ?? model.getObjectByName(name)
    legacy?.parent?.remove(legacy)
  })

  const source = legsScene.clone(true)
  let attached = 0

  GLB_LEG_NODES.forEach((name) => {
    const leg = source.getObjectByName(name)
    if (!leg) return

    const xf = GLB_LEG_TRANSFORMS[name]
    if (xf?.position) leg.position.set(...xf.position)
    if (xf?.rotation) leg.rotation.set(...xf.rotation)
    else leg.rotation.set(0, 0, 0)
    if (xf?.scale) leg.scale.set(...xf.scale)
    else leg.scale.set(1, 1, 1)
    shkafRoot.add(leg)
    leg.raycast = () => null
    leg.traverse((child) => {
      if (!child.isMesh) return
      child.raycast = () => null
      child.castShadow = true
      child.receiveShadow = true
    })
    attached += 1
  })

  if (attached > 0) {
    syncLegMaterialsFromCabinet(model)
  }

  return attached > 0
}
