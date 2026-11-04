import { useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { STUDIO_SCENE_PATH } from '../../constants/shkafNodes'
import { STUDIO_FLOOR } from '../../constants/cabinetStudio'
import { useIsMobile } from '../../hooks/useMediaQuery'

function prepareCyclorama(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return
    obj.castShadow = false
    obj.receiveShadow = true
    obj.raycast = () => {}
    obj.layers.set(STUDIO_FLOOR.layer)

    obj.geometry = obj.geometry.clone()
    const nrm = obj.geometry.attributes.normal
    if (nrm) {
      for (let i = 0; i < nrm.count; i += 1) {
        nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i))
      }
      nrm.needsUpdate = true
    }

    const src = Array.isArray(obj.material) ? obj.material : [obj.material]
    const next = src.map((mat) => {
      if (!mat) return mat
      const cloned = mat.clone()
      cloned.side = THREE.DoubleSide
      cloned.color.set(STUDIO_FLOOR.color)
      if ('envMapIntensity' in cloned) cloned.envMapIntensity = 0
      cloned.needsUpdate = true
      return cloned
    })
    obj.material = Array.isArray(obj.material) ? next : next[0]
  })
}

function applyStudioFalloff(material, inner, outer, wallY0, wallY1) {
  const key = `studio-falloff-${inner}-${outer}-${wallY0}-${wallY1}`
  material.customProgramCacheKey = () => key
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFalloffInner = { value: inner }
    shader.uniforms.uFalloffOuter = { value: outer }
    shader.uniforms.uWallY0 = { value: wallY0 }
    shader.uniforms.uWallY1 = { value: wallY1 }

    shader.vertexShader = `varying vec3 vStudioWorldPos;\n${shader.vertexShader}`
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      vStudioWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    )

    shader.fragmentShader = `varying vec3 vStudioWorldPos;
uniform float uFalloffInner;
uniform float uFalloffOuter;
uniform float uWallY0;
uniform float uWallY1;
${shader.fragmentShader}`

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `{
        float radial = smoothstep(uFalloffInner, uFalloffOuter, length(vStudioWorldPos.xz));
        float wall = smoothstep(uWallY0, uWallY1, vStudioWorldPos.y);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.0), max(radial, wall));
      }
      #include <dithering_fragment>`,
    )
  }
  material.needsUpdate = true
}

function FloorShadowCatcher({ radius, y, opacity }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    if (ref.current) ref.current.layers.set(STUDIO_FLOOR.layer)
  }, [])

  return (
    <mesh
      ref={ref}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, y, 0.08]}
      receiveShadow
      raycast={() => {}}
      renderOrder={1}
    >
      <circleGeometry args={[radius, 64]} />
      <shadowMaterial transparent opacity={opacity} color="#000000" />
    </mesh>
  )
}

function FloorContact({ radius, y, opacity, inner, outer }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    if (ref.current) ref.current.layers.set(STUDIO_FLOOR.layer)
  }, [])

  return (
    <mesh
      ref={ref}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, y, 0.08]}
      raycast={() => {}}
      renderOrder={2}
    >
      <circleGeometry args={[radius, 64]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        toneMapped={false}
        uniforms={{
          uOpacity: { value: opacity },
          uInner: { value: inner },
          uOuter: { value: outer },
        }}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uOpacity;
          uniform float uInner;
          uniform float uOuter;
          varying vec2 vUv;
          void main() {
            vec2 p = (vUv - vec2(0.5)) * vec2(1.15, 1.0);
            float d = length(p) * 2.0;
            float a = (1.0 - smoothstep(uInner, uOuter, d)) * uOpacity;
            if (a < 0.004) discard;
            gl_FragColor = vec4(0.0, 0.0, 0.0, a);
          }
        `}
      />
    </mesh>
  )
}

/** Циклорама из Blender-GLB: цементный пол, ков вместо жёсткого горизонта. */
export default function StudioSceneMesh() {
  const isMobile = useIsMobile()
  const gltf = useGLTF(STUDIO_SCENE_PATH)
  const model = useMemo(() => {
    const scene = gltf.scene.clone(true)
    prepareCyclorama(scene)
    return scene
  }, [gltf.scene])

  const inner = isMobile ? STUDIO_FLOOR.mobile.falloffInner : STUDIO_FLOOR.falloffInner
  const outer = isMobile ? STUDIO_FLOOR.mobile.falloffOuter : STUDIO_FLOOR.falloffOuter
  const contact = isMobile ? STUDIO_FLOOR.mobile.contact : STUDIO_FLOOR.contact
  const catcher = isMobile ? STUDIO_FLOOR.mobile.catcher : STUDIO_FLOOR.catcher
  const [wallY0, wallY1] = STUDIO_FLOOR.wallFadeY

  useLayoutEffect(() => {
    model.traverse((obj) => {
      if (!obj.isMesh) return
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach((mat) => {
        if (mat) applyStudioFalloff(mat, inner, outer, wallY0, wallY1)
      })
    })
  }, [inner, model, outer, wallY0, wallY1])

  return (
    <>
      <primitive object={model} />
      <FloorShadowCatcher {...catcher} />
      <FloorContact {...contact} />
    </>
  )
}

useGLTF.preload(STUDIO_SCENE_PATH)
