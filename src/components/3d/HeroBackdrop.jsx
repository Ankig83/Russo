import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { HERO, LIGHT_LAYERS } from '../../constants/studioScene'
import { useStudioPerformance } from '../../hooks/useStudioPerformance'
import { useShkafStore } from '../../store/shkafStore'

function useLightLayers(ref, layers) {
  useLayoutEffect(() => {
    const light = ref.current
    if (!light) return
    light.layers.disableAll()
    layers.forEach((layer) => light.layers.enable(layer))
  }, [ref, layers])
}

const KEY_LIGHT_LAYERS = [LIGHT_LAYERS.doors, LIGHT_LAYERS.corpus, LIGHT_LAYERS.floor]
/** Только двери/береста — иначе ortho-frustum рисует «лишний» прямоугольник на полу */
const HANDLE_SHADOW_LAYERS = [LIGHT_LAYERS.doors, LIGHT_LAYERS.accent]

/** Spot с целью-object3D: lookAt на группе не работает, нужен light.target */
function AimedSpotLight({ config, lightRef, castShadow = false, mapSize }) {
  const ref = useRef(null)
  const resolved = lightRef ?? ref
  const targetRef = useRef(null)
  const shadow = config.shadow

  useLightLayers(resolved, KEY_LIGHT_LAYERS)

  useLayoutEffect(() => {
    const light = resolved.current
    const target = targetRef.current
    if (!light || !target) return
    light.target = target
    if (!castShadow || !shadow) return
    light.shadow.radius = shadow.radius ?? 2
    light.shadow.blurSamples = shadow.blurSamples ?? 8
    light.shadow.camera.near = shadow.camera.near
    light.shadow.camera.far = shadow.camera.far
    light.shadow.camera.updateProjectionMatrix()
  }, [resolved, castShadow, shadow])

  return (
    <>
      <object3D ref={targetRef} position={config.aimAt} />
      <spotLight
        ref={resolved}
        position={config.position}
        intensity={config.intensity ?? config.closedIntensity}
        color={config.color}
        angle={config.angle}
        penumbra={config.penumbra}
        distance={config.distance}
        decay={config.decay}
        castShadow={castShadow}
        shadow-bias={shadow?.bias}
        shadow-normalBias={shadow?.normalBias}
        shadow-mapSize={castShadow ? [mapSize, mapSize] : undefined}
      />
    </>
  )
}

/** Узкий directional: плотная ortho shadow-map на медальон / ручки */
function AimedDirectionalShadow({ config, mapSize }) {
  const lightRef = useRef(null)
  const targetRef = useRef(null)
  const shadow = config.shadow

  useLightLayers(lightRef, HANDLE_SHADOW_LAYERS)

  useLayoutEffect(() => {
    const light = lightRef.current
    const target = targetRef.current
    if (!light || !target || !shadow) return
    light.target = target
    light.shadow.radius = shadow.radius ?? 1
    light.shadow.blurSamples = shadow.blurSamples ?? 8
    const cam = light.shadow.camera
    cam.left = shadow.camera.left
    cam.right = shadow.camera.right
    cam.top = shadow.camera.top
    cam.bottom = shadow.camera.bottom
    cam.near = shadow.camera.near
    cam.far = shadow.camera.far
    cam.updateProjectionMatrix()
  }, [shadow])

  return (
    <>
      <object3D ref={targetRef} position={config.aimAt} />
      <directionalLight
        ref={lightRef}
        position={config.position}
        intensity={config.intensity}
        color={config.color}
        castShadow
        shadow-bias={shadow?.bias}
        shadow-normalBias={shadow?.normalBias}
        shadow-mapSize={[mapSize, mapSize]}
      />
    </>
  )
}

function AimedAreaLight({ config, lightRef, layer }) {
  const ref = useRef(null)
  const resolvedRef = lightRef ?? ref
  const target = useMemo(
    () => new THREE.Vector3(...config.aimAt),
    [config.aimAt],
  )

  useLayoutEffect(() => {
    const light = resolvedRef.current
    if (!light) return
    light.layers.disableAll()
    if (layer == null) {
      light.layers.enable(LIGHT_LAYERS.doors)
      light.layers.enable(LIGHT_LAYERS.corpus)
    } else {
      light.layers.enable(layer)
    }
    light.lookAt(target)
  }, [resolvedRef, target, layer])

  return (
    <rectAreaLight
      ref={resolvedRef}
      position={config.position}
      width={config.width}
      height={config.height}
      intensity={config.intensity ?? config.closedIntensity}
      color={config.color}
    />
  )
}

function AmbientFill({ config }) {
  const ref = useRef(null)
  useLightLayers(ref, KEY_LIGHT_LAYERS)
  return <ambientLight ref={ref} intensity={config.intensity} color={config.color} />
}

/**
 * Three-point rig: warm key spot (единственный castShadow), cool rim спереди
 * назад-мимо корпуса, ambient fill. Плюс два служебных area-света —
 * accent на латунь и interior LED при открытых дверях.
 */
export default function HeroBackdrop() {
  const doorsOpen = useShkafStore((state) => state.doorsOpen)
  const perf = useStudioPerformance()
  const keyRef = useRef(null)
  const legKickRef = useRef(null)
  const accentRef = useRef(null)
  const interiorRef = useRef(null)
  const keyMapSize = perf.shadowMapSize ?? HERO.keyLight.shadow.mapSize
  const handleMapSize = Math.min(
    perf.shadowMapSize ?? 1024,
    HERO.handleShadow?.shadow?.mapSize ?? 1024,
  )

  useEffect(() => {
    RectAreaLightUniformsLib.init()
  }, [])

  useFrame((_, delta) => {
    const lambda = 4.2
    if (keyRef.current) {
      const target = doorsOpen
        ? HERO.keyLight.openIntensity
        : HERO.keyLight.closedIntensity
      keyRef.current.intensity = THREE.MathUtils.damp(
        keyRef.current.intensity,
        target,
        lambda,
        delta,
      )
    }
    if (legKickRef.current && HERO.legKickLight) {
      const kick = HERO.legKickLight
      const target = doorsOpen
        ? (kick.openIntensity ?? kick.intensity ?? 22)
        : (kick.closedIntensity ?? kick.intensity ?? 16)
      legKickRef.current.intensity = THREE.MathUtils.damp(
        legKickRef.current.intensity,
        target,
        lambda,
        delta,
      )
    }
    if (accentRef.current) {
      const target = doorsOpen
        ? HERO.accentLight.openIntensity
        : HERO.accentLight.closedIntensity
      accentRef.current.intensity = THREE.MathUtils.damp(
        accentRef.current.intensity,
        target,
        lambda,
        delta,
      )
    }
    if (interiorRef.current) {
      const target = doorsOpen
        ? HERO.interiorLight.openIntensity
        : HERO.interiorLight.closedIntensity
      interiorRef.current.intensity = THREE.MathUtils.damp(
        interiorRef.current.intensity,
        target,
        lambda,
        delta,
      )
    }
  })

  return (
    <group raycast={() => null}>
      <AimedSpotLight
        config={HERO.keyLight}
        lightRef={keyRef}
        castShadow
        mapSize={keyMapSize}
      />
      {HERO.handleShadow?.type === 'directional' ? (
        <AimedDirectionalShadow config={HERO.handleShadow} mapSize={handleMapSize} />
      ) : HERO.handleShadow ? (
        <AimedSpotLight
          config={HERO.handleShadow}
          castShadow
          mapSize={handleMapSize}
        />
      ) : null}
      <AimedSpotLight config={HERO.rimLight} />
      {HERO.legKickLight ? (
        <AimedSpotLight config={HERO.legKickLight} lightRef={legKickRef} />
      ) : null}
      <AmbientFill config={HERO.fillLight} />
      <AimedAreaLight
        config={HERO.accentLight}
        lightRef={accentRef}
        layer={LIGHT_LAYERS.accent}
      />
      <AimedAreaLight
        config={HERO.interiorLight}
        lightRef={interiorRef}
        layer={LIGHT_LAYERS.interior}
      />
    </group>
  )
}
