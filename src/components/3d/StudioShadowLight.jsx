import { useLayoutEffect, useRef } from 'react'
import { LIGHT_LAYERS, STUDIO } from '../../constants/studioScene'
import { useStudioPerformance } from '../../hooks/useStudioPerformance'

/** Большой spot: перспективная мягкая тень на физическом полу и стенах. */
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
    light.shadow.blurSamples = cfg.blurSamples ?? 8
    light.shadow.camera.near = cfg.camera.near
    light.shadow.camera.far = cfg.camera.far
    light.shadow.camera.updateProjectionMatrix()
  }, [cfg.blurSamples, cfg.camera.far, cfg.camera.near, cfg.radius])

  if (!cfg) return null

  return (
    <>
      <object3D ref={targetRef} position={cfg.target} />
      <spotLight
        ref={lightRef}
        position={cfg.position}
        intensity={cfg.intensity}
        color={cfg.color}
        angle={cfg.angle}
        penumbra={cfg.penumbra}
        distance={cfg.distance}
        decay={cfg.decay}
        castShadow
        shadow-bias={cfg.bias}
        shadow-normalBias={cfg.normalBias}
        shadow-mapSize={[mapSize, mapSize]}
      />
    </>
  )
}
