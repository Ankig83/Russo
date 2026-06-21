import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Environment, OrbitControls, useProgress } from '@react-three/drei'
import * as THREE from 'three'
import Shkaf from './Shkaf'
import Loader from './Loader'
import StudioBackdrop from './StudioBackdrop'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { DESKTOP_SCALE, MOBILE_SCALE } from '../../constants/shkaf'
import {
  STUDIO_BG,
  STUDIO_BG_STYLE,
  STUDIO_LIGHT_COLOR,
  STUDIO_FOG_NEAR,
  STUDIO_FOG_FAR,
} from '../../constants/scene'
import { USE_GLB_ENVIRONMENT } from '../../constants/shkafNodes'

Environment.preload?.({ preset: 'studio' })

/** Освещение */
const AMBIENT_INTENSITY = 0.35
const FILL_LIGHT_INTENSITY = 0.4
const FILL_LIGHT_POSITION = [-5, 4, -3]
const RIM_LIGHT_INTENSITY = 0.3
const RIM_LIGHT_POSITION = [3, 6, -5]

/** OrbitControls — широкий вертикальный диапазон + панорамирование при зуме */
const ORBIT_MIN_POLAR = 0.12 // почти вид сверху
const ORBIT_MAX_POLAR = Math.PI / 2.35 // не опускаем камеру ниже горизонта шкафа
const ORBIT_PAN_SPEED = 0.65

function CanvasLoader() {
  const { active } = useProgress()
  if (!active) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-[5]">
      <Loader />
    </div>
  )
}

function handleCanvasCreated({ gl, scene }) {
  gl.toneMapping = THREE.ACESFilmicToneMapping
  // экспозиция снижена — иначе студийный HDR перветяет кожу и дерево
  gl.toneMappingExposure = 0.9

  if (!USE_GLB_ENVIRONMENT) {
    scene.background = new THREE.Color(STUDIO_BG)
  }

  gl.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    console.warn('WebGL context lost — перезагрузите страницу')
  })
}

/** castShadow / receiveShadow после загрузки модели */
function EnableShadows() {
  const scene = useThree((s) => s.scene)
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true
        obj.receiveShadow = true
      }
    })
    done.current = true
  }, [scene])

  return null
}

function StudioEnvironment() {
  return <Environment preset="studio" background={false} environmentIntensity={0.45} />
}

/** Студийная 3D-сцена: шкаф + пол из GLB */
export default function Scene() {
  const isMobile = useIsMobile()
  const scale = isMobile ? MOBILE_SCALE : DESKTOP_SCALE

  return (
    <div className="absolute inset-0 h-full w-full" style={STUDIO_BG_STYLE}>
      <CanvasLoader />

      <Canvas
        shadows
        camera={{ fov: 38, near: 0.05, far: 200, position: [0, 1.2, 8] }}
        gl={{ powerPreference: 'high-performance', antialias: true }}
        onCreated={handleCanvasCreated}
        style={{
          width: '100vw',
          height: '100vh',
          display: 'block',
        }}
      >
        {!USE_GLB_ENVIRONMENT && <color attach="background" args={[STUDIO_BG]} />}
        <fog attach="fog" args={[STUDIO_BG, STUDIO_FOG_NEAR, STUDIO_FOG_FAR]} />

        <ambientLight intensity={AMBIENT_INTENSITY} />
        <hemisphereLight color="#ffffff" groundColor="#b0b0b0" intensity={0.35} />
        {/* Заполняющий свет слева-сзади */}
        <directionalLight
          color={STUDIO_LIGHT_COLOR}
          intensity={FILL_LIGHT_INTENSITY}
          position={FILL_LIGHT_POSITION}
        />
        {/* Контровой свет справа-сзади — создаёт объём */}
        <directionalLight
          color="#fff5e6"
          intensity={RIM_LIGHT_INTENSITY}
          position={RIM_LIGHT_POSITION}
        />

        <OrbitControls
          makeDefault
          enablePan={!isMobile}
          enableRotate
          minPolarAngle={ORBIT_MIN_POLAR}
          maxPolarAngle={ORBIT_MAX_POLAR}
          panSpeed={ORBIT_PAN_SPEED}
          enableZoom={!isMobile}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
          touches={{ ONE: 0, TWO: 2 }}
        />

        <Suspense fallback={null}>
          <EnableShadows />
          <group scale={scale}>
            <Shkaf sceneScale={scale} />
          </group>
        </Suspense>

        {/* Фон вне группы масштабирования — фиксированные мировые координаты */}
        <StudioBackdrop />

        {!USE_GLB_ENVIRONMENT && (
          <Suspense fallback={null}>
            <StudioEnvironment />
          </Suspense>
        )}
      </Canvas>
    </div>
  )
}
