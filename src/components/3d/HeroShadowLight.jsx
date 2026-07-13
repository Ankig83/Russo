import { useLayoutEffect, useRef } from 'react'
import { HERO, LIGHT_LAYERS } from '../../constants/studioScene'
import { useStudioPerformance } from '../../hooks/useStudioPerformance'

function ShadowDirectional({ config, mapSize }) {
  const lightRef = useRef(null)
  const targetRef = useRef(null)

  useLayoutEffect(() => {
    const light = lightRef.current
    const target = targetRef.current
    if (!light || !target) return

    light.target = target
    light.layers.enable(LIGHT_LAYERS.doors)
    light.layers.enable(LIGHT_LAYERS.corpus)
    light.shadow.radius = config.radius ?? 2
  }, [config.radius])

  return (
    <>
      <object3D ref={targetRef} position={config.target} />
      <directionalLight
        ref={lightRef}
        position={config.position}
        intensity={config.intensity}
        color={config.color}
        castShadow
        shadow-bias={config.bias}
        shadow-normalBias={config.normalBias}
        shadow-mapSize={[mapSize, mapSize]}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[
            config.camera.left,
            config.camera.right,
            config.camera.top,
            config.camera.bottom,
            config.camera.near,
            config.camera.far,
          ]}
        />
      </directionalLight>
    </>
  )
}

/** Hero: динамические shadow map — пол + контактные тени ручек на дверях */
export default function HeroShadowLight() {
  const perf = useStudioPerformance()
  const { shadow } = HERO
  if (!shadow) return null

  const floorMap = Math.min(perf.shadowMapSize ?? shadow.floor.mapSize, shadow.floor.mapSize)
  const doorMap = Math.min(perf.shadowMapSize ?? shadow.door.mapSize, shadow.door.mapSize)

  return (
    <group>
      <ShadowDirectional config={shadow.floor} mapSize={floorMap} />
      <ShadowDirectional config={shadow.door} mapSize={doorMap} />
    </group>
  )
}
