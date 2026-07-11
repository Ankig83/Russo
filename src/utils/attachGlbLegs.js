import {
  GLB_LEG_NODES,
  GLB_LEG_TRANSFORMS,
  SHKAF_ROOT_NAME,
} from '../constants/shkafNodes'
import { findByName } from './cabinetBounds'
import { applyPlainDarkCopperMaterialFixups } from './materialFixups'

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
    applyPlainDarkCopperMaterialFixups(shkafRoot)
  }

  return attached > 0
}
