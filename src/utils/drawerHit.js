import { drawerSections } from '../constants/sections'
import {
  DRAWER_LID_TO_BODY,
  INACTIVE_DRAWER_NODES,
  INACTIVE_MESH_NAMES,
  SHKAF_NODE_MAP,
} from '../constants/shkafNodes'

/** Имена нод-ящиков в GLB (drawer_1, drawer_2, …) */
const DRAWER_NODE_NAMES = new Set(
  drawerSections.map((s) => SHKAF_NODE_MAP[s.id]).filter(Boolean),
)

function isUnderInactiveDrawerNode(object) {
  let current = object
  while (current) {
    if (INACTIVE_DRAWER_NODES.has(current.name)) return true
    if (INACTIVE_MESH_NAMES.has(current.name)) return true
    current = current.parent
  }
  return false
}

/**
 * Клик попадает в дочерний mesh (например 148_.001),
 * а анимировать нужно родителя drawer_1 — поднимаемся по дереву.
 */
export function findDrawerNodeFromHit(object) {
  if (isUnderInactiveDrawerNode(object)) return null

  let current = object
  while (current) {
    if (INACTIVE_DRAWER_NODES.has(current.name)) return null
    if (INACTIVE_MESH_NAMES.has(current.name)) {
      current = current.parent
      continue
    }

    if (DRAWER_NODE_NAMES.has(current.name)) return current

    if (DRAWER_LID_TO_BODY[current.name]) return current

    const lid = Object.entries(DRAWER_LID_TO_BODY).find(([, body]) => body === current.name)?.[0]
    if (lid) {
      if (current.parent?.name === lid) return current.parent
      let root = current
      while (root.parent) root = root.parent
      const lidNode = root.getObjectByName?.(lid)
      if (lidNode) return lidNode
      return current
    }

    current = current.parent
  }
  return null
}

/** section по ноде ящика из GLB */
export function findDrawerSectionByNode(drawerNode) {
  if (!drawerNode) return null

  const direct = drawerSections.find((s) => SHKAF_NODE_MAP[s.id] === drawerNode.name)
  if (direct) return direct

  // крышка (section → body в маппинге)
  const body = DRAWER_LID_TO_BODY[drawerNode.name]
  if (body) {
    return drawerSections.find((s) => SHKAF_NODE_MAP[s.id] === body) ?? null
  }

  // корпус .1
  const lid = Object.entries(DRAWER_LID_TO_BODY).find(([, b]) => b === drawerNode.name)?.[0]
  if (lid) {
    return drawerSections.find((s) => SHKAF_NODE_MAP[s.id] === lid) ?? null
  }

  return null
}

/** section по объекту, в который попал raycast */
export function findDrawerSectionFromHit(object) {
  const drawerNode = findDrawerNodeFromHit(object)
  return drawerNode ? findDrawerSectionByNode(drawerNode) : null
}

/** Имя корпуса (.1) по крышке */
export function getDrawerBodyName(lidName) {
  return DRAWER_LID_TO_BODY[lidName] ?? (lidName.endsWith('.1') ? null : `${lidName}.1`)
}

/** Имя крышки по корпусу (.1) */
export function getDrawerLidName(bodyName) {
  return Object.entries(DRAWER_LID_TO_BODY).find(([, body]) => body === bodyName)?.[0] ?? null
}
