import * as THREE from 'three'
import { getHorizonEnvIntensity, STUDIO } from '../../constants/studioScene'
import { useRoomConcreteTextures } from '../../utils/roomConcreteTextures'

/** Физический бетонный пол: принимает реальные тени и отражает IBL. */
export default function StudioHorizon() {
  const { size, y, color, roughness, metalness } = STUDIO.horizon
  const maps = useRoomConcreteTextures([12, 12])

  return (
    <mesh
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, y, 0]}
      raycast={() => null}
    >
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        {...maps}
        color={color}
        roughness={roughness}
        metalness={metalness}
        normalScale={new THREE.Vector2(0.12, 0.12)}
        envMapIntensity={getHorizonEnvIntensity()}
      />
    </mesh>
  )
}
