import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Environment, OrbitControls, useProgress } from '@react-three/drei'
import * as THREE from 'three'
import Shkaf from './Shkaf'
import Loader from './Loader'
import ReferenceBackdrop from './ReferenceBackdrop'
import StudioCameraLimits from './StudioCameraLimits'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { DESKTOP_SCALE, MOBILE_SCALE } from '../../constants/shkaf'
import {
  STUDIO_BG,
  STUDIO_BG_STYLE,
  STUDIO_FOG_NEAR,
  STUDIO_FOG_FAR,
} from '../../constants/scene'
import { USE_GLB_ENVIRONMENT } from '../../constants/shkafNodes'

Environment.preload?.({ preset: 'studio' })

/** Мягкий свет слева-сверху — как на референсе */
const KEY_LIGHT_INTENSITY = 1.15
const KEY_LIGHT_POSITION = [-5.5, 7.5, 5.5]
const FILL_LIGHT_INTENSITY = 0.32
const FILL_LIGHT_POSITION = [4.5, 3.5, 6]
const AMBIENT_INTENSITY = 0.48

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
  gl.toneMappingExposure = 0.88
  scene.background = new THREE.Color(STUDIO_BG)

  gl.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    console.warn('WebGL context lost — перезагрузите страницу')
  })
}

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

function ReferenceEnvironment() {
  return <Environment preset="studio" background={false} environmentIntensity={0.42} />
}

/** Продуктовая студия по референсу */
export default function Scene() {
  const isMobile = useIsMobile()
  const scale = isMobile ? MOBILE_SCALE : DESKTOP_SCALE

  return (
    <div className="absolute inset-0 h-full w-full" style={STUDIO_BG_STYLE}>
      <CanvasLoader />

      <Canvas
        shadows
        camera={{ fov: 38, near: 0.05, far: 120, position: [0, 1.2, 6] }}
        gl={{ powerPreference: 'high-performance', antialias: true }}
        onCreated={handleCanvasCreated}
        style={{
          width: '100vw',
          height: '100vh',
          display: 'block',
          touchAction: 'none',
        }}
      >
        <color attach="background" args={[STUDIO_BG]} />
        <fog attach="fog" args={[STUDIO_BG, STUDIO_FOG_NEAR, STUDIO_FOG_FAR]} />

        <ambientLight intensity={AMBIENT_INTENSITY} />
        <hemisphereLight color="#f2f2f2" groundColor="#9a9a9a" intensity={0.38} />

        <directionalLight
          castShadow
          color="#fff6ee"
          intensity={KEY_LIGHT_INTENSITY}
          position={KEY_LIGHT_POSITION}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={40}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
          shadow-bias={-0.00015}
          shadow-normalBias={0.02}
        />

        <directionalLight
          color="#e8e8e8"
          intensity={FILL_LIGHT_INTENSITY}
          position={FILL_LIGHT_POSITION}
        />

        <OrbitControls
          makeDefault
          enablePan={!isMobile}
          enableRotate
          panSpeed={ORBIT_PAN_SPEED}
          enableZoom
          zoomSpeed={isMobile ? 1 : 1.1}
          minDistance={0.1}
          maxDistance={500}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
          touches={{
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN,
          }}
        />

        <StudioCameraLimits />

        <Suspense fallback={null}>
          <EnableShadows />
          <group scale={scale}>
            <Shkaf sceneScale={scale} />
          </group>
        </Suspense>

        <ReferenceBackdrop />

        {!USE_GLB_ENVIRONMENT && (
          <Suspense fallback={null}>
            <ReferenceEnvironment />
          </Suspense>
        )}
      </Canvas>
    </div>
  )
}
