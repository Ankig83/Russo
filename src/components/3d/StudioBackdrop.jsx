import { useRef } from 'react'
import * as THREE from 'three'
import { STUDIO, USE_STUDIO_FLOOR_TILE } from '../../constants/studioScene'

const wallVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const wallFragmentShader = `
  varying vec2 vUv;
  uniform vec3 wallBottomColor;
  uniform vec3 wallTopColor;
  void main() {
    vec3 col = mix(wallBottomColor, wallTopColor, smoothstep(0.0, 1.0, vUv.y));
    gl_FragColor = vec4(col, 1.0);
  }
`

/** Студия: пол (y=0) + стена (z=wallZ), прямой стык — как на референсе. */
export default function StudioBackdrop() {
  const {
    width,
    wallZ,
    wallHeight,
    floorFront,
    floorColor,
    wallBottomColor,
    wallTopColor,
  } = STUDIO.backdrop

  const wallUniforms = useRef({
    wallBottomColor: { value: new THREE.Color(wallBottomColor) },
    wallTopColor: { value: new THREE.Color(wallTopColor) },
  })

  const floorBack = Math.abs(wallZ) + 1.5
  const floorSizeZ = floorFront + floorBack
  const floorCenterZ = (floorFront - floorBack) / 2

  return (
    <group raycast={() => null}>
      {!USE_STUDIO_FLOOR_TILE && (
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, floorCenterZ]}>
          <planeGeometry args={[width, floorSizeZ]} />
          <meshStandardMaterial color={floorColor} roughness={0.88} metalness={0} />
        </mesh>
      )}

      <mesh position={[0, wallHeight / 2, wallZ]}>
        <planeGeometry args={[width, wallHeight]} />
        <shaderMaterial
          vertexShader={wallVertexShader}
          fragmentShader={wallFragmentShader}
          uniforms={wallUniforms.current}
          side={THREE.FrontSide}
        />
      </mesh>
    </group>
  )
}
