import { drawerSections } from '../constants/sections'
import { SHKAF_NODE_MAP } from '../constants/shkafNodes'

/** Имена нод-ящиков в GLB (drawer_1, drawer_2, …) */
const DRAWER_NODE_NAMES = new Set(
  drawerSections.map((s) => SHKAF_NODE_MAP[s.id]).filter(Boolean),
)

/**
 * Клик попадает в дочерний mesh (например 148_.001),
 * а анимировать нужно родителя drawer_1 — поднимаемся по дереву.
 */
export function findDrawerNodeFromHit(object) {
  let current = object
  while (current) {
    if (DRAWER_NODE_NAMES.has(current.name)) return current
    current = current.parent
  }
  return null
}

/** section по ноде ящика из GLB */
export function findDrawerSectionByNode(drawerNode) {
  if (!drawerNode) return null
  return drawerSections.find((s) => SHKAF_NODE_MAP[s.id] === drawerNode.name) ?? null
}

/** section по объекту, в который попал raycast */
export function findDrawerSectionFromHit(object) {
  const drawerNode = findDrawerNodeFromHit(object)
  return drawerNode ? findDrawerSectionByNode(drawerNode) : null
}
