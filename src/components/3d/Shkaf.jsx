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
import { USE_STUDIO_CAMERA, USE_HDRI_ONLY } from '../../constants/studioScene'
import { getCabinetBounds, getCabinetPlacement, findByName } from '../../utils/cabinetBounds'
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

const HOVER_NUDGE = 0.032
const HOVER_WIGGLE_DURATION = 0.45
const HOVER_EMISSIVE = '#c9a040'
const HOVER_EMISSIVE_INTENSITY = 0.32

/** Ящики без анимации выдвижения при hover — только подсветка */
const HOVER_HIGHLIGHT_ONLY = new Set()

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

function finalizeShkafSceneGraph(model) {
  INACTIVE_DRAWER_NODES.forEach((name) => {
    const node = model.getObjectByName(name)
    node?.traverse((child) => {
      if (child.isMesh) child.raycast = () => null
    })
  })

  // Прячем кривые GLB-ножки — заменяем процедурным Х-каркасом (CabinetLegs)
  if (USE_PROCEDURAL_LEGS) {
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

  Object.entries(DRAWER_TABL_NODES).forEach(([sectionId, tablName]) => {
    const drawer = model.getObjectByName(SHKAF_NODE_MAP[sectionId])
    const tabl = model.getObjectByName(tablName)
    if (!drawer || !tabl) return

    drawer.attach(tabl)
    tabl.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
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
    }
    return cloned
  }, [scene])
  const shkafGroup = useMemo(() => findByName(model, SHKAF_ROOT_NAME), [model])
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
      const tl = gsap.timeline({
        onComplete: () => {
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
    { pos: [center.x - size.x * 0.28, ceilingY, lightZ], target: [center.x - size.x * 0.28, targetY, center.z], castShadow: false },
    { pos: [center.x, ceilingY, lightZ], target: [center.x, targetY, center.z], castShadow: true },
    { pos: [center.x + size.x * 0.28, ceilingY, lightZ], target: [center.x + size.x * 0.28, targetY, center.z], castShadow: false },
  ]

  return (
    <group ref={rootRef} position={placement}>
      <primitive
        object={model}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
      />

      {USE_PROCEDURAL_LEGS && <CabinetLegs />}

      {!USE_HDRI_ONLY &&
        INTERIOR_LIGHTS.map(({ pos, target, castShadow: shadowOn }, i) => (
          <spotLight
            key={i}
            position={pos}
            color="#ffcf8a"
            intensity={lightIntensity}
            angle={0.62}
            penumbra={0.95}
            distance={lightDist}
            decay={2}
            castShadow={shadowOn}
            shadow-mapSize={shadowOn ? 512 : undefined}
            shadow-bias={shadowOn ? -0.00008 : undefined}
            shadow-camera-near={shadowOn ? 0.08 : undefined}
            shadow-camera-far={shadowOn ? lightDist : undefined}
          >
            <object3D attach="target" position={target} />
          </spotLight>
        ))}

      {!USE_STUDIO_CAMERA && (
        <FitCamera object={model} sceneScale={sceneScale} placement={placement} />
      )}
    </group>
  )
}

export default Shkaf
