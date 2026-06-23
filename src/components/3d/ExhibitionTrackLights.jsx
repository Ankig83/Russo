import * as THREE from 'three'

/**
 * Трековые прожекторы выставочного стенда.
 * Настройки — константы TRACK_* в начале файла.
 */

const TRACK_LENGTH = 11
const TRACK_Z = 4.2
const TRACK_Y_BELOW_CEILING = 0.14
const TRACK_SPOT_X = [-3.4, -1.15, 1.15, 3.4]
const TRACK_SPOT_INTENSITY = 1.35
const TRACK_SPOT_COLOR = '#fff3e0'
/** Доля высоты стены — куда светят прожекторы (логотип / центр стены) */
const TRACK_AIM_WALL_FRAC = 0.38

const railMat = { color: '#141414', metalness: 0.92, roughness: 0.18 }
const housingMat = { color: '#1c1c1c', metalness: 0.88, roughness: 0.22 }

function TrackSpot({ position, aimWorld }) {
  const [x, y, z] = position
  const targetLocal = [
    aimWorld[0] - x,
    aimWorld[1] - y,
    aimWorld[2] - z,
  ]

  return (
    <group position={[x, y, z]}>
      {/* крепление к шине */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.1, 0.045, 0.08]} />
        <meshStandardMaterial {...railMat} />
      </mesh>
      {/* корпус прожектора */}
      <mesh position={[0, -0.1, 0]} rotation={[Math.PI, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.07, 0.14, 14, 1, true]} />
        <meshStandardMaterial {...housingMat} side={THREE.DoubleSide} />
      </mesh>
      <spotLight
        position={[0, -0.14, 0]}
        color={TRACK_SPOT_COLOR}
        intensity={TRACK_SPOT_INTENSITY}
        angle={0.36}
        penumbra={0.55}
        distance={22}
        decay={2}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-bias={-0.0002}
      >
        <object3D attach="target" position={targetLocal} />
      </spotLight>
    </group>
  )
}

/** Параллельные трековые шины + прожекторы у потолка стенда */
export default function ExhibitionTrackLights({ floorY, wallZ, wallH }) {
  const ceilingY = floorY + wallH
  const railY = ceilingY - TRACK_Y_BELOW_CEILING
  const aimY = floorY + wallH * TRACK_AIM_WALL_FRAC
  const aimWorld = [0, aimY, wallZ + 0.15]

  return (
    <group>
      {/* основная шина над зоной экспоната */}
      <mesh position={[0, railY, TRACK_Z]}>
        <boxGeometry args={[TRACK_LENGTH, 0.055, 0.075]} />
        <meshStandardMaterial {...railMat} />
      </mesh>

      {/* вторая шина чуть ближе к зрителю — типичная трековая система */}
      <mesh position={[0, railY - 0.02, TRACK_Z + 1.1]}>
        <boxGeometry args={[TRACK_LENGTH * 0.85, 0.045, 0.065]} />
        <meshStandardMaterial {...railMat} />
      </mesh>

      {TRACK_SPOT_X.map((x) => (
        <TrackSpot key={`front-${x}`} position={[x, railY, TRACK_Z]} aimWorld={aimWorld} />
      ))}

      {TRACK_SPOT_X.slice(1, 3).map((x) => (
        <TrackSpot
          key={`rear-${x}`}
          position={[x, railY - 0.02, TRACK_Z + 1.1]}
          aimWorld={aimWorld}
        />
      ))}
    </group>
  )
}
