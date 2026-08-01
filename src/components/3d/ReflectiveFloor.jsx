import * as THREE from 'three'
import { MeshReflectorMaterial } from '@react-three/drei'
import { HERO } from '../../constants/studioScene'

/** Существующий floor превращён в низкую круглую платформу + отражающий верх */
export default function ReflectiveFloor() {
  const { floor } = HERO

  return (
    <group>
      <mesh
        position={[0, 0, 0]}
        receiveShadow
        raycast={() => null}
      >
        <cylinderGeometry args={[floor.radius, floor.radius, floor.height, 96, 1, false]} />
        <meshStandardMaterial
          color={floor.color}
          roughness={floor.roughness}
          metalness={floor.metalness}
        />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, floor.height * 0.5 + 0.002, 0]}
        receiveShadow
        raycast={() => null}
      >
        <circleGeometry args={[floor.radius, 96]} />
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
    </group>
  )
}
