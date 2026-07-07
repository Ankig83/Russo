import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { LIGHT_LAYERS, STUDIO, USE_SPLIT_CORPUS_LIGHT, USE_REFERENCE_VOID_LOOK, REFERENCE_VOID } from '../../constants/studioScene'

const DEFAULT_AIM = new THREE.Vector3(0, 1, 0)

function AimedRectAreaLight({ aimAt, rotation, position, layers, bothLayers, ...rest }) {
  const ref = useRef(null)
  const target = useMemo(
    () => (aimAt ? new THREE.Vector3(...aimAt) : DEFAULT_AIM),
    [aimAt?.[0], aimAt?.[1], aimAt?.[2]],
  )

  useLayoutEffect(() => {
    const light = ref.current
    if (!light) return
    if (bothLayers) {
      light.layers.enable(LIGHT_LAYERS.doors)
      light.layers.enable(LIGHT_LAYERS.corpus)
    } else if (layers != null) {
      light.layers.set(layers)
    }
    if (rotation) {
      light.rotation.set(rotation[0], rotation[1], rotation[2])
    } else {
      light.lookAt(target)
    }
  }, [rotation, target, layers, bothLayers])

  return <rectAreaLight ref={ref} position={position} {...rest} />
}

/** Ambient на оба слоя — иначе корпус (layer 1) останется чёрным */
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

export default function StudioLights() {
  useEffect(() => {
    RectAreaLightUniformsLib.init()
  }, [])

  if (USE_REFERENCE_VOID_LOOK) {
    const { ambient, rim, fill } = REFERENCE_VOID.lights
    return (
      <>
        <SharedAmbient intensity={ambient} />
        <AimedRectAreaLight
          bothLayers
          aimAt={rim.aimAt}
          position={rim.position}
          width={rim.width}
          height={rim.height}
          intensity={rim.intensity}
          color={rim.color}
        />
        <AimedRectAreaLight
          bothLayers
          position={fill.position}
          width={fill.width}
          height={fill.height}
          intensity={fill.intensity}
          color={fill.color}
        />
      </>
    )
  }

  const { key, rim, fill, beresta, ambient, corpus, corpusRim } = STUDIO.lights
  const doorLayer = USE_SPLIT_CORPUS_LIGHT ? LIGHT_LAYERS.doors : undefined

  return (
    <>
      <SharedAmbient intensity={ambient} />

      <AimedRectAreaLight
        layers={doorLayer}
        position={key.position}
        width={key.width}
        height={key.height}
        intensity={key.intensity}
        color={key.color}
      />

      <AimedRectAreaLight
        layers={doorLayer}
        aimAt={rim.aimAt}
        position={rim.position}
        width={rim.width}
        height={rim.height}
        intensity={rim.intensity}
        color={rim.color}
      />

      {fill && (
        <AimedRectAreaLight
          layers={doorLayer}
          position={fill.position}
          width={fill.width}
          height={fill.height}
          intensity={fill.intensity}
          color={fill.color}
        />
      )}

      {beresta && (
        <AimedRectAreaLight
          layers={doorLayer}
          aimAt={beresta.target}
          position={beresta.position}
          width={beresta.width}
          height={beresta.height}
          intensity={beresta.intensity}
          color={beresta.color}
        />
      )}

      {USE_SPLIT_CORPUS_LIGHT && corpus && (
        <>
          <AimedRectAreaLight
            layers={LIGHT_LAYERS.corpus}
            position={corpus.position}
            width={corpus.width}
            height={corpus.height}
            intensity={corpus.intensity}
            color={corpus.color}
          />
          {corpusRim && (
            <AimedRectAreaLight
              layers={LIGHT_LAYERS.corpus}
              position={corpusRim.position}
              width={corpusRim.width}
              height={corpusRim.height}
              intensity={corpusRim.intensity}
              color={corpusRim.color}
            />
          )}
        </>
      )}

    </>
  )
}
