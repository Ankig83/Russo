import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGLTF, Html, ContactShadows } from '@react-three/drei'
import gsap from 'gsap'
import { drawerSections } from '../../constants/sections'
import { SHKAF_MODEL_PATH, SHKAF_NODE_MAP } from '../../constants/shkafNodes'
import {
  DOOR_OPEN_ANGLE,
  DOOR_OPEN_DURATION,
  DRAWER_PULL_DISTANCE,
  DRAWER_OPEN_DURATION,
  NAVIGATE_DELAY_MS,
} from '../../constants/shkaf'
import { STUDIO_LIGHT_COLOR } from '../../constants/scene'
import { useShkafStore } from '../../store/shkafStore'
import FitCamera, { FLOOR_NODE_NAME } from './FitCamera'
import { getCabinetBounds, getFloorY } from '../../utils/cabinetBounds'

useGLTF.preload(SHKAF_MODEL_PATH)

/** Тени — ключевой свет над шкафом */
const SHADOW_MAP_SIZE = 512
const SHADOW_CAMERA_SIZE = 3
const SHADOW_CAMERA_FAR = 20
const KEY_LIGHT_INTENSITY = 1.6
const KEY_LIGHT_HEIGHT = 10

/** ContactShadows под шкафом */
const CONTACT_SHADOW_OPACITY = 0.5
const CONTACT_SHADOW_BLUR = 2
const CONTACT_SHADOW_FAR = 3

/** Подпись ящика при hover */
function DrawerLabel({ label, position }) {
  return (
    <Html center position={position} distanceFactor={6} zIndexRange={[100, 0]}>
      <div className="pointer-events-none whitespace-nowrap rounded-md bg-black/60 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
        {label}
      </div>
    </Html>
  )
}

/** Получить Three.js-объект по id раздела */
function resolveNode(nodesMap, sectionId) {
  const nodeName = SHKAF_NODE_MAP[sectionId]
  return nodeName ? nodesMap[nodeName] : null
}

/** Собрать карту имя → объект из клонированной сцены */
function buildNodesMap(object) {
  const map = {}
  object.traverse((child) => {
    if (child.name) map[child.name] = child
  })
  return map
}

/** Шкаф — GLB-модель с GSAP-анимациями дверец и ящиков */
export default function Shkaf() {
  const { nodes, scene } = useGLTF(SHKAF_MODEL_PATH)
  const rootRef = useRef()
  const leftDoorRef = useRef()
  const rightDoorRef = useRef()
  const navigate = useNavigate()

  const [hoveredDrawer, setHoveredDrawer] = useState(null)

  const { doorsOpen, animating, setDoorsOpen, setAnimating, setActiveDrawerId } =
    useShkafStore()

  // Клон — useGLTF кэширует scene, GSAP не должен мутировать оригинал
  const model = useMemo(() => scene.clone(true), [scene])
  const modelNodes = useMemo(() => buildNodesMap(model), [model])
  const bounds = useMemo(() => getCabinetBounds(model), [model])
  const floorY = useMemo(() => getFloorY(model), [model])
  const { center, size } = bounds

  // Контраст материалов — один раз на каждый новый клон модели
  const materialsAppliedTo = useRef(null)
  useEffect(() => {
    if (materialsAppliedTo.current === model.uuid) return
    materialsAppliedTo.current = model.uuid

    model.traverse((child) => {
      if (!child.isMesh) return

      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((mat) => {
        if (!mat) return
        mat.envMapIntensity = 0.5
        if (mat.color && child.name !== FLOOR_NODE_NAME) {
          mat.color.multiplyScalar(0.9)
        }
        mat.needsUpdate = true
      })
    })
  }, [model])

  // Список объектов модели — для настройки SHKAF_NODE_MAP
  useEffect(() => {
    console.log(nodes)
  }, [nodes])

  // Привязка refs к нодам GLB (когда заполнен SHKAF_NODE_MAP)
  useEffect(() => {
    leftDoorRef.current = resolveNode(modelNodes, 'door_left')
    rightDoorRef.current = resolveNode(modelNodes, 'door_right')
  }, [modelNodes])

  /** Открытие дверец по клику на шкаф */
  const openDoors = useCallback(() => {
    if (doorsOpen || animating) return

    setAnimating(true)

    const left = leftDoorRef.current
    const right = rightDoorRef.current

    // Если ноды дверец ещё не сопоставлены — просто открываем состояние
    if (!left || !right) {
      setDoorsOpen(true)
      setAnimating(false)
      return
    }

    const tl = gsap.timeline({
      onComplete: () => {
        setDoorsOpen(true)
        setAnimating(false)
      },
    })

    tl.to(
      left.rotation,
      { y: DOOR_OPEN_ANGLE, duration: DOOR_OPEN_DURATION, ease: 'power2.out' },
      0,
    )
    tl.to(
      right.rotation,
      { y: -DOOR_OPEN_ANGLE, duration: DOOR_OPEN_DURATION, ease: 'power2.out' },
      0,
    )
  }, [doorsOpen, animating, setDoorsOpen, setAnimating])

  /** Выдвижение ящика и переход на страницу */
  const handleDrawerClick = useCallback(
    (section, target) => {
      setAnimating(true)
      setActiveDrawerId(section.id)

      gsap.to(target.position, {
        z: target.position.z + DRAWER_PULL_DISTANCE,
        duration: DRAWER_OPEN_DURATION,
        ease: 'power2.out',
        onComplete: () => {
          setTimeout(() => {
            navigate(section.route)
          }, NAVIGATE_DELAY_MS)
        },
      })
    },
    [navigate, setAnimating, setActiveDrawerId],
  )

  /** Клик по модели — шкаф или ящик */
  const handleClick = useCallback(
    (event) => {
      event.stopPropagation()
      const clickedName = event.object?.name
      const { activeDrawerId } = useShkafStore.getState()

      if (doorsOpen && !animating && !activeDrawerId && clickedName) {
        const drawerSection = drawerSections.find(
          (s) => SHKAF_NODE_MAP[s.id] === clickedName,
        )
        if (drawerSection) {
          const drawerNode = modelNodes[clickedName]
          if (drawerNode) {
            handleDrawerClick(drawerSection, drawerNode)
            return
          }
        }
      }

      if (!doorsOpen) {
        openDoors()
      }
    },
    [doorsOpen, animating, modelNodes, openDoors, handleDrawerClick],
  )

  /** Hover по ящику — подпись */
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
        const node = modelNodes[clickedName]
        setHoveredDrawer({
          label: drawerSection.label,
          position: [node.position.x, node.position.y + 0.15, node.position.z],
        })
        document.body.style.cursor = 'pointer'
      }
    },
    [doorsOpen, modelNodes],
  )

  const handlePointerOut = useCallback(() => {
    setHoveredDrawer(null)
    document.body.style.cursor = 'auto'
  }, [])

  return (
    <group
      ref={rootRef}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <primitive object={model} />

      {/* Ключевой свет и тени — привязаны к позиции шкафа из Blender */}
      <directionalLight
        castShadow
        color={STUDIO_LIGHT_COLOR}
        intensity={KEY_LIGHT_INTENSITY}
        position={[center.x + 3, center.y + KEY_LIGHT_HEIGHT, center.z + 5]}
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
        position={[center.x, floorY + 0.002, center.z]}
        opacity={CONTACT_SHADOW_OPACITY}
        scale={Math.max(size.x, size.z) * 2.2}
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
