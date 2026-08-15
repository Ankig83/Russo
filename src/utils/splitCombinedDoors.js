import * as THREE from 'three'
import { symmetrizeHandleSpacing } from './attachLeatherRim'

/**
 * v46 doors_front_back.glb: двери — один multi-material mesh (node_0.001 /
 * node_0001) с фронтом M_ClosedDoors_AI и тылом Material.001, без door_left/right.
 * Режем по шву X → два pivot’а, вешаем L/R декор с closed_doors_facade.
 */

const COMBINED_DOOR_NAMES = ['node_0001', 'node_0.001']

const FACADE_LEFT = [
  'Beresta_L',
  'кож_обод_L_facade',
  'ручка_левая',
  'ручка_левая_1',
]
const FACADE_RIGHT = [
  'Beresta_R',
  'кож_обод_R_facade',
  'ручка_правая',
  'ручка_правая_1',
]

function findCombinedDoorRoot(model) {
  for (const name of COMBINED_DOOR_NAMES) {
    const n = model.getObjectByName(name)
    if (n) return n
  }
  return null
}

function collectDoorMeshes(root) {
  const meshes = []
  if (root.isMesh) {
    meshes.push(root)
    return meshes
  }
  root.children.forEach((child) => {
    if (child.isMesh) meshes.push(child)
  })
  // fallback deep
  if (!meshes.length) {
    root.traverse((child) => {
      if (child.isMesh) meshes.push(child)
    })
  }
  return meshes
}

/**
 * Режет BufferGeometry по X (локальные координаты mesh).
 * Indexed: классифицируем треугольники по центроиду, собираем новый index+attrs.
 */
function splitGeometryBySeamX(geometry, seamX) {
  const pos = geometry.attributes.position
  if (!pos) return { left: null, right: null }

  const index = geometry.index
  const triCount = index ? index.count / 3 : Math.floor(pos.count / 3)

  const leftIndices = []
  const rightIndices = []
  const v0 = new THREE.Vector3()
  const v1 = new THREE.Vector3()
  const v2 = new THREE.Vector3()

  const readVertex = (vertIndex, target) => {
    target.fromBufferAttribute(pos, vertIndex)
  }

  for (let t = 0; t < triCount; t += 1) {
    let i0
    let i1
    let i2
    if (index) {
      i0 = index.getX(t * 3)
      i1 = index.getX(t * 3 + 1)
      i2 = index.getX(t * 3 + 2)
    } else {
      i0 = t * 3
      i1 = t * 3 + 1
      i2 = t * 3 + 2
    }
    readVertex(i0, v0)
    readVertex(i1, v1)
    readVertex(i2, v2)
    const cx = (v0.x + v1.x + v2.x) / 3
    const bucket = cx < seamX ? leftIndices : rightIndices
    bucket.push(i0, i1, i2)
  }

  function makeGeo(triIndices) {
    if (triIndices.length < 9) return null
    // Remap used verts → compact geometry
    const used = new Map()
    const newIndex = []
    let next = 0
    for (let i = 0; i < triIndices.length; i += 1) {
      const old = triIndices[i]
      let mapped = used.get(old)
      if (mapped == null) {
        mapped = next
        used.set(old, next)
        next += 1
      }
      newIndex.push(mapped)
    }

    const g = new THREE.BufferGeometry()
    const attrNames = Object.keys(geometry.attributes)
    attrNames.forEach((name) => {
      const src = geometry.attributes[name]
      const item = src.itemSize
      const arr = new Float32Array(used.size * item)
      used.forEach((newIdx, oldIdx) => {
        for (let c = 0; c < item; c += 1) {
          arr[newIdx * item + c] = src.getComponent(oldIdx, c)
        }
      })
      g.setAttribute(name, new THREE.BufferAttribute(arr, item))
    })
    g.setIndex(newIndex)
    // Не вызывать computeVertexNormals(): затирает baked normals из GLB,
    // а старые TANGENT остаются → полосы/moire на M_ClosedDoors_AI normal map.
    if (!g.attributes.normal) {
      g.computeVertexNormals()
    }
    g.computeBoundingBox()
    g.computeBoundingSphere()
    return g
  }

  return {
    left: makeGeo(leftIndices),
    right: makeGeo(rightIndices),
  }
}

function reparentKeepWorld(child, newParent) {
  if (!child || !newParent || child.parent === newParent) return
  newParent.attach(child)
}

/**
 * THREE.Object3D.attach ломает world-transform, если текущий parent
 * с non-uniform scale (у closed_doors_facade scale.x = 1.015).
 * Сначала «выпекаем» scale в детей через attach на grandparent.
 */
function neutralizeNonUniformScale(object) {
  if (!object) return
  const { x: sx, y: sy, z: sz } = object.scale
  if (Math.abs(sx - 1) < 1e-5 && Math.abs(sy - 1) < 1e-5 && Math.abs(sz - 1) < 1e-5) {
    return
  }
  const parent = object.parent
  if (!parent) {
    object.scale.set(1, 1, 1)
    return
  }
  object.updateWorldMatrix(true, true)
  const kids = [...object.children]
  kids.forEach((k) => parent.attach(k))
  object.scale.set(1, 1, 1)
  object.updateMatrixWorld(true)
  kids.forEach((k) => object.attach(k))
}

/**
 * @returns {{ left: THREE.Object3D, right: THREE.Object3D } | null}
 */
export function ensureSplitDoorPivots(model) {
  if (!model) return null
  const existingL = model.getObjectByName('door_left')
  const existingR = model.getObjectByName('door_right')
  if (existingL && existingR && existingL.userData.v46SplitDoors) {
    return { left: existingL, right: existingR }
  }

  const combined = findCombinedDoorRoot(model)
  if (!combined) {
    console.warn('РУССО: combined door (node_0001) не найден — split skip')
    return null
  }

  const parent = combined.parent || model
  combined.updateWorldMatrix(true, true)

  const meshes = collectDoorMeshes(combined)
  if (!meshes.length) {
    console.warn('РУССО: combined door без mesh')
    return null
  }

  // Общий bbox в локали meshes (обычно identity under combined)
  const localBox = new THREE.Box3()
  meshes.forEach((m) => {
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
    localBox.union(m.geometry.boundingBox)
  })
  const seamX = (localBox.min.x + localBox.max.x) * 0.5

  // Hinge: внешние края в WORLD, потом в parent local
  const worldBox = new THREE.Box3().setFromObject(combined)
  const midY = (worldBox.min.y + worldBox.max.y) * 0.5
  const midZ = (worldBox.min.z + worldBox.max.z) * 0.5
  const hingeLeftParent = parent.worldToLocal(
    new THREE.Vector3(worldBox.min.x, midY, midZ),
  )
  const hingeRightParent = parent.worldToLocal(
    new THREE.Vector3(worldBox.max.x, midY, midZ),
  )

  const doorLeft = new THREE.Object3D()
  doorLeft.name = 'door_left'
  doorLeft.userData.v46SplitDoors = true
  doorLeft.position.copy(hingeLeftParent)

  const doorRight = new THREE.Object3D()
  doorRight.name = 'door_right'
  doorRight.userData.v46SplitDoors = true
  doorRight.position.copy(hingeRightParent)

  parent.add(doorLeft)
  parent.add(doorRight)

  let halfCount = 0
  meshes.forEach((mesh, mi) => {
    mesh.updateWorldMatrix(true, false)
    const { left: leftGeo, right: rightGeo } = splitGeometryBySeamX(
      mesh.geometry,
      seamX,
    )

    // Half-mesh сначала в том же parent, что исходный (локальные verts совпадают),
    // потом attach на door_* — world transform сохраняется, hinge станет осью.
    if (leftGeo) {
      const leftMesh = new THREE.Mesh(leftGeo, mesh.material)
      leftMesh.name = `door_left_panel_${mi}`
      leftMesh.castShadow = true
      leftMesh.receiveShadow = true
      mesh.parent.add(leftMesh)
      leftMesh.position.copy(mesh.position)
      leftMesh.quaternion.copy(mesh.quaternion)
      leftMesh.scale.copy(mesh.scale)
      doorLeft.attach(leftMesh)
      halfCount += 1
    }

    if (rightGeo) {
      const rightMesh = new THREE.Mesh(rightGeo, mesh.material)
      rightMesh.name = `door_right_panel_${mi}`
      rightMesh.castShadow = true
      rightMesh.receiveShadow = true
      mesh.parent.add(rightMesh)
      rightMesh.position.copy(mesh.position)
      rightMesh.quaternion.copy(mesh.quaternion)
      rightMesh.scale.copy(mesh.scale)
      doorRight.attach(rightMesh)
      halfCount += 1
    }
  })

  const facade = model.getObjectByName('closed_doors_facade')
  // scale.x=1.015 на фасаде → без bake attach() разъезжает Beresta_L/R по Y
  if (facade) neutralizeNonUniformScale(facade)

  // Декор фасада L/R → на двери (вращаются вместе с полотном)
  FACADE_LEFT.forEach((name) => {
    const node = model.getObjectByName(name)
    if (node) reparentKeepWorld(node, doorLeft)
  })
  FACADE_RIGHT.forEach((name) => {
    const node = model.getObjectByName(name)
    if (node) reparentKeepWorld(node, doorRight)
  })

  combined.visible = false
  combined.traverse((c) => {
    c.visible = false
    if (c.isMesh) c.raycast = () => null
  })

  if (facade) {
    facade.visible = false
    facade.userData.v46DecorMovedToDoors = true
  }

  model.userData.pendingDoorSplit = false

  console.info(
    `РУССО: v46 doors split → door_left/right (halves=${halfCount}, seamX=${seamX.toFixed(3)})`,
  )

  return { left: doorLeft, right: doorRight }
}

/** true — декор уже на door_*, facade-swap не нужен (runtime split или bake в GLB) */
export function doorsUseV46Split(model) {
  const left = model?.getObjectByName('door_left')
  const right = model?.getObjectByName('door_right')
  if (!left || !right) return false
  // extras.v46SplitDoors из GLB → userData; либо panel-меши после scripts/split_doors_glb.mjs
  if (left.userData?.v46SplitDoors || right.userData?.v46SplitDoors) return true
  return !!(
    left.getObjectByName('door_left_panel_0')
    || right.getObjectByName('door_right_panel_0')
  )
}

/**
 * Closed-first path: НЕ сплитим на load.
 * Медные дверки = node_0001 (M_ClosedDoors_AI) — оставляем ВИДИМЫМИ.
 * Facade даёт только бересту/ручки поверх. Split — при первом open.
 * @returns {boolean} true — есть combined door, нужен lazy split
 */
export function prepareLazyDoorSplit(model) {
  if (!model) return false
  if (doorsUseV46Split(model)) {
    model.userData.pendingDoorSplit = false
    return false
  }
  const combined = findCombinedDoorRoot(model)
  if (!combined) {
    model.userData.pendingDoorSplit = false
    return false
  }
  // Важно: не прятать combined — иначе «потеряются дверки» (медь только тут)
  combined.visible = true
  combined.traverse((c) => {
    c.visible = true
  })
  // Bake facade scale.x=1.015 до attach при open — иначе медальон разъедется
  const facade = model.getObjectByName('closed_doors_facade')
  if (facade) {
    neutralizeNonUniformScale(facade)
    // После bake scale — выровнять ручки по world-центру (не по origin группы)
    symmetrizeHandleSpacing(facade)
  }

  // Медь node_0001: без castShadow — иначе диагональный acne на патине
  // (не импортируем attachClosedDoors — цикл с doorsUseV46Split)
  combined.traverse((child) => {
    if (!child.isMesh || !child.material) return
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    let isCopper = child === combined || COMBINED_DOOR_NAMES.includes(child.name)
    mats.forEach((mat) => {
      if (!mat) return
      if (mat.name === 'Material.002') mat.name = 'M_ClosedDoors_AI'
      if (mat.name !== 'M_ClosedDoors_AI') return
      isCopper = true
      if (mat.normalMap && mat.normalScale) mat.normalScale.set(0.42, 0.42)
      mat.needsUpdate = true
    })
    if (isCopper) {
      child.castShadow = false
      child.receiveShadow = true
    }
  })

  model.userData.pendingDoorSplit = true
  return true
}

export function needsLazyDoorSplit(model) {
  return !!model?.userData?.pendingDoorSplit && !doorsUseV46Split(model)
}
