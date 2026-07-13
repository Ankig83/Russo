import React, { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, ContactShadows, OrbitControls, useProgress } from '@react-three/drei'
import { EffectComposer, Vignette, BrightnessContrast, HueSaturation, N8AO, Bloom, Noise } from '@react-three/postprocessing'
import * as THREE from 'three'
import Shkaf from './Shkaf'
import Loader from './Loader'
import StudioBackdrop from './StudioBackdrop'
import StudioEnvironment from './StudioEnvironment'
import StudioHorizon from './StudioHorizon'
import HeroBackdrop from './HeroBackdrop'
import HeroShadowLight from './HeroShadowLight'
import HeroLogo from './HeroLogo'
import ReflectiveFloor from './ReflectiveFloor'
import StudioLights from './StudioLights'
import StudioShadowLight from './StudioShadowLight'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { useStudioPerformance } from '../../hooks/useStudioPerformance'
import { DESKTOP_SCALE, MOBILE_SCALE } from '../../constants/shkaf'
import { SCENE_BG_STYLE, SCENE_CANVAS_BG, TONE_MAPPING_EXPOSURE } from '../../constants/scene'
import { STUDIO, getStudioCameraConfig, getStudioOrbitConfig, getStudioCameraStartDistance, DEBUG_LOG_CAMERA_POSITION, USE_HDRI_ONLY, LIGHT_LAYERS, USE_REFERENCE_VOID_LOOK, REFERENCE_VOID, USE_HERO_LOOK, HERO, HERO_LIGHTBOX_ONLY, getEffectiveSplitCorpusLight, USE_STUDIO_CAMERA } from '../../constants/studioScene'
import { useAppStore } from '../../store/appStore'
import { russoCanvasReady, russoLog } from '../../utils/russoLog'

/** ВРЕМЕННО: гасим все источники, кроме лайтбокса */
const lightboxOnly = USE_HERO_LOOK && HERO_LIGHTBOX_ONLY

/** Камера по умолчанию рендерит только layer 0 — без этого корпус (layer 1) невидим */
function EnableViewLayers() {
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    camera.layers.enable(LIGHT_LAYERS.doors)
    if (getEffectiveSplitCorpusLight()) camera.layers.enable(LIGHT_LAYERS.corpus)
  }, [camera])

  return null
}

function GlProfile({ perf }) {
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    gl.shadowMap.type = perf.pcfSoftShadows
      ? THREE.PCFSoftShadowMap
      : THREE.PCFShadowMap
  }, [gl, perf.pcfSoftShadows])

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

function handleCanvasCreated({ gl, scene }) {
  const bg = USE_HERO_LOOK
    ? HERO.background
    : USE_REFERENCE_VOID_LOOK
      ? REFERENCE_VOID.background
      : STUDIO.backdrop.wallTopColor
  const exposure = USE_REFERENCE_VOID_LOOK
    ? REFERENCE_VOID.toneMappingExposure
    : TONE_MAPPING_EXPOSURE

  gl.outputColorSpace = THREE.SRGBColorSpace
  gl.toneMapping = THREE.ACESFilmicToneMapping
  gl.toneMappingExposure = exposure
  gl.shadowMap.enabled = !USE_REFERENCE_VOID_LOOK || REFERENCE_VOID.directionalShadow
  gl.shadowMap.type = THREE.PCFSoftShadowMap
  scene.background = new THREE.Color(bg)
  russoCanvasReady()

  const canvas = gl.domElement
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    russoLog('error', 'scene', 'WebGL context lost — закрой вкладку и открой заново')
    window.dispatchEvent(new CustomEvent('russo:webgl-lost'))
  })
  // авто-reload при restored → бесконечный цикл на тяжёлой сцене
}

function WebGLFallback() {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#0e0e0e] px-6 text-center text-neutral-300">
      <p className="text-sm">
        3D-сцена не запустилась — Chrome заблокировал WebGL после сбоя (часто после hot-reload).
      </p>
      <p className="text-xs text-neutral-600">
        Закрой вкладку полностью и открой{' '}
        <span className="font-mono">localhost:5173</span> заново. Обычного F5 может быть мало.
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

/** Жёстко выставляет STUDIO.camera после OrbitControls — иначе старт съезжает. */
function StudioCameraSync({ position, target }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)

  useLayoutEffect(() => {
    if (!camera || !controls) return undefined

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

/** Clamp pan/zoom: target и высота камеры не уходят под пол / слишком вверх */
function StudioOrbitLimits({ startTarget, limits, startDistance }) {
  const controls = useThree((s) => s.controls)
  const camera = useThree((s) => s.camera)

  useFrame(() => {
    if (!controls?.target || !limits) return

    const [sx, sy, sz] = startTarget
    const { targetOffset, targetMinOffset, targetMaxOffset, minCameraY, maxCameraY } = limits

    const dist = camera.position.distanceTo(controls.target)
    const zoomT =
      startDistance > 0
        ? THREE.MathUtils.clamp(1 - dist / startDistance, 0, 1)
        : 0
    const zoomPanBoost = 1 + zoomT * 0.9

    const minOff = targetMinOffset || targetOffset
    const maxOff = targetMaxOffset || targetOffset

    if (minOff || maxOff) {
      if (minOff) {
        controls.target.x = THREE.MathUtils.clamp(
          controls.target.x,
          sx - minOff.x * zoomPanBoost,
          sx + (maxOff?.x ?? minOff.x) * zoomPanBoost,
        )
        controls.target.y = THREE.MathUtils.clamp(
          controls.target.y,
          sy - minOff.y * zoomPanBoost,
          sy + (maxOff?.y ?? minOff.y) * zoomPanBoost,
        )
        controls.target.z = THREE.MathUtils.clamp(
          controls.target.z,
          sz - minOff.z * zoomPanBoost,
          sz + (maxOff?.z ?? minOff.z) * zoomPanBoost,
        )
      }
    } else if (targetOffset) {
      controls.target.x = THREE.MathUtils.clamp(
        controls.target.x,
        sx - targetOffset.x,
        sx + targetOffset.x,
      )
      controls.target.y = THREE.MathUtils.clamp(
        controls.target.y,
        sy - targetOffset.y,
        sy + targetOffset.y,
      )
      controls.target.z = THREE.MathUtils.clamp(
        controls.target.z,
        sz - targetOffset.z,
        sz + targetOffset.z,
      )
    }

    if (minCameraY != null) {
      camera.position.y = Math.max(camera.position.y, minCameraY)
    }
    if (maxCameraY != null) {
      camera.position.y = Math.min(camera.position.y, maxCameraY)
    }

    controls.update()
  })

  return null
}

function LogStudioCameraStart() {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const logged = useRef(false)

  useEffect(() => {
    if (!DEBUG_LOG_CAMERA_POSITION || logged.current) return undefined

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (logged.current) return
        logged.current = true
        const t = controls?.target
        console.log(
          '[STUDIO camera start] position',
          camera.position.x.toFixed(2),
          camera.position.y.toFixed(2),
          camera.position.z.toFixed(2),
          '| target',
          t
            ? `${t.x.toFixed(2)} ${t.y.toFixed(2)} ${t.z.toFixed(2)}`
            : STUDIO.camera.target.join(' '),
        )
      })
    })

    return () => cancelAnimationFrame(raf)
  }, [camera, controls])

  return null
}

export default function Scene() {
  const isMobile = useIsMobile()
  const perf = useStudioPerformance()
  const loadingDone = useAppStore((s) => s.loadingDone)
  const scale = isMobile ? MOBILE_SCALE : DESKTOP_SCALE
  const refVoid = USE_REFERENCE_VOID_LOOK
  const camera = refVoid ? REFERENCE_VOID.camera : getStudioCameraConfig(isMobile)
  const orbit = refVoid ? REFERENCE_VOID.orbit : getStudioOrbitConfig(isMobile)
  const maxOrbitDistance = refVoid ? orbit.maxDistance : getStudioCameraStartDistance(camera)
  const object = STUDIO.object
  const shadow = STUDIO.shadow
  const postprocessing = refVoid
    ? { ...STUDIO.postprocessing, ...REFERENCE_VOID.postprocessing }
    : STUDIO.postprocessing
  const canvasBg = USE_HERO_LOOK
    ? HERO.background
    : refVoid
      ? REFERENCE_VOID.background
      : SCENE_CANVAS_BG
  const toneExposure = refVoid ? REFERENCE_VOID.toneMappingExposure : TONE_MAPPING_EXPOSURE
  const [webglLost, setWebglLost] = useState(false)

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.info(
        refVoid
          ? 'РУССО: reference void look (чёрная пустота)'
          : `РУССО: perf tier "${perf.tier}" (dpr≤${perf.dpr[1]}, n8ao=${perf.n8ao}, bloom=${perf.bloom})`,
      )
    }
  }, [perf, refVoid])

  useEffect(() => {
    const onLost = () => setWebglLost(true)
    const onRejection = (event) => {
      const msg = String(event.reason?.message ?? event.reason ?? '')
      if (/webgl|WebGL|context/i.test(msg)) setWebglLost(true)
    }
    window.addEventListener('russo:webgl-lost', onLost)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('russo:webgl-lost', onLost)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  if (webglLost) {
    return (
      <div className="absolute inset-0 h-full w-full" style={{ background: canvasBg }}>
        <WebGLFallback />
      </div>
    )
  }

  const contactResolution = perf.contactShadowResolution ?? shadow.resolution

  return (
    <div
      className="absolute inset-0 h-full w-full"
      style={{ ...SCENE_BG_STYLE, background: canvasBg }}
    >
      <CanvasLoader />

      <WebGLErrorBoundary fallback={<WebGLFallback />}>
      <Canvas
        shadows={!refVoid || REFERENCE_VOID.directionalShadow}
        dpr={perf.dpr}
        gl={{
          powerPreference: 'default',
          antialias: perf.antialias,
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: toneExposure,
        }}
        onCreated={handleCanvasCreated}
        style={{
          width: '100vw',
          height: '100dvh',
          minHeight: '100vh',
          display: 'block',
          background: canvasBg,
          touchAction: 'none',
        }}
      >
        <color attach="background" args={[canvasBg]} />
        <GlProfile perf={perf} />

        <PerspectiveCamera
          makeDefault
          fov={camera.fov}
          near={0.05}
          far={200}
        />
        <EnableViewLayers />
        <OrbitControls
          makeDefault
          target={camera.target}
          enablePan={orbit.enablePan ?? true}
          enableZoom
          screenSpacePanning
          rotateSpeed={orbit.rotateSpeed ?? 1}
          zoomSpeed={orbit.zoomSpeed ?? 1}
          panSpeed={orbit.panSpeed ?? 1}
          minAzimuthAngle={orbit.minAzimuth}
          maxAzimuthAngle={orbit.maxAzimuth}
          minPolarAngle={orbit.minPolar}
          maxPolarAngle={orbit.maxPolar}
          minDistance={orbit.minDistance}
          maxDistance={maxOrbitDistance}
          touches={
            isMobile
              ? { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
              : undefined
          }
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
        {USE_STUDIO_CAMERA && !refVoid && orbit.panLimits && (
          <StudioOrbitLimits
            startTarget={camera.target}
            limits={orbit.panLimits}
            startDistance={maxOrbitDistance}
          />
        )}
        <StudioCameraSync position={camera.position} target={camera.target} />
        {DEBUG_LOG_CAMERA_POSITION && <LogStudioCameraStart />}

        {(!refVoid || REFERENCE_VOID.showBackdrop) && !USE_HERO_LOOK && <StudioBackdrop />}
        {USE_HERO_LOOK && <HeroBackdrop />}
        {USE_HERO_LOOK && <HeroShadowLight />}
        {!lightboxOnly && (!USE_HDRI_ONLY || refVoid) && <StudioLights />}
        {!lightboxOnly && !refVoid && <StudioShadowLight />}

        <Suspense fallback={null}>
          {!lightboxOnly && (!refVoid || REFERENCE_VOID.showEnvironment) && <StudioEnvironment />}
          {USE_HERO_LOOK
            ? <ReflectiveFloor />
            : (!refVoid || REFERENCE_VOID.showHorizon) && <StudioHorizon />}
          {USE_HERO_LOOK && loadingDone && <HeroLogo />}
          <group scale={scale} position={object.position}>
            <Shkaf sceneScale={scale} />
          </group>
          {(!USE_HERO_LOOK && (!refVoid || REFERENCE_VOID.contactShadows)) && (
            <ContactShadows
              position={shadow.position}
              opacity={shadow.opacity}
              blur={shadow.blur}
              far={shadow.far}
              resolution={contactResolution}
              scale={shadow.scale}
              color={shadow.color}
            />
          )}
        </Suspense>

        {perf.postFX && !(refVoid && REFERENCE_VOID.postFX === false) && (
          <EffectComposer
            enableNormalPass={perf.normalPass && perf.n8ao}
            multisampling={perf.multisampling}
          >
            {perf.n8ao && (
              <N8AO
                halfRes
                quality="low"
                aoRadius={postprocessing.aoRadius}
                intensity={postprocessing.aoIntensity}
                distanceFalloff={1.2}
                depthAwareUpsampling
              />
            )}
            {perf.bloom && (
              <Bloom
                intensity={postprocessing.bloomIntensity}
                luminanceThreshold={postprocessing.bloomThreshold}
                luminanceSmoothing={postprocessing.bloomSmoothing ?? 0.2}
                mipmapBlur
              />
            )}
            {perf.noise && postprocessing.noiseOpacity > 0 && (
              <Noise opacity={postprocessing.noiseOpacity} />
            )}
            <Vignette
              offset={postprocessing.vignetteOffset}
              darkness={postprocessing.vignetteDarkness}
            />
            <BrightnessContrast contrast={postprocessing.contrast} brightness={postprocessing.brightness} />
            <HueSaturation saturation={postprocessing.saturation} />
          </EffectComposer>
        )}
      </Canvas>
      </WebGLErrorBoundary>
    </div>
  )
}
