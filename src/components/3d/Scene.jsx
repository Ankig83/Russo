import React, { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { PerspectiveCamera, OrbitControls, Environment, useProgress } from '@react-three/drei'
import { EffectComposer, Vignette, BrightnessContrast, HueSaturation, N8AO, Bloom, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import gsap from 'gsap'
import Shkaf from './Shkaf'
import Loader from './Loader'
import CabinetLights from './CabinetLights'
import StudioSceneMesh from './StudioSceneMesh'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { useStudioPerformance } from '../../hooks/useStudioPerformance'
import {
  CABINET_BACKGROUND,
  CABINET_ENV,
  CABINET_EXPOSURE,
  CABINET_LOOK,
  CABINET_POST,
  cameraDistance,
  getCabinetCamera,
  getCabinetCameraOpen,
  getCabinetCameraOpenDetail,
  getCabinetOrbit,
} from '../../constants/cabinetStudio'
import { DOOR_OPEN_DURATION, DOOR_OPEN_ZOOM_DURATION } from '../../constants/shkaf'
import { cabinetFlags } from '../../utils/cabinetQuery'
import { Exposure } from './ExposureEffect'
import CabinetTune from './CabinetTune'
import { useCabinetTune } from '../../utils/cabinetTune'
import { useShkafStore } from '../../store/shkafStore'

const TONE_MODE = {
  agx: ToneMappingMode.AGX,
  aces: ToneMappingMode.ACES_FILMIC,
  neutral: ToneMappingMode.NEUTRAL,
}
import { russoCanvasReady, russoLog } from '../../utils/russoLog'
import { watchFirstRender } from '../../utils/loadTiming'

function handleCanvasCreated({ gl, scene }) {
  gl.outputColorSpace = THREE.SRGBColorSpace
  gl.toneMapping = THREE.ACESFilmicToneMapping
  gl.toneMappingExposure = CABINET_EXPOSURE
  gl.shadowMap.enabled = true
  gl.shadowMap.type = THREE.PCFSoftShadowMap
  gl.dithering = true
  scene.background = new THREE.Color(CABINET_BACKGROUND)
  gl.domElement.dataset.russoCanvas = '1'
  watchFirstRender(gl)
  russoCanvasReady()
}

function GlProfile() {
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    gl.shadowMap.type = THREE.PCFSoftShadowMap
    gl.shadowMap.needsUpdate = true
  }, [gl])

  return null
}

function CanvasLoader() {
  const { active } = useProgress()
  if (!active) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-[5]">
      <Loader />
    </div>
  )
}

function WebGLContextMonitor() {
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    const canvas = gl.domElement
    const onContextLost = (event) => {
      event.preventDefault()
      russoLog('error', 'scene', 'WebGL context lost — закрой вкладку и открой заново')
      window.dispatchEvent(new CustomEvent('russo:webgl-lost'))
    }
    canvas.addEventListener('webglcontextlost', onContextLost)
    return () => canvas.removeEventListener('webglcontextlost', onContextLost)
  }, [gl])

  return null
}

function WebGLFallback() {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#0e0e0e] px-6 text-center text-neutral-300">
      <p className="text-sm">
        3D-сцена не запустилась — Chrome заблокировал WebGL после сбоя (часто после hot-reload).
      </p>
      <p className="text-xs text-neutral-600">
        Закрой вкладку полностью и открой{' '}
        <span className="font-mono">localhost:5173</span> заново.
      </p>
      <button
        type="button"
        className="rounded bg-neutral-800 px-4 py-2 text-sm text-white"
        onClick={() => window.location.reload()}
      >
        Перезагрузить страницу
      </button>
    </div>
  )
}

class WebGLErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(err) {
    console.warn('WebGL / Canvas error:', err)
  }

  render() {
    if (this.state.failed) return this.props.fallback
    return this.props.children
  }
}

function CompareCamera() {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const shot = CABINET_LOOK.compare

  useLayoutEffect(() => {
    if (!camera) return undefined
    const apply = () => {
      const fov = THREE.MathUtils.radToDeg(
        2 * Math.atan(shot.sensorHeight / (2 * shot.focalLength)),
      )
      camera.fov = fov
      camera.near = 0.05
      camera.far = 100
      camera.position.set(shot.position[0], shot.position[1], shot.position[2])
      camera.updateProjectionMatrix()
      if (!controls) return
      const dist = shot.targetDistance
      controls.target.set(
        shot.position[0] + shot.forward[0] * dist,
        shot.position[1] + shot.forward[1] * dist,
        shot.position[2] + shot.forward[2] * dist,
      )
      controls.minDistance = 0.2
      controls.maxDistance = 40
      controls.minPolarAngle = 0.01
      controls.maxPolarAngle = Math.PI - 0.01
      controls.minAzimuthAngle = -Infinity
      controls.maxAzimuthAngle = Infinity
      controls.update()
    }
    apply()
    const raf = requestAnimationFrame(apply)
    return () => cancelAnimationFrame(raf)
  }, [camera, controls, shot])

  return null
}

function DoorFrontCamera({ closed, open, detail, duration, zoomDuration }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const doorsOpen = useShkafStore((s) => s.doorsOpen)
  const skip = useRef(true)

  useEffect(() => {
    if (!controls) return undefined
    if (skip.current) {
      skip.current = false
      return undefined
    }
    const wideDist = cameraDistance(open)
    const closedDist = cameraDistance(closed)
    controls.maxDistance = Math.max(
      controls.minDistance,
      doorsOpen ? wideDist : closedDist,
    )
    controls.enabled = false
    gsap.killTweensOf([camera.position, controls.target])
    const ease = 'power2.out'
    const tl = gsap.timeline({
      onUpdate: () => controls.update(),
      onComplete: () => {
        controls.enabled = true
        controls.update()
      },
    })
    const move = (pose, dur, at) => {
      tl.to(
        camera.position,
        { x: pose.position[0], y: pose.position[1], z: pose.position[2], duration: dur, ease },
        at,
      )
      tl.to(
        controls.target,
        { x: pose.target[0], y: pose.target[1], z: pose.target[2], duration: dur, ease },
        at,
      )
    }
    if (doorsOpen) {
      move(open, duration, 0)
      move(detail, zoomDuration, duration)
    } else {
      move(closed, duration, 0)
    }
    return () => {
      tl.kill()
      gsap.killTweensOf([camera.position, controls.target])
      controls.enabled = true
    }
  }, [camera, closed, controls, detail, doorsOpen, duration, open, zoomDuration])

  return null
}

function ClampOrbitPan({ minY, maxY }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)

  useEffect(() => {
    if (!controls) return undefined
    const clamp = () => {
      let dy = 0
      if (camera.position.y < minY) dy = minY - camera.position.y
      else if (camera.position.y > maxY) dy = maxY - camera.position.y
      if (!dy) return
      camera.position.y += dy
      controls.target.y += dy
    }
    controls.addEventListener('change', clamp)
    return () => controls.removeEventListener('change', clamp)
  }, [camera, controls, minY, maxY])

  return null
}

function StudioCameraSync({ position, target }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)

  useLayoutEffect(() => {
    if (!camera || !controls) return undefined
    camera.layers.enable(1)
    const apply = () => {
      camera.position.set(position[0], position[1], position[2])
      controls.target.set(target[0], target[1], target[2])
      controls.update()
      camera.updateProjectionMatrix()
    }
    apply()
    const raf1 = requestAnimationFrame(() => {
      apply()
      requestAnimationFrame(apply)
    })
    return () => cancelAnimationFrame(raf1)
  }, [camera, controls, position, target])

  return null
}

export default function Scene({ active = true }) {
  const isMobile = useIsMobile()
  const perf = useStudioPerformance()
  const flags = cabinetFlags()
  const tune = useCabinetTune()
  const exposure = flags.tune ? tune.exposure : CABINET_LOOK.tone.exposure
  const environmentIntensity = flags.tune ? tune.environmentIntensity : CABINET_ENV.intensity
  const aoOn = flags.tune ? tune.ao : flags.ao
  const aoIntensity = flags.tune ? tune.aoIntensity : CABINET_POST.aoIntensity
  const bloomIntensity = flags.tune ? tune.bloomIntensity : CABINET_POST.bloomIntensity
  const bloomThreshold = flags.tune ? tune.bloomThreshold : CABINET_POST.bloomThreshold
  const camera = getCabinetCamera(isMobile)
  const cameraOpen = getCabinetCameraOpen(isMobile)
  const cameraOpenDetail = getCabinetCameraOpenDetail(isMobile)
  const orbit = getCabinetOrbit(isMobile)
  const doorsOpen = useShkafStore((s) => s.doorsOpen)
  const orbitMaxDistance = doorsOpen ? cameraDistance(cameraOpen) : orbit.maxDistance
  const [webglLost, setWebglLost] = useState(false)
  const [postFxReady, setPostFxReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    let frames = 0
    let raf = 0
    const tick = () => {
      if (cancelled) return
      frames += 1
      if (frames >= 3) {
        setPostFxReady(true)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    if (!active) return undefined
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
    return () => cancelAnimationFrame(id)
  }, [active])

  useEffect(() => {
    const onLost = () => setWebglLost(true)
    window.addEventListener('russo:webgl-lost', onLost)
    return () => window.removeEventListener('russo:webgl-lost', onLost)
  }, [])

  if (webglLost) {
    return (
      <div className="absolute inset-0 h-full w-full" style={{ background: CABINET_BACKGROUND }}>
        <WebGLFallback />
      </div>
    )
  }

  return (
    <div
      className="absolute inset-0 h-full w-full"
      style={{ background: CABINET_BACKGROUND, width: '100vw', height: '100dvh', minHeight: '100vh' }}
    >
      <CanvasLoader />
      {flags.tune ? <CabinetTune /> : null}

      <WebGLErrorBoundary fallback={<WebGLFallback />}>
        <Canvas
          shadows
          frameloop={active ? 'always' : 'never'}
          dpr={perf.dpr}
          gl={{
            powerPreference: 'default',
            antialias: perf.antialias,
            alpha: false,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: CABINET_EXPOSURE,
          }}
          onCreated={handleCanvasCreated}
          style={{
            width: '100vw',
            height: '100dvh',
            minHeight: '100vh',
            display: 'block',
            background: CABINET_BACKGROUND,
            touchAction: 'none',
          }}
        >
          <color attach="background" args={[CABINET_BACKGROUND]} />
          <GlProfile />
          <WebGLContextMonitor />

          <PerspectiveCamera
            makeDefault
            fov={camera.fov}
            near={camera.near}
            far={camera.far}
            position={camera.position}
          />
          <OrbitControls
            makeDefault
            target={camera.target}
            enablePan={orbit.enablePan}
            enableZoom
            screenSpacePanning
            rotateSpeed={orbit.rotateSpeed}
            zoomSpeed={orbit.zoomSpeed}
            panSpeed={orbit.panSpeed}
            minAzimuthAngle={orbit.minAzimuth}
            maxAzimuthAngle={orbit.maxAzimuth}
            minPolarAngle={orbit.minPolar}
            maxPolarAngle={orbit.maxPolar}
            minDistance={orbit.minDistance}
            maxDistance={orbitMaxDistance}
            touches={
              isMobile
                ? { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
                : undefined
            }
          />
          <ClampOrbitPan minY={orbit.panMinY} maxY={orbit.panMaxY} />
          {flags.compare ? (
            <CompareCamera />
          ) : (
            <>
              <StudioCameraSync position={camera.position} target={camera.target} />
              <DoorFrontCamera
                closed={camera}
                open={cameraOpen}
                detail={cameraOpenDetail}
                duration={DOOR_OPEN_DURATION}
                zoomDuration={DOOR_OPEN_ZOOM_DURATION}
              />
            </>
          )}

          <CabinetLights shadowMapSize={perf.shadowMapSize} />

          <Suspense fallback={null}>
            <Environment
              files={CABINET_ENV.url}
              environmentIntensity={environmentIntensity}
              background={false}
            />
            <StudioSceneMesh />
            <Shkaf />
          </Suspense>

          {postFxReady && perf.postFX && (
            <EffectComposer
              enableNormalPass={perf.normalPass && perf.n8ao}
              multisampling={perf.multisampling}
            >
              {perf.n8ao && aoOn && (
                <N8AO
                  halfRes
                  quality={perf.n8aoQuality || 'medium'}
                  aoRadius={CABINET_POST.aoRadius}
                  intensity={aoIntensity * (isMobile ? CABINET_LOOK.ao.mobileScale : 1)}
                  distanceFalloff={0.6}
                  depthAwareUpsampling
                />
              )}
              {perf.bloom && bloomIntensity > 0 && (
                <Bloom
                  intensity={bloomIntensity}
                  luminanceThreshold={bloomThreshold}
                  luminanceSmoothing={CABINET_POST.bloomSmoothing}
                  mipmapBlur
                />
              )}
              <Exposure exposure={exposure} />
              <ToneMapping mode={TONE_MODE[flags.tone] ?? ToneMappingMode.AGX} />
              <BrightnessContrast
                contrast={CABINET_POST.contrast}
                brightness={CABINET_POST.brightness}
              />
              <HueSaturation saturation={CABINET_POST.saturation} />
              <Vignette
                offset={CABINET_POST.vignetteOffset}
                darkness={CABINET_POST.vignetteDarkness}
              />
            </EffectComposer>
          )}
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  )
}
