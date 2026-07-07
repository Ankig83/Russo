import { MAIN_BODY_MATERIALS, PATINA_MATERIALS } from '../constants/shkafNodes'
import { LIGHT_LAYERS } from '../constants/studioScene'

const corpusMaterialNames = new Set(MAIN_BODY_MATERIALS)
const patinaMaterialNames = new Set(PATINA_MATERIALS)

function resolveMeshLightLayer(mesh) {
  if (!mesh.isMesh || !mesh.material) return LIGHT_LAYERS.doors

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  const names = materials.map((mat) => mat?.name).filter(Boolean)

  // Панель двери: door_right + door_side на одном mesh — всегда слой дверей
  if (names.some((name) => patinaMaterialNames.has(name))) {
    return LIGHT_LAYERS.doors
  }

  if (names.length > 0 && names.every((name) => corpusMaterialNames.has(name))) {
    return LIGHT_LAYERS.corpus
  }

  return LIGHT_LAYERS.doors
}

/** Корпус (только одно-материальные mesh) — layer 1; двери/береста — layer 0 */
export function assignShkafLightLayers(root) {
  root.traverse((child) => {
    if (!child.isMesh) return
    child.layers.set(resolveMeshLightLayer(child))
  })
}
