import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { HERO, LIGHT_LAYERS } from '../../constants/studioScene'
import { useShkafStore } from '../../store/shkafStore'

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

/** Пять источников: key, rim, fill, metal accent, animated interior */
export default function HeroBackdrop() {
  const doorsOpen = useShkafStore((state) => state.doorsOpen)
  const keyRef = useRef(null)
  const accentRef = useRef(null)
  const interiorRef = useRef(null)

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
      <AimedAreaLight config={HERO.keyLight} lightRef={keyRef} />
      <AimedAreaLight config={HERO.rimLight} />
      <AimedAreaLight config={HERO.fillLight} />
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
