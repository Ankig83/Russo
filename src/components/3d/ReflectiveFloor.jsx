import { Suspense, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { HERO, LIGHT_LAYERS } from '../../constants/studioScene'
import { useRoomConcreteTextures } from '../../utils/roomConcreteTextures'
import { useCinematicFloorTextures } from '../../utils/cinematicStudioTextures'

function useFloorLayer(ref) {
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    mesh.layers.disableAll()
    mesh.layers.enable(LIGHT_LAYERS.floor)
  }, [ref])
}

function applyRadialFalloff(material, inner, outer) {
  const key = `floor-falloff-${inner}-${outer}`

  material.customProgramCacheKey = () => key
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFalloffInner = { value: inner }
    shader.uniforms.uFalloffOuter = { value: outer }

    shader.vertexShader = `varying vec3 vFloorWorldPos;\n${shader.vertexShader}`
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      vFloorWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    )

    shader.fragmentShader = `varying vec3 vFloorWorldPos;
uniform float uFalloffInner;
uniform float uFalloffOuter;
${shader.fragmentShader}`

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `{
        float d = length(vFloorWorldPos.xz);
        float fade = smoothstep(uFalloffInner, uFalloffOuter, d);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.0), fade);
      }
      #include <dithering_fragment>`,
    )
  }
}

function FloorDisc({ maps }) {
  const { floor } = HERO
  const matRef = useRef(null)
  const discRef = useRef(null)
  const shadowRef = useRef(null)

  useFloorLayer(discRef)
  useFloorLayer(shadowRef)

  useLayoutEffect(() => {
    const mat = matRef.current
    if (!mat) return
    applyRadialFalloff(mat, floor.falloff.inner, floor.falloff.outer)
    mat.needsUpdate = true
  }, [floor.falloff.inner, floor.falloff.outer])

  return (
    <group>
      <mesh
        ref={discRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        raycast={() => null}
      >
        <circleGeometry args={[floor.radius, 128]} />
        <meshStandardMaterial
          ref={matRef}
          map={maps.map}
          roughnessMap={maps.roughnessMap}
          normalMap={maps.normalMap}
          normalScale={new THREE.Vector2(floor.normalScale ?? 0.18, floor.normalScale ?? 0.18)}
          color={floor.color}
          roughness={floor.roughness}
          metalness={floor.metalness}
          envMapIntensity={0}
        />
      </mesh>
      <mesh
        ref={shadowRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.003, 0]}
        receiveShadow
        raycast={() => null}
      >
        <circleGeometry args={[floor.radius, 128]} />
        <shadowMaterial transparent opacity={floor.shadowOpacity ?? 0.58} color="#000000" />
      </mesh>
    </group>
  )
}

function CinematicFloorDisc() {
  const repeat = HERO.floor.textureRepeat ?? [2, 2]
  const maps = useCinematicFloorTextures(repeat)
  return <FloorDisc maps={maps} />
}

function ConcreteFloorDisc() {
  const repeat = HERO.floor.textureRepeat ?? [2.8, 2.8]
  const maps = useRoomConcreteTextures(repeat)
  return <FloorDisc maps={maps} />
}

export default function ReflectiveFloor() {
  const cinematic = HERO.floor?.source === 'cinematic'
  return (
    <Suspense fallback={null}>
      {cinematic ? <CinematicFloorDisc /> : <ConcreteFloorDisc />}
    </Suspense>
  )
}
