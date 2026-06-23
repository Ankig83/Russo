import { Box3, Matrix4, Vector3 } from 'three'

/** Корневой объект шкафа в GLB */
export const SHKAF_ROOT_NAME = 'shkaf'

/** Имя меша пола (старые экспорты) */
export const FLOOR_NODE_NAME = 'Плоскость'

/** Найти объект по имени в дереве */
export function findByName(object, name) {
  let found = null
  object.traverse((child) => {
    if (child.name === name && !found) found = child
  })
  return found
}

/** Bbox шкафа в мировых координатах (учитывает scale/position группы) */
export function getWorldCabinetBox(object, rootName = SHKAF_ROOT_NAME) {
  const root = findByName(object, rootName) || object
  const box = new Box3()
  root.updateWorldMatrix(true, true)
  root.traverse((child) => {
    if (child.isMesh) box.expandByObject(child)
  })
  return box.isEmpty() ? null : box
}

/** 8 углов bbox */
export function getBoxCorners(box) {
  const { min, max } = box
  return [
    new Vector3(min.x, min.y, min.z),
    new Vector3(max.x, min.y, min.z),
    new Vector3(min.x, max.y, min.z),
    new Vector3(max.x, max.y, min.z),
    new Vector3(min.x, min.y, max.z),
    new Vector3(max.x, min.y, max.z),
    new Vector3(min.x, max.y, max.z),
    new Vector3(max.x, max.y, max.z),
  ]
}

/** Bbox шкафа в локальных координатах узла shkaf */
export function getCabinetBounds(object, rootName = SHKAF_ROOT_NAME) {
  const root = findByName(object, rootName) || object
  const box = new Box3()
  root.updateWorldMatrix(true, true)
  const rootInv = new Matrix4().copy(root.matrixWorld).invert()

  root.traverse((child) => {
    if (!child.isMesh || !child.visible) return
    const geom = child.geometry
    if (!geom?.boundingBox) geom?.computeBoundingBox()
    if (!geom?.boundingBox) return
    const meshBox = geom.boundingBox.clone()
    meshBox.applyMatrix4(child.matrixWorld).applyMatrix4(rootInv)
    box.union(meshBox)
  })

  return {
    box,
    center: box.getCenter(new Vector3()),
    size: box.getSize(new Vector3()),
    root,
  }
}

/** Y нижней точки шкафа в координатах родителя (model) — вдоль мировой вертикали */
export function getFloorY(object, rootName = SHKAF_ROOT_NAME) {
  const root = findByName(object, rootName) || object
  const box = new Box3()
  const parentInv = new Matrix4()

  object.updateWorldMatrix(true, true)
  parentInv.copy(object.matrixWorld).invert()

  root.traverse((child) => {
    if (!child.isMesh || !child.visible) return
    const meshBox = new Box3().setFromObject(child)
    meshBox.applyMatrix4(parentInv)
    box.union(meshBox)
  })

  return box.isEmpty() ? 0 : box.min.y
}
