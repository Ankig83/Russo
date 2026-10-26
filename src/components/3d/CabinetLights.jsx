import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { CABINET_LIGHTS } from '../../constants/cabinetStudio'
import { cabinetFlags } from '../../utils/cabinetQuery'

function AimedRect({ position, aim, width, height, intensity, color }) {
  const ref = useRef(null)
  const target = useMemo(() => new THREE.Vector3(...aim), [aim])

  useLayoutEffect(() => {
    const light = ref.current
    if (!light) return
    light.lookAt(target)
  }, [target, position])

  return (
    <rectAreaLight
      ref={ref}
      position={position}
      width={width}
      height={height}
      intensity={intensity}
      color={color}
    />
  )
}

function FloorPool({ position, aim, intensity, color, angle, penumbra, distance, decay }) {
  const ref = useRef(null)
  const target = useMemo(() => new THREE.Vector3(...aim), [aim])

  useLayoutEffect(() => {
    const light = ref.current
    if (!light) return
    light.lookAt(target)
    light.layers.disable(0)
    light.layers.enable(1)
  }, [target, position])

  return (
    <spotLight
      ref={ref}
      position={position}
      intensity={intensity}
      color={color}
      angle={angle}
      penumbra={penumbra}
      distance={distance}
      decay={decay}
    />
  )
}

function InteriorSpot({
  position,
  aim,
  intensity,
  color,
  angle,
  penumbra,
  distance,
  decay,
  mapSize,
}) {
  const ref = useRef(null)
  const target = useMemo(() => new THREE.Vector3(...aim), [aim])

  useLayoutEffect(() => {
    const light = ref.current
    if (!light) return
    light.lookAt(target)
    light.shadow.mapSize.set(mapSize, mapSize)
    light.shadow.bias = CABINET_LIGHTS.interiorSpot.bias
    light.shadow.normalBias = CABINET_LIGHTS.interiorSpot.normalBias
    light.shadow.camera.near = 0.05
    light.shadow.camera.far = distance
    light.shadow.camera.updateProjectionMatrix()
  }, [distance, mapSize, target])

  return (
    <spotLight
      ref={ref}
      position={position}
      intensity={intensity}
      color={color}
      angle={angle}
      penumbra={penumbra}
      distance={distance}
      decay={decay}
      castShadow
    />
  )
}

function KeyShadow({ position, intensity, color, mapSize, aim }) {
  const ref = useRef(null)
  const target = useMemo(() => new THREE.Vector3(...aim), [aim])

  useLayoutEffect(() => {
    const light = ref.current
    if (!light) return
    light.lookAt(target)
    light.shadow.mapSize.set(mapSize, mapSize)
    light.layers.enable(0)
    light.layers.enable(1)
    light.shadow.bias = CABINET_LIGHTS.shadow.bias
    light.shadow.normalBias = CABINET_LIGHTS.shadow.normalBias
    light.shadow.radius = CABINET_LIGHTS.shadow.radius
    if ('intensity' in light.shadow) light.shadow.intensity = 1.35
    light.shadow.camera.near = 0.3
    light.shadow.camera.far = 18
    light.shadow.camera.left = -3.2
    light.shadow.camera.right = 3.2
    light.shadow.camera.top = 3.6
    light.shadow.camera.bottom = -2.4
    light.shadow.camera.updateProjectionMatrix()
  }, [aim, mapSize, target])

  return (
    <directionalLight
      ref={ref}
      position={position}
      intensity={intensity}
      color={color}
      castShadow
    />
  )
}

export default function CabinetLights({ shadowMapSize = 1024 }) {
  const realtime = cabinetFlags().realtime

  useEffect(() => {
    if (!realtime) return
    RectAreaLightUniformsLib.init()
  }, [realtime])

  if (!realtime) return null

  const { ambient, aim, key, fill, rimLeft, rimRight, interior, interiorSpot, backdropSpot, shadow, floorPool } =
    CABINET_LIGHTS

  return (
    <>
      <ambientLight intensity={ambient} />

      <AimedRect
        position={key.position}
        aim={aim}
        width={key.width}
        height={key.height}
        intensity={key.intensity}
        color={key.color}
      />
      <AimedRect
        position={fill.position}
        aim={aim}
        width={fill.width}
        height={fill.height}
        intensity={fill.intensity}
        color={fill.color}
      />
      <AimedRect
        position={rimLeft.position}
        aim={aim}
        width={rimLeft.width}
        height={rimLeft.height}
        intensity={rimLeft.intensity}
        color={rimLeft.color}
      />
      <AimedRect
        position={rimRight.position}
        aim={aim}
        width={rimRight.width}
        height={rimRight.height}
        intensity={rimRight.intensity}
        color={rimRight.color}
      />
      <AimedRect
        position={interior.position}
        aim={interior.aim}
        width={interior.width}
        height={interior.height}
        intensity={interior.intensity}
        color={interior.color}
      />

      <object3D position={backdropSpot.aim} />
      <spotLight
        position={backdropSpot.position}
        intensity={backdropSpot.intensity}
        color={backdropSpot.color}
        angle={backdropSpot.angle}
        penumbra={backdropSpot.penumbra}
        distance={12}
      />

      {floorPool.intensity > 0 && (
        <FloorPool
          position={floorPool.position}
          aim={floorPool.aim}
          intensity={floorPool.intensity}
          color={floorPool.color}
          angle={floorPool.angle}
          penumbra={floorPool.penumbra}
          distance={floorPool.distance}
          decay={floorPool.decay}
        />
      )}

      <InteriorSpot
        position={interiorSpot.position}
        aim={interiorSpot.aim}
        intensity={interiorSpot.intensity}
        color={interiorSpot.color}
        angle={interiorSpot.angle}
        penumbra={interiorSpot.penumbra}
        distance={interiorSpot.distance}
        decay={interiorSpot.decay}
        mapSize={Math.min(shadowMapSize, interiorSpot.mapSize)}
      />

      <KeyShadow
        position={shadow.position}
        intensity={shadow.intensity}
        color={shadow.color}
        mapSize={shadowMapSize}
        aim={aim}
      />
    </>
  )
}
