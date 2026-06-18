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

useGLTF.preload(SHKAF_MODEL_PATH)

const SHADOW_MAP_SIZE = 512
const SHADOW_CAMERA_SIZE = 2.5
const SHADOW_CAMERA_FAR = 20
const KEY_LIGHT_INTENSITY = 1.8
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

function DrawerLabel({ label, position }) {
  return (
    <Html center position={position} distanceFactor={6} zIndexRange={[100, 0]}>
      <div className="pointer-events-none whitespace-nowrap rounded-md bg-black/60 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
        {label}
      </div>
    </Html>
  )
}

function resolveNode(object, sectionId) {
  const nodeName = SHKAF_NODE_MAP[sectionId]
  if (!nodeName) return null
  return object.getObjectByName(nodeName)
}

/** Шкаф — GLB с анимацией дверец (ось Z, как в Blender) */
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

  const [hoveredDrawer, setHoveredDrawer] = useState(null)
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

        // Усилить отражения окружения для PBR-эффекта
        mat.envMapIntensity = 1.4

        // Правильное цветовое пространство текстур
        if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace
        if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace

        // Нормали — полная сила
        if (mat.normalMap) {
          mat.normalScale = mat.normalScale ?? new THREE.Vector2(1, 1)
          mat.normalScale.set(1, 1)
        }

        // Материалы без текстур (процедурные) — сделать их visually интересными
        if (!mat.map && mat.isMeshStandardMaterial) {
          mat.roughness = Math.min(mat.roughness ?? 1, 0.65)
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

      gsap.to(target.position, {
        z: target.position.z + DRAWER_PULL_DISTANCE,
        duration: DRAWER_OPEN_DURATION,
        ease: 'power2.out',
        onComplete: () => {
          setTimeout(() => navigate(section.route), NAVIGATE_DELAY_MS)
        },
      })
    },
    [navigate, setAnimating, setActiveDrawerId],
  )

  const handlePointerDown = useCallback((event) => {
    pointerDownPos.current = { x: event.clientX, y: event.clientY }
  }, [])

  const handleClick = useCallback(
    (event) => {
      event.stopPropagation()

      // Игнорировать клик если была перетяжка (вращение камеры)
      const dx = event.clientX - pointerDownPos.current.x
      const dy = event.clientY - pointerDownPos.current.y
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD_PX) return

      const clickedName = event.object?.name
      const { activeDrawerId } = useShkafStore.getState()

      if (doorsOpen && !animating && !activeDrawerId && clickedName) {
        const drawerSection = drawerSections.find(
          (s) => SHKAF_NODE_MAP[s.id] === clickedName,
        )
        if (drawerSection) {
          const drawerNode = model.getObjectByName(clickedName)
          if (drawerNode) {
            handleDrawerClick(drawerSection, drawerNode)
            return
          }
        }
      }

      toggleDoors()
    },
    [doorsOpen, animating, model, toggleDoors, handleDrawerClick],
  )

  const handlePointerOver = useCallback(
    (event) => {
      event.stopPropagation()
      const { animating, activeDrawerId } = useShkafStore.getState()
      if (!doorsOpen || animating || activeDrawerId) return

      const clickedName = event.object?.name
      const drawerSection = drawerSections.find(
        (s) => SHKAF_NODE_MAP[s.id] === clickedName,
      )
      if (drawerSection) {
        const node = model.getObjectByName(clickedName)
        if (node) {
          setHoveredDrawer({
            label: drawerSection.label,
            position: [node.position.x, node.position.y + 0.15, node.position.z],
          })
          document.body.style.cursor = 'pointer'
        }
      }
    },
    [doorsOpen, model],
  )

  const handlePointerOut = useCallback(() => {
    setHoveredDrawer(null)
    document.body.style.cursor = 'auto'
  }, [])

  return (
    <group
      ref={rootRef}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <primitive object={model} />
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

      {hoveredDrawer && (
        <DrawerLabel label={hoveredDrawer.label} position={hoveredDrawer.position} />
      )}
    </group>
  )
}
