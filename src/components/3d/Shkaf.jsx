import { useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { drawerSections } from '../../constants/sections'
import {
  SHKAF_MODEL_PATH,
  SHKAF_NODE_MAP,
  SHKAF_ROOT_NAME,
  HIDE_SCENE_DECOR,
  DOOR_NORMAL_SCALE,
  DOOR_SURFACE_MATERIALS,
  INACTIVE_DRAWER_NODES,
  INACTIVE_MESH_NAMES,
  DRAWER_LID_TO_BODY,
} from '../../constants/shkafNodes'
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
import { USE_STUDIO_CAMERA } from '../../constants/studioScene'
import { getCabinetBounds, getFloorY, findByName } from '../../utils/cabinetBounds'
import {
  findDrawerNodeFromHit,
  findDrawerSectionFromHit,
  getDrawerBodyName,
} from '../../utils/drawerHit'
import { fixGltfTextureColorSpaces } from '../../utils/gltfColorSpace'

useGLTF.preload(SHKAF_MODEL_PATH)

const HOVER_NUDGE = 0.032
const HOVER_WIGGLE_DURATION = 0.45
const HOVER_EMISSIVE = '#c9a040'
const HOVER_EMISSIVE_INTENSITY = 0.32

/** Ящики без анимации выдвижения при hover — только подсветка */
const HOVER_HIGHLIGHT_ONLY = new Set()

/** Парные узлы (крышка ↔ корпус) */
const PAIRED_DRAWER_NODES = new Set(Object.keys(DRAWER_LID_TO_BODY))

/** У каждого mesh — свой экземпляр material (в GLB один mat на drawer_1, drawe_3, …) */
function ensureUniqueMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return
    child.material = Array.isArray(child.material)
      ? child.material.map((mat) => mat?.clone?.() ?? mat)
      : child.material.clone()
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

/** Порог смещения мыши (px) — выше него клик считается вращением */
const DRAG_THRESHOLD_PX = 5

export default function Shkaf({ sceneScale = 1 }) {
  const { scene } = useGLTF(SHKAF_MODEL_PATH)
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

  const model = useMemo(() => scene.clone(true), [scene])
  const shkafGroup = useMemo(() => findByName(model, SHKAF_ROOT_NAME), [model])
  const bounds = useMemo(() => getCabinetBounds(model, SHKAF_ROOT_NAME), [model])
  const floorY = useMemo(() => getFloorY(model, SHKAF_ROOT_NAME), [model])
  const placementY = -floorY
  const alignedFloorY = 0
  const { center, size, box } = bounds

  // Скрыть декор HDRI-сцены — оставить только shkaf
  const scenePrepared = useRef(null)
  useEffect(() => {
    if (scenePrepared.current === model.uuid) return
    scenePrepared.current = model.uuid

    if (HIDE_SCENE_DECOR) {
      model.children.forEach((child) => {
        child.visible = child.name === SHKAF_ROOT_NAME
      })
    }

    fixGltfTextureColorSpaces(model)

    // Патина: микрогрань в normal map без сглаживания → точечные блики при IBL
    const doorMaterials = new Set(DOOR_SURFACE_MATERIALS)
    model.traverse((child) => {
      if (!child.isMesh) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((mat) => {
        if (!mat?.name || !doorMaterials.has(mat.name) || !mat.normalMap) return
        if (DOOR_NORMAL_SCALE <= 0) {
          mat.normalMap = null
        } else {
          mat.normalScale = mat.normalScale ?? new THREE.Vector2(1, 1)
          mat.normalScale.set(DOOR_NORMAL_SCALE, DOOR_NORMAL_SCALE)
        }
        mat.needsUpdate = true
      })
    })

    ensureUniqueMaterials(model)

    INACTIVE_DRAWER_NODES.forEach((name) => {
      const node = model.getObjectByName(name)
      node?.traverse((child) => {
        if (child.isMesh) child.raycast = () => null
      })
    })

    // Планка — статичный декор, не часть ящика
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

    model.traverse((child) => {
      // Текстовые объекты из Blender
      if (child.name.startsWith('Текст')) {
        child.visible = false
        return
      }

      if (!child.isMesh) return

      child.castShadow = true
      child.receiveShadow = true
    })
  }, [model])

  // Запомнить закрытое положение дверей (rotation Z = 0 в Blender)
  useEffect(() => {
    const left = model.getObjectByName('door_left')
    const right = model.getObjectByName('door_right')
    leftDoorRef.current = left
    rightDoorRef.current = right

    if (left) closedRotations.current.left = left.rotation[DOOR_ROTATION_AXIS]
    if (right) closedRotations.current.right = right.rotation[DOOR_ROTATION_AXIS]

    console.log('РУССО: двери найдены', {
      door_left: !!left,
      door_right: !!right,
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

      if (!left || !right) {
        setDoorsOpen(open)
        setAnimating(false)
        return
      }

      const axis = DOOR_ROTATION_AXIS
      const tl = gsap.timeline({
        onComplete: () => {
          setDoorsOpen(open)
          setAnimating(false)
        },
      })

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

  const handlePointerDown = useCallback((event) => {
    pointerDownPos.current = { x: event.clientX, y: event.clientY }
  }, [])

  const handleClick = useCallback(
    (event) => {
      event.stopPropagation()

      const dx = event.clientX - pointerDownPos.current.x
      const dy = event.clientY - pointerDownPos.current.y
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD_PX) return

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
    [doorsOpen, animating, toggleDoors, handleDrawerClick],
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

  // Подсветка с потолка шкафа
  const ceilingY = box.max.y - 0.06
  const lightZ = center.z + size.z * 0.08
  const targetY = center.y - size.y * 0.05
  const lightDist = size.y * 1.8
  const lightIntensity = doorsOpen ? 1.4 : 0
  const INTERIOR_LIGHTS = [
    { pos: [center.x - size.x * 0.28, ceilingY, lightZ], target: [center.x - size.x * 0.28, targetY, center.z] },
    { pos: [center.x, ceilingY, lightZ], target: [center.x, targetY, center.z] },
    { pos: [center.x + size.x * 0.28, ceilingY, lightZ], target: [center.x + size.x * 0.28, targetY, center.z] },
  ]

  return (
    <group ref={rootRef} position={[0, placementY, 0]}>
      <primitive
        object={model}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
      />

      {INTERIOR_LIGHTS.map(({ pos, target }, i) => (
        <spotLight
          key={i}
          position={pos}
          color="#ffcf8a"
          intensity={lightIntensity}
          angle={0.62}
          penumbra={0.95}
          distance={lightDist}
          decay={2}
        >
          <object3D attach="target" position={target} />
        </spotLight>
      ))}

      {!USE_STUDIO_CAMERA && (
        <FitCamera object={model} sceneScale={sceneScale} placementY={placementY} />
      )}
    </group>
  )
}
