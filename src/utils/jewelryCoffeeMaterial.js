import * as THREE from 'three'
import { CABINET_LOOK } from '../constants/cabinetStudio'

/**
 * Шкатулка уже приходит из GLB с уникальными UV (T_jewelry case_Col/NM/MR) —
 * серебро/олово с рельефом. Плитка aged-copper эти карты затирает и красит медью.
 * Здесь только тон: металл читает albedo, внутри шкафа без прямого света
 * нужен слабый emissive по той же карте.
 */
export function applyAgedCopperToJewelry(root) {
  if (!root) return 0
  let applied = 0
  root.traverse((obj) => {
    if (!obj.isMesh || !/jewelry[_\s]?case/i.test(obj.name || '')) return
    const list = Array.isArray(obj.material) ? obj.material : [obj.material]
    const next = list.map((mat) => {
      if (!mat) return mat
      const use = mat.userData.jewelryOwnLook ? mat : mat.clone()
      use.color.set('#ffffff')
      use.metalness = 1
      use.roughness = 1
      if (use.map) {
        use.emissive.set('#d8d0c4')
        use.emissiveMap = use.map
        use.emissiveIntensity = 0.28
      }
      use.envMapIntensity = CABINET_LOOK.envMapIntensity.jewelry
      if (use.normalScale) use.normalScale.set(1.15, 1.15)
      use.userData.jewelryOwnLook = true
      use.needsUpdate = true
      return use
    })
    obj.material = Array.isArray(obj.material) ? next : next[0]
    applied += 1
  })
  return applied
}

/** @deprecated имя оставлено для старых импортов */
export function applyCoffeeMaterialToJewelry(root, textures) {
  return applyAgedCopperToJewelry(root, textures)
}
