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
import { getCabinetPlacement, findByName } from '../../utils/cabinetBounds'
import { attachGlbLegs } from '../../utils/attachGlbLegs'
import {
  findDrawerFromIntersections,
  getDrawerBodyName,
} from '../../utils/drawerHit'
import {
  russoShkafReady,
  russoInteractState,
  russoClick,
  russoLog,
  describeHitObject,
} from '../../utils/russoLog'
import { USE_RAW_GLB_MATERIALS } from '../../constants/studioScene'
import { applyDoorPanelPatinaTextures, loadPatinaTextures } from '../../utils/patinaTextures'
import {
  applyRawMaterialPipeline,
  applyStudioMaterialFixups,
  isBerestaMaterial,
} from '../../utils/materialFixups'

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

function findDoorRing(_model, door, side) {
  if (!door) return null

  const preferred = side === 'left'
    ? ['BézierCircle', 'Circle.001', 'Circle']
    : ['Circle.002', 'Circle']

  for (const name of preferred) {
    const node = door.getObjectByName(name)
    if (node?.isMesh) return node
  }

  let best = null
  let bestCount = 0
  door.traverse((child) => {
    if (!child.isMesh) return
    const name = (child.name ?? '').normalize('NFC')
    if (!/circle|bezier/i.test(name)) return
    if (side === 'left' && /002$/i.test(name)) return
    if (side === 'right' && /001$/i.test(name) && !/002$/i.test(name)) return
    const count = child.geometry?.getAttribute('position')?.count ?? 0
    if (count > bestCount) {
      best = child
      bestCount = count
    }
  })

  return best
}

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

const _ringFaceOffset = new THREE.Vector3()
const _ringCenterLocal = new THREE.Vector3()
const _ringWorldPos = new THREE.Vector3()
const _ringDoorPos = new THREE.Vector3()

function isAngleOnDoorSemicircle(angle, side) {
  const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  if (side === 'left') return a >= Math.PI / 2 - 0.12 && a <= (Math.PI * 3) / 2 + 0.12
  return a <= Math.PI / 2 + 0.12 || a >= (Math.PI * 3) / 2 - 0.12
}

function isPointOnOuterRim(ringBox, point, plane, side) {
  const { normalAxis, axisA, axisB } = plane

  if (
    point[normalAxis] < ringBox.min[normalAxis] - 0.001
    || point[normalAxis] > ringBox.max[normalAxis] + 0.006
  ) {
    return false
  }

  const centerA = (ringBox.min[axisA] + ringBox.max[axisA]) * 0.5
  const centerB = (ringBox.min[axisB] + ringBox.max[axisB]) * 0.5
  const dx = point[axisA] - centerA
  const dy = point[axisB] - centerB
  const radius = Math.hypot(dx, dy)

  const halfA = (ringBox.max[axisA] - ringBox.min[axisA]) * 0.5
  const halfB = (ringBox.max[axisB] - ringBox.min[axisB]) * 0.5
  const maxRadius = Math.hypot(halfA, halfB)

  if (radius < maxRadius * 0.88 || radius > maxRadius * 1.02) return false
  if (!isAngleOnDoorSemicircle(Math.atan2(dy, dx), side)) return false

  const pad = 0.002
  return (
    point[axisA] >= ringBox.min[axisA] - pad
    && point[axisA] <= ringBox.max[axisA] + pad
    && point[axisB] >= ringBox.min[axisB] - pad
    && point[axisB] <= ringBox.max[axisB] + pad
  )
}

function sampleSemicircleRivetPositions(ringBox, plane, side, count) {
  const { normalAxis, axisA, axisB } = plane
  const centerA = (ringBox.min[axisA] + ringBox.max[axisA]) * 0.5
  const centerB = (ringBox.min[axisB] + ringBox.max[axisB]) * 0.5
  const halfA = (ringBox.max[axisA] - ringBox.min[axisA]) * 0.5
  const halfB = (ringBox.max[axisB] - ringBox.min[axisB]) * 0.5
  const radius = Math.hypot(halfA, halfB) * 0.96
  const faceValue = ringBox.max[normalAxis] + 0.002

  const startAngle = side === 'left' ? Math.PI / 2 : -Math.PI / 2
  const endAngle = side === 'left' ? (Math.PI * 3) / 2 : Math.PI / 2
  const positions = []

  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1)
    const angle = THREE.MathUtils.lerp(startAngle, endAngle, t)
    const pos = new THREE.Vector3()
    pos[axisA] = centerA + Math.cos(angle) * radius
    pos[axisB] = centerB + Math.sin(angle) * radius
    pos[normalAxis] = faceValue
    positions.push(pos)
  }

  return positions
}

function pushRivetOntoRingFace(localPos, ringBox, normalAxis, axisA, axisB, outward = 0.004) {
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
    /** Один ряд по внешнему краю обода */
    const rivetCount = 28

    const plane = getRingPlaneAxes(ringBox)
    door.updateWorldMatrix(true, true)
    ring.updateWorldMatrix(true, true)

    let index = 0
    const positions = sampleSemicircleRivetPositions(ringBox, plane, side, rivetCount)

    positions.forEach((ringLocalPos) => {
      if (!isPointOnOuterRim(ringBox, ringLocalPos, plane, side)) return

      const onFace = pushRivetOntoRingFace(
        ringLocalPos,
        ringBox,
        plane.normalAxis,
        plane.axisA,
        plane.axisB,
      )
      _ringWorldPos.copy(ring.localToWorld(onFace.clone()))
      _ringDoorPos.copy(door.worldToLocal(_ringWorldPos))

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

/** Порог смещения (px) — выше = начало вращения камеры, не тап */
const DRAG_THRESHOLD_DESKTOP_PX = 8
const DRAG_THRESHOLD_MOBILE_PX = 36
/** Дольше этого — не считаем тапом (удержание / orbit) */
const TAP_MAX_MS = 450

/** Включить/выключить raycast дверей (когда открыты — не перехватывают клик по ящикам) */
function setDoorRaycastEnabled(model, enabled) {
  ;(['left', 'right']).forEach((side) => {
    const door = findDoorPivotNode(model, side)
    if (!door) return
    door.traverse((child) => {
      if (!child.isMesh) return
      if (child.name?.includes('__inner_copper')) {
        child.raycast = () => null
        return
      }
      child.raycast = enabled ? THREE.Mesh.prototype.raycast : () => null
    })
  })
}

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

  // drawer_1/drawer_2 — нутро, не трогаем анимацию; raycast off чтобы не перекрывать фронты/tabl
  ;['drawer_1', 'drawer_2'].forEach((name) => {
    const node = model.getObjectByName(name)
    if (!node) return
    node.raycast = () => null
    node.traverse((child) => {
      if (child.isMesh) child.raycast = () => null
    })
  })

  // tabl_* → к своему фронту; кликабельны и табличка, и drawer_tl/tr/bl/br
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
  const { gl, camera } = useThree()
  const isMobile = useIsMobile()
  const dragThresholdPx = isMobile ? DRAG_THRESHOLD_MOBILE_PX : DRAG_THRESHOLD_DESKTOP_PX
  const rootRef = useRef()
  const leftDoorRef = useRef()
  const rightDoorRef = useRef()
  const closedRotations = useRef({ left: 0, right: 0 })
  const hoveredDrawerId = useRef(null)
  const hoverTweens = useRef([])
  const meshMaterialBackup = useRef(new Map())
  const drawerBasePositions = useRef(new Map())
  const doorTimelineRef = useRef(null)
  const drawerTimelineRef = useRef(null)
  const navTimerRef = useRef(null)
  const navigate = useNavigate()

  const { doorsOpen, animating, activeDrawerId, setDoorsOpen, setAnimating, setActiveDrawerId } =
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

    const drawers = drawerSections.map((s) => {
      const nodeName = SHKAF_NODE_MAP[s.id]
      const node = model.getObjectByName(nodeName)
      const tablName = DRAWER_TABL_NODES[s.id]
      const tabl = tablName ? model.getObjectByName(tablName) : null
      const tablMat = tabl?.isMesh
        ? (Array.isArray(tabl.material) ? tabl.material[0] : tabl.material)?.name
        : null
      return {
        id: s.id,
        label: s.label,
        route: s.route,
        node: nodeName,
        nodeFound: !!node,
        tabl: tablName,
        tablFound: !!tabl,
        tablParent: tabl?.parent?.name ?? null,
        tablMaterial: tablMat,
      }
    })

    russoShkafReady({
      door_left: left?.name ?? null,
      door_right: right?.name ?? null,
      shkaf: !!shkafGroup,
      drawers,
    })
  }, [model, shkafGroup])

  useEffect(() => {
    russoInteractState({ doorsOpen, animating, activeDrawerId })
  }, [doorsOpen, animating, activeDrawerId])

  const animateDoors = useCallback(
    (open) => {
      if (animating) {
        russoLog('warn', 'doors', 'пропуск: уже идёт анимация', { wantOpen: open })
        return
      }

      russoLog('info', 'doors', open ? 'открытие дверей…' : 'закрытие дверей…')
      setAnimating(true)

      const left = leftDoorRef.current
      const right = rightDoorRef.current

      if (!left && !right) {
        russoLog('warn', 'doors', 'pivot дверей не найдены')
        setDoorsOpen(open)
        setAnimating(false)
        return
      }

      const axis = DOOR_ROTATION_AXIS
      setInnerDoorBackfacesVisible(model, open)

      doorTimelineRef.current?.kill()
      const tl = gsap.timeline({
        onComplete: () => {
          doorTimelineRef.current = null
          if (!open) setInnerDoorBackfacesVisible(model, false)
          setDoorsOpen(open)
          setAnimating(false)
          russoLog('info', 'doors', open ? 'двери открыты' : 'двери закрыты')
        },
      })
      doorTimelineRef.current = tl

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
    [animating, setDoorsOpen, setAnimating, model],
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
      const originals = new Set(Array.isArray(original) ? original : [original])
      const current = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      current.forEach((material) => {
        if (material && !originals.has(material)) material.dispose?.()
      })
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
      russoLog('info', 'drawer', `выдвижение ${section.id} → ${section.route}`, {
        node: target.name,
        label: section.label,
      })

      const pull = getPullDirection(target)

      const animateNode = (node) => ({
        x: node.position.x + pull.x * DRAWER_PULL_DISTANCE,
        y: node.position.y + pull.y * DRAWER_PULL_DISTANCE,
        z: node.position.z + pull.z * DRAWER_PULL_DISTANCE,
        duration: DRAWER_OPEN_DURATION,
        ease: 'power2.out',
      })

      drawerTimelineRef.current?.kill()
      if (navTimerRef.current) clearTimeout(navTimerRef.current)
      const tl = gsap.timeline({
        onComplete: () => {
          drawerTimelineRef.current = null
          navTimerRef.current = setTimeout(() => {
            navTimerRef.current = null
            setAnimating(false)
            russoLog('info', 'nav', `navigate ${section.route}`)
            navigate(section.route)
          }, NAVIGATE_DELAY_MS)
        },
      })
      drawerTimelineRef.current = tl

      tl.to(target.position, animateNode(target), 0)

      const paired = PAIRED_DRAWER_NODES.has(target.name)
        ? model.getObjectByName(getPairedDrawerName(target.name))
        : null
      if (paired) tl.to(paired.position, animateNode(paired), 0)
    },
    [model, navigate, setAnimating, setActiveDrawerId, clearDrawerHover],
  )

  useEffect(
    () => () => {
      doorTimelineRef.current?.kill()
      drawerTimelineRef.current?.kill()
      if (navTimerRef.current) clearTimeout(navTimerRef.current)
      hoverTweens.current.forEach((tween) => tween.kill())
      restoreMeshMaterials()
      document.body.style.cursor = 'auto'
    },
    [restoreMeshMaterials],
  )

  const processTapFromHits = useCallback(
    (intersections, dragPx) => {
      const firstObject = intersections[0]?.object ?? null

      const { activeDrawerId: activeId, animating: isAnimating, doorsOpen: open } =
        useShkafStore.getState()

      if (isAnimating || activeId) {
        russoClick('blocked', {
          hit: firstObject,
          dragPx,
          reason: isAnimating
            ? 'идёт анимация дверей/ящика'
            : `activeDrawerId=${activeId}`,
          doorsOpen: open,
          animating: isAnimating,
          activeDrawerId: activeId,
        })
        return
      }

      if (open) {
        const drawerHit = findDrawerFromIntersections(intersections, model)
        if (drawerHit) {
          const skipped = drawerHit.firstHitName !== drawerHit.object.name
          russoClick('drawer', {
            hit: drawerHit.object,
            dragPx,
            sectionId: drawerHit.section.id,
            route: drawerHit.section.route,
            nodeName: drawerHit.node.name,
            label: drawerHit.section.label,
            firstHitName: drawerHit.firstHitName,
            usedDeeperHit: skipped,
            reason: skipped
              ? `первый hit «${drawerHit.firstHitName}», ящик глубже по лучу`
              : undefined,
          })
          handleDrawerClick(drawerHit.section, drawerHit.node)
          return
        }

        russoClick('miss-close', {
          hit: firstObject,
          dragPx,
          reason: 'по лучу нет drawer/tabl — закрываем двери',
          hitInfo: describeHitObject(firstObject),
          intersectionNames: intersections.slice(0, 6).map((h) => h.object?.name),
        })
        toggleDoors()
        return
      }

      if (!firstObject) {
        russoLog('info', 'click', 'тап мимо модели — игнор')
        return
      }

      russoClick('doors', {
        hit: firstObject,
        dragPx,
        reason: 'двери закрыты → открываем',
        hitInfo: describeHitObject(firstObject),
      })
      toggleDoors()
    },
    [model, handleDrawerClick, toggleDoors],
  )

  const tapRaycaster = useMemo(() => new THREE.Raycaster(), [])
  const tapNdc = useMemo(() => new THREE.Vector2(), [])

  // Тап через DOM — OrbitControls не конфликтует с R3F pointer handlers на mesh
  useEffect(() => {
    const el = gl.domElement
    let down = null

    const onPointerDown = (e) => {
      if (e.pointerType !== 'touch' && e.button !== 0) return
      if (typeof e.isPrimary === 'boolean' && !e.isPrimary) return
      down = {
        x: e.clientX,
        y: e.clientY,
        t: performance.now(),
        pointerId: e.pointerId,
      }
    }

    const onPointerUp = (e) => {
      if (!down || down.pointerId !== e.pointerId) return
      const start = down
      down = null
      if (e.pointerType !== 'touch' && e.button !== 0) return

      const dragPx = Math.hypot(e.clientX - start.x, e.clientY - start.y)
      const elapsed = performance.now() - start.t

      if (dragPx > dragThresholdPx) {
        russoClick('ignore-drag', {
          dragPx: Math.round(dragPx),
          threshold: dragThresholdPx,
          reason: `сдвиг ${Math.round(dragPx)}px — камера, не тап`,
        })
        return
      }
      if (elapsed > TAP_MAX_MS) {
        russoClick('ignore-drag', {
          dragPx: Math.round(dragPx),
          reason: `удержание ${Math.round(elapsed)}ms — не тап`,
        })
        return
      }

      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      tapNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      tapNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      tapRaycaster.setFromCamera(tapNdc, camera)
      const hits = tapRaycaster.intersectObject(model, true)
      processTapFromHits(hits, Math.round(dragPx * 10) / 10)
    }

    const onPointerCancel = (e) => {
      if (down?.pointerId === e.pointerId) down = null
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerCancel)
    russoLog('info', 'click', 'DOM-тап поверх OrbitControls (без R3F stopPropagation)')

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [gl, camera, model, dragThresholdPx, processTapFromHits, tapRaycaster, tapNdc])

  // Пока двери открыты — двери не ловят raycast (ящики доступны стабильно)
  useEffect(() => {
    if (animating) return
    setDoorRaycastEnabled(model, !doorsOpen)
    russoLog('info', 'doors', doorsOpen ? 'raycast дверей OFF (ящики приоритет)' : 'raycast дверей ON')
  }, [doorsOpen, animating, model])

  // Hover только desktop — без stopPropagation, чтобы не трогать orbit
  const handlePointerMove = useCallback(
    (event) => {
      if (isMobile) return
      const { animating: busy, activeDrawerId: activeId } = useShkafStore.getState()
      if (!doorsOpen || busy || activeId) return

      const drawerHit = findDrawerFromIntersections(event.intersections, model)
      if (drawerHit) applyDrawerHover(drawerHit.section.id)
      else clearDrawerHover()
    },
    [isMobile, doorsOpen, applyDrawerHover, clearDrawerHover, model],
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
      <primitive object={model} onPointerMove={handlePointerMove} />

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
