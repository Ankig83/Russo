import { Box3, Vector3 } from 'three'

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

/** Bbox шкафа — только внутри узла shkaf, без ящиков как отдельных исключений */
export function getCabinetBounds(object, rootName = SHKAF_ROOT_NAME) {
  const root = findByName(object, rootName) || object
  const box = new Box3()

  root.traverse((child) => {
    if (child.isMesh) box.expandByObject(child)
  })

  return {
    box,
    center: box.getCenter(new Vector3()),
    size: box.getSize(new Vector3()),
    root,
  }
}

/** Y «пола» под шкафом — нижняя точка bbox */
export function getFloorY(object, rootName = SHKAF_ROOT_NAME) {
  const { box } = getCabinetBounds(object, rootName)
  return box.isEmpty() ? 0 : box.min.y
}
