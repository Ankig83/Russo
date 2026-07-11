import { Box3, Vector3 } from 'three'
import {
  GLB_LEG_FLOOR_MIN_Y,
  GLB_LEG_NODES,
  USE_PROCEDURAL_LEGS,
  findDoorPivotNode,
} from '../constants/shkafNodes'

/** Корневой объект шкафа в GLB */
export const SHKAF_ROOT_NAME = 'shkaf'

const LEG_NODE_NAMES = new Set(GLB_LEG_NODES)

function isLegMesh(child) {
  let node = child
  while (node) {
    if (LEG_NODE_NAMES.has(node.name)) return true
    node = node.parent
  }
  return false
}

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
export function getCabinetBounds(object, rootName = SHKAF_ROOT_NAME, options = {}) {
  const { excludeLegs = false } = options
  const root = findByName(object, rootName) || object
  const box = new Box3()

  root.traverse((child) => {
    if (!child.isMesh) return
    if (excludeLegs && isLegMesh(child)) return
    box.expandByObject(child)
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

function hasGlbLegMeshes(object, rootName) {
  const root = findByName(object, rootName) || object
  return GLB_LEG_NODES.some((name) => !!root.getObjectByName(name))
}

/** X/Z — середина между pivot дверей (визуальный центр фасада, x=0 под логотип) */
function getVisualAlignmentCenter(object, rootName = SHKAF_ROOT_NAME) {
  object.updateMatrixWorld(true)
  const root = findByName(object, rootName) || object
  const left = findDoorPivotNode(root, 'left')
  const right = findDoorPivotNode(root, 'right')

  if (left && right) {
    const lp = new Vector3()
    const rp = new Vector3()
    left.getWorldPosition(lp)
    right.getWorldPosition(rp)
    return lp.add(rp).multiplyScalar(0.5)
  }

  const { center } = getCabinetBounds(object, rootName, { excludeLegs: true })
  return center
}

/** Пол на y=0; X/Z — по фасаду (pivot дверей), не по bbox корпуса с задней стенкой */
export function getCabinetPlacement(object, rootName = SHKAF_ROOT_NAME) {
  const { box: floorBox, size } = getCabinetBounds(object, rootName)
  const center = getVisualAlignmentCenter(object, rootName)

  if (floorBox.isEmpty()) {
    return {
      position: [0, 0, 0],
      alignedCenter: new Vector3(),
      size,
      box: floorBox,
    }
  }

  let floorY = floorBox.min.y
  // Без ножек bbox.min.y ≈ 0.51 (дно корпуса) — шкаф «висит» после async attach
  if (
    !USE_PROCEDURAL_LEGS &&
    !hasGlbLegMeshes(object, rootName) &&
    floorY > GLB_LEG_FLOOR_MIN_Y
  ) {
    floorY = GLB_LEG_FLOOR_MIN_Y
  }
  return {
    position: [-center.x, -floorY, -center.z],
    alignedCenter: new Vector3(0, center.y - floorY, 0),
    size,
    box: floorBox,
  }
}
