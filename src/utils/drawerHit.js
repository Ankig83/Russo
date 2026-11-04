import { drawerSections } from '../constants/sections'
import { SHKAF_NODE_MAP } from '../constants/shkafNodes'

const DRAWER_NODE_TO_SECTION = Object.fromEntries(
  drawerSections.map((s) => [SHKAF_NODE_MAP[s.id], s.id]),
)

const DRAWER_NODE_NAMES = new Set(Object.keys(DRAWER_NODE_TO_SECTION))

function findSectionIdFromHit(object) {
  let current = object
  while (current) {
    if (DRAWER_NODE_NAMES.has(current.name)) return DRAWER_NODE_TO_SECTION[current.name]
    current = current.parent
  }
  return null
}

export function findDrawerNodeFromHit(object) {
  const sectionId = findSectionIdFromHit(object)
  if (!sectionId) return null
  const nodeName = SHKAF_NODE_MAP[sectionId]
  let current = object
  while (current) {
    if (current.name === nodeName) return current
    current = current.parent
  }
  return null
}

export function findDrawerSectionByNode(drawerNode) {
  if (!drawerNode) return null
  const sectionId = DRAWER_NODE_TO_SECTION[drawerNode.name]
  return drawerSections.find((s) => s.id === sectionId) ?? null
}

export function findDrawerSectionFromHit(object) {
  const sectionId = findSectionIdFromHit(object)
  if (!sectionId) return null
  return drawerSections.find((s) => s.id === sectionId) ?? null
}

export function findDrawerFromIntersections(intersections, model) {
  for (const hit of intersections) {
    const object = hit?.object
    if (!object) continue
    const section = findDrawerSectionFromHit(object)
    if (!section) continue
    const node =
      findDrawerNodeFromHit(object) ?? model?.getObjectByName(SHKAF_NODE_MAP[section.id])
    if (!node) continue
    return {
      section,
      node,
      object,
      firstHitName: intersections[0]?.object?.name,
    }
  }
  return null
}
