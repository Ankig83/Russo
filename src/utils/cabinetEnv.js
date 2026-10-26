import { CABINET_LOOK } from '../constants/cabinetStudio'

const METAL_NAME = /bronze|copper|metal|medallion|hinge|coffee|foil|plaque|glass|decanter|whisky|liquid|mirror|dorado|bottle|urn|spout|handle/i

function envIntensityFor(mesh, mat) {
  if (mat.lightMap) return CABINET_LOOK.envMapIntensity.lit
  const blob = `${mesh.name || ''} ${mat.name || ''}`
  if ((mat.transmission ?? 0) > 0.01 || (mat.metalness ?? 0) >= 0.5 || METAL_NAME.test(blob)) {
    return CABINET_LOOK.envMapIntensity.metal
  }
  return CABINET_LOOK.envMapIntensity.rest
}

/**
 * scene.environment (PMREM от drei) пишется в material.envMap.
 * Иначе three берёт scene.environmentIntensity и игнорирует envMapIntensity.
 * Общий материал клонируется, если двум мешам нужна разная интенсивность.
 */
export function applyCabinetEnv(root, envMap) {
  if (!root || !envMap) return 0
  let count = 0
  root.traverse((mesh) => {
    if (!mesh.isMesh) return
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const next = list.map((mat) => {
      if (!mat?.isMeshStandardMaterial) return mat
      const intensity = envIntensityFor(mesh, mat)
      let use = mat
      const tagged = mat.userData?.cabinetEnv
      if (tagged !== undefined && tagged !== intensity) use = mat.clone()
      use.envMap = envMap
      use.envMapIntensity = intensity
      use.userData.cabinetEnv = intensity
      use.needsUpdate = true
      count += 1
      return use
    })
    mesh.material = Array.isArray(mesh.material) ? next : next[0]
  })
  return count
}
