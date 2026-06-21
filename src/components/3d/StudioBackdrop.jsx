import * as THREE from 'three'

export default function StudioBackdrop() {
  // Центральная светлая полоса
  const centerVertices = new Float32Array([
    -4.5, 0, 15,   4.5, 0, 15,  // пол перед (0, 1)
    -2,   0,  0,   2,   0,  0,  // стык     (2, 3)
    -2,  10,  0,   2,  10,  0,  // стена верх (4, 5)
  ])
  const centerIndices = new Uint16Array([
    0, 3, 2,   0, 1, 3,  // пол
    2, 5, 4,   2, 3, 5,  // стена
  ])

  // Боковые тёмные полосы
  const sidesVertices = new Float32Array([
    // левая
    -12,  0, 15,  -4.5, 0, 15,   // 0, 1
    -6,   0,  0,  -2,   0,  0,   // 2, 3
    -6,  10,  0,  -2,  10,  0,   // 4, 5
    // правая
     4.5, 0, 15,   12,  0, 15,   // 6, 7
     2,   0,  0,   6,   0,  0,   // 8, 9
     2,  10,  0,   6,  10,  0,   // 10, 11
  ])
  const sidesIndices = new Uint16Array([
    // левая
    0, 3, 2,   0, 1, 3,   2, 5, 4,   2, 3, 5,
    // правая
    6, 9, 8,   6, 7, 9,   8, 11, 10, 8, 9, 11,
  ])

  return (
    <group position={[0, -1.5, -2]}>
      {/* Центральная светлая полоса */}
      <mesh receiveShadow>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={centerVertices} count={6} itemSize={3} />
          <bufferAttribute attach="index" array={centerIndices} count={centerIndices.length} />
        </bufferGeometry>
        <meshStandardMaterial color="#f0f0f0" roughness={0.35} metalness={0} side={THREE.DoubleSide} />
      </mesh>

      {/* Боковые тёмные полосы */}
      <mesh receiveShadow>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={sidesVertices} count={12} itemSize={3} />
          <bufferAttribute attach="index" array={sidesIndices} count={sidesIndices.length} />
        </bufferGeometry>
        <meshStandardMaterial color="#b8b8b8" roughness={0.35} metalness={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
