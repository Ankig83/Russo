import * as THREE from 'three'
import {
  BERESTA_SEAM_HALF_GAP,
  BERESTA_SEAM_HALF_OVERLAP,
  CLOSED_DOORS_ALIGN,
  CLOSED_DOORS_NODE_NAME,
} from '../constants/shkafNodes'
import { LIGHT_LAYERS } from '../constants/studioScene'
import { applyBerestaMaterialFixups } from './materialFixups'
import { doorsUseV46Split } from './splitCombinedDoors'

/**
 * Ровный шов через медальон: половины бересты разводим от центра,
 * чтобы была видна та же фаска, что у медного полотна.
 */
export function openBerestaSeamGap(root, halfGap = BERESTA_SEAM_HALF_GAP) {
  if (!root || !(halfGap > 0)) return
  // На door_left есть только Beresta_L (и наоборот) — ищем оба имени
  const left = root.getObjectByName('Beresta_L')
  const right = root.getObjectByName('Beresta_R')
  if (left) left.position.x -= halfGap
  if (right) right.position.x += halfGap
}

/** Closed: L/R к центру — сужает щель шва (без правки геометрии). */
export function closeBerestaSeamOverlap(root, halfOverlap = BERESTA_SEAM_HALF_OVERLAP) {
  if (!root || !(halfOverlap > 0)) return
  const left = root.getObjectByName('Beresta_L')
  const right = root.getObjectByName('Beresta_R')
  if (left) left.position.x += halfOverlap
  if (right) right.position.x -= halfOverlap
}

/** Медь дверей: не кастить self-shadow (диагональный acne от meshopt normal). */
export function softenClosedDoorsCopperArtifacts(root) {
  if (!root) return
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    let isCopperDoor = /^node_0001$/i.test(child.name || '')
    mats.forEach((mat) => {
      if (!mat) return
      if (mat.name === 'Material.002') mat.name = 'M_ClosedDoors_AI'
      if (mat.name !== 'M_ClosedDoors_AI') return
      isCopperDoor = true
      if (mat.normalMap && mat.normalScale) {
        mat.normalScale.set(0.42, 0.42)
      }
      ;['map', 'normalMap', 'roughnessMap', 'metalnessMap'].forEach((slot) => {
        const tex = mat[slot]
        if (!tex) return
        tex.anisotropy = Math.max(tex.anisotropy || 0, 16)
        tex.needsUpdate = true
      })
      mat.needsUpdate = true
    })
    if (isCopperDoor) {
      child.castShadow = false
      child.receiveShadow = true
    }
  })
}

function prepareClosedDoorsMeshes(group, { applyAlign = false, openSeam = true } = {}) {
  group.traverse((child) => {
    if (!child.isMesh) return
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    mats.forEach((mat) => {
      if (!mat) return
      // Не давать woodTextures перехватить Material.002 корпуса
      if (mat.name === 'Material.002') mat.name = 'M_ClosedDoors_AI'
      mat.needsUpdate = true
    })
    child.castShadow = true
    child.receiveShadow = true
    child.layers.enable(LIGHT_LAYERS.doors)
    child.layers.enable(LIGHT_LAYERS.corpus)
    if (/ручка|Beresta|кож_обод/i.test(child.name)) {
      child.layers.enable(LIGHT_LAYERS.accent)
    }
  })

  applyBerestaMaterialFixups(group)
  softenClosedDoorsCopperArtifacts(group)

  // v46 split: шов уже в GLB; лишний gap + attach с scale.x=1.015 разъезжает медальон
  if (openSeam && !group.userData.berestaSeamOpened) {
    openBerestaSeamGap(group)
    group.userData.berestaSeamOpened = true
  } else if (!openSeam && !group.userData.berestaSeamClosed) {
    closeBerestaSeamOverlap(group)
    group.userData.berestaSeamClosed = true
  }

  if (applyAlign) {
    const align = CLOSED_DOORS_ALIGN
    if (align?.position) {
      group.position.set(
        align.position[0] ?? 0,
        align.position[1] ?? 0,
        align.position[2] ?? 0,
      )
    }
    if (align?.scale) {
      group.scale.set(
        align.scale[0] ?? 1,
        align.scale[1] ?? 1,
        align.scale[2] ?? 1,
      )
    }
  }

  group.userData.closedDoorsPrepared = true
}

/**
 * Берёт фасад из shkaf.glb (baked) или аттачит из doors-closed.glb.
 * doorsScene можно не передавать, если нода closed_doors_facade уже в модели.
 */
export function attachClosedDoorsFacade(model, doorsScene = null, { openSeam = true } = {}) {
  if (!model) return null

  const existing = model.getObjectByName(CLOSED_DOORS_NODE_NAME)
  if (existing) {
    if (!existing.userData.closedDoorsPrepared) {
      // Align уже в GLB (translation/scale запечены) — не дублировать
      prepareClosedDoorsMeshes(existing, { applyAlign: false, openSeam })
    }
    return existing
  }

  if (!doorsScene) return null

  const source = doorsScene.clone(true)
  const group = new THREE.Group()
  group.name = CLOSED_DOORS_NODE_NAME

  const roots = [...source.children]
  if (roots.length === 0) {
    source.traverse((child) => {
      if (child.isMesh && child.parent === source) roots.push(child)
    })
  }

  roots.forEach((node) => {
    source.remove(node)
    group.add(node)
  })

  if (group.children.length === 0) return null

  prepareClosedDoorsMeshes(group, { applyAlign: true, openSeam })
  model.add(group)
  return group
}

/**
 * Показать закрытый фасад / спрятать рабочие door_* (и наоборот).
 * v46: декор уже на door_left/right — swap не трогает двери, facade пустой.
 */
export function setClosedDoorsLook(model, facade, useClosedFacade) {
  if (doorsUseV46Split(model) || facade?.userData?.v46DecorMovedToDoors) {
    if (facade) facade.visible = false
    ;(['door_left', 'door_right']).forEach((name) => {
      const door = model?.getObjectByName(name)
      if (!door) return
      door.visible = true
      door.traverse((child) => {
        child.visible = true
      })
    })
    return
  }

  if (facade) {
    facade.visible = useClosedFacade
    facade.traverse((child) => {
      child.visible = useClosedFacade
      if (!child.isMesh) return
      child.raycast = useClosedFacade ? THREE.Mesh.prototype.raycast : () => null
    })
  }

  if (!model) return
  ;(['door_left', 'door_right']).forEach((name) => {
    const door = model.getObjectByName(name)
    if (!door) return
    door.visible = !useClosedFacade
    door.traverse((child) => {
      child.visible = !useClosedFacade
    })
  })
}
