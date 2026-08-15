import * as THREE from 'three'
import {
  CLOSED_DOORS_NODE_NAME,
  LEATHER_HARDWARE,
  LEATHER_RIM_FIT,
  findDoorPivotNode,
} from '../constants/shkafNodes'
import { LIGHT_LAYERS } from '../constants/studioScene'

const RIM_L = 'кож_обод_L'
const RIM_R = 'кож_обод_R'
const HANDLE_RIVET_PREFIX = 'leather_handle_rivet'
const RIM_RIVETS_NAME = 'leather_rim_rivets'
const RIM_WASHERS_NAME = 'leather_rim_washers'

/** Процедурная чеканка + AO для миниатюрных заклёпок (без bake в GLB). */
function createRivetDetailMaps(size = 64) {
  const normalData = new Uint8Array(size * size * 4)
  const aoData = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / (size - 1)
      const v = y / (size - 1)
      const dx = u * 2 - 1
      const dy = v * 2 - 1
      const r = Math.hypot(dx, dy)
      // мелкая чеканка
      const n =
        Math.sin(u * 38.2) * Math.cos(v * 41.7) * 0.45
        + Math.sin((u + v) * 67.0) * 0.25
      const nx = THREE.MathUtils.clamp(0.5 + n * 0.22 - dx * 0.08, 0, 1)
      const ny = THREE.MathUtils.clamp(0.5 + n * 0.18 - dy * 0.08, 0, 1)
      const i = (y * size + x) * 4
      normalData[i] = (nx * 255) | 0
      normalData[i + 1] = (ny * 255) | 0
      normalData[i + 2] = 255
      normalData[i + 3] = 255
      // AO: край шляпки темнее, центр светлее
      const edge = THREE.MathUtils.smoothstep(0.55, 1.05, r)
      const ao = THREE.MathUtils.clamp(1 - edge * 0.55 - Math.abs(n) * 0.08, 0.35, 1)
      const a = (ao * 255) | 0
      aoData[i] = a
      aoData[i + 1] = a
      aoData[i + 2] = a
      aoData[i + 3] = 255
    }
  }
  const normalMap = new THREE.DataTexture(normalData, size, size, THREE.RGBAFormat)
  normalMap.colorSpace = THREE.NoColorSpace
  normalMap.wrapS = THREE.RepeatWrapping
  normalMap.wrapT = THREE.RepeatWrapping
  normalMap.needsUpdate = true
  const aoMap = new THREE.DataTexture(aoData, size, size, THREE.RGBAFormat)
  aoMap.colorSpace = THREE.NoColorSpace
  aoMap.wrapS = THREE.ClampToEdgeWrapping
  aoMap.wrapT = THREE.ClampToEdgeWrapping
  aoMap.needsUpdate = true
  return { normalMap, aoMap }
}

const { normalMap: rivetNormalMap, aoMap: rivetAoMap } = createRivetDetailMaps()

const rivetMaterial = new THREE.MeshPhysicalMaterial({
  name: 'M_Leather_Hardware',
  color: LEATHER_HARDWARE.color,
  metalness: LEATHER_HARDWARE.metalness,
  roughness: LEATHER_HARDWARE.roughness,
  envMapIntensity: LEATHER_HARDWARE.env,
  normalMap: rivetNormalMap,
  normalScale: new THREE.Vector2(0.55, 0.55),
  aoMap: rivetAoMap,
  aoMapIntensity: 0.85,
  clearcoat: 0.22,
  clearcoatRoughness: 0.35,
})

/** Купол — больше сегментов, чтобы миниатюра не была «угловатой». */
const rivetGeometry = new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58)
/** Тонкая шайба под заклёпкой обода */
const washerGeometry = new THREE.CylinderGeometry(1, 1.05, 1, 20)
// aoMap читает uv2; для сферы/цилиндра копируем uv → uv2
function ensureAoUv(geometry) {
  const uv = geometry.attributes.uv
  if (uv && !geometry.attributes.uv2) {
    geometry.setAttribute('uv2', uv.clone())
  }
}
ensureAoUv(rivetGeometry)
ensureAoUv(washerGeometry)

/** Placeholder до applyLeatherAccentMaterials (PBR leather-mix). */
function tuneLeatherRimMaterial(mat) {
  if (!mat?.isMeshStandardMaterial && !mat?.isMeshPhysicalMaterial) return
  mat.color.set('#2a1810')
  mat.map = null
  mat.metalness = 0
  mat.roughness = 0.9
  mat.envMapIntensity = 0.12
  if ('clearcoat' in mat) mat.clearcoat = 0
  if ('sheen' in mat) mat.sheen = 0
  mat.side = THREE.DoubleSide
  mat.needsUpdate = true
}

/**
 * Сужает ремешок, наращивает объёмный профиль и губу на торец у шва.
 * Исходник — полукольцо в XZ, тонкое по Y.
 */
function reshapeLeatherRimGeometry(geometry, fit = LEATHER_RIM_FIT) {
  const geo = geometry.clone()
  const pos = geo.attributes.position
  if (!pos) return geo

  let rMin = Infinity
  let rMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const r = Math.hypot(x, z)
    rMin = Math.min(rMin, r)
    rMax = Math.max(rMax, r)
    yMin = Math.min(yMin, y)
    yMax = Math.max(yMax, y)
  }

  const oldWidth = Math.max(rMax - rMin, 1e-6)
  const newWidth = oldWidth * (fit.widthScale ?? 0.6)
  const ySpan = Math.max(yMax - yMin, 1e-6)
  const edgeDepth = fit.edgeDepth ?? 0.02
  const seamOverlap = fit.seamOverlap ?? 0.016
  const seamZone = fit.seamZone ?? 0.11

  for (let i = 0; i < pos.count; i += 1) {
    let x = pos.getX(i)
    let y = pos.getY(i)
    let z = pos.getZ(i)
    const r = Math.hypot(x, z)
    const ang = Math.atan2(z, x)

    // радиус: наружный край на месте, внутренний ближе → уже ремешок
    const t = THREE.MathUtils.clamp((r - rMin) / oldWidth, 0, 1)
    const newR = rMax - newWidth + t * newWidth
    x = Math.cos(ang) * newR
    z = Math.sin(ang) * newR

    // глубина: профиль с лёгкой «подушкой» по центру ремешка
    const yT = THREE.MathUtils.clamp((y - yMin) / ySpan, 0, 1)
    let seam = 0
    if (x < seamZone) {
      seam = 1 - x / seamZone
      x -= seamOverlap * seam
    }
    const pillow = Math.sin(t * Math.PI) * 0.22
    const depth = edgeDepth * (0.38 + 0.42 * seam + pillow)
    y = -0.001 + yT * depth

    pos.setXYZ(i, x, y, z)
  }

  pos.needsUpdate = true
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

function prepareRimMesh(mesh, name) {
  mesh.name = name
  mesh.geometry = reshapeLeatherRimGeometry(mesh.geometry)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.layers.enable(LIGHT_LAYERS.doors)
  mesh.layers.enable(LIGHT_LAYERS.accent)
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  mats.forEach((mat) => {
    if (!mat) return
    mat.name = 'Leather Dark Brown'
    tuneLeatherRimMaterial(mat)
  })
  addRimRivets(mesh)
}

/** Центр радиальной ширины ремешка после reshape — ось ряда заклёпок. */
function getRimBandCenterRadius(rim) {
  const pos = rim.geometry?.attributes?.position
  if (!pos) {
    return {
      radius: 0.5002 - (LEATHER_HARDWARE.rimRivetRadialInset ?? 0.012),
      yFront: -0.001,
    }
  }
  let rMin = Infinity
  let rMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const r = Math.hypot(x, z)
    rMin = Math.min(rMin, r)
    rMax = Math.max(rMax, r)
    yMin = Math.min(yMin, y)
    yMax = Math.max(yMax, y)
  }
  if (!Number.isFinite(rMin) || !Number.isFinite(rMax)) {
    return {
      radius: 0.5002 - (LEATHER_HARDWARE.rimRivetRadialInset ?? 0.012),
      yFront: -0.001,
    }
  }
  // После Rx(-90) локальный −Y уходит в +Z двери (к камере).
  // max(y) — это заход на торец / внутрь, не лицевая сторона.
  return {
    radius: (rMin + rMax) * 0.5,
    yFront: Number.isFinite(yMin) ? yMin : -0.001,
  }
}

/** Ряд миниатюрных купольных заклёпок + шайб строго по центру ремешка. */
function addRimRivets(rim) {
  if (rim.getObjectByName(RIM_RIVETS_NAME)) return
  const count = LEATHER_HARDWARE.rimRivetsPerHalf
  const { radius, yFront } = getRimBandCenterRadius(rim)
  const size = LEATHER_HARDWARE.rimRivetRadius
  const washerR = LEATHER_HARDWARE.rimWasherRadius
  const washerH = LEATHER_HARDWARE.rimWasherHeight

  const rivets = new THREE.InstancedMesh(rivetGeometry, rivetMaterial, count)
  rivets.name = RIM_RIVETS_NAME
  rivets.castShadow = true
  rivets.receiveShadow = true
  rivets.layers.enable(LIGHT_LAYERS.doors)

  const washers = new THREE.InstancedMesh(washerGeometry, rivetMaterial, count)
  washers.name = RIM_WASHERS_NAME
  washers.castShadow = true
  washers.receiveShadow = true
  washers.layers.enable(LIGHT_LAYERS.doors)

  const matrix = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const rivetScale = new THREE.Vector3(size, size * 0.7, size)
  const washerScale = new THREE.Vector3(washerR, washerH, washerR)
  const domeQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0))
  // −Y = к камере: шайба/купол чуть выступают наружу от лицевой кожи
  const yWasher = yFront - washerH * 0.5
  const yDome = yFront - size * 0.65

  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5) / count
    const angle = -Math.PI / 2 + t * Math.PI
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius

    position.set(x, yWasher, z)
    matrix.compose(position, quaternion, washerScale)
    washers.setMatrixAt(i, matrix)

    position.set(x, yDome, z)
    matrix.compose(position, domeQ, rivetScale)
    rivets.setMatrixAt(i, matrix)
  }
  washers.instanceMatrix.needsUpdate = true
  rivets.instanceMatrix.needsUpdate = true
  rim.add(washers)
  rim.add(rivets)
}

/**
 * Якорь на реальном конце S-ремня: кластер вершин у экстремума world-Y.
 * XY — центр кластера, Z — передняя грань. AABB-центр на изгибе врал.
 */
function sampleHandleEndAnchor(mesh, which) {
  const pos = mesh.geometry?.attributes?.position
  if (!pos) return null

  mesh.updateWorldMatrix(true, false)
  const v = new THREE.Vector3()
  const worlds = []
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
    worlds.push(v.x, v.y, v.z)
  }
  if (worlds.length < 3) return null

  let extremeY = which === 'top' ? -Infinity : Infinity
  let yMin = Infinity
  let yMax = -Infinity
  for (let i = 1; i < worlds.length; i += 3) {
    const y = worlds[i]
    yMin = Math.min(yMin, y)
    yMax = Math.max(yMax, y)
    extremeY = which === 'top' ? Math.max(extremeY, y) : Math.min(extremeY, y)
  }

  const band = Math.max((yMax - yMin) * 0.045, 0.006)
  const inset = LEATHER_HARDWARE.handleRivetEndInset ?? 0.01
  const targetY = which === 'top' ? extremeY - inset : extremeY + inset

  // Взвешенный центр: ближе к targetY — больший вес (не уезжает в сторону изгиба)
  let sx = 0
  let sy = 0
  let wSum = 0
  let maxZ = -Infinity
  for (let i = 0; i < worlds.length; i += 3) {
    const x = worlds[i]
    const y = worlds[i + 1]
    const z = worlds[i + 2]
    const dy = Math.abs(y - targetY)
    if (dy > band) continue
    const w = 1 - dy / band
    sx += x * w
    sy += y * w
    wSum += w
    maxZ = Math.max(maxZ, z)
  }
  if (wSum < 1e-6) {
    for (let i = 0; i < worlds.length; i += 3) {
      const x = worlds[i]
      const y = worlds[i + 1]
      const z = worlds[i + 2]
      const dy = Math.abs(y - extremeY)
      if (dy > band) continue
      const w = 1 - dy / band
      sx += x * w
      sy += y * w
      wSum += w
      maxZ = Math.max(maxZ, z)
    }
  }
  if (wSum < 1e-6) return null

  return new THREE.Vector3(sx / wSum, sy / wSum, maxZ)
}

/** По 1 заклёпке сверху/снизу — на поверхности геометрии, не в центре AABB. */
function addHandleRivets(root) {
  const worldBox = new THREE.Box3()
  const size = new THREE.Vector3()
  const worldPos = new THREE.Vector3()
  const domeAlign = new THREE.Vector3(0, 1, 0)
  const camFront = new THREE.Vector3(0, 0, 1)
  let added = 0

  root.traverse((child) => {
    if (!child.isMesh || !/ручка/i.test(child.name || '')) return
    if (child.getObjectByName(`${HANDLE_RIVET_PREFIX}_0`)) return

    child.updateWorldMatrix(true, false)
    worldBox.setFromObject(child)
    if (worldBox.isEmpty()) return
    worldBox.getSize(size)

    const front = LEATHER_HARDWARE.handleRivetFront
    const strapWidth = Math.max(Math.min(size.x, size.z), 1e-4)
    const radius = Math.min(
      LEATHER_HARDWARE.handleRivetRadius,
      strapWidth * 0.36,
    )

    const invWorld = new THREE.Matrix4().copy(child.matrixWorld).invert()
    const localFront = camFront.clone().transformDirection(invWorld)
    if (localFront.lengthSq() > 1e-8) localFront.normalize()
    else localFront.set(0, 0, 1)

    ;(['top', 'bottom']).forEach((which, index) => {
      const anchor = sampleHandleEndAnchor(child, which)
      if (!anchor) return

      const washer = new THREE.Mesh(washerGeometry, rivetMaterial)
      washer.name = `${HANDLE_RIVET_PREFIX}_washer_${index}`
      worldPos.copy(anchor)
      worldPos.z += front * 0.15
      child.worldToLocal(worldPos)
      washer.position.copy(worldPos)
      washer.quaternion.setFromUnitVectors(domeAlign, localFront)
      washer.scale.set(radius * 1.1, radius * 0.05, radius * 1.1)
      washer.castShadow = true
      washer.receiveShadow = true
      washer.layers.enable(LIGHT_LAYERS.doors)
      child.add(washer)

      const rivet = new THREE.Mesh(rivetGeometry, rivetMaterial)
      rivet.name = `${HANDLE_RIVET_PREFIX}_${index}`
      worldPos.copy(anchor)
      worldPos.z += front
      child.worldToLocal(worldPos)
      rivet.position.copy(worldPos)
      rivet.quaternion.setFromUnitVectors(domeAlign, localFront)
      rivet.scale.set(radius, radius * 0.68, radius)
      rivet.castShadow = true
      rivet.receiveShadow = true
      rivet.layers.enable(LIGHT_LAYERS.doors)
      child.add(rivet)
      added += 1
    })
  })

  return added
}

function findBerestaForHandle(handle) {
  const name = handle.name || ''
  const prefer = /лев|left|_l\b/i.test(name)
    ? 'Beresta_L'
    : /прав|right|_r\b/i.test(name)
      ? 'Beresta_R'
      : null
  let scope = handle.parent
  while (scope) {
    if (prefer) {
      const hit = scope.getObjectByName(prefer)
      if (hit?.isMesh) return hit
    }
    const l = scope.getObjectByName('Beresta_L')
    const r = scope.getObjectByName('Beresta_R')
    if (l?.isMesh || r?.isMesh) return l?.isMesh ? l : r
    scope = scope.parent
  }
  return null
}

/** Задняя плоскость ремня: среднее Z по задним 25% вершин (устойчивее AABB.min). */
function getHandleBackWorldZ(obj) {
  const zs = []
  const v = new THREE.Vector3()
  const collect = (mesh) => {
    const pos = mesh.geometry?.attributes?.position
    if (!pos) return
    // Заклёпки не участвуют — только ремень (крупный mesh / без rivet в имени)
    if (/rivet|washer/i.test(mesh.name || '')) return
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
      zs.push(v.z)
    }
  }
  if (obj.isMesh) collect(obj)
  else {
    obj.traverse((c) => {
      if (c.isMesh) collect(c)
    })
  }
  if (!zs.length) {
    const box = new THREE.Box3().setFromObject(obj)
    return box.isEmpty() ? null : box.min.z
  }
  zs.sort((a, b) => a - b)
  const n = Math.max(1, Math.ceil(zs.length * 0.25))
  let sum = 0
  for (let i = 0; i < n; i += 1) sum += zs[i]
  return sum / n
}

/**
 * Посадить ручки на берёсту: спинка ремня → плоскость берёсты + минимальный gap.
 * Root cause «утоплены»: в GLB `ручка_*` — Group (mesh=null), а ремень — безымянный child;
 * старый код искал isMesh+/ручка/ и пропускал группу целиком.
 */
export function seatHandlesOnBeresta(root) {
  const gap = LEATHER_HARDWARE.handleSeatGap ?? 0.0012
  const berestaBox = new THREE.Box3()
  const parentScale = new THREE.Vector3()
  const handles = []

  root.traverse((child) => {
    const name = child.name || ''
    if (!/ручка/i.test(name)) return
    if (/rivet|washer/i.test(name)) return
    handles.push(child)
  })

  handles.forEach((handle) => {
    const beresta = findBerestaForHandle(handle)
    if (!beresta) return

    handle.updateWorldMatrix(true, true)
    beresta.updateWorldMatrix(true, false)
    berestaBox.setFromObject(beresta)
    if (berestaBox.isEmpty()) return

    const backZ = getHandleBackWorldZ(handle)
    if (backZ == null) return

    // Берёста плоская в XY; лицевая — max.z.
    const deltaWorldZ = berestaBox.max.z + gap - backZ
    if (Math.abs(deltaWorldZ) > 1e-6) {
      if (handle.parent) {
        handle.parent.getWorldScale(parentScale)
        const sz = Math.abs(parentScale.z) > 1e-6 ? parentScale.z : 1
        handle.position.z += deltaWorldZ / sz
      } else {
        handle.position.z += deltaWorldZ
      }
    }

    handle.traverse((c) => {
      if (!c.isMesh) return
      c.castShadow = true
      c.receiveShadow = true
      c.layers.enable(LIGHT_LAYERS.doors)
      // handleShadow light смотрит только accent — без этого нет contact-тени
      c.layers.enable(LIGHT_LAYERS.accent)
    })
    handle.userData.leatherBaseZ = handle.position.z
  })

  symmetrizeHandleSpacing(root)
}

const _symBox = new THREE.Box3()
const _symCenter = new THREE.Vector3()
const _symParentScale = new THREE.Vector3()

/** World X центра ручки (AABB) — не origin группы: у ремня общий local offset, не зеркало. */
function getHandleWorldCenterX(handle) {
  handle.updateWorldMatrix(true, true)
  _symBox.setFromObject(handle)
  if (_symBox.isEmpty()) return null
  _symBox.getCenter(_symCenter)
  return _symCenter.x
}

/**
 * Root cause «без изменений»: симметрия position.x групп бесполезна —
 * у обеих ручек одинаковый local offset ремня (−0.025), не зеркальный →
 * визуальный центр левой ближе к шву. Ровняем по world AABB center.
 * Вызывать ПОСЛЕ neutralizeNonUniformScale(facade).
 */
export function symmetrizeHandleSpacing(root) {
  if (!root) return
  /** @type {Map<THREE.Object3D, { left: THREE.Object3D[], right: THREE.Object3D[] }>} */
  const byParent = new Map()

  root.traverse((child) => {
    const name = child.name || ''
    if (!/^ручка_(левая|правая)/i.test(name)) return
    if (/rivet|washer/i.test(name)) return
    const parent = child.parent || root
    let bucket = byParent.get(parent)
    if (!bucket) {
      bucket = { left: [], right: [] }
      byParent.set(parent, bucket)
    }
    if (/лев/i.test(name)) bucket.left.push(child)
    else bucket.right.push(child)
  })

  // Шов бересты в world X (между max L и min R)
  let seamX = null
  const bL = root.getObjectByName('Beresta_L')
  const bR = root.getObjectByName('Beresta_R')
  if (bL && bR) {
    bL.updateWorldMatrix(true, false)
    bR.updateWorldMatrix(true, false)
    const boxL = new THREE.Box3().setFromObject(bL)
    const boxR = new THREE.Box3().setFromObject(bR)
    if (!boxL.isEmpty() && !boxR.isEmpty()) {
      seamX = (boxL.max.x + boxR.min.x) * 0.5
    }
  }

  byParent.forEach(({ left, right }) => {
    const n = Math.min(left.length, right.length)
    for (let i = 0; i < n; i += 1) {
      const L = left[i]
      const R = right[i]
      const cL = getHandleWorldCenterX(L)
      const cR = getHandleWorldCenterX(R)
      if (cL == null || cR == null) continue

      const mid = seamX != null ? seamX : (cL + cR) * 0.5
      const dist = (Math.abs(cL - mid) + Math.abs(cR - mid)) * 0.5
      const targetL = mid - dist
      const targetR = mid + dist

      const shiftLocal = (handle, worldDeltaX) => {
        if (Math.abs(worldDeltaX) < 1e-6) return
        if (handle.parent) {
          handle.parent.getWorldScale(_symParentScale)
          const sx = Math.abs(_symParentScale.x) > 1e-6 ? _symParentScale.x : 1
          handle.position.x += worldDeltaX / sx
        } else {
          handle.position.x += worldDeltaX
        }
      }
      shiftLocal(L, targetL - cL)
      shiftLocal(R, targetR - cR)
    }
  })
}

function getBerestaRadius(beresta) {
  if (!beresta?.isMesh) return 0.484
  const geo = beresta.geometry
  if (!geo.boundingBox) geo.computeBoundingBox()
  const box = geo.boundingBox
  if (!box) return 0.484
  const sx = Math.abs(beresta.scale.x || 1)
  const sy = Math.abs(beresta.scale.y || 1)
  return 0.5 * Math.max(box.max.x - box.min.x, box.max.y - box.min.y) * Math.max(sx, sy)
}

/**
 * Полукольцо XZ → плоскость двери XY; L зеркалим.
 * outerPad держит наружный край чуть снаружи берёсты.
 */
function placeRimOnBeresta(rim, beresta, side, fit = LEATHER_RIM_FIT) {
  if (!rim || !beresta) return
  rim.position.copy(beresta.position)
  rim.rotation.set(-Math.PI / 2, 0, 0)

  // исходный rMax ≈ 0.500; масштабируем под радиус берёсты
  const berestaR = getBerestaRadius(beresta)
  const srcRMax = 0.5002
  const s = (berestaR * (fit.outerPad ?? 1.015)) / srcRMax
  rim.scale.set(side === 'left' ? -s : s, s, s)
  rim.position.z += fit.frontZ ?? 0.003
}

function takeRimFromScene(scene, name) {
  const src = scene.getObjectByName(name)
  if (!src?.isMesh) return null
  const rim = src.clone(true)
  prepareRimMesh(rim, name)
  return rim
}

/**
 * Вешает кожаный ободок на door_left / door_right (видно при открытых дверях)
 * и копию на closed_doors_facade (закрытый AI-фасад).
 */
export function attachLeatherRims(model, rimScene) {
  if (!model || !rimScene) return 0
  let attached = 0

  ;([
    { side: 'left', rimName: RIM_L, berestaName: 'Beresta_L' },
    { side: 'right', rimName: RIM_R, berestaName: 'Beresta_R' },
  ]).forEach(({ side, rimName, berestaName }) => {
    const door = findDoorPivotNode(model, side)
    if (!door) return
    if (door.getObjectByName(rimName)) return

    const rim = takeRimFromScene(rimScene, rimName)
    if (!rim) return
    const beresta = door.getObjectByName(berestaName)
    placeRimOnBeresta(rim, beresta, side)
    door.add(rim)
    attached += 1
  })

  const facade = model.getObjectByName(CLOSED_DOORS_NODE_NAME)
  if (facade) {
    ;([
      { side: 'left', rimName: RIM_L, berestaName: 'Beresta_L' },
      { side: 'right', rimName: RIM_R, berestaName: 'Beresta_R' },
    ]).forEach(({ side, rimName, berestaName }) => {
      const facadeRimName = `${rimName}_facade`
      if (facade.getObjectByName(facadeRimName)) return
      const rim = takeRimFromScene(rimScene, rimName)
      if (!rim) return
      rim.name = facadeRimName
      const beresta = facade.getObjectByName(berestaName)
      placeRimOnBeresta(rim, beresta, side)
      facade.add(rim)
      attached += 1
    })
  }

  seatHandlesOnBeresta(model)
  addHandleRivets(model)
  return attached
}
