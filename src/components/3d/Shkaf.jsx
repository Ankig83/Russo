import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useThree } from '@react-three/fiber'
import { useGLTF, Html, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { drawerSections } from '../../constants/sections'
import {
  SHKAF_MODEL_PATH,
  SHKAF_NODE_MAP,
  USE_GLB_ENVIRONMENT,
  SHKAF_ROOT_NAME,
  HIDE_SCENE_DECOR,
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
import { STUDIO_LIGHT_COLOR } from '../../constants/scene'
import { useShkafStore } from '../../store/shkafStore'
import FitCamera from './FitCamera'
import { getCabinetBounds, getFloorY, findByName } from '../../utils/cabinetBounds'
import {
  findDrawerNodeFromHit,
  findDrawerSectionFromHit,
} from '../../utils/drawerHit'

useGLTF.preload(SHKAF_MODEL_PATH)

const SHADOW_MAP_SIZE = 512
const SHADOW_CAMERA_SIZE = 2.5
const SHADOW_CAMERA_FAR = 20
const KEY_LIGHT_INTENSITY = 1.2
const KEY_LIGHT_HEIGHT = 8

const CONTACT_SHADOW_OPACITY = 0.45
const CONTACT_SHADOW_BLUR = 2
const CONTACT_SHADOW_FAR = 2.5

/** HDRI / фон из GLB */
function GlbEnvironment({ source }) {
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    if (!USE_GLB_ENVIRONMENT || !source) return
    if (source.environment) scene.environment = source.environment
    if (source.background) scene.background = source.background
  }, [source, scene])

  return null
}

const _tmpVec = new THREE.Vector3()

/**
 * Подпись над ящиком.
 * Позиция вычисляется один раз в useEffect (после рендера Three.js),
 * поэтому матрицы гарантированно обновлены и позиция точная.
 */
function DrawerLabel({ node, label }) {
  const [pos, setPos] = useState(null)

  useEffect(() => {
    if (!node) return
    // forceWorldMatrix: обойти всю цепочку родителей
    node.updateWorldMatrix(true, false)
    node.getWorldPosition(_tmpVec)
    // смещаем чуть выше центра ящика
    setPos([_tmpVec.x, _tmpVec.y + 0.12, _tmpVec.z])
  }, [node])

  if (!pos) return null

  return (
    <Html
      center
      position={pos}
      distanceFactor={5}
      zIndexRange={[100, 0]}
      // предотвращает ошибки с occlude
      occlude={false}
    >
      <div className="pointer-events-none whitespace-nowrap rounded-md bg-black/75 px-3 py-1.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm">
        {label}
      </div>
    </Html>
  )
}

/** Все подписи ящиков — видны когда двери открыты */
function DrawerLabels({ model, visible }) {
  const entries = useMemo(
    () =>
      drawerSections
        .map((section) => ({
          section,
          node: model.getObjectByName(SHKAF_NODE_MAP[section.id]),
        }))
        .filter((entry) => entry.node),
    [model],
  )

  if (!visible) return null

  return entries.map(({ section, node }) => (
    <DrawerLabel key={section.id} node={node} label={section.label} />
  ))
}


/** Шкаф — GLB с анимацией дверец и ящиков */
/** Порог смещения мыши (px) — выше него клик считается вращением */
const DRAG_THRESHOLD_PX = 5

export default function Shkaf() {
  const { scene } = useGLTF(SHKAF_MODEL_PATH)
  const rootRef = useRef()
  const leftDoorRef = useRef()
  const rightDoorRef = useRef()
  const closedRotations = useRef({ left: 0, right: 0 })
  const pointerDownPos = useRef({ x: 0, y: 0 })
  const navigate = useNavigate()

  const { doorsOpen, animating, setDoorsOpen, setAnimating, setActiveDrawerId } =
    useShkafStore()

  const model = useMemo(() => scene.clone(true), [scene])
  const shkafGroup = useMemo(() => findByName(model, SHKAF_ROOT_NAME), [model])
  const bounds = useMemo(() => getCabinetBounds(model, SHKAF_ROOT_NAME), [model])
  const floorY = useMemo(() => getFloorY(model, SHKAF_ROOT_NAME), [model])
  const { center, size } = bounds

  // Скрыть декор HDRI-сцены — оставить только shkaf; настроить материалы
  const scenePrepared = useRef(null)
  useEffect(() => {
    if (scenePrepared.current === model.uuid) return
    scenePrepared.current = model.uuid

    if (HIDE_SCENE_DECOR) {
      model.children.forEach((child) => {
        child.visible = child.name === SHKAF_ROOT_NAME
      })
    }

    model.traverse((child) => {
      if (!child.isMesh) return
      child.castShadow = true
      child.receiveShadow = true

      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((mat) => {
        if (!mat) return

        // envMapIntensity умеренный — иначе яркий студийный HDR даёт перветку
        mat.envMapIntensity = 0.85

        // Нормали — полная сила
        if (mat.normalMap) {
          mat.normalScale = mat.normalScale ?? new THREE.Vector2(1, 1)
          mat.normalScale.set(1, 1)
        }

        // Процедурные материалы без текстур — чуть снизить roughness для блеска
        if (!mat.map && mat.isMeshStandardMaterial) {
          mat.roughness = Math.min(mat.roughness ?? 1, 0.6)
        }

        mat.needsUpdate = true
      })
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

  const handleDrawerClick = useCallback(
    (section, target) => {
      setAnimating(true)
      setActiveDrawerId(section.id)

      // Двигаем основной узел ящика
      const tl = gsap.timeline({
        onComplete: () => {
          setTimeout(() => navigate(section.route), NAVIGATE_DELAY_MS)
        },
      })

      tl.to(target.position, {
        z: target.position.z + DRAWER_PULL_DISTANCE,
        duration: DRAWER_OPEN_DURATION,
        ease: 'power2.out',
      }, 0)

      // Ищем парный узел (крышка/корпус: drawer_4 ↔ drawer_4.1)
      const pairedName = target.name.endsWith('.1')
        ? target.name.slice(0, -2)           // drawer_4.1 → drawer_4
        : target.name + '.1'                 // drawer_4   → drawer_4.1
      const paired = model.getObjectByName(pairedName)
      if (paired) {
        tl.to(paired.position, {
          z: paired.position.z + DRAWER_PULL_DISTANCE,
          duration: DRAWER_OPEN_DURATION,
          ease: 'power2.out',
        }, 0)
      }
    },
    [model, navigate, setAnimating, setActiveDrawerId],
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
        document.body.style.cursor = 'pointer'
      }
    },
    [doorsOpen],
  )

  const handlePointerOut = useCallback(() => {
    document.body.style.cursor = 'auto'
  }, [])

  const showDrawerLabels = doorsOpen && !animating

  return (
    <group ref={rootRef}>
      <primitive
        object={model}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />
      <GlbEnvironment source={scene} />

      <directionalLight
        castShadow
        color={STUDIO_LIGHT_COLOR}
        intensity={KEY_LIGHT_INTENSITY}
        position={[center.x + 2, center.y + KEY_LIGHT_HEIGHT, center.z + 4]}
        shadow-mapSize={[SHADOW_MAP_SIZE, SHADOW_MAP_SIZE]}
        shadow-camera-far={SHADOW_CAMERA_FAR}
        shadow-camera-left={-SHADOW_CAMERA_SIZE}
        shadow-camera-right={SHADOW_CAMERA_SIZE}
        shadow-camera-top={SHADOW_CAMERA_SIZE}
        shadow-camera-bottom={-SHADOW_CAMERA_SIZE}
        shadow-bias={-0.0001}
        shadow-normalBias={0.04}
      >
        <object3D position={[center.x, center.y, center.z]} />
      </directionalLight>

      <ContactShadows
        position={[center.x, floorY + 0.01, center.z]}
        opacity={CONTACT_SHADOW_OPACITY}
        scale={Math.max(size.x, size.z) * 1.8}
        blur={CONTACT_SHADOW_BLUR}
        far={CONTACT_SHADOW_FAR}
        color="#000000"
        frames={1}
        resolution={256}
      />

      <FitCamera object={model} />

      <DrawerLabels model={model} visible={showDrawerLabels} />
    </group>
  )
}
