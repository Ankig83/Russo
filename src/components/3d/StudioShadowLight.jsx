import { useLayoutEffect, useRef } from 'react'
import { LIGHT_LAYERS, STUDIO } from '../../constants/studioScene'
import { useStudioPerformance } from '../../hooks/useStudioPerformance'

/** Directional + target: тени шкафа на пол, оба view-layer */
export default function StudioShadowLight() {
  const lightRef = useRef(null)
  const targetRef = useRef(null)
  const cfg = STUDIO.lights.shadow
  const perf = useStudioPerformance()
  const mapSize = perf.shadowMapSize ?? cfg.mapSize

  useLayoutEffect(() => {
    const light = lightRef.current
    const target = targetRef.current
    if (!light || !target) return

    light.target = target
    light.layers.enable(LIGHT_LAYERS.doors)
    light.layers.enable(LIGHT_LAYERS.corpus)
    light.shadow.radius = cfg.radius ?? 2
  }, [cfg.radius])

  if (!cfg) return null

  return (
    <>
      <object3D ref={targetRef} position={cfg.target} />
      <directionalLight
        ref={lightRef}
        position={cfg.position}
        intensity={cfg.intensity}
        color={cfg.color}
        castShadow
        shadow-bias={cfg.bias}
        shadow-normalBias={cfg.normalBias}
        shadow-mapSize={[mapSize, mapSize]}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[
            cfg.camera.left,
            cfg.camera.right,
            cfg.camera.top,
            cfg.camera.bottom,
            cfg.camera.near,
            cfg.camera.far,
          ]}
        />
      </directionalLight>
    </>
  )
}
