import * as THREE from 'three'
import { MeshReflectorMaterial } from '@react-three/drei'
import { HERO } from '../../constants/studioScene'

/** Тёмный глянцевый пол с отражением шкафа и лайтбокса (в стиле CHILE20) */
export default function ReflectiveFloor() {
  const { floor } = HERO

  return (
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
  )
}
