import {
  GLB_LEG_NODES,
  GLB_LEG_TRANSFORMS,
  SHKAF_ROOT_NAME,
} from '../constants/shkafNodes'
import { findByName } from './cabinetBounds'

/** Материалы корпуса шкафа — приоритет для ножек (как у фасада / корпуса) */
const LEG_MATERIAL_REFERENCE_ORDER = [
  'patina_PBR',
  'Scratched copper metal',
  'Material.002',
]

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

/** Клонирует материал корпуса на mesh-ножки (текстура как у шкафа) */
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
      child.material = reference.clone()
      child.material.needsUpdate = true
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
