import * as THREE from 'three'
import { MeshReflectorMaterial } from '@react-three/drei'
import { HERO } from '../../constants/studioScene'

/** Тёмный глянцевый пол + shadow catcher (MeshReflector плохо принимает shadow map) */
export default function ReflectiveFloor() {
  const { floor } = HERO

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        raycast={() => null}
      >
        <planeGeometry args={[floor.size, floor.size]} />
        <MeshReflectorMaterial
          resolution={floor.resolution}
          mirror={floor.mirror}
          blur={floor.blur}
          mixBlur={floor.mixBlur}
          mixStrength={floor.mixStrength}
          roughness={floor.roughness}
          metalness={floor.metalness}
          color={floor.color}
          depthScale={1.2}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          side={THREE.FrontSide}
        />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.004, 0]}
        receiveShadow
        raycast={() => null}
      >
        <planeGeometry args={[floor.size, floor.size]} />
        <shadowMaterial transparent opacity={0.5} color="#000000" />
      </mesh>
    </group>
  )
}
