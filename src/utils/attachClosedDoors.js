import * as THREE from 'three'
import {
  BERESTA_SEAM_HALF_GAP,
  CLOSED_DOORS_ALIGN,
  CLOSED_DOORS_NODE_NAME,
} from '../constants/shkafNodes'
import { LIGHT_LAYERS } from '../constants/studioScene'
import { applyBerestaMaterialFixups } from './materialFixups'

/**
 * Ровный шов через медальон: половины бересты разводим от центра,
 * чтобы была видна та же фаска, что у медного полотна.
 */
export function openBerestaSeamGap(root, halfGap = BERESTA_SEAM_HALF_GAP) {
  if (!root || !(halfGap > 0)) return
  const left = root.getObjectByName('Beresta_L')
  const right = root.getObjectByName('Beresta_R')
  if (left) left.position.x -= halfGap
  if (right) right.position.x += halfGap
}

/**
 * Вешает фасад закрытых дверей (полотно + берёста + ручки) в корень сцены шкафа.
 * Координаты doors_closed.glb близки к world-space shkaf_for_D; Z подгоняется ALIGN.
 */
export function attachClosedDoorsFacade(model, doorsScene) {
  if (!model || !doorsScene) return null
  const existing = model.getObjectByName(CLOSED_DOORS_NODE_NAME)
  if (existing) return existing

  const source = doorsScene.clone(true)
  const group = new THREE.Group()
  group.name = CLOSED_DOORS_NODE_NAME

  // Все корневые дети сцены (node_0, Beresta_*, ручка_*)
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
    if (/ручка|Beresta/i.test(child.name)) {
      child.layers.enable(LIGHT_LAYERS.accent)
    }
  })

  // Фасад аттачится после applyRawMaterialPipeline — иначе у M_Beresta
  // остаётся normalMap=albedo и круг уходит в чёрное под hero-светом.
  applyBerestaMaterialFixups(group)
  openBerestaSeamGap(group)

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

  model.add(group)
  return group
}

/** Показать закрытый фасад / спрятать рабочие door_* (и наоборот). */
export function setClosedDoorsLook(model, facade, useClosedFacade) {
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
