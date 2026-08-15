import * as THREE from 'three'

/**
 * ∞-ножки: Extrude прямоугольного сечения вдоль сглаженного spine.
 * Силуэт петли = путь из GLB; толщина/ширина = сечение.
 */
export const LEG_DETAIL = {
  /** профиль ≈90×80 мм — толще GLB, без Laplacian (он взрывал вершины) */
  sectionWidth: 0.09,
  sheetThickness: 0.08,
  fallbackHalfWidth: 0.045,
  /** потолок scale тонкой оси — иначе NaN/шипы при битом bbox */
  maxThicknessScale: 3,
  taperAtCross: 0.74,
  taperRadius: 0.28,
  spineBins: 80,
  extrudeSteps: 140,
  bevel: 0.004,
  /** v17: убран widenRibbonFromSkeleton (Laplacian → vertex explosion) */
  reshapeVersion: 17,
}

/**
 * Две пары ∞ по глубине шкафа (якоря из старого CabinetLegs / GLB).
 * Одна пара в GLB по центру → сдвигаем вперёд и клонируем назад.
 */
export const LEG_PAIR_Z = {
  front: 0.179,
  back: -0.262,
}

/** Подгонка ширины ∞ под корпус (ноги не должны выпирать за бока). */
export const LEG_FIT = {
  /** зазор от бока корпуса до наружного края ножек */
  inset: 0.02,
  /** v46: ноги уже корпуса — разрешаем расширять (раньше max=1 только сужал) */
  maxScale: 12,
  minScale: 0.5,
}

function toAsciiName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isBezierRibbonName(name) {
  // Blender: "BézierCurve.004" или иногда "BézierCurve004"
  return /^BezierCurve(\.\d+)?$/i.test(toAsciiName(name))
    || /^BezierCurve\d+$/i.test(toAsciiName(name))
}

export function collectRibbonLegMeshes(root, { pair } = {}) {
  if (!root) return []
  const meshes = []
  const seen = new Set()

  // Только ленты BézierCurve* (+ клоны задней пары) — не медальон / декор.
  root.traverse((child) => {
    if (!child?.isMesh || seen.has(child)) return
    const ribbon = isBezierRibbonName(child.name) || child.userData?.legRibbon
    if (!ribbon) return
    if (pair === 'front' && child.userData?.legPairRole === 'back') return
    if (pair === 'back' && child.userData?.legPairRole !== 'back') return
    seen.add(child)
    meshes.push(child)
  })

  return meshes
}

/**
 * После reshape: передняя пара на Z_FRONT, задняя — клон на Z_BACK.
 * Идемпотентно (HMR): задние клоны пересобираются, base Z хранится в userData.
 */
export function ensureDualRibbonLegPairs(root, zPair = LEG_PAIR_Z) {
  if (!root) return { front: [], back: [] }

  const staleBack = []
  root.traverse((o) => {
    if (o.userData?.legPairRole === 'back') staleBack.push(o)
  })
  staleBack.forEach((o) => o.parent?.remove(o))

  const fronts = collectRibbonLegMeshes(root, { pair: 'front' })
  if (!fronts.length) return { front: [], back: [] }

  const frame = root.getObjectByName('Table_Top_Frame')
  const frameIsAncestor = !!(frame && fronts.some((m) => {
    let p = m.parent
    while (p) {
      if (p === frame) return true
      p = p.parent
    }
    return false
  }))

  root.updateMatrixWorld(true)
  const box = new THREE.Box3()
  fronts.forEach((m) => box.expandByObject(m))
  if (box.isEmpty()) return { front: [], back: [] }

  if (root.userData.legRibbonHomeZ == null) {
    root.userData.legRibbonHomeZ = box.getCenter(new THREE.Vector3()).z
  }
  const homeZ = root.userData.legRibbonHomeZ
  const dFront = zPair.front - homeZ
  const dBack = zPair.back - homeZ

  fronts.forEach((mesh) => {
    if (mesh.userData.legBasePosZ == null) {
      mesh.userData.legBasePosZ = mesh.position.z
    }
    mesh.userData.legPairRole = 'front'
    mesh.userData.legRibbon = true
  })

  const backs = []

  if (frameIsAncestor) {
    // двигаем весь узел frame → ленты едут с ним; локальный Z лент = base
    if (frame.userData.legBasePosZ == null) {
      frame.userData.legBasePosZ = frame.position.z
    }
    fronts.forEach((mesh) => {
      mesh.position.z = mesh.userData.legBasePosZ
    })
    frame.position.z = frame.userData.legBasePosZ + dFront
    frame.userData.legPairRole = 'front'

    fronts.forEach((mesh) => {
      const clone = mesh.clone(false)
      clone.geometry = mesh.geometry
      clone.material = mesh.material
      clone.name = `${mesh.name}_back`
      clone.userData = {
        ...mesh.userData,
        legPairRole: 'back',
        legRibbon: true,
        legSourceGeometry: undefined,
      }
      // frame уже +dFront; локально добираем до dBack
      clone.position.copy(mesh.position)
      clone.position.z = mesh.userData.legBasePosZ + (dBack - dFront)
      clone.quaternion.copy(mesh.quaternion)
      clone.scale.copy(mesh.scale)
      clone.castShadow = true
      clone.receiveShadow = true
      clone.raycast = () => null
      mesh.parent.add(clone)
      backs.push(clone)
    })

    if (frame.isMesh && frame.parent) {
      const frameBack = frame.clone(false)
      frameBack.geometry = frame.geometry
      frameBack.material = frame.material
      frameBack.name = 'Table_Top_Frame_back'
      frameBack.userData = {
        ...frame.userData,
        legPairRole: 'back',
        legSourceGeometry: undefined,
      }
      frameBack.position.copy(frame.position)
      frameBack.position.z = frame.userData.legBasePosZ + dBack
      frameBack.castShadow = true
      frameBack.receiveShadow = true
      frameBack.raycast = () => null
      frame.parent.add(frameBack)
    }
  } else {
    // ленты — самостоятельные меши
    fronts.forEach((mesh) => {
      mesh.position.z = mesh.userData.legBasePosZ + dFront
    })
    if (frame?.isMesh) {
      if (frame.userData.legBasePosZ == null) {
        frame.userData.legBasePosZ = frame.position.z
      }
      frame.position.z = frame.userData.legBasePosZ + dFront
      frame.userData.legPairRole = 'front'
    }

    fronts.forEach((mesh) => {
      if (!mesh.parent) return
      const clone = mesh.clone(false)
      clone.geometry = mesh.geometry
      clone.material = mesh.material
      clone.name = `${mesh.name}_back`
      clone.userData = {
        ...mesh.userData,
        legPairRole: 'back',
        legRibbon: true,
        legSourceGeometry: undefined,
      }
      clone.position.copy(mesh.position)
      clone.position.z = mesh.userData.legBasePosZ + dBack
      clone.quaternion.copy(mesh.quaternion)
      clone.scale.copy(mesh.scale)
      clone.castShadow = true
      clone.receiveShadow = true
      clone.raycast = () => null
      mesh.parent.add(clone)
      backs.push(clone)
    })

    if (frame?.isMesh && frame.parent) {
      const frameBack = frame.clone(false)
      frameBack.geometry = frame.geometry
      frameBack.material = frame.material
      frameBack.name = 'Table_Top_Frame_back'
      frameBack.userData = {
        ...frame.userData,
        legPairRole: 'back',
        legSourceGeometry: undefined,
      }
      frameBack.position.copy(frame.position)
      frameBack.position.z = frame.userData.legBasePosZ + dBack
      frameBack.castShadow = true
      frameBack.receiveShadow = true
      frameBack.raycast = () => null
      frame.parent.add(frameBack)
    }
  }

  root.updateMatrixWorld(true)
  const zOf = (meshes) => {
    if (!meshes.length) return null
    const b = new THREE.Box3()
    meshes.forEach((m) => b.expandByObject(m))
    return +b.getCenter(new THREE.Vector3()).z.toFixed(3)
  }

  return {
    front: fronts,
    back: backs,
    zFront: zOf(fronts),
    zBack: zOf(backs),
    homeZ: +homeZ.toFixed(3),
    frameParent: frameIsAncestor,
  }
}

function isV46RibbonLegName(name) {
  // node_0 / node_0002 — ленты; node_0001 — двери, не трогать
  return /^node_0$/i.test(name)
    || /^node_0\.002$/i.test(name)
    || /^node_0002$/i.test(name)
}

function isLegRelatedObject(obj) {
  let n = obj
  while (n) {
    const name = n.name || ''
    if (/^Table_Top_Frame/i.test(name)) return true
    if (isBezierRibbonName(name) || n.userData?.legRibbon) return true
    if (isV46RibbonLegName(name)) return true
    if (/^leg_cross_medallion/i.test(name)) return true
    n = n.parent
  }
  return false
}

function measureBodyBox(root) {
  const box = new THREE.Box3()
  const shkaf = root.getObjectByName('shkaf')
  const scope = shkaf || root
  const tmp = new THREE.Box3()
  const size = new THREE.Vector3()

  const addMesh = (child) => {
    if (!child.isMesh || !child.visible) return
    if (isLegRelatedObject(child)) return
    tmp.setFromObject(child)
    if (tmp.isEmpty()) return
    tmp.getSize(size)
    // отсечь выбросы (битые/далекие меши в GLB давали body≈33)
    if (size.x > 5 || size.y > 5 || size.z > 5) return
    if (Math.abs(tmp.getCenter(new THREE.Vector3()).x) > 5) return
    box.union(tmp)
  }

  scope.traverse(addMesh)
  ;['door_left', 'door_right', 'door_righr', 'door_left.001', 'closed_doors_facade'].forEach((name) => {
    const node = root.getObjectByName(name)
    if (!node) return
    node.traverse(addMesh)
  })
  return box
}

function measureLegBox(root) {
  const box = new THREE.Box3()
  root.traverse((child) => {
    if (!child.isMesh || !child.visible) return
    if (!isLegRelatedObject(child)) return
    if (/^leg_cross_medallion/i.test(child.name || '')) return
    box.expandByObject(child)
  })
  return box
}

/** Сжать геометрию по world-X вокруг центра корпуса (unique BufferGeometry один раз). */
function bakeWorldScaleX(mesh, scaleX, centerX, done) {
  let geo = mesh.geometry
  if (!geo?.attributes?.position) return

  // frame: всегда от исходника — иначе HMR удваивает сжатие
  if (/^Table_Top_Frame/i.test(mesh.name || '')) {
    if (!mesh.userData.legFitSourceGeometry) {
      mesh.userData.legFitSourceGeometry = geo.clone()
    }
    mesh.geometry = mesh.userData.legFitSourceGeometry.clone()
    geo = mesh.geometry
  }

  if (done.has(geo.uuid)) return
  done.add(geo.uuid)

  mesh.updateMatrixWorld(true)
  const world = mesh.matrixWorld
  const inv = new THREE.Matrix4().copy(world).invert()
  const pos = geo.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i).applyMatrix4(world)
    v.x = centerX + (v.x - centerX) * scaleX
    v.applyMatrix4(inv)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  pos.needsUpdate = true
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  geo.computeVertexNormals()
}

/**
 * Сжать ∞ по X под ширину корпуса.
 * Root cause прошлого фикса: scale.x на Table_Top_Frame крутился вокруг
 * pivot frame, а не центра корпуса — силуэт почти не сужался.
 */
export function fitLegsToCabinetWidth(root, fit = LEG_FIT) {
  if (!root) return null

  // сброс старого transform-fit
  root.traverse((o) => {
    if (o.userData?.legFitBaseScaleX != null) {
      o.scale.x = o.userData.legFitBaseScaleX
      delete o.userData.legFitBaseScaleX
    }
  })
  root.updateMatrixWorld(true)

  const bodyBox = measureBodyBox(root)
  const legBox = measureLegBox(root)
  if (bodyBox.isEmpty() || legBox.isEmpty()) return null

  const bodyW = bodyBox.max.x - bodyBox.min.x
  const legW = legBox.max.x - legBox.min.x
  if (bodyW < 1e-4 || legW < 1e-4) return null

  const bodyCenterX = (bodyBox.min.x + bodyBox.max.x) * 0.5
  const targetW = Math.max(bodyW - fit.inset * 2, bodyW * 0.85)
  let scaleX = targetW / legW
  scaleX = THREE.MathUtils.clamp(scaleX, fit.minScale, fit.maxScale)

  if (scaleX >= 0.998) {
    return {
      scaleX: 1,
      bodyW: +bodyW.toFixed(3),
      legW: +legW.toFixed(3),
      skipped: true,
    }
  }

  const done = new Set()
  const targets = []
  root.traverse((child) => {
    if (!child.isMesh || !child.visible) return
    if (!isLegRelatedObject(child)) return
    if (/^leg_cross_medallion/i.test(child.name || '')) return
    targets.push(child)
  })
  targets.forEach((mesh) => bakeWorldScaleX(mesh, scaleX, bodyCenterX, done))

  // задние клоны шарят geo
  collectRibbonLegMeshes(root, { pair: 'back' }).forEach((back) => {
    const frontName = String(back.name || '').replace(/_back$/i, '')
    const front = collectRibbonLegMeshes(root, { pair: 'front' })
      .find((m) => m.name === frontName)
    if (front?.geometry) back.geometry = front.geometry
  })
  const frameBack = root.getObjectByName('Table_Top_Frame_back')
  const frameFront = root.getObjectByName('Table_Top_Frame')
  if (frameBack?.isMesh && frameFront?.isMesh) {
    frameBack.geometry = frameFront.geometry
  }

  root.updateMatrixWorld(true)
  const after = measureLegBox(root)
  return {
    scaleX: +scaleX.toFixed(4),
    bodyW: +bodyW.toFixed(3),
    legW: +legW.toFixed(3),
    afterW: after.isEmpty() ? null : +(after.max.x - after.min.x).toFixed(3),
  }
}

function applyWorldDelta(obj, deltaWorld) {
  if (!obj || deltaWorld.lengthSq() < 1e-12) return
  const world = new THREE.Vector3()
  obj.getWorldPosition(world)
  world.add(deltaWorld)
  if (obj.parent) {
    obj.parent.worldToLocal(world)
    obj.position.copy(world)
  } else {
    obj.position.copy(world)
  }
}

/**
 * Baked медальон v46 часто «висит» впереди/ниже креста.
 * Сдвигаем front/back группы так, чтобы диск лёг вплотную на перекрестье ∞.
 */
export function snapBakedLegMedallionsToCross(root, { forwardGap = 0.004 } = {}) {
  if (!root) return 0
  root.updateMatrixWorld(true)
  const legBox = measureLegBox(root)
  if (legBox.isEmpty()) return 0

  const cx = (legBox.min.x + legBox.max.x) * 0.5
  const cy = (legBox.min.y + legBox.max.y) * 0.5

  const all = []
  root.traverse((o) => {
    if (!o.isMesh) return
    if (!/^leg_cross_medallion/i.test(o.name || '')) return
    all.push(o)
  })
  if (!all.length) return 0

  const isBack = (o) => /001$/.test(String(o.name || '').replace(/\./g, ''))
  const fronts = all.filter((o) => !isBack(o))
  const backs = all.filter((o) => isBack(o))

  const snapGroup = (group, face) => {
    if (!group.length) return 0
    const logo = group.find((o) => /logo/i.test(o.name || '')) || group[0]
    logo.updateWorldMatrix(true, false)
    const box = new THREE.Box3().setFromObject(logo)
    if (box.isEmpty()) return 0
    const center = box.getCenter(new THREE.Vector3())
    const delta = new THREE.Vector3(cx - center.x, cy - center.y, 0)
    if (face === 'front') {
      // задняя грань медальона → лицевая плоскость лент
      delta.z = legBox.max.z + forwardGap - box.min.z
    } else {
      delta.z = legBox.min.z - forwardGap - box.max.z
    }
    group.forEach((o) => applyWorldDelta(o, delta))
    return group.length
  }

  return snapGroup(fronts, 'front') + snapGroup(backs, 'back')
}

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / Math.max(edge1 - edge0, 1e-6), 0, 1)
  return t * t * (3 - 2 * t)
}

function getCrossCenter(meshes) {
  const box = new THREE.Box3()
  meshes.forEach((m) => {
    m.updateWorldMatrix(true, false)
    box.expandByObject(m)
  })
  return box.getCenter(new THREE.Vector3())
}

/** Spine = центр масс сечения по UV.u + медианная полуширина. */
function extractSpineData(geo, bins) {
  const pos = geo.attributes.position
  const uv = geo.attributes.uv
  if (!uv) return null

  const sums = Array.from({ length: bins }, () => new THREE.Vector3())
  const counts = new Float32Array(bins)
  const radials = Array.from({ length: bins }, () => [])
  const p = new THREE.Vector3()

  for (let i = 0; i < pos.count; i += 1) {
    const u = THREE.MathUtils.clamp(uv.getX(i), 0, 0.9999)
    const bin = Math.floor(u * bins)
    p.fromBufferAttribute(pos, i)
    sums[bin].add(p)
    counts[bin] += 1
  }

  for (let b = 0; b < bins; b += 1) {
    if (counts[b] > 0) sums[b].multiplyScalar(1 / counts[b])
  }
  for (let b = 1; b < bins; b += 1) {
    if (counts[b] === 0) {
      sums[b].copy(sums[b - 1])
      counts[b] = 1
    }
  }
  for (let b = bins - 2; b >= 0; b -= 1) {
    if (counts[b] === 0) sums[b].copy(sums[b + 1])
  }

  for (let i = 0; i < pos.count; i += 1) {
    const u = THREE.MathUtils.clamp(uv.getX(i), 0, 0.9999)
    const bin = Math.floor(u * bins)
    p.fromBufferAttribute(pos, i)
    radials[bin].push(p.distanceTo(sums[bin]))
  }

  const halfWidths = new Float32Array(bins)
  for (let b = 0; b < bins; b += 1) {
    const arr = radials[b].sort((a, c) => a - c)
    const med = arr.length ? arr[Math.floor(arr.length * 0.5)] : LEG_DETAIL.fallbackHalfWidth
    halfWidths[b] = Math.max(med, LEG_DETAIL.fallbackHalfWidth * 0.7)
  }

  // сгладить точки
  let pts = sums.map((v) => v.clone())
  for (let pass = 0; pass < 4; pass += 1) {
    const next = pts.map((v) => v.clone())
    for (let b = 1; b < bins - 1; b += 1) {
      next[b].set(
        pts[b - 1].x * 0.25 + pts[b].x * 0.5 + pts[b + 1].x * 0.25,
        pts[b - 1].y * 0.25 + pts[b].y * 0.5 + pts[b + 1].y * 0.25,
        pts[b - 1].z * 0.25 + pts[b].z * 0.5 + pts[b + 1].z * 0.25,
      )
    }
    pts = next
  }

  // убрать почти нулевые сегменты
  const cleaned = [pts[0].clone()]
  const cleanedW = [halfWidths[0]]
  for (let b = 1; b < bins; b += 1) {
    if (cleaned[cleaned.length - 1].distanceTo(pts[b]) < 0.002) continue
    cleaned.push(pts[b].clone())
    cleanedW.push(halfWidths[b])
  }
  if (cleaned.length < 6) return null

  // медианная полуширина — стабильная база
  const sortedW = [...cleanedW].sort((a, b) => a - b)
  const baseHalfW = sortedW[Math.floor(sortedW.length * 0.5)]

  return { points: cleaned, baseHalfW }
}

function applyWidthTaper(geometry, curve, crossLocal, baseHalfW, cfg) {
  const pos = geometry.attributes.position
  const p = new THREE.Vector3()
  const nearest = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const binormal = new THREE.Vector3()
  const offset = new THREE.Vector3()
  const tmp = new THREE.Vector3()

  // frames along curve
  const samples = 64
  const frames = []
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples
    const pt = curve.getPointAt(t)
    const tan = curve.getTangentAt(t).normalize()
    frames.push({ t, pt, tan })
  }

  for (let i = 0; i < pos.count; i += 1) {
    p.fromBufferAttribute(pos, i)

    // nearest frame
    let best = 0
    let bestD = Infinity
    for (let f = 0; f < frames.length; f += 1) {
      const d = p.distanceToSquared(frames[f].pt)
      if (d < bestD) {
        bestD = d
        best = f
      }
    }
    const fr = frames[best]
    nearest.copy(fr.pt)
    tangent.copy(fr.tan)

    // local frame
    tmp.set(0, 0, 1)
    normal.crossVectors(tangent, tmp)
    if (normal.lengthSq() < 1e-8) {
      tmp.set(0, 1, 0)
      normal.crossVectors(tangent, tmp)
    }
    normal.normalize()
    binormal.crossVectors(tangent, normal).normalize()
    normal.crossVectors(binormal, tangent).normalize()

    offset.subVectors(p, nearest)
    const alongT = offset.dot(tangent)
    const alongN = offset.dot(normal)
    const alongB = offset.dot(binormal)

    const dist = Math.hypot(nearest.x - crossLocal.x, nearest.y - crossLocal.y)
    const taper = THREE.MathUtils.lerp(
      cfg.taperAtCross,
      1,
      smoothstep(0, cfg.taperRadius, dist),
    )

    // ширина (normal) сужается; толщина (binormal) константа
    p.copy(nearest)
      .addScaledVector(tangent, alongT)
      .addScaledVector(normal, alongN * taper)
      .addScaledVector(binormal, alongB)

    pos.setXYZ(i, p.x, p.y, p.z)
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
  void baseHalfW
}

function buildSheetExtrusion(spinePoints, baseHalfW, cfg) {
  const curve = new THREE.CatmullRomCurve3(spinePoints, false, 'catmullrom', 0.25)
  // фиксированный профиль (LEG_DETAIL.sectionWidth × sheetThickness), если задан sectionWidth
  const hw = cfg.sectionWidth != null ? cfg.sectionWidth * 0.5 : baseHalfW
  const ht = cfg.sheetThickness * 0.5

  const shape = new THREE.Shape()
  const b = Math.min(cfg.bevel, hw * 0.35, ht * 0.35)
  // прямоугольник с лёгкой фаской (8 точек)
  shape.moveTo(-hw + b, -ht)
  shape.lineTo(hw - b, -ht)
  shape.lineTo(hw, -ht + b)
  shape.lineTo(hw, ht - b)
  shape.lineTo(hw - b, ht)
  shape.lineTo(-hw + b, ht)
  shape.lineTo(-hw, ht - b)
  shape.lineTo(-hw, -ht + b)
  shape.closePath()

  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: cfg.extrudeSteps,
    bevelEnabled: false,
    extrudePath: curve,
    curveSegments: 4,
  })
  geo.computeVertexNormals()
  return { geo, curve, sectionHalfW: hw }
}

/**
 * Утолщение baked Extrude-ленты без пересборки пути.
 *
 * Безопасно: pristine GLB → scale тонкой оси до sheetThickness.
 * НЕ использовать Laplacian-скелет: при widthScale≫1 вершины улетают в «шипы».
 */
function thickenRibbonPreservePath(mesh, cfg = LEG_DETAIL) {
  if (!mesh?.geometry?.attributes?.position) return false

  if (!mesh.userData.legPristineGeometry) {
    mesh.userData.legPristineGeometry = mesh.geometry.clone()
  }
  const pristine = mesh.userData.legPristineGeometry
  const geo = pristine.clone()
  geo.computeBoundingBox()
  const box = geo.boundingBox
  const size = box.getSize(new THREE.Vector3())
  const loopSpan = Math.max(size.x, size.y)
  if (loopSpan < 0.25 || loopSpan > 5) {
    console.warn('РУССО: pristine leg bbox bad', mesh.name, size.toArray())
    return false
  }

  const axis = size.z <= size.x && size.z <= size.y ? 'z' : (size.x <= size.y ? 'x' : 'y')
  const currentT = axis === 'x' ? size.x : axis === 'y' ? size.y : size.z
  const mid = axis === 'x'
    ? (box.min.x + box.max.x) * 0.5
    : axis === 'y'
      ? (box.min.y + box.max.y) * 0.5
      : (box.min.z + box.max.z) * 0.5
  const zScale = Math.min(
    cfg.sheetThickness / Math.max(currentT, 1e-6),
    cfg.maxThicknessScale ?? 3,
  )

  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i += 1) {
    if (axis === 'x') pos.setX(i, mid + (pos.getX(i) - mid) * zScale)
    else if (axis === 'y') pos.setY(i, mid + (pos.getY(i) - mid) * zScale)
    else pos.setZ(i, mid + (pos.getZ(i) - mid) * zScale)
  }

  // Лёгкий inflate только по XY-нормали (кромки ленты), без скелета.
  const extra = Math.max(0, (cfg.sectionWidth - currentT) * 0.5)
  if (extra > 1e-5 && axis === 'z') {
    geo.computeVertexNormals()
    const nrm = geo.attributes.normal
    for (let i = 0; i < pos.count; i += 1) {
      const nx = nrm.getX(i)
      const ny = nrm.getY(i)
      const len = Math.hypot(nx, ny)
      if (len < 0.35) continue
      pos.setX(i, pos.getX(i) + (nx / len) * extra)
      pos.setY(i, pos.getY(i) + (ny / len) * extra)
    }
  }

  pos.needsUpdate = true
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  geo.computeBoundingSphere()

  const after = geo.boundingBox.getSize(new THREE.Vector3())
  const afterSpan = Math.max(after.x, after.y)
  // collapse ИЛИ explosion (Laplacian раньше давал шипы на весь экран)
  if (afterSpan < 0.25 || afterSpan > loopSpan * 2.5 || !Number.isFinite(afterSpan)) {
    console.warn('РУССО: leg thicken bad result — keep pristine', mesh.name, after.toArray())
    mesh.geometry = pristine.clone()
    return false
  }

  mesh.geometry = geo
  mesh.userData.legReshapeVersion = cfg.reshapeVersion
  mesh.userData.legThickened = true
  mesh.userData.legThickenAxis = axis
  mesh.userData.legThickenScale = zScale
  mesh.castShadow = true
  mesh.receiveShadow = true
  return true
}

export function thickenBakedLegs(root, cfg = LEG_DETAIL) {
  if (!root) return 0
  const meshes = collectRibbonLegMeshes(root)
  if (!meshes.length) {
    console.warn('РУССО: no ribbon leg meshes')
    return 0
  }

  let count = 0
  meshes.forEach((mesh) => {
    if (mesh.userData.legReshapeVersion === cfg.reshapeVersion) return
    if (thickenRibbonPreservePath(mesh, cfg)) count += 1
  })
  return count
}

export const reshapeSheetMetalLegs = thickenBakedLegs
