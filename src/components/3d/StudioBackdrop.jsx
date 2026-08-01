import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { STUDIO, USE_STUDIO_FLOOR_TILE } from '../../constants/studioScene'
import { useRoomConcreteTextures } from '../../utils/roomConcreteTextures'

function createCoveGeometry(leftX, rightX, wallZ, floorY, radius, segments = 32) {
  const positions = []
  const uvs = []
  const indices = []

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    const angle = t * Math.PI * 0.5
    const z = wallZ + radius - radius * Math.sin(angle)
    const y = floorY + radius - radius * Math.cos(angle)

    positions.push(leftX, y, z, rightX, y, z)
    uvs.push(0, t, 1, t)

    if (i < segments) {
      const a = i * 2
      const b = a + 1
      const c = a + 2
      const d = a + 3
      indices.push(a, b, c, b, d, c)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

/** Физическая комната с плавной циклорамой между полом и стеной. */
export default function StudioBackdrop() {
  const {
    width,
    wallZ,
    wallHeight,
    floorFront,
    floorColor,
    roomLeftX,
    roomRightX,
  } = STUDIO.backdrop
  const wallMaps = useRoomConcreteTextures([3.3, 3.7])
  const coveMaps = useRoomConcreteTextures([5, 0.56])

  const floorBack = Math.abs(wallZ) + 1.5
  const floorSizeZ = floorFront + floorBack
  const floorCenterZ = (floorFront - floorBack) / 2
  const sideDepth = floorFront + Math.abs(wallZ)
  const sideCenterZ = (floorFront + wallZ) * 0.5
  const roomWidth = roomRightX - roomLeftX
  const roomCenterX = (roomLeftX + roomRightX) * 0.5
  const wallPlaneHeight = wallHeight + 0.4
  const wallCenterY = (wallHeight - 0.4) * 0.5
  const coveRadius = 1.65
  const coveGeometry = useMemo(
    () => createCoveGeometry(
      roomLeftX,
      roomRightX,
      wallZ,
      STUDIO.horizon.y,
      coveRadius,
    ),
    [roomLeftX, roomRightX, wallZ],
  )

  useEffect(() => () => coveGeometry.dispose(), [coveGeometry])

  const renderWallMaterial = () => (
    <meshStandardMaterial
      {...wallMaps}
      color="#ffffff"
      roughness={0.94}
      metalness={0}
      normalScale={new THREE.Vector2(0.07, 0.07)}
      envMapIntensity={0.52}
      side={THREE.FrontSide}
    />
  )

  return (
    <group raycast={() => null}>
      {!USE_STUDIO_FLOOR_TILE && (
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, floorCenterZ]}>
          <planeGeometry args={[width, floorSizeZ]} />
          <meshStandardMaterial color={floorColor} roughness={0.88} metalness={0} />
        </mesh>
      )}

      <mesh receiveShadow position={[roomCenterX, wallCenterY, wallZ]}>
        <planeGeometry args={[roomWidth, wallPlaneHeight]} />
        {renderWallMaterial()}
      </mesh>

      <mesh receiveShadow geometry={coveGeometry}>
        <meshStandardMaterial
          {...coveMaps}
          color="#ffffff"
          roughness={0.93}
          metalness={0}
          normalScale={new THREE.Vector2(0.06, 0.06)}
          envMapIntensity={0.48}
          side={THREE.FrontSide}
        />
      </mesh>

      <mesh
        receiveShadow
        position={[roomLeftX, wallCenterY, sideCenterZ]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <planeGeometry args={[sideDepth, wallPlaneHeight]} />
        {renderWallMaterial()}
      </mesh>
      <mesh
        receiveShadow
        position={[roomRightX, wallCenterY, sideCenterZ]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <planeGeometry args={[sideDepth, wallPlaneHeight]} />
        {renderWallMaterial()}
      </mesh>
    </group>
  )
}
