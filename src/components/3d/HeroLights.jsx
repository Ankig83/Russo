import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { HERO, LIGHT_LAYERS } from '../../constants/studioScene'

function AimedRectAreaLight({ aimAt, position, ...rest }) {
  const ref = useRef(null)
  const target = useMemo(
    () => new THREE.Vector3(...(aimAt ?? [0, 1.2, 0])),
    [aimAt],
  )

  useLayoutEffect(() => {
    const light = ref.current
    if (!light) return
    light.layers.enable(LIGHT_LAYERS.doors)
    light.layers.enable(LIGHT_LAYERS.corpus)
    light.lookAt(target)
  }, [target])

  return <rectAreaLight ref={ref} position={position} {...rest} />
}

function SharedAmbient({ intensity }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const light = ref.current
    if (!light) return
    light.layers.enable(LIGHT_LAYERS.doors)
    light.layers.enable(LIGHT_LAYERS.corpus)
  }, [])

  return <ambientLight ref={ref} intensity={intensity} />
}

/** Свет для hero void: без лайтбокса и стен — только key/rim/fill. */
export default function HeroLights() {
  const { lights } = HERO

  useEffect(() => {
    RectAreaLightUniformsLib.init()
  }, [])

  if (!lights) return null

  return (
    <>
      <SharedAmbient intensity={lights.ambient ?? 0.04} />
      {lights.key && (
        <AimedRectAreaLight
          aimAt={lights.key.aimAt}
          position={lights.key.position}
          width={lights.key.width}
          height={lights.key.height}
          intensity={lights.key.intensity}
          color={lights.key.color}
        />
      )}
      {lights.rim && (
        <AimedRectAreaLight
          aimAt={lights.rim.aimAt}
          position={lights.rim.position}
          width={lights.rim.width}
          height={lights.rim.height}
          intensity={lights.rim.intensity}
          color={lights.rim.color}
        />
      )}
      {lights.fill && (
        <AimedRectAreaLight
          aimAt={lights.fill.aimAt ?? [0, 1.2, 0]}
          position={lights.fill.position}
          width={lights.fill.width}
          height={lights.fill.height}
          intensity={lights.fill.intensity}
          color={lights.fill.color}
        />
      )}
    </>
  )
}
