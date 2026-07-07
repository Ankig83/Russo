import { useRef } from 'react'
import * as THREE from 'three'
import { getHorizonEnvIntensity, STUDIO } from '../../constants/studioScene'

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  varying vec2 vUv;
  uniform vec3 centerColor;
  uniform vec3 edgeColor;
  uniform float envStrength;
  void main() {
    vec2 uv = vUv - 0.5;
    float radial = length(uv) * 1.55;
    vec3 base = mix(centerColor, edgeColor, smoothstep(0.05, 0.92, radial));
    float sheen = smoothstep(0.35, 0.95, radial) * envStrength * 0.08;
    gl_FragColor = vec4(base + sheen, 1.0);
  }
`

/** Горизонт — мягкий градиент + лёгкий sheen под IBL (не matte-black дыра) */
export default function StudioHorizon() {
  const { size, y, color, edgeColor, envScale } = STUDIO.horizon
  const envStrength = getHorizonEnvIntensity() / Math.max(envScale, 0.01)

  const uniforms = useRef({
    centerColor: { value: new THREE.Color(color) },
    edgeColor: { value: new THREE.Color(edgeColor ?? '#0c0c0e') },
    envStrength: { value: envStrength },
  })

  return (
    <mesh
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, y, 0]}
      renderOrder={-1}
      raycast={() => null}
    >
      <planeGeometry args={[size, size]} />
      <shaderMaterial
        uniforms={uniforms.current}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  )
}
