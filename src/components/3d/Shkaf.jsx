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
  SHKAF_BACKWALL_MODEL_PATH,
  SHKAF_CLOSED_DOORS_PATH,
  SHKAF_LEATHER_RIM_PATH,
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
  USE_BAKED_LEGS,
  BAKED_LEG_HIDE_NODES,
  USE_ATTACH_BACKWALL,
  USE_ATTACH_LEATHER_RIM,
  USE_CLOSED_DOORS_FACADE,
  USE_AI_DOOR_TEXTURES,
  CLOSED_DOORS_NODE_NAME,
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
import { USE_STUDIO_CAMERA, LIGHT_LAYERS, STUDIO } from '../../constants/studioScene'
import { getCabinetPlacement, findByName } from '../../utils/cabinetBounds'
import { attachGlbLegs } from '../../utils/attachGlbLegs'
import { attachGlbBackwall } from '../../utils/attachGlbBackwall'
import { attachClosedDoorsFacade, openBerestaSeamGap, setClosedDoorsLook } from '../../utils/attachClosedDoors'
import { attachLeatherRims } from '../../utils/attachLeatherRim'
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
import { USE_RAW_GLB_MATERIALS, USE_WOOD_DOORS, USE_BRONZE_METAL } from '../../constants/studioScene'
import { applyDoorPanelPatinaTextures, loadPatinaTextures } from '../../utils/patinaTextures'
import { applyWoodDoorMaterials, createInnerDoorWoodMaterial, ensureWoodUv2, loadWoodTextures } from '../../utils/woodTextures'
import {
  applyAiDoorFacadeTextures,
  extractAiDoorTexturesFromFacade,
} from '../../utils/aiDoorTextures'
import { applyBronzeMetalMaterials, loadBronzeTextures } from '../../utils/bronzeTextures'
import { applyLeatherAccentMaterials, loadLeatherTextures } from '../../utils/leatherTextures'
import {
  applyRawMaterialPipeline,
  applyStudioMaterialFixups,
  isBerestaMaterial,
} from '../../utils/materialFixups'

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

const _pullDir = new THREE.Vector3()
const _parentMatrix = new THREE.Matrix4()

const INNER_DOOR_BACKFACE_SUFFIX = '__inner_copper_backface'

/** Полотна дверей: mesh с patina_PBR под pivot, либо сам pivot как mesh (shkaf_for_D) */
function findDoorPanelMeshes(door) {
  if (!door) return []
  const panels = []
  const isPanelMaterial = (mat) =>
    mat?.name === 'patina_PBR'
    || mat?.name === 'Dark_Metal_Frame'
    || mat?.name === 'Material.002'
    || /^M_AiDoor_/i.test(mat?.name || '')

  if (door.isMesh && door.material) {
    const materials = Array.isArray(door.material) ? door.material : [door.material]
    if (materials.some(isPanelMaterial)) panels.push(door)
  }

  door.traverse((child) => {
    if (!child.isMesh || !child.material || child === door) return
    if (String(child.name).includes(INNER_DOOR_BACKFACE_SUFFIX)) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    if (materials.some((mat) => mat?.name === 'patina_PBR')) panels.push(child)
  })
  return panels
}

function createInnerDoorCopperMaterial(sourceMaterial) {
  const source = Array.isArray(sourceMaterial) ? sourceMaterial[0] : sourceMaterial
  const material = source?.clone?.() ?? new THREE.MeshStandardMaterial({ name: 'Material.002' })

  // Внутренняя сторона дверей — BackSide-клон полотна (pivot door_* теперь Empty / Mesh).
  material.side = THREE.BackSide
  material.polygonOffset = true
  material.polygonOffsetFactor = -1
  material.polygonOffsetUnits = -1
  material.transparent = false
  material.opacity = 1
  material.depthWrite = true
  material.needsUpdate = true

  return material
}

/**
 * В shkaf_for_D.glb корпус/двери ошибочно сидят на Dark_Metal_Frame (материал базы).
 * Клонируем и переименовываем в Material.002 — чтобы сработал woodTextures pipeline.
 * Table_Top_Frame остаётся на Dark_Metal_Frame.
 */
function remapDarkMetalCorpusToWoodAlias(model) {
  // При AI-текстуре дверей не трогаем door_* — на них повесим doors-ai maps.
  const corpusMeshes = USE_AI_DOOR_TEXTURES
    ? new Set(['shkaf'])
    : new Set(['shkaf', 'door_left', 'door_right'])
  model.traverse((child) => {
    if (!child.isMesh || !corpusMeshes.has(child.name)) return
    const remap = (mat) => {
      if (!mat || mat.name !== 'Dark_Metal_Frame') return mat
      const clone = mat.clone()
      clone.name = 'Material.002'
      clone.needsUpdate = true
      return clone
    }
    child.material = Array.isArray(child.material)
      ? child.material.map(remap)
      : remap(child.material)
  })
}

function setInnerDoorBackfacesVisible(model, visible) {
  ;(['left', 'right']).forEach((side) => {
    const door = findDoorPivotNode(model, side)
    if (!door) return
    door.traverse((child) => {
      if (child.isMesh && String(child.name).includes(INNER_DOOR_BACKFACE_SUFFIX)) {
        child.visible = visible
      }
    })
  })
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
    if (!door) return

    // Полотно — дочерний mesh с patina_PBR (pivot door_* = Empty, не Mesh)
    findDoorPanelMeshes(door).forEach((panel, index) => {
      const innerName = `${door.name}${INNER_DOOR_BACKFACE_SUFFIX}_${index}`
      if (door.getObjectByName(innerName) || panel.getObjectByName(innerName)) return

      const innerFace = new THREE.Mesh(
        panel.geometry,
        createInnerDoorCopperMaterial(panel.material),
      )
      innerFace.name = innerName
      innerFace.raycast = () => null
      innerFace.castShadow = false
      innerFace.receiveShadow = true
      innerFace.renderOrder = 1
      // Виден при открытых дверях — изнанка полотна
      innerFace.visible = false
      panel.add(innerFace)

      // Снаружи и изнанка — DoubleSide (pivot Empty, backface-клон как страховка)
      const mats = Array.isArray(panel.material) ? panel.material : [panel.material]
      mats.forEach((mat) => {
        if (!mat) return
        mat.side = THREE.DoubleSide
        mat.transparent = false
        mat.opacity = 1
        mat.depthWrite = true
        mat.needsUpdate = true
      })
      panel.visible = true
    })
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

const ACCENT_LIGHT_RE = /leg_|ручка|заклеп|rivet|circle|bezier/i
const ACCENT_MATERIAL_RE = /bronze|brass|scratched copper|material\.001/i
const INTERIOR_LIGHT_RE = /drawer|tabl_|inside|inner|interior|внутр|door_back/i
const INTERIOR_MATERIAL_RE = /inside|inner|berestf_insige|door_back/i

function lineageName(object) {
  const names = []
  let current = object
  while (current && names.length < 5) {
    names.push(current.name ?? '')
    current = current.parent
  }
  return names.join(' ')
}

/** Дополнительные light-layers не меняют видимость или материалы мешей. */
function applyProductLightLayers(model) {
  model.traverse((child) => {
    if (!child.isMesh) return
    const names = lineageName(child)
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    const materialNames = materials.map((mat) => mat?.name ?? '').join(' ')

    if (ACCENT_LIGHT_RE.test(names) || ACCENT_MATERIAL_RE.test(materialNames)) {
      child.layers.enable(LIGHT_LAYERS.accent)
    }
    if (INTERIOR_LIGHT_RE.test(names) || INTERIOR_MATERIAL_RE.test(materialNames)) {
      child.layers.enable(LIGHT_LAYERS.interior)
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

  // Ножки: baked Table_Top_Frame оставляем; старые X (model*) прячем.
  // При отдельном shkaf-legs.glb — снимаем leg_* до attachGlbLegs.
  if (USE_BAKED_LEGS) {
    BAKED_LEG_HIDE_NODES.forEach((name) => {
      const node = model.getObjectByName(name)
      if (!node) return
      node.visible = false
      node.traverse((child) => {
        child.visible = false
        child.raycast = () => null
      })
    })
    GLB_LEG_NODES.forEach((name) => {
      const leg = model.getObjectByName(name)
      if (!leg) return
      leg.raycast = () => null
      leg.traverse((child) => {
        if (!child.isMesh) return
        child.raycast = () => null
        child.castShadow = true
        child.receiveShadow = true
      })
    })
  } else if (!USE_PROCEDURAL_LEGS) {
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

  /*
   * LEGACY DRAWER PLAQUES — временно отключены.
   * Чтобы вернуть таблички, раскомментировать блок и удалить hide-guard ниже.
   *
   * Object.entries(DRAWER_TABL_NODES).forEach(([sectionId, tablName]) => {
   *   const drawer = model.getObjectByName(SHKAF_NODE_MAP[sectionId])
   *   const tabl = model.getObjectByName(tablName)
   *   if (!drawer || !tabl) return
   *
   *   drawer.attach(tabl)
   *   tabl.traverse((child) => {
   *     if (child.isMesh) {
   *       child.castShadow = true
   *       child.receiveShadow = true
   *       child.renderOrder = 3
   *     }
   *   })
   * })
   */
  Object.values(DRAWER_TABL_NODES).forEach((tablName) => {
    const tabl = model.getObjectByName(tablName)
    if (!tabl) return
    tabl.visible = false
    tabl.traverse((child) => {
      child.visible = false
      child.raycast = () => null
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
  const { scene: backwallScene } = useGLTF(SHKAF_BACKWALL_MODEL_PATH)
  // Ножки / heavy facade — только если реально нужны (иначе dummy = backwall, без лишнего fetch)
  const { scene: legsScene } = useGLTF(
    !USE_BAKED_LEGS && !USE_PROCEDURAL_LEGS ? SHKAF_LEGS_MODEL_PATH : SHKAF_BACKWALL_MODEL_PATH,
  )
  const { scene: closedDoorsScene } = useGLTF(
    USE_CLOSED_DOORS_FACADE ? SHKAF_CLOSED_DOORS_PATH : SHKAF_BACKWALL_MODEL_PATH,
  )
  const { scene: leatherRimScene } = useGLTF(
    USE_ATTACH_LEATHER_RIM ? SHKAF_LEATHER_RIM_PATH : SHKAF_BACKWALL_MODEL_PATH,
  )
  const { gl, camera } = useThree()
  const isMobile = useIsMobile()
  const dragThresholdPx = isMobile ? DRAG_THRESHOLD_MOBILE_PX : DRAG_THRESHOLD_DESKTOP_PX
  const rootRef = useRef()
  const leftDoorRef = useRef()
  const rightDoorRef = useRef()
  const closedRotations = useRef({ left: 0, right: 0 })
  const hoveredDrawerId = useRef(null)
  const doorTimelineRef = useRef(null)
  const drawerTimelineRef = useRef(null)
  const navTimerRef = useRef(null)
  const navigate = useNavigate()

  const {
    doorsOpen,
    animating,
    activeDrawerId,
    setDoorsOpen,
    setAnimating,
    setActiveDrawerId,
    setHoveredSectionId,
  } = useShkafStore()

  const model = useMemo(() => {
    const cloned = scene.clone(true)
    if (USE_ATTACH_BACKWALL) {
      attachGlbBackwall(cloned, backwallScene)
    }
    attachCabinetSceneRoots(cloned)
    hideSceneDecor(cloned)
    if (USE_RAW_GLB_MATERIALS) {
      applyRawMaterialPipeline(cloned)
      finalizeShkafSceneGraph(cloned)
      if (!USE_PROCEDURAL_LEGS && !USE_BAKED_LEGS) {
        attachGlbLegs(cloned, legsScene)
      }
      remapDarkMetalCorpusToWoodAlias(cloned)
      applyProductLightLayers(cloned)
    }
    if (USE_CLOSED_DOORS_FACADE) {
      const facade = attachClosedDoorsFacade(cloned, closedDoorsScene)
      setClosedDoorsLook(cloned, facade, true)
      // Те же карты, что на AI-фасаде — на open door_* (без второго HTTP)
      if (USE_AI_DOOR_TEXTURES) {
        const aiMaps = extractAiDoorTexturesFromFacade(facade)
        if (aiMaps) applyAiDoorFacadeTextures(cloned, aiMaps)
      }
    } else if (USE_AI_DOOR_TEXTURES) {
      russoLog('warn', 'mat', 'USE_AI_DOOR_TEXTURES без facade — skip')
    }
    // Шов фаски на рабочих Beresta_* (на фасаде уже в attachClosedDoors)
    ;(['left', 'right']).forEach((side) => {
      openBerestaSeamGap(findDoorPivotNode(cloned, side))
    })
    if (USE_ATTACH_LEATHER_RIM) {
      const n = attachLeatherRims(cloned, leatherRimScene)
      russoLog('info', 'mat', `leather rim: ${n} halves`)
    }
    return cloned
  }, [scene, legsScene, backwallScene, closedDoorsScene, leatherRimScene])

  const closedDoorsFacade = useMemo(
    () => (USE_CLOSED_DOORS_FACADE ? model.getObjectByName(CLOSED_DOORS_NODE_NAME) : null),
    [model],
  )
  const shkafGroup = useMemo(() => findByName(model, SHKAF_ROOT_NAME), [model])
  const alignOffset = STUDIO.object.alignOffset ?? [0, 0, 0]
  const { position: placement } = useMemo(
    () => getCabinetPlacement(model, SHKAF_ROOT_NAME),
    [model],
  )

  const scenePrepared = useRef(null)
  useEffect(() => {
    if (USE_RAW_GLB_MATERIALS) return
    if (scenePrepared.current === model.uuid) return
    let cancelled = false

    const prepare = async () => {
      if (USE_ATTACH_BACKWALL) {
        attachGlbBackwall(model, backwallScene)
      }
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
      applyProductLightLayers(model)
      scenePrepared.current = model.uuid
    }

    prepare()
    return () => {
      cancelled = true
    }
  }, [model, backwallScene])

  // Тёмное дерево на корпус + полотна дверей (когда нет AI texture transfer)
  useEffect(() => {
    if (!USE_WOOD_DOORS || !model) return undefined
    let cancelled = false
    loadWoodTextures()
      .then((tex) => {
        if (cancelled) return
        const n = applyWoodDoorMaterials(model, tex)
        if (!USE_AI_DOOR_TEXTURES) {
          const innerMat = createInnerDoorWoodMaterial(tex)
          ;(['left', 'right']).forEach((side) => {
            const door = findDoorPivotNode(model, side)
            findDoorPanelMeshes(door).forEach((panel) => {
              panel.visible = true
              panel.traverse((child) => {
                if (!child.isMesh) return
                if (!String(child.name).includes(INNER_DOOR_BACKFACE_SUFFIX)) return
                child.material = innerMat
                ensureWoodUv2(child)
                child.material.side = THREE.BackSide
                child.material.transparent = false
                child.material.opacity = 1
                child.material.depthWrite = true
                child.material.needsUpdate = true
              })
            })
          })
        }
        russoLog('info', 'mat', `dark-wood-stain: ${n} slots`)
      })
      .catch((err) => {
        console.warn('РУССО: wood textures not loaded', err)
      })
    return () => {
      cancelled = true
    }
  }, [model])

  // Бронза только на ножки (после attachGlbLegs)
  useEffect(() => {
    if (!USE_BRONZE_METAL || !model) return undefined
    let cancelled = false
    loadBronzeTextures()
      .then((tex) => {
        if (cancelled) return
        const { legs } = applyBronzeMetalMaterials(model, tex)
        russoLog('info', 'mat', `bronze: legs=${legs}`)
      })
      .catch((err) => {
        console.warn('РУССО: bronze textures not loaded', err)
      })
    return () => {
      cancelled = true
    }
  }, [model])

  // Кожа на ободке + ручках (facade и door_*) — grain вместо пластика Material.001
  useEffect(() => {
    if (!model) return undefined
    let cancelled = false
    loadLeatherTextures()
      .then((tex) => {
        if (cancelled) return
        const n = applyLeatherAccentMaterials(model, tex)
        russoLog('info', 'mat', `leather accents: ${n}`)
      })
      .catch((err) => {
        console.warn('РУССО: leather textures not loaded', err)
      })
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
      /*
       * LEGACY PLAQUE DIAGNOSTICS — вернуть вместе с drawer plaques:
       * const tablName = DRAWER_TABL_NODES[s.id]
       * const tabl = tablName ? model.getObjectByName(tablName) : null
       * const tablMat = tabl?.isMesh
       *   ? (Array.isArray(tabl.material) ? tabl.material[0] : tabl.material)?.name
       *   : null
       */
      return {
        id: s.id,
        label: s.label,
        route: s.route,
        node: nodeName,
        nodeFound: !!node,
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

  // Закрыто → AI-фасад; открытие/открыто → рабочие door_left/door_right
  useEffect(() => {
    if (!USE_CLOSED_DOORS_FACADE) return
    const useClosedFacade = !doorsOpen && !animating
    setClosedDoorsLook(model, closedDoorsFacade, useClosedFacade)
    russoLog(
      'info',
      'doors',
      useClosedFacade ? 'closed facade ON (AI)' : 'closed facade OFF → real doors',
    )
  }, [doorsOpen, animating, model, closedDoorsFacade])

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

  const clearDrawerHover = useCallback(() => {
    if (!hoveredDrawerId.current) return
    hoveredDrawerId.current = null
    setHoveredSectionId(null)
    document.body.style.cursor = 'auto'
  }, [setHoveredSectionId])

  const applyDrawerHover = useCallback(
    (sectionId) => {
      if (hoveredDrawerId.current === sectionId) return
      hoveredDrawerId.current = sectionId
      setHoveredSectionId(sectionId)
      document.body.style.cursor = 'pointer'
    },
    [setHoveredSectionId],
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
      setHoveredSectionId(null)
      document.body.style.cursor = 'auto'
    },
    [setHoveredSectionId],
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
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerMove}
      />

      {USE_PROCEDURAL_LEGS && <CabinetLegs />}

      {!USE_STUDIO_CAMERA && (
        <FitCamera object={model} sceneScale={sceneScale} placement={placement} />
      )}
    </group>
  )
}

export default Shkaf
