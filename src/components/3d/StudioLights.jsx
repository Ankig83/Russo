import { useEffect, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { STUDIO } from '../../constants/studioScene'

const LIGHT_TARGET = new THREE.Vector3(0, 1, 0)

function AimedRectAreaLight({ aimAt, rotation, position, ...rest }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const light = ref.current
    if (!light) return
    if (rotation) {
      light.rotation.set(rotation[0], rotation[1], rotation[2])
    } else {
      light.lookAt(aimAt ?? LIGHT_TARGET)
    }
  })

  return <rectAreaLight ref={ref} position={position} {...rest} />
}

export default function StudioLights() {
  useEffect(() => {
    RectAreaLightUniformsLib.init() // обязательно один раз, иначе RectAreaLight не рендерится
  }, [])

  const { key, rim, fill, ambient } = STUDIO.lights

  return (
    <>
      <ambientLight intensity={ambient} />

      <AimedRectAreaLight
        aimAt={LIGHT_TARGET}
        position={key.position}
        width={key.width}
        height={key.height}
        intensity={key.intensity}
        color={key.color}
      />

      <AimedRectAreaLight
        aimAt={LIGHT_TARGET}
        position={rim.position}
        width={rim.width}
        height={rim.height}
        intensity={rim.intensity}
        color={rim.color}
      />

      <AimedRectAreaLight
        aimAt={LIGHT_TARGET}
        position={fill.position}
        width={fill.width}
        height={fill.height}
        intensity={fill.intensity}
        color={fill.color}
      />
    </>
  )
}
