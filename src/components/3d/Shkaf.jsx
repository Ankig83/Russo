import { useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { drawerSections } from '../../constants/sections'
import {
  SHKAF_MODEL_PATH,
  SHKAF_LEGS_MODEL_PATH,
  SHKAF_NODE_MAP,
  SHKAF_ROOT_NAME,
  HIDE_SCENE_DECOR,
  CABINET_SCENE_ROOTS,
  findDoorPivotNode,
  INACTIVE_DRAWER_NODES,
  INACTIVE_MESH_NAMES,
  DRAWER_LID_TO_BODY,
  DRAWER_FRONT_NODES,
  DRAWER_TABL_NODES,
  GLB_LEG_NODES,
  USE_PROCEDURAL_LEGS,
} from '../../constants/shkafNodes'
import CabinetLegs from './CabinetLegs'
import {
  DOOR_ROTATION_AXIS,
  DOOR_LEFT_OPEN_ANGLE,
  DOOR_RIGHT_OPEN_ANGLE,
  DOOR_OPEN_DURATION,
  DRAWER_PULL_DISTANCE,
  DRAWER_OPEN_DURATION,
  NAVIGATE_DELAY_MS,
} from '../../constants/shkaf'
import { useShkafStore } from '../../store/shkafStore'
import FitCamera from './FitCamera'
import { USE_STUDIO_CAMERA, USE_HDRI_ONLY, LIGHT_LAYERS, getEffectiveSplitCorpusLight, STUDIO } from '../../constants/studioScene'
import { getCabinetBounds, getCabinetPlacement, findByName } from '../../utils/cabinetBounds'
import { attachGlbLegs } from '../../utils/attachGlbLegs'
import {
  findDrawerNodeFromHit,
  findDrawerSectionFromHit,
  getDrawerBodyName,
} from '../../utils/drawerHit'
import { USE_RAW_GLB_MATERIALS } from '../../constants/studioScene'
import { applyDoorPanelPatinaTextures, loadPatinaTextures } from '../../utils/patinaTextures'
import {
  applyRawMaterialPipeline,
  applyStudioMaterialFixups,
  isBerestaMaterial,
} from '../../utils/materialFixups'

useGLTF.preload(SHKAF_MODEL_PATH)
useGLTF.preload(SHKAF_LEGS_MODEL_PATH)

const HOVER_NUDGE = 0.032
const HOVER_WIGGLE_DURATION = 0.45
const HOVER_EMISSIVE = '#c9a040'
const HOVER_EMISSIVE_INTENSITY = 0.32

/** Ящики без анимации выдвижения при hover — только подсветка */
const HOVER_HIGHLIGHT_ONLY = new Set()

/** Свет внутри шкафа должен доставать до обоих слоёв (двери + медный корпус) */
function enableBothLightLayers(light) {
  if (!light) return
  light.layers.enable(LIGHT_LAYERS.doors)
  if (getEffectiveSplitCorpusLight()) light.layers.enable(LIGHT_LAYERS.corpus)
}

/**
 * Внутренний спот шкафа — мягкий верхний акцент (лёгкая тень под полками).
 * При split corpus light светит на оба слоя.
 */
function InteriorSpot({ position, target, intensity, castShadow, distance }) {
  const ref = useRef(null)

  useEffect(() => {
    enableBothLightLayers(ref.current)
  }, [])

  return (
    <spotLight
      ref={ref}
      position={position}
      color="#ffcf8a"
      intensity={intensity}
      angle={0.95}
      penumbra={1}
      distance={distance}
      decay={2}
      castShadow={castShadow}
      shadow-mapSize={castShadow ? 512 : undefined}
      shadow-bias={castShadow ? -0.00008 : undefined}
      shadow-camera-near={castShadow ? 0.08 : undefined}
      shadow-camera-far={castShadow ? distance : undefined}
    >
      <object3D attach="target" position={target} />
    </spotLight>
  )
}

/**
 * Тёплый заполняющий омни-свет внутри шкафа (как soft-свет в Blender при
 * открытии дверей). Point light светит во все стороны — заливает заднюю
 * стенку, бока, полки и пол, а не только пятно под потолком.
 */
function InteriorFill({ position, intensity, distance }) {
  const ref = useRef(null)

  useEffect(() => {
    enableBothLightLayers(ref.current)
  }, [])

  return (
    <pointLight
      ref={ref}
      position={position}
      color="#ffd9a6"
      intensity={intensity}
      distance={distance}
      decay={2}
    />
  )
}

/** Имена нод-табличек — не подсвечивать при hover */
const TABL_NODE_NAMES = new Set(Object.values(DRAWER_TABL_NODES))

/** Парные узлы (крышка ↔ корпус) */
const PAIRED_DRAWER_NODES = new Set(Object.keys(DRAWER_LID_TO_BODY))

/** У каждого mesh — свой material; береста одного типа (mat.name) — общий экземпляр */
function ensureUniqueMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return
    if (Array.isArray(child.material)) {
      child.material = child.material.map((mat) =>
        isBerestaMaterial(mat) ? mat : (mat?.clone?.() ?? mat),
      )
      return
    }
    if (isBerestaMaterial(child.material)) return
    child.material = child.material.clone()
  })
}

function isUnderInactiveDrawerNode(object) {
  let current = object
  while (current) {
    if (INACTIVE_DRAWER_NODES.has(current.name)) return true
    if (INACTIVE_MESH_NAMES.has(current.name)) return true
    current = current.parent
  }
  return false
}

const _pullDir = new THREE.Vector3()
const _parentMatrix = new THREE.Matrix4()

const INNER_DOOR_BACKFACE_SUFFIX = '__inner_copper_backface'
const MEDALLION_RING_NODES = {
  left: 'BézierCircle.001',
  right: 'BézierCircle',
}

function createInnerDoorCopperMaterial(sourceMaterial) {
  const source = Array.isArray(sourceMaterial) ? sourceMaterial[0] : sourceMaterial
  const material = source?.clone?.() ?? new THREE.MeshStandardMaterial({ name: 'Material.002' })

  // Внутренняя сторона дверей должна совпадать с медью корпуса shkaf (Material.002),
  // но рендериться только с обратной стороны существующей геометрии дверки.
  material.side = THREE.BackSide
  material.polygonOffset = true
  material.polygonOffsetFactor = -1
  material.polygonOffsetUnits = -1
  material.needsUpdate = true

  return material
}

function createWarmRivetMaterial(name = 'warm_dark_brass_rivet', { rim = false } = {}) {
  return new THREE.MeshPhysicalMaterial({
    name,
    color: rim ? '#c9a24a' : '#b8893a',
    metalness: 0.92,
    roughness: rim ? 0.24 : 0.2,
    envMapIntensity: 0.9,
    clearcoat: rim ? 0.08 : 0.16,
    clearcoatRoughness: 0.38,
    specularIntensity: rim ? 0.12 : 0.18,
    specularColor: '#e8c878',
    side: THREE.DoubleSide,
  })
}

function setInnerDoorBackfacesVisible(model, visible) {
  ;(['left', 'right']).forEach((side) => {
    const door = findDoorPivotNode(model, side)
    const innerFace = door?.getObjectByName(`${door.name}${INNER_DOOR_BACKFACE_SUFFIX}`)
    if (innerFace) innerFace.visible = visible
  })
}

function getObjectBoxInDoorLocal(door, object) {
  door.updateWorldMatrix(true, false)
  object.updateWorldMatrix(true, false)

  const worldBox = new THREE.Box3().setFromObject(object)
  const localBox = new THREE.Box3()
  const points = [
    [worldBox.min.x, worldBox.min.y, worldBox.min.z],
    [worldBox.min.x, worldBox.min.y, worldBox.max.z],
    [worldBox.min.x, worldBox.max.y, worldBox.min.z],
    [worldBox.min.x, worldBox.max.y, worldBox.max.z],
    [worldBox.max.x, worldBox.min.y, worldBox.min.z],
    [worldBox.max.x, worldBox.min.y, worldBox.max.z],
    [worldBox.max.x, worldBox.max.y, worldBox.min.z],
    [worldBox.max.x, worldBox.max.y, worldBox.max.z],
  ]

  points.forEach(([x, y, z]) => {
    localBox.expandByPoint(door.worldToLocal(new THREE.Vector3(x, y, z)))
  })

  return localBox
}

function findDoorRing(_model, door, side) {
  if (!door) return null

  let best = null
  let bestCount = 0
  door.traverse((child) => {
    if (!child.isMesh) return
    const name = (child.name ?? '').normalize('NFC')
    const match = side === 'left'
      ? /001$/i.test(name) && /circle/i.test(name)
      : /circle/i.test(name) && !/001/i.test(name)
    if (!match) return
    const count = child.geometry?.getAttribute('position')?.count ?? 0
    if (count > bestCount) {
      best = child
      bestCount = count
    }
  })

  return best
}

const _ringPoint = new THREE.Vector3()

function removeMedallionRivets(root) {
  if (!root) return
  const stale = []
  root.traverse((child) => {
    if (child.isMesh && child.name.startsWith('medallion_rivet')) stale.push(child)
  })
  stale.forEach((mesh) => mesh.parent?.remove(mesh))
}

function getRingPlaneAxes(ringBox) {
  const size = new THREE.Vector3()
  ringBox.getSize(size)
  const axes = ['x', 'y', 'z'].sort((a, b) => size[a] - size[b])
  return {
    normalAxis: axes[0],
    axisA: axes[1],
    axisB: axes[2],
    faceValue: ringBox.max[axes[0]] + 0.002,
  }
}

function getRingGeometryBox(ring) {
  const geometry = ring?.geometry
  if (!geometry) return null

  geometry.computeBoundingBox?.()
  if (geometry.boundingBox) return geometry.boundingBox

  const posAttr = geometry.getAttribute('position')
  if (!posAttr) return null

  const box = new THREE.Box3().setFromBufferAttribute(posAttr)
  geometry.boundingBox = box
  return box
}

function sampleMedallionArcPositions(door, side, count, radiusScale = 1) {
  const beresta = door.getObjectByName(side === 'left' ? 'Beresta_L' : 'Beresta_R')
  const ring = findDoorRing(null, door, side)
  if (!beresta?.isMesh) return []

  const berestaBox = getObjectBoxInDoorLocal(door, beresta)
  const ringBox = ring?.isMesh ? getObjectBoxInDoorLocal(door, ring) : berestaBox

  const center = berestaBox.getCenter(new THREE.Vector3())
  center.x = side === 'left' ? berestaBox.max.x : berestaBox.min.x
  const outerX = side === 'left' ? berestaBox.min.x : berestaBox.max.x
  const radius = Math.abs(outerX - center.x) * radiusScale
  const z = ringBox.max.z + 0.004

  const startAngle = side === 'left' ? Math.PI / 2 : -Math.PI / 2
  const endAngle = side === 'left' ? (Math.PI * 3) / 2 : Math.PI / 2
  const positions = []

  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1)
    const angle = THREE.MathUtils.lerp(startAngle, endAngle, t)
    positions.push(new THREE.Vector3(
      center.x + Math.cos(angle) * radius,
      center.y + Math.sin(angle) * radius,
      z,
    ))
  }

  return positions
}

function sampleRingOuterEdgePositions(ring, count, band = 'outer') {
  if (!ring?.isMesh?.geometry || count < 1) return []

  const ringBox = getRingGeometryBox(ring)
  if (!ringBox) return []

  const posAttr = ring.geometry.getAttribute('position')
  if (!posAttr) return []

  const { normalAxis, axisA, axisB, faceValue } = getRingPlaneAxes(ringBox)
  const centerA = (ringBox.min[axisA] + ringBox.max[axisA]) * 0.5
  const centerB = (ringBox.min[axisB] + ringBox.max[axisB]) * 0.5

  const candidates = []
  for (let i = 0; i < posAttr.count; i += 1) {
    _ringPoint.fromBufferAttribute(posAttr, i)

    const a = _ringPoint[axisA] - centerA
    const b = _ringPoint[axisB] - centerB
    candidates.push({
      point: _ringPoint.clone(),
      angle: Math.atan2(b, a),
      radius: Math.hypot(a, b),
    })
  }

  if (candidates.length === 0) return []

  const maxRadius = candidates.reduce((max, entry) => Math.max(max, entry.radius), 0)
  const pool = candidates.filter((entry) => {
    if (band === 'outer') return entry.radius >= maxRadius * 0.93
    return entry.radius >= maxRadius * 0.72 && entry.radius <= maxRadius * 0.84
  })
  const sorted = (pool.length >= count ? pool : candidates)
    .sort((a, b) => a.angle - b.angle)

  const positions = []
  for (let i = 0; i < count; i += 1) {
    const entry = sorted[Math.min(sorted.length - 1, Math.floor((i / count) * sorted.length))]
    entry.point[normalAxis] = Math.max(entry.point[normalAxis], faceValue)
    positions.push(entry.point)
  }

  return positions
}

const _ringFaceOffset = new THREE.Vector3()
const _ringCenterLocal = new THREE.Vector3()
const _ringWorldPos = new THREE.Vector3()
const _ringDoorPos = new THREE.Vector3()

function pushRivetOntoRingFace(localPos, ringBox, normalAxis, axisA, axisB, outward = 0.006) {
  _ringCenterLocal.set(
    (ringBox.min.x + ringBox.max.x) * 0.5,
    (ringBox.min.y + ringBox.max.y) * 0.5,
    (ringBox.min.z + ringBox.max.z) * 0.5,
  )

  const dx = localPos[axisA] - _ringCenterLocal[axisA]
  const dy = localPos[axisB] - _ringCenterLocal[axisB]
  const len = Math.hypot(dx, dy) || 1

  _ringFaceOffset.copy(localPos)
  _ringFaceOffset[axisA] += (dx / len) * outward
  _ringFaceOffset[axisB] += (dy / len) * outward
  _ringFaceOffset[normalAxis] = ringBox.max[normalAxis] + 0.003

  return _ringFaceOffset
}

function addMedallionRivets(model) {
  const geometry = new THREE.SphereGeometry(1, 8, 8)
  const rimMaterial = createWarmRivetMaterial('medallion_edge_rivets', { rim: true })
  rimMaterial.depthTest = true
  rimMaterial.polygonOffset = true
  rimMaterial.polygonOffsetFactor = -3
  rimMaterial.polygonOffsetUnits = -3

  ;(['left', 'right']).forEach((side) => {
    const door = findDoorPivotNode(model, side)
    const ring = findDoorRing(model, door, side)
    if (!door || !ring?.isMesh) return

    removeMedallionRivets(door)
    removeMedallionRivets(ring)

    ring.geometry.computeBoundingBox?.()
    const ringBox = getRingGeometryBox(ring)
    if (!ringBox) return

    const ringSize = new THREE.Vector3()
    ringBox.getSize(ringSize)
    const rivetRadius = THREE.MathUtils.clamp(
      Math.max(ringSize.x, ringSize.y, ringSize.z) * 0.026,
      0.0011,
      0.0021,
    )
    const rows = [
      { band: 'outer', count: 52 },
      { band: 'inner', count: 48 },
    ]

    const plane = getRingPlaneAxes(ringBox)
    door.updateWorldMatrix(true, true)
    ring.updateWorldMatrix(true, true)

    let index = 0
    rows.forEach(({ band, count }) => {
      let positions = sampleRingOuterEdgePositions(ring, count, band)
      let usedArcFallback = false
      if (positions.length === 0) {
        positions = sampleMedallionArcPositions(door, side, count, band === 'inner' ? 0.9 : 1)
        usedArcFallback = true
      }
      positions.forEach((localPos) => {
        if (usedArcFallback) {
          _ringDoorPos.copy(localPos)
          _ringDoorPos.z += 0.004
        } else {
          const onFace = pushRivetOntoRingFace(
            localPos,
            ringBox,
            plane.normalAxis,
            plane.axisA,
            plane.axisB,
            Math.max(ringSize[plane.normalAxis] * 0.55, 0.005),
          )
          _ringWorldPos.copy(ring.localToWorld(onFace.clone()))
          _ringDoorPos.copy(door.worldToLocal(_ringWorldPos))
        }

        const rivet = new THREE.Mesh(geometry, rimMaterial)
        rivet.name = `medallion_rivet_${side}_${index}`
        rivet.position.copy(_ringDoorPos)
        rivet.scale.setScalar(rivetRadius)
        rivet.castShadow = true
        rivet.receiveShadow = true
        rivet.renderOrder = 8
        rivet.layers.set(LIGHT_LAYERS.doors)
        door.add(rivet)
        index += 1
      })
    })
  })
}

function tuneHandleRivets(model) {
  const material = createWarmRivetMaterial('handle_rivet_warm_metal')
  model.traverse((child) => {
    if (!child.isMesh || !child.name.startsWith('заклепа_ручка')) return
    child.material = material
    child.castShadow = true
    child.receiveShadow = true
    child.renderOrder = 7
  })
}

function getPairedDrawerName(name) {
  return getDrawerBodyName(name) ?? name
}

/** Для секций, привязанных к корпусу (.1), анимировать крышку + корпус */
function resolveDrawerMainName(nodeName) {
  const lid = Object.entries(DRAWER_LID_TO_BODY).find(([, body]) => body === nodeName)?.[0]
  if (lid) return lid
  return nodeName.endsWith('.1') ? nodeName.slice(0, -2) : nodeName
}

function getDrawerNodes(model, sectionId) {
  const nodeName = SHKAF_NODE_MAP[sectionId]
  if (!nodeName) return []
  const mainName = resolveDrawerMainName(nodeName)
  const main = model.getObjectByName(mainName)
  if (!main) return []
  if (!PAIRED_DRAWER_NODES.has(mainName)) return [main]
  const paired = model.getObjectByName(getPairedDrawerName(mainName))
  return paired ? [main, paired] : [main]
}

function getPullDirection(node) {
  node.updateWorldMatrix(true, false)
  _pullDir.set(0, 0, 1)
  if (node.parent) {
    _parentMatrix.copy(node.parent.matrixWorld).invert()
    _pullDir.transformDirection(_parentMatrix)
  }
  return _pullDir.clone()
}

/** Порог смещения (px) — выше него клик считается вращением камеры */
const DRAG_THRESHOLD_DESKTOP_PX = 5
const DRAG_THRESHOLD_MOBILE_PX = 14

function attachCabinetSceneRoots(model) {
  const shkafRoot = model.getObjectByName(SHKAF_ROOT_NAME)
  if (!shkafRoot) return

  const attachToShkaf = (node) => {
    if (node?.parent && node.parent !== shkafRoot) {
      shkafRoot.attach(node)
    }
  }

  CABINET_SCENE_ROOTS.forEach((name) => {
    if (name === SHKAF_ROOT_NAME) return
    attachToShkaf(model.getObjectByName(name))
  })

  attachToShkaf(findDoorPivotNode(model, 'left'))
  attachToShkaf(findDoorPivotNode(model, 'right'))

  ;(['left', 'right']).forEach((side) => {
    const door = findDoorPivotNode(model, side)
    if (!door?.isMesh || door.getObjectByName(`${door.name}${INNER_DOOR_BACKFACE_SUFFIX}`)) {
      return
    }

    const innerFace = new THREE.Mesh(
      door.geometry,
      createInnerDoorCopperMaterial(shkafRoot.material),
    )
    innerFace.name = `${door.name}${INNER_DOOR_BACKFACE_SUFFIX}`
    innerFace.raycast = () => null
    innerFace.castShadow = false
    innerFace.receiveShadow = true
    innerFace.renderOrder = 1
    innerFace.visible = false
    door.add(innerFace)
  })
}

function ensureDoorPivotsVisible(model) {
  ;(['left', 'right']).forEach((side) => {
    const door = findDoorPivotNode(model, side)
    if (!door) return
    door.visible = true
    door.traverse((child) => {
      child.visible = true
    })
  })
}

function hideSceneDecor(model) {
  if (!HIDE_SCENE_DECOR) return
  const keep = new Set(CABINET_SCENE_ROOTS)
  model.children.forEach((child) => {
    child.visible = keep.has(child.name)
  })
  ensureDoorPivotsVisible(model)
}

function ensureDoorDetailShadows(model) {
  model.traverse((child) => {
    if (!child.isMesh) return
    const name = child.name ?? ''

    if (/ручка|заклепа/i.test(name) || name.startsWith('medallion_rivet')) {
      child.castShadow = true
    }

    if (
      /Beresta|door_left|door_right|BézierCircle|Circle|patina|ручка/i.test(name)
      || name.startsWith('medallion_rivet')
    ) {
      child.receiveShadow = true
    }
  })
}

function finalizeShkafSceneGraph(model) {
  addMedallionRivets(model)
  tuneHandleRivets(model)
  ensureDoorDetailShadows(model)

  INACTIVE_DRAWER_NODES.forEach((name) => {
    const node = model.getObjectByName(name)
    node?.traverse((child) => {
      if (child.isMesh) child.raycast = () => null
    })
  })

  // Старые ножки в shkaf.glb — убираем; новые вешает attachGlbLegs до placement
  if (!USE_PROCEDURAL_LEGS) {
    GLB_LEG_NODES.forEach((name) => {
      const node = model.getObjectByName(name)
      node?.parent?.remove(node)
    })
  } else {
    GLB_LEG_NODES.forEach((name) => {
      const node = model.getObjectByName(name)
      if (node) node.visible = false
    })
  }

  const plank = model.getObjectByName('124_')
  const shkafRoot = model.getObjectByName(SHKAF_ROOT_NAME)
  if (plank && shkafRoot) {
    shkafRoot.attach(plank)
    plank.raycast = () => null
  }

  INACTIVE_MESH_NAMES.forEach((name) => {
    const mesh = model.getObjectByName(name)
    if (mesh?.isMesh) mesh.raycast = () => null
  })

  // Группы анимации — mesh перекрывает фронты drawer_tl/tr/bl/br и таблички
  ;['drawer_1', 'drawer_2'].forEach((name) => {
    const node = model.getObjectByName(name)
    if (!node) return
    node.raycast = () => null
    node.traverse((child) => {
      if (child.isMesh) child.raycast = () => null
    })
  })

  // Навигация — по tabl_*; фронты drawer_tl/tr/bl/br не принимают raycast
  DRAWER_FRONT_NODES.forEach((name) => {
    const front = model.getObjectByName(name)
    if (!front) return
    front.raycast = () => null
  })

  Object.entries(DRAWER_TABL_NODES).forEach(([sectionId, tablName]) => {
    const drawer = model.getObjectByName(SHKAF_NODE_MAP[sectionId])
    const tabl = model.getObjectByName(tablName)
    if (!drawer || !tabl) return

    drawer.attach(tabl)
    tabl.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        child.renderOrder = 3
      }
    })
  })

  model.traverse((child) => {
    if (child.name.startsWith('Текст')) {
      child.visible = false
      return
    }

    if (!child.isMesh) return

    child.castShadow = true
    child.receiveShadow = true

    if (child.name === '17_' || child.name === '19_') {
      child.renderOrder = 2
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((mat) => {
        if (!mat) return
        mat.polygonOffset = true
        mat.polygonOffsetFactor = 1
        mat.polygonOffsetUnits = 1
        mat.needsUpdate = true
      })
    }
  })

  ensureDoorPivotsVisible(model)
}

function Shkaf({ sceneScale = 1 }) {
  const { scene } = useGLTF(SHKAF_MODEL_PATH)
  const { scene: legsScene } = useGLTF(SHKAF_LEGS_MODEL_PATH)
  const controls = useThree((s) => s.controls)
  const isMobile = useIsMobile()
  const dragThresholdPx = isMobile ? DRAG_THRESHOLD_MOBILE_PX : DRAG_THRESHOLD_DESKTOP_PX
  const rootRef = useRef()
  const leftDoorRef = useRef()
  const rightDoorRef = useRef()
  const closedRotations = useRef({ left: 0, right: 0 })
  const pointerDownPos = useRef({ x: 0, y: 0 })
  const hoveredDrawerId = useRef(null)
  const hoverTweens = useRef([])
  const meshMaterialBackup = useRef(new Map())
  const drawerBasePositions = useRef(new Map())
  const navigate = useNavigate()

  const { doorsOpen, animating, setDoorsOpen, setAnimating, setActiveDrawerId } =
    useShkafStore()

  const model = useMemo(() => {
    const cloned = scene.clone(true)
    attachCabinetSceneRoots(cloned)
    hideSceneDecor(cloned)
    if (USE_RAW_GLB_MATERIALS) {
      applyRawMaterialPipeline(cloned)
      finalizeShkafSceneGraph(cloned)
      if (!USE_PROCEDURAL_LEGS) {
        attachGlbLegs(cloned, legsScene)
      }
    }
    return cloned
  }, [scene, legsScene])
  const shkafGroup = useMemo(() => findByName(model, SHKAF_ROOT_NAME), [model])
  const alignOffset = STUDIO.object.alignOffset ?? [0, 0, 0]
  const { position: placement, alignedCenter, size, box } = useMemo(
    () => getCabinetPlacement(model, SHKAF_ROOT_NAME),
    [model],
  )
  const alignedFloorY = 0
  const center = alignedCenter

  const scenePrepared = useRef(null)
  useEffect(() => {
    if (USE_RAW_GLB_MATERIALS) return
    if (scenePrepared.current === model.uuid) return
    let cancelled = false

    const prepare = async () => {
      attachCabinetSceneRoots(model)
      hideSceneDecor(model)
      ensureUniqueMaterials(model)

      try {
        const patinaTex = await loadPatinaTextures()
        if (!cancelled) {
          applyDoorPanelPatinaTextures(model, patinaTex)
        }
      } catch (err) {
        console.warn('РУССО: patina textures not loaded — fallback to GLB maps', err)
      }

      if (cancelled) return

      applyStudioMaterialFixups(model)
      finalizeShkafSceneGraph(model)
      scenePrepared.current = model.uuid
    }

    prepare()
    return () => {
      cancelled = true
    }
  }, [model])

  // Закомнить закрытое положение дверей; сбросить baked rotation из GLB (door_right часто π по Y)
  useEffect(() => {
    const left = findDoorPivotNode(model, 'left')
    const right = findDoorPivotNode(model, 'right')
    leftDoorRef.current = left
    rightDoorRef.current = right

    const axis = DOOR_ROTATION_AXIS
    const closedLeft = left?.rotation[axis] ?? 0

    if (left) closedRotations.current.left = closedLeft

    if (right) {
      right.rotation.set(
        left?.rotation.x ?? 0,
        closedLeft,
        left?.rotation.z ?? 0,
      )
      closedRotations.current.right = right.rotation[axis]
    }

    setInnerDoorBackfacesVisible(model, false)

    console.log('РУССО: двери найдены', {
      door_left: left?.name ?? null,
      door_right: right?.name ?? null,
      closedY: { left: closedLeft, right: closedRotations.current.right },
      shkaf: !!shkafGroup,
      drawers: drawerSections.map((s) => ({
        id: s.id,
        found: !!model.getObjectByName(SHKAF_NODE_MAP[s.id]),
      })),
    })
  }, [model, shkafGroup])

  const animateDoors = useCallback(
    (open) => {
      if (animating) return

      setAnimating(true)

      const left = leftDoorRef.current
      const right = rightDoorRef.current

      if (!left && !right) {
        setDoorsOpen(open)
        setAnimating(false)
        return
      }

      const axis = DOOR_ROTATION_AXIS
      setInnerDoorBackfacesVisible(model, open)

      const tl = gsap.timeline({
        onComplete: () => {
          if (!open) setInnerDoorBackfacesVisible(model, false)
          setDoorsOpen(open)
          setAnimating(false)
        },
      })

      if (left) {
        tl.to(
          left.rotation,
          {
            [axis]: open
              ? closedRotations.current.left + DOOR_LEFT_OPEN_ANGLE
              : closedRotations.current.left,
            duration: DOOR_OPEN_DURATION,
            ease: 'power2.out',
          },
          0,
        )
      }

      if (right) {
        tl.to(
          right.rotation,
          {
            [axis]: open
              ? closedRotations.current.right + DOOR_RIGHT_OPEN_ANGLE
              : closedRotations.current.right,
            duration: DOOR_OPEN_DURATION,
            ease: 'power2.out',
          },
          0,
        )
      }
    },
    [animating, setDoorsOpen, setAnimating],
  )

  const toggleDoors = useCallback(() => {
    animateDoors(!doorsOpen)
  }, [doorsOpen, animateDoors])

  const resetHoveredDrawerPositions = useCallback(() => {
    if (!hoveredDrawerId.current) return
    getDrawerNodes(model, hoveredDrawerId.current).forEach((node) => {
      const base = drawerBasePositions.current.get(node.uuid)
      if (base) node.position.copy(base)
    })
    drawerBasePositions.current.clear()
  }, [model])

  const restoreMeshMaterials = useCallback(() => {
    meshMaterialBackup.current.forEach((original, mesh) => {
      mesh.material = original
    })
    meshMaterialBackup.current.clear()
  }, [])

  const highlightDrawerMeshes = useCallback((nodes) => {
    nodes.forEach((node) => {
      node.traverse((child) => {
        if (!child.isMesh) return
        if (isUnderInactiveDrawerNode(child)) return
        if (INACTIVE_MESH_NAMES.has(child.name)) return
        if (TABL_NODE_NAMES.has(child.name)) return
        let parent = child.parent
        while (parent) {
          if (TABL_NODE_NAMES.has(parent.name)) return
          parent = parent.parent
        }
        if (meshMaterialBackup.current.has(child)) return

        const original = child.material
        meshMaterialBackup.current.set(child, original)

        const applyHover = (mat) => {
          if (!mat?.isMeshStandardMaterial && !mat?.isMeshPhysicalMaterial) return mat
          const clone = mat.clone()
          clone.emissive.set(HOVER_EMISSIVE)
          clone.emissiveIntensity = HOVER_EMISSIVE_INTENSITY
          return clone
        }

        child.material = Array.isArray(original)
          ? original.map(applyHover)
          : applyHover(original)
      })
    })
  }, [])

  const clearDrawerHover = useCallback(() => {
    hoverTweens.current.forEach((tween) => tween.kill())
    hoverTweens.current = []
    resetHoveredDrawerPositions()
    restoreMeshMaterials()

    hoveredDrawerId.current = null
    document.body.style.cursor = 'auto'
  }, [resetHoveredDrawerPositions, restoreMeshMaterials])

  const applyDrawerHover = useCallback(
    (sectionId) => {
      if (hoveredDrawerId.current === sectionId) return

      hoverTweens.current.forEach((tween) => tween.kill())
      hoverTweens.current = []
      resetHoveredDrawerPositions()
      restoreMeshMaterials()

      hoveredDrawerId.current = sectionId
      const nodes = getDrawerNodes(model, sectionId)
      const wiggle = !HOVER_HIGHLIGHT_ONLY.has(sectionId)

      if (wiggle) {
        nodes.forEach((node) => {
          drawerBasePositions.current.set(node.uuid, node.position.clone())

          const base = drawerBasePositions.current.get(node.uuid)
          const pull = getPullDirection(node)

          hoverTweens.current.push(
            gsap.to(node.position, {
              x: base.x + pull.x * HOVER_NUDGE,
              y: base.y + pull.y * HOVER_NUDGE,
              z: base.z + pull.z * HOVER_NUDGE,
              duration: HOVER_WIGGLE_DURATION,
              yoyo: true,
              repeat: -1,
              ease: 'sine.inOut',
            }),
          )
        })
      }

      highlightDrawerMeshes(nodes)
      document.body.style.cursor = 'pointer'
    },
    [model, resetHoveredDrawerPositions, restoreMeshMaterials, highlightDrawerMeshes],
  )

  useEffect(() => {
    if (!doorsOpen) clearDrawerHover()
  }, [doorsOpen, clearDrawerHover])

  const handleDrawerClick = useCallback(
    (section, target) => {
      clearDrawerHover()
      setAnimating(true)
      setActiveDrawerId(section.id)

      const pull = getPullDirection(target)

      const animateNode = (node) => ({
        x: node.position.x + pull.x * DRAWER_PULL_DISTANCE,
        y: node.position.y + pull.y * DRAWER_PULL_DISTANCE,
        z: node.position.z + pull.z * DRAWER_PULL_DISTANCE,
        duration: DRAWER_OPEN_DURATION,
        ease: 'power2.out',
      })

      const tl = gsap.timeline({
        onComplete: () => {
          setTimeout(() => {
            setAnimating(false)
            navigate(section.route)
          }, NAVIGATE_DELAY_MS)
        },
      })

      tl.to(target.position, animateNode(target), 0)

      const paired = PAIRED_DRAWER_NODES.has(target.name)
        ? model.getObjectByName(getPairedDrawerName(target.name))
        : null
      if (paired) tl.to(paired.position, animateNode(paired), 0)
    },
    [model, navigate, setAnimating, setActiveDrawerId, clearDrawerHover],
  )

  const orbitBlocked = useRef(false)

  const handlePointerDown = useCallback((event) => {
    pointerDownPos.current = { x: event.clientX, y: event.clientY }
    // На таче orbit не блокируем — один палец крутит камеру, тап открывает шкаф
    if (event.pointerType === 'touch') return
    // ПКМ / колесо — не трогаем OrbitControls (pan / zoom)
    if (event.button !== 0) return
    event.stopPropagation()
    orbitBlocked.current = true
    if (controls) controls.enabled = false
  }, [controls])

  const handlePointerUp = useCallback((event) => {
    if (!orbitBlocked.current) return
    event.stopPropagation()
    orbitBlocked.current = false
    if (controls) controls.enabled = true
  }, [controls])

  useEffect(() => {
    const releaseOrbit = () => {
      if (!orbitBlocked.current) return
      orbitBlocked.current = false
      if (controls) controls.enabled = true
    }
    window.addEventListener('pointerup', releaseOrbit)
    window.addEventListener('pointercancel', releaseOrbit)
    window.addEventListener('blur', releaseOrbit)
    return () => {
      window.removeEventListener('pointerup', releaseOrbit)
      window.removeEventListener('pointercancel', releaseOrbit)
      window.removeEventListener('blur', releaseOrbit)
    }
  }, [controls])

  const handleClick = useCallback(
    (event) => {
      event.stopPropagation()
      // После лагов pointerup может не успеть — разблокируем orbit до обработки клика
      orbitBlocked.current = false
      if (controls) controls.enabled = true

      const dx = event.clientX - pointerDownPos.current.x
      const dy = event.clientY - pointerDownPos.current.y
      if (Math.sqrt(dx * dx + dy * dy) > dragThresholdPx) return

      const { activeDrawerId } = useShkafStore.getState()

      if (doorsOpen && !animating && !activeDrawerId) {
        const drawerNode = findDrawerNodeFromHit(event.object)
        const drawerSection = findDrawerSectionFromHit(event.object)
        if (drawerSection && drawerNode) {
          handleDrawerClick(drawerSection, drawerNode)
          return
        }
      }

      toggleDoors()
    },
    [doorsOpen, animating, toggleDoors, handleDrawerClick, dragThresholdPx],
  )

  const handlePointerOver = useCallback(
    (event) => {
      event.stopPropagation()
      const { animating, activeDrawerId } = useShkafStore.getState()
      if (!doorsOpen || animating || activeDrawerId) return

      const drawerSection = findDrawerSectionFromHit(event.object)
      if (drawerSection) {
        applyDrawerHover(drawerSection.id)
      } else {
        clearDrawerHover()
      }
    },
    [doorsOpen, applyDrawerHover, clearDrawerHover],
  )

  // Подсветка с потолка шкафа — мягкий верхний акцент
  const ceilingY = box.max.y - 0.06
  const lightZ = center.z + size.z * 0.08
  const targetY = center.y - size.y * 0.05
  const lightDist = size.y * 1.8
  const lightIntensity = doorsOpen ? 0.55 : 0
  const INTERIOR_LIGHTS = [
    { pos: [center.x - size.x * 0.28, ceilingY, lightZ], target: [center.x - size.x * 0.28, targetY, center.z], castShadow: false },
    { pos: [center.x + size.x * 0.28, ceilingY, lightZ], target: [center.x + size.x * 0.28, targetY, center.z], castShadow: false },
  ]

  // Тёплый заполняющий свет — у задней стенки, разнесён по бокам.
  // Центр не светим напрямую: иначе внутренняя береста выбивается горячим пятном.
  const fillDist = size.y * 3.0
  const fillIntensity = doorsOpen ? 1.35 : 0
  const INTERIOR_FILLS = [
    [center.x - size.x * 0.34, center.y + size.y * 0.02, center.z - size.z * 0.22],
    [center.x + size.x * 0.34, center.y + size.y * 0.02, center.z - size.z * 0.22],
  ]

  // Фронтальные споты на ящики (их лицо смотрит наружу — fill изнутри не достаёт).
  // Стоят спереди-сверху, в плоскости открытых дверей.
  const drawerSpotDist = size.y * 2.2
  const DRAWER_SPOTS = [
    // нижний модуль — 4 плашки навигации
    {
      pos: [center.x, center.y + size.y * 0.02, box.max.z + size.z * 0.42],
      target: [center.x, center.y - size.y * 0.36, center.z + size.z * 0.3],
      intensity: doorsOpen ? 3.0 : 0,
    },
    // средние два ящика
    {
      pos: [center.x, center.y + size.y * 0.34, box.max.z + size.z * 0.42],
      target: [center.x, center.y - size.y * 0.06, center.z + size.z * 0.3],
      intensity: doorsOpen ? 2.6 : 0,
    },
  ]

  return (
    <group
      ref={rootRef}
      position={[
        placement[0] + alignOffset[0],
        placement[1] + alignOffset[1],
        placement[2] + alignOffset[2],
      ]}
    >
      <primitive
        object={model}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
      />

      {USE_PROCEDURAL_LEGS && <CabinetLegs />}

      {!USE_HDRI_ONLY &&
        INTERIOR_LIGHTS.map(({ pos, target, castShadow: shadowOn }, i) => (
          <InteriorSpot
            key={i}
            position={pos}
            target={target}
            intensity={lightIntensity}
            castShadow={shadowOn}
            distance={lightDist}
          />
        ))}

      {!USE_HDRI_ONLY &&
        INTERIOR_FILLS.map((pos, i) => (
          <InteriorFill key={i} position={pos} intensity={fillIntensity} distance={fillDist} />
        ))}

      {!USE_HDRI_ONLY &&
        DRAWER_SPOTS.map(({ pos, target, intensity }, i) => (
          <InteriorSpot
            key={i}
            position={pos}
            target={target}
            intensity={intensity}
            castShadow={false}
            distance={drawerSpotDist}
          />
        ))}

      {!USE_STUDIO_CAMERA && (
        <FitCamera object={model} sceneScale={sceneScale} placement={placement} />
      )}
    </group>
  )
}

export default Shkaf
