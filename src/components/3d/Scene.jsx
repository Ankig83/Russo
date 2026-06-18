import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Environment, OrbitControls, useProgress } from '@react-three/drei'
import * as THREE from 'three'
import Shkaf from './Shkaf'
import Loader from './Loader'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { DESKTOP_SCALE, MOBILE_SCALE } from '../../constants/shkaf'
import { STUDIO_BG, STUDIO_BG_STYLE, STUDIO_LIGHT_COLOR } from '../../constants/scene'
import { USE_GLB_ENVIRONMENT } from '../../constants/shkafNodes'

Environment.preload?.({ preset: 'studio' })

/** Освещение (без теней — ключевой свет внутри Shkaf, привязан к позиции шкафа) */
const AMBIENT_INTENSITY = 0.3
const FILL_LIGHT_INTENSITY = 0.35
const FILL_LIGHT_POSITION = [-5, 4, -3]

/** OrbitControls */
const ORBIT_POLAR_ANGLE = Math.PI / 2.4

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
  gl.toneMappingExposure = 1.05

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
  return <Environment preset="studio" background={false} environmentIntensity={0.4} />
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
        camera={{ fov: 40, near: 0.05, far: 200, position: [0, 1.5, 5] }}
        gl={{ powerPreference: 'high-performance', antialias: false }}
        onCreated={handleCanvasCreated}
        style={{
          width: '100vw',
          height: '100vh',
          display: 'block',
        }}
      >
        {!USE_GLB_ENVIRONMENT && <color attach="background" args={[STUDIO_BG]} />}

        <ambientLight intensity={AMBIENT_INTENSITY} />
        <hemisphereLight color="#ffffff" groundColor="#b0b0b0" intensity={0.3} />
        <directionalLight
          color={STUDIO_LIGHT_COLOR}
          intensity={FILL_LIGHT_INTENSITY}
          position={FILL_LIGHT_POSITION}
        />

        <OrbitControls
          enablePan={false}
          enableRotate
          minPolarAngle={ORBIT_POLAR_ANGLE}
          maxPolarAngle={ORBIT_POLAR_ANGLE}
          enableZoom={!isMobile}
          touches={{ ONE: 1, TWO: 0 }}
        />

        <Suspense fallback={null}>
          <EnableShadows />
          <group scale={scale}>
            <Shkaf />
          </group>
        </Suspense>

        {!USE_GLB_ENVIRONMENT && (
          <Suspense fallback={null}>
            <StudioEnvironment />
          </Suspense>
        )}
      </Canvas>
    </div>
  )
}
