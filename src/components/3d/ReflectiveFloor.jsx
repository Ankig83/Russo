import { Suspense, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { HERO } from '../../constants/studioScene'
import { useRoomConcreteTextures } from '../../utils/roomConcreteTextures'

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

/** Бетонный диск: PBR-текстура, матовый, без отражений + falloff в void */
function ConcreteFloorDisc() {
  const { floor } = HERO
  const matRef = useRef(null)
  const repeat = floor.textureRepeat ?? [2.8, 2.8]
  const { map, roughnessMap, normalMap } = useRoomConcreteTextures(repeat)

  useLayoutEffect(() => {
    const mat = matRef.current
    if (!mat) return
    applyRadialFalloff(mat, floor.falloff.inner, floor.falloff.outer)
    mat.needsUpdate = true
  }, [floor.falloff.inner, floor.falloff.outer])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow raycast={() => null}>
        <circleGeometry args={[floor.radius, 128]} />
        <meshStandardMaterial
          ref={matRef}
          map={map}
          roughnessMap={roughnessMap}
          normalMap={normalMap}
          normalScale={new THREE.Vector2(floor.normalScale ?? 0.18, floor.normalScale ?? 0.18)}
          color={floor.color}
          roughness={floor.roughness}
          metalness={floor.metalness}
          envMapIntensity={0}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} receiveShadow raycast={() => null}>
        <circleGeometry args={[floor.radius, 128]} />
        <shadowMaterial transparent opacity={floor.shadowOpacity ?? 0.58} color="#000000" />
      </mesh>
    </group>
  )
}

export default function ReflectiveFloor() {
  return (
    <Suspense fallback={null}>
      <ConcreteFloorDisc />
    </Suspense>
  )
}
