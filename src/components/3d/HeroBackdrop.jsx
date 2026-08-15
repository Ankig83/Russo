import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { HERO, LIGHT_LAYERS } from '../../constants/studioScene'
import { useStudioPerformance } from '../../hooks/useStudioPerformance'
import { useShkafStore } from '../../store/shkafStore'
import { useCinematicCycloramaTextures } from '../../utils/cinematicStudioTextures'
import CinematicReflectors from './CinematicReflectors'

function useLightLayers(ref, layers) {
  useLayoutEffect(() => {
    const light = ref.current
    if (!light) return
    light.layers.disableAll()
    layers.forEach((layer) => light.layers.enable(layer))
  }, [ref, layers])
}

const KEY_LIGHT_LAYERS = [LIGHT_LAYERS.doors, LIGHT_LAYERS.corpus, LIGHT_LAYERS.floor]
const HANDLE_SHADOW_LAYERS = [LIGHT_LAYERS.accent]

function AimedSpotLight({
  config,
  lightRef,
  castShadow = false,
  mapSize,
  layers = KEY_LIGHT_LAYERS,
}) {
  const ref = useRef(null)
  const resolved = lightRef ?? ref
  const targetRef = useRef(null)
  const shadow = config.shadow

  useLightLayers(resolved, layers)

  useLayoutEffect(() => {
    const light = resolved.current
    const target = targetRef.current
    if (!light || !target) return
    light.target = target
    if (!castShadow || !shadow) return
    light.shadow.radius = shadow.radius ?? 2
    light.shadow.blurSamples = shadow.blurSamples ?? 8
    if (shadow.camera?.near != null) light.shadow.camera.near = shadow.camera.near
    if (shadow.camera?.far != null) light.shadow.camera.far = shadow.camera.far
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

function AimedAreaLight({ config, lightRef, layer, layers }) {
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
    if (layers?.length) {
      layers.forEach((l) => light.layers.enable(l))
    } else if (layer == null) {
      light.layers.enable(LIGHT_LAYERS.doors)
      light.layers.enable(LIGHT_LAYERS.corpus)
      light.layers.enable(LIGHT_LAYERS.floor)
    } else {
      light.layers.enable(layer)
    }
    light.lookAt(target)
  }, [resolvedRef, target, layer, layers])

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

function CinematicCyclorama() {
  const cfg = HERO.cyclorama
  const meshRef = useRef(null)
  const { map, roughnessMap, metalnessMap } = useCinematicCycloramaTextures(
    cfg.textureRepeat ?? [2, 1],
  )

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    mesh.layers.disableAll()
    mesh.layers.enable(LIGHT_LAYERS.doors)
    mesh.layers.enable(LIGHT_LAYERS.corpus)
    mesh.layers.enable(LIGHT_LAYERS.floor)
  }, [])

  if (!cfg?.enabled) return null

  return (
    <mesh
      ref={meshRef}
      position={cfg.position}
      receiveShadow
      raycast={() => null}
    >
      <planeGeometry args={cfg.size} />
      <meshStandardMaterial
        map={map}
        roughnessMap={roughnessMap}
        metalnessMap={metalnessMap}
        color={cfg.color}
        roughness={cfg.roughness}
        metalness={cfg.metalness}
        envMapIntensity={0.15}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

/**
 * CINEMATIC rig из Blender: KEY/FILL/BACK/TOP_RIM = RectArea,
 * shadowSpot вдоль KEY для пола, accent/interior служебные.
 */
export default function HeroBackdrop() {
  const doorsOpen = useShkafStore((state) => state.doorsOpen)
  const perf = useStudioPerformance()
  const keyRef = useRef(null)
  const shadowRef = useRef(null)
  const fillRef = useRef(null)
  const rimRef = useRef(null)
  const topRimRef = useRef(null)
  const accentRef = useRef(null)
  const interiorRef = useRef(null)
  const shadowMapSize = perf.shadowMapSize ?? HERO.shadowSpot?.shadow?.mapSize ?? 2048
  const handleMapSize = Math.min(
    perf.shadowMapSize ?? 1024,
    HERO.handleShadow?.shadow?.mapSize ?? 1024,
  )

  useEffect(() => {
    RectAreaLightUniformsLib.init()
  }, [])

  useFrame((_, delta) => {
    const lambda = 4.2
    const damp = (ref, closed, open) => {
      if (!ref.current) return
      const target = doorsOpen ? open : closed
      ref.current.intensity = THREE.MathUtils.damp(
        ref.current.intensity,
        target,
        lambda,
        delta,
      )
    }
    if (HERO.keyLight) {
      damp(
        keyRef,
        HERO.keyLight.closedIntensity ?? HERO.keyLight.intensity,
        HERO.keyLight.openIntensity ?? HERO.keyLight.intensity,
      )
    }
    if (HERO.shadowSpot) {
      damp(
        shadowRef,
        HERO.shadowSpot.closedIntensity ?? HERO.shadowSpot.intensity,
        HERO.shadowSpot.openIntensity ?? HERO.shadowSpot.intensity,
      )
    }
    if (accentRef.current) {
      damp(
        accentRef,
        HERO.accentLight.closedIntensity,
        HERO.accentLight.openIntensity,
      )
    }
    if (interiorRef.current) {
      damp(
        interiorRef,
        HERO.interiorLight.closedIntensity,
        HERO.interiorLight.openIntensity,
      )
    }
  })

  return (
    <group raycast={() => null}>
      {HERO.cyclorama?.enabled ? (
        <Suspense fallback={null}>
          <CinematicCyclorama />
        </Suspense>
      ) : null}
      <CinematicReflectors />

      {HERO.keyLight?.type === 'area' ? (
        <AimedAreaLight config={HERO.keyLight} lightRef={keyRef} layers={KEY_LIGHT_LAYERS} />
      ) : (
        <AimedSpotLight
          config={HERO.keyLight}
          lightRef={keyRef}
          castShadow
          mapSize={shadowMapSize}
        />
      )}

      {HERO.shadowSpot ? (
        <AimedSpotLight
          config={HERO.shadowSpot}
          lightRef={shadowRef}
          castShadow
          mapSize={shadowMapSize}
        />
      ) : null}

      {HERO.fillLight?.type === 'area' ? (
        <AimedAreaLight config={HERO.fillLight} lightRef={fillRef} layers={KEY_LIGHT_LAYERS} />
      ) : null}

      {HERO.rimLight?.type === 'area' ? (
        <AimedAreaLight config={HERO.rimLight} lightRef={rimRef} layers={KEY_LIGHT_LAYERS} />
      ) : HERO.rimLight ? (
        <AimedSpotLight config={HERO.rimLight} />
      ) : null}

      {HERO.topRimLight ? (
        <AimedAreaLight config={HERO.topRimLight} lightRef={topRimRef} layers={KEY_LIGHT_LAYERS} />
      ) : null}

      {HERO.legKickLight ? (
        <AimedSpotLight config={HERO.legKickLight} />
      ) : null}

      {HERO.handleShadow?.type === 'directional' ? (
        <AimedDirectionalShadow config={HERO.handleShadow} mapSize={handleMapSize} />
      ) : HERO.handleShadow ? (
        <AimedSpotLight
          config={HERO.handleShadow}
          castShadow
          mapSize={handleMapSize}
          layers={HANDLE_SHADOW_LAYERS}
        />
      ) : null}

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
