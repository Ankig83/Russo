import * as THREE from 'three'

/**
 * В shkaf-cabinet.glb таблички «Мебель» и «О нас» — корневые меши,
 * не дети ящиков. GLTFLoader выкидывает точку: node_0.001 → node_0001.
 * GSAP двигает drawer_*, пластина остаётся в проёме и пропадает с фасада.
 */
const DRAWER_PLAQUES = [
  { names: ['node_0.001', 'node_0001'], drawer: 'drawer_1' },
  { names: ['node_0.002', 'node_0002'], drawer: 'drawer_2' },
]

const _box = new THREE.Box3()
const _center = new THREE.Vector3()

function centerOf(obj) {
  _box.setFromObject(obj)
  if (_box.isEmpty()) return null
  return _box.getCenter(_center)
}

function sitsOnDrawer(plaque, drawer) {
  const plaqueCenter = centerOf(plaque)
  if (!plaqueCenter) return false
  const y = plaqueCenter.y
  const z = plaqueCenter.z
  _box.setFromObject(drawer)
  if (_box.isEmpty()) return false
  const inY = y >= _box.min.y - 0.02 && y <= _box.max.y + 0.02
  const inFront = z >= _box.max.z - 0.05
  return inY && inFront
}

function isUnder(obj, parent) {
  let current = obj
  while (current) {
    if (current === parent) return true
    current = current.parent
  }
  return false
}

export function seatDrawerPlaques(root) {
  if (!root) return 0
  root.updateWorldMatrix(true, true)
  let seated = 0
  for (const spec of DRAWER_PLAQUES) {
    const drawer = root.getObjectByName(spec.drawer)
    if (!drawer) continue
    const names = new Set(spec.names)
    const found = []
    root.traverse((obj) => {
      if (names.has(obj.name)) found.push(obj)
    })
    for (const plaque of found) {
      if (plaque === drawer || isUnder(plaque, drawer)) continue
      if (!sitsOnDrawer(plaque, drawer)) continue
      drawer.attach(plaque)
      seated += 1
    }
  }
  return seated
}
