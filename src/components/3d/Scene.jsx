import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { PerspectiveCamera, ContactShadows, OrbitControls, useProgress } from '@react-three/drei'
import { EffectComposer, Vignette, BrightnessContrast, HueSaturation } from '@react-three/postprocessing'
import * as THREE from 'three'
import Shkaf from './Shkaf'
import Loader from './Loader'
import StudioBackdrop from './StudioBackdrop'
import StudioLights from './StudioLights'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { DESKTOP_SCALE, MOBILE_SCALE } from '../../constants/shkaf'
import { SCENE_BG_STYLE, TONE_MAPPING_EXPOSURE } from '../../constants/scene'
import { STUDIO, DEBUG_LOG_CAMERA_POSITION } from '../../constants/studioScene'

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
  gl.outputColorSpace = THREE.SRGBColorSpace
  gl.toneMapping = THREE.ACESFilmicToneMapping
  gl.toneMappingExposure = TONE_MAPPING_EXPOSURE
  scene.background = new THREE.Color(STUDIO.backdrop.bottomColor)

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

export default function Scene() {
  const isMobile = useIsMobile()
  const scale = isMobile ? MOBILE_SCALE : DESKTOP_SCALE
  const { camera, shadow, postprocessing, orbit } = STUDIO
  const canvasBg = STUDIO.backdrop.bottomColor

  return (
    <div
      className="absolute inset-0 h-full w-full"
      style={{ ...SCENE_BG_STYLE, background: canvasBg }}
    >
      <CanvasLoader />

      <Canvas
        shadows
        gl={{
          powerPreference: 'high-performance',
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: TONE_MAPPING_EXPOSURE,
        }}
        onCreated={handleCanvasCreated}
        style={{
          width: '100vw',
          height: '100dvh',
          minHeight: '100vh',
          display: 'block',
          background: canvasBg,
        }}
      >
        <color attach="background" args={[canvasBg]} />

        <PerspectiveCamera
          makeDefault
          fov={camera.fov}
          position={camera.position}
          near={0.05}
          far={200}
        />
        <OrbitControls
          makeDefault
          target={camera.target}
          enablePan={orbit.enablePan}
          enableZoom
          minAzimuthAngle={orbit.minAzimuth}
          maxAzimuthAngle={orbit.maxAzimuth}
          minPolarAngle={orbit.minPolar}
          maxPolarAngle={orbit.maxPolar}
          minDistance={orbit.minDistance}
          maxDistance={orbit.maxDistance}
          onChange={
            DEBUG_LOG_CAMERA_POSITION
              ? (e) => {
                  const pos = e?.target?.object?.position
                  if (pos) {
                    console.log(
                      '[STUDIO camera]',
                      pos.x.toFixed(2),
                      pos.y.toFixed(2),
                      pos.z.toFixed(2),
                    )
                  }
                }
              : undefined
          }
        />

        <StudioBackdrop />
        <StudioLights />

        <Suspense fallback={null}>
          <EnableShadows />
          <group scale={scale}>
            <Shkaf sceneScale={scale} />
          </group>
        </Suspense>

        <ContactShadows
          position={[0, 0.001, 0]}
          opacity={shadow.opacity}
          blur={shadow.blur}
          far={shadow.far}
          resolution={shadow.resolution}
          scale={4}
        />

        <EffectComposer>
          <Vignette
            offset={postprocessing.vignetteOffset}
            darkness={postprocessing.vignetteDarkness}
          />
          <BrightnessContrast contrast={postprocessing.contrast} />
          <HueSaturation saturation={postprocessing.saturation} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
