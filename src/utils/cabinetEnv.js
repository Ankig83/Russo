import { CABINET_LOOK } from '../constants/cabinetStudio'
import { classifyCabinetMesh } from './cabinetTune'

const METAL_NAME = /bronze|copper|metal|medallion|hinge|coffee|foil|plaque|glass|decanter|whisky|liquid|mirror|dorado|bottle|urn|spout|handle/i
/** Шкатулка и чайники — бронзовый тинт. Бутылки не трогаем. */
const BRONZE_INSIDE = /jewelry|vase_brass|urn|^base(\.\d+|_?\d+)?$|^handle(\.\d+|_?\d+)?$|^handle_attach_|^spout$/i
const JEWELRY = /jewelry/i

function isUnderDoorRight(mesh) {
  let node = mesh
  while (node) {
    if (node.name === 'door_right') return true
    node = node.parent
  }
  return false
}

function envIntensityFor(mesh, mat, group) {
  if (group.env === 'base') return CABINET_LOOK.envMapIntensity.base
  if (group.env === 'medallion') return CABINET_LOOK.envMapIntensity.medallion
  if (group.env === 'door_panel') return CABINET_LOOK.envMapIntensity.door_panel
  if (group.env === 'leather_lit') return CABINET_LOOK.envMapIntensity.leather
  if (mat.userData?.jewelryOwnLook) return CABINET_LOOK.envMapIntensity.jewelry
  // Правая дверка: бутылки не берут glass_prop 1 — иначе пересвет.
  if (isUnderDoorRight(mesh)) {
    const matName = mat.name || ''
    if (/foil|plastic|dorado/i.test(matName)) return CABINET_LOOK.envMapIntensity.metal_inside
    if (/label/i.test(matName)) return 0.22
    if (/^Material\.005$/i.test(matName)) return CABINET_LOOK.envMapIntensity.door_bottle
    return CABINET_LOOK.envMapIntensity.door_bottle
  }
  // Стекло раньше metal_inside: графин Cup / JW получали бронзу и env 0.28.
  if ((mat.transmission ?? 0) > 0.01 || group.env === 'glass_prop') {
    return CABINET_LOOK.envMapIntensity.glass_prop
  }
  if (group.env === 'metal_inside') {
    return JEWELRY.test(mesh.name || '')
      ? CABINET_LOOK.envMapIntensity.jewelry
      : CABINET_LOOK.envMapIntensity.metal_inside
  }
  if (mat.lightMap) return CABINET_LOOK.envMapIntensity.lit
  const blob = `${mesh.name || ''} ${mat.name || ''}`
  if ((mat.metalness ?? 0) >= 0.5 || METAL_NAME.test(blob)) {
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
      const group = classifyCabinetMesh(mesh.name || '', [mat.name || ''])
      const intensity = envIntensityFor(mesh, mat, group)
      let use = mat
      const tagged = mat.userData?.cabinetEnv
      if (tagged !== undefined && tagged !== intensity) use = mat.clone()
      use.envMap = envMap
      use.envMapIntensity = intensity
      use.userData.cabinetEnv = intensity
      if (group.env === 'base') {
        if (use.userData.tuneBaseRoughness == null) use.userData.tuneBaseRoughness = use.roughness
        const add = CABINET_LOOK.roughnessAdd.base
        use.roughness = Math.min(1, use.userData.tuneBaseRoughness + add)
      }
      if (group.env === 'medallion') {
        use.emissive.set('#6b4a30')
        use.emissiveIntensity = 0.22
      }
      if (group.env === 'door_panel' && !use.userData.doorTint) {
        use = use.clone()
        use.userData.doorTint = true
        use.userData.cabinetEnv = intensity
        use.color.multiplyScalar(0.82)
      }
      // Белый albedo + env 1 = хром. Тёмный бронзовый тон шкатулки/чайников.
      if (
        group.env === 'metal_inside'
        && BRONZE_INSIDE.test(mesh.name || '')
        && !use.userData.bronzeInside
        && !use.userData.jewelryOwnLook
      ) {
        use = use.clone()
        use.userData.bronzeInside = true
        use.userData.cabinetEnv = intensity
        use.color.r *= 0.62
        use.color.g *= 0.48
        use.color.b *= 0.32
        use.roughness = Math.min(1, Math.max(use.roughness ?? 0.35, 0.48))
        if ((use.metalness ?? 0) < 0.7) use.metalness = 0.82
      }
      // Тёплый приглушённый интерьер: задняя стенка и шпон корпуса.
      if (
        !use.userData.warmInterior
        && (/^back_wall/i.test(mesh.name || '') || (group.light === 'corpus' && group.env === 'wood_lit'))
      ) {
        use = use.clone()
        use.userData.warmInterior = true
        use.userData.cabinetEnv = intensity
        use.color.r = Math.min(1, use.color.r * 1.06)
        use.color.g = Math.min(1, use.color.g * 0.94)
        use.color.b = Math.min(1, use.color.b * 0.82)
      }
      use.needsUpdate = true
      count += 1
      return use
    })
    mesh.material = Array.isArray(mesh.material) ? next : next[0]
  })
  return count
}
