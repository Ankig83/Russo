import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { HERO, LIGHT_LAYERS } from '../../constants/studioScene'

/** Лайтбокс — равномерная молочная панель с мягкими краями (bloom → свечение) */
const lightboxVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const lightboxFragment = `
  varying vec2 vUv;
  uniform vec3 color;
  uniform float strength;
  uniform float feather;
  void main() {
    float fx = smoothstep(0.0, feather, vUv.x) * smoothstep(1.0, 1.0 - feather, vUv.x);
    float fy = smoothstep(0.0, feather * 0.6, vUv.y) * smoothstep(1.0, 1.0 - feather * 0.6, vUv.y);
    float a = fx * fy;
    gl_FragColor = vec4(color * strength, a);
  }
`

function LightboxBacking() {
  const { lightbox, background } = HERO
  return (
    <mesh
      position={[
        lightbox.position[0],
        lightbox.position[1],
        lightbox.position[2] - 0.03,
      ]}
      renderOrder={-2}
      raycast={() => null}
    >
      <planeGeometry args={[lightbox.width, lightbox.height]} />
      <meshBasicMaterial color={background} toneMapped={false} />
    </mesh>
  )
}

function LightboxPanel() {
  const { lightbox } = HERO
  const uniforms = useRef({
    color: { value: new THREE.Color(lightbox.color) },
    strength: { value: lightbox.strength },
    feather: { value: lightbox.feather },
  })

  return (
    <mesh position={lightbox.position} renderOrder={-1} raycast={() => null}>
      <planeGeometry args={[lightbox.width, lightbox.height]} />
      <shaderMaterial
        vertexShader={lightboxVertex}
        fragmentShader={lightboxFragment}
        uniforms={uniforms.current}
        transparent
        depthWrite={false}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

/** Рассеянный area-свет от лайтбокса — на оба слоя (двери + корпус) */
function FillAreaLight() {
  const { fillLight } = HERO
  const ref = useRef(null)
  const target = useMemo(() => new THREE.Vector3(...fillLight.aimAt), [])

  useLayoutEffect(() => {
    const light = ref.current
    if (!light) return
    light.layers.enable(LIGHT_LAYERS.doors)
    light.layers.enable(LIGHT_LAYERS.corpus)
    light.lookAt(target)
  }, [target])

  return (
    <rectAreaLight
      ref={ref}
      position={fillLight.position}
      width={fillLight.width}
      height={fillLight.height}
      intensity={fillLight.intensity}
      color={fillLight.color}
    />
  )
}

function RimLight() {
  const { rimLight } = HERO
  const ref = useRef(null)
  useLayoutEffect(() => {
    const light = ref.current
    if (!light) return
    light.layers.enable(LIGHT_LAYERS.doors)
    light.layers.enable(LIGHT_LAYERS.corpus)
  }, [])
  return (
    <pointLight
      ref={ref}
      position={rimLight.position}
      color={rimLight.color}
      intensity={rimLight.intensity}
      distance={rimLight.distance}
      decay={rimLight.decay}
    />
  )
}

/**
 * Контурный свет на дверки (пара лево/право, конфиг из HERO).
 * layers.set(doors) → ТОЛЬКО layer 0: боковины корпуса (layer 1) не задевает.
 */
function DoorRimLight({ config }) {
  const ref = useRef(null)
  const target = useMemo(
    () => new THREE.Vector3(...config.aimAt),
    [config.aimAt[0], config.aimAt[1], config.aimAt[2]],
  )

  useLayoutEffect(() => {
    const light = ref.current
    if (!light) return
    light.layers.set(LIGHT_LAYERS.doors)
    light.lookAt(target)
  }, [target])

  return (
    <rectAreaLight
      ref={ref}
      position={config.position}
      width={config.width}
      height={config.height}
      intensity={config.intensity}
      color={config.color}
    />
  )
}

/** Геройский фон: светящаяся стена-лайтбокс + рассеянный fill + ободок */
export default function HeroBackdrop() {
  useEffect(() => {
    RectAreaLightUniformsLib.init()
  }, [])

  return (
    <group raycast={() => null}>
      <LightboxBacking />
      <LightboxPanel />
      <FillAreaLight />
      <RimLight />
      <DoorRimLight config={HERO.doorRimLeft} />
      <DoorRimLight config={HERO.doorRimRight} />
      <DoorRimLight config={HERO.doorFrontSoft} />
      <DoorRimLight config={HERO.doorMedallion} />
    </group>
  )
}
