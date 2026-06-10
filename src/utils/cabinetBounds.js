import { Box3, Vector3 } from 'three'

/** Имя меша пола в GLB (Blender «Плоскость») */
export const FLOOR_NODE_NAME = 'Плоскость'

/** Bbox шкафа без пола */
export function getCabinetBounds(object, exclude = [FLOOR_NODE_NAME]) {
  const box = new Box3()

  object.traverse((child) => {
    if (child.isMesh && !exclude.includes(child.name)) {
      box.expandByObject(child)
    }
  })

  return {
    box,
    center: box.getCenter(new Vector3()),
    size: box.getSize(new Vector3()),
  }
}

/** Y верхней поверхности пола */
export function getFloorY(object, floorName = FLOOR_NODE_NAME) {
  const box = new Box3()
  let floor = null

  object.traverse((child) => {
    if (child.isMesh && child.name === floorName) floor = child
  })

  if (!floor) return 0

  box.setFromObject(floor)
  return box.max.y
}
