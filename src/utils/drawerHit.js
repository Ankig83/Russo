import { drawerSections } from '../constants/sections'
import {
  DRAWER_LID_TO_BODY,
  DRAWER_TABL_NODES,
  INACTIVE_DRAWER_NODES,
  INACTIVE_MESH_NAMES,
  PLAQUE_MATERIAL_TO_SECTION,
  SHKAF_NODE_MAP,
} from '../constants/shkafNodes'

/** Имена нод-ящиков из GLB (drawer_tl/tr/bl/br) → section.id */
const DRAWER_NODE_TO_SECTION = Object.fromEntries(
  drawerSections.map((s) => [SHKAF_NODE_MAP[s.id], s.id]),
)

/** Множество кликабельных нод ящиков */
const DRAWER_NODE_NAMES = new Set(Object.keys(DRAWER_NODE_TO_SECTION))

/** tabl_1 → drawer_tl … (для клика по табличке) */
const TABL_TO_SECTION = Object.fromEntries(
  Object.entries(DRAWER_TABL_NODES).map(([sectionId, tablName]) => [tablName, sectionId]),
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

/** section.id по объекту raycast — вверх по дереву; материал таблички важнее номера tabl_N */
function findSectionIdFromHit(object) {
  let current = object
  while (current) {
    if (INACTIVE_MESH_NAMES.has(current.name)) return null

    if (current.isMesh && current.material) {
      const materials = Array.isArray(current.material) ? current.material : [current.material]
      for (const mat of materials) {
        const sectionId = PLAQUE_MATERIAL_TO_SECTION[mat?.name]
        if (sectionId) return sectionId
      }
    }

    if (TABL_TO_SECTION[current.name]) return TABL_TO_SECTION[current.name]

    if (DRAWER_NODE_NAMES.has(current.name)) return DRAWER_NODE_TO_SECTION[current.name]

    current = current.parent
  }
  return null
}

/** Нода для анимации выдвижения — сам ящик drawer_tl/tr/bl/br */
export function findDrawerNodeFromHit(object) {
  if (isUnderInactiveDrawerNode(object)) return null

  const sectionId = findSectionIdFromHit(object)
  if (!sectionId) return null

  // подняться до самой ноды ящика в дереве
  let current = object
  while (current) {
    if (current.name === SHKAF_NODE_MAP[sectionId]) return current
    current = current.parent
  }

  // tabl/плашка привязаны к ящику как дети — найти родителя-ящик
  current = object
  while (current) {
    if (DRAWER_NODE_NAMES.has(current.name)) return current
    current = current.parent
  }

  return null
}

/** section по ноде ящика из GLB */
export function findDrawerSectionByNode(drawerNode) {
  if (!drawerNode) return null
  const sectionId = DRAWER_NODE_TO_SECTION[drawerNode.name]
  return drawerSections.find((s) => s.id === sectionId) ?? null
}

/** section по объекту raycast — ящик, tabl или плашка */
export function findDrawerSectionFromHit(object) {
  const sectionId = findSectionIdFromHit(object)
  if (!sectionId) return null
  return drawerSections.find((s) => s.id === sectionId) ?? null
}

/** Имя корпуса (.1) по крышке */
export function getDrawerBodyName(lidName) {
  return DRAWER_LID_TO_BODY[lidName] ?? (lidName.endsWith('.1') ? null : `${lidName}.1`)
}

/** Имя крышки по корпусу (.1) */
export function getDrawerLidName(bodyName) {
  return Object.entries(DRAWER_LID_TO_BODY).find(([, body]) => body === bodyName)?.[0] ?? null
}
