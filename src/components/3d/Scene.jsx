import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Environment, OrbitControls, useProgress } from '@react-three/drei'
import * as THREE from 'three'
import Shkaf from './Shkaf'
import Loader from './Loader'
import StudioBackdrop from './StudioBackdrop'
import StudioScene from './StudioScene'
import {
  USE_STUDIO_GLB,
  STUDIO_ENV_INTENSITY,
  STUDIO_KEY_SPOT_INTENSITY,
  STUDIO_KEY_SPOT_POSITION,
  STUDIO_KEY_SPOT_TARGET,
  STUDIO_KEY_SPOT_ANGLE,
  STUDIO_KEY_SPOT_PENUMBRA,
  STUDIO_RIM_INTENSITY,
  STUDIO_RIM_POSITION,
  STUDIO_HEMISPHERE_INTENSITY,
  STUDIO_HEMISPHERE_SKY,
  STUDIO_HEMISPHERE_GROUND,
  STUDIO_AMBIENT_INTENSITY,
  STUDIO_TONE_MAPPING_EXPOSURE,
} from '../../constants/studioScene'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { DESKTOP_SCALE, MOBILE_SCALE } from '../../constants/shkaf'
import {
  STUDIO_BG,
  STUDIO_BG_STYLE,
  STUDIO_LIGHT_COLOR,
  STUDIO_CANVAS_BG,
  STUDIO_FOG_NEAR,
  STUDIO_FOG_FAR,
  LEGACY_FOG_NEAR,
  LEGACY_FOG_FAR,
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
  gl.toneMappingExposure = USE_STUDIO_GLB ? STUDIO_TONE_MAPPING_EXPOSURE : 0.9

  if (!USE_GLB_ENVIRONMENT) {
    scene.background = new THREE.Color(USE_STUDIO_GLB ? STUDIO_CANVAS_BG : STUDIO_BG)
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
  return (
    <Environment
      preset="studio"
      background={false}
      environmentIntensity={USE_STUDIO_GLB ? STUDIO_ENV_INTENSITY : 0.45}
    />
  )
}

/** Студийная 3D-сцена: шкаф + пол из GLB */
export default function Scene() {
  const isMobile = useIsMobile()
  const scale = isMobile ? MOBILE_SCALE : DESKTOP_SCALE

  return (
    <div
      className="absolute inset-0 h-full w-full"
      style={{
        ...STUDIO_BG_STYLE,
        background: USE_STUDIO_GLB ? STUDIO_CANVAS_BG : STUDIO_BG_STYLE.background,
      }}
    >
      <CanvasLoader />

      <Canvas
        shadows
        camera={{ fov: 42, near: 0.05, far: 200, position: [0, 3.5, 11] }}
        gl={{ powerPreference: 'high-performance', antialias: true }}
        onCreated={handleCanvasCreated}
        style={{
          width: '100vw',
          height: '100vh',
          display: 'block',
          background: USE_STUDIO_GLB ? STUDIO_CANVAS_BG : undefined,
        }}
      >
        {!USE_GLB_ENVIRONMENT && (
          <color attach="background" args={[USE_STUDIO_GLB ? STUDIO_CANVAS_BG : STUDIO_BG]} />
        )}
        {USE_STUDIO_GLB ? (
          <fog attach="fog" args={[STUDIO_CANVAS_BG, STUDIO_FOG_NEAR, STUDIO_FOG_FAR]} />
        ) : (
          <fog attach="fog" args={[STUDIO_BG, LEGACY_FOG_NEAR, LEGACY_FOG_FAR]} />
        )}

        {USE_STUDIO_GLB ? (
          <>
            <ambientLight intensity={STUDIO_AMBIENT_INTENSITY} />
            <hemisphereLight
              color={STUDIO_HEMISPHERE_SKY}
              groundColor={STUDIO_HEMISPHERE_GROUND}
              intensity={STUDIO_HEMISPHERE_INTENSITY}
            />
            <directionalLight
              color="#fff8f0"
              intensity={STUDIO_RIM_INTENSITY}
              position={STUDIO_RIM_POSITION}
            />
            <spotLight
              position={STUDIO_KEY_SPOT_POSITION}
              angle={STUDIO_KEY_SPOT_ANGLE}
              penumbra={STUDIO_KEY_SPOT_PENUMBRA}
              intensity={STUDIO_KEY_SPOT_INTENSITY}
              decay={2}
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-camera-near={0.5}
              shadow-camera-far={30}
              shadow-camera-left={-7}
              shadow-camera-right={7}
              shadow-camera-top={7}
              shadow-camera-bottom={-7}
            >
              <object3D attach="target" position={STUDIO_KEY_SPOT_TARGET} />
            </spotLight>
          </>
        ) : (
          <>
            <ambientLight intensity={AMBIENT_INTENSITY} />
            <hemisphereLight color="#ffffff" groundColor="#b0b0b0" intensity={0.35} />
            <directionalLight
              color={STUDIO_LIGHT_COLOR}
              intensity={FILL_LIGHT_INTENSITY}
              position={FILL_LIGHT_POSITION}
            />
            <directionalLight
              color="#fff5e6"
              intensity={RIM_LIGHT_INTENSITY}
              position={RIM_LIGHT_POSITION}
            />
          </>
        )}

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
          {USE_STUDIO_GLB ? (
            <StudioScene>
              <group scale={scale}>
                <Shkaf sceneScale={scale} />
              </group>
            </StudioScene>
          ) : (
            <group scale={scale}>
              <Shkaf sceneScale={scale} />
            </group>
          )}
        </Suspense>

        {!USE_STUDIO_GLB && <StudioBackdrop />}

        {!USE_GLB_ENVIRONMENT && (
          <Suspense fallback={null}>
            <StudioEnvironment />
          </Suspense>
        )}
      </Canvas>
    </div>
  )
}
