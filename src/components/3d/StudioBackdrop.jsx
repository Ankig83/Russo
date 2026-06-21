import * as THREE from 'three'
import { useMemo } from 'react'
import { STUDIO_FLOOR_Y } from '../../constants/scene'

/**
 * Студийный фон — L-полосы пол→стена.
 * Центральная полоса — чёрный глянец с отражением шкафа (env map).
 */

const WALL_Z  = -7
const FLOOR_D = 28
const WALL_H  = 18

/** x0, x1, color, glossy */
const STRIPS = [
  [-120, -4.5, '#707070', false],
  [ -4.5, -1.5, '#b0b0b0', false],
  [ -1.5,  1.5, '#080808', true],   // центр — чёрный глянец
  [  1.5,  4.5, '#b0b0b0', false],
  [  4.5, 120, '#707070', false],
]

function shadeVertex(baseHex, y, z, floorY, zFront, zWall) {
  const c = new THREE.Color(baseHex)
  let shade = 1

  const onFloor = y <= floorY + 0.001
  if (onFloor) {
    const depth = (z - zWall) / (zFront - zWall)
    shade = 0.82 + depth * 0.14
    if (depth < 0.08) shade *= 0.78
  } else {
    const height = (y - floorY) / WALL_H
    shade = 0.68 + height * 0.38
    if (height < 0.12) shade *= 0.82
  }

  c.multiplyScalar(shade)
  return c
}

function makeLStrip(xStart, xEnd, baseColor, floorY, glossy = false) {
  const geo = new THREE.BufferGeometry()

  const y0 = floorY
  const y1 = floorY + WALL_H
  const z0 = WALL_Z + FLOOR_D
  const z1 = WALL_Z
  const x0 = xStart
  const x1 = xEnd

  const positions = [
    [x0, y0, z0],
    [x1, y0, z0],
    [x0, y0, z1],
    [x1, y0, z1],
    [x0, y1, z1],
    [x1, y1, z1],
  ]

  const verts = new Float32Array(positions.flat())

  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))

  if (!glossy) {
    const colors = new Float32Array(positions.length * 3)
    positions.forEach(([x, y, z], i) => {
      const c = shadeVertex(baseColor, y, z, floorY, z0, z1)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    })
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  }

  geo.setIndex([
    0, 1, 2,  1, 3, 2,
    2, 3, 4,  3, 5, 4,
  ])
  geo.computeVertexNormals()
  return geo
}

function BackdropSpot({ floorY }) {
  return (
    <spotLight
      position={[0, floorY + WALL_H + 3, 5]}
      color="#fffaf0"
      intensity={0.55}
      angle={0.42}
      penumbra={0.85}
      distance={35}
      decay={2}
    >
      <object3D attach="target" position={[0, floorY + WALL_H * 0.45, WALL_Z + 0.1]} />
    </spotLight>
  )
}

function StripMaterial({ glossy }) {
  if (glossy) {
    return (
      <meshPhysicalMaterial
        color="#050505"
        roughness={0.03}
        metalness={0.92}
        envMapIntensity={2.8}
        clearcoat={1}
        clearcoatRoughness={0.02}
        reflectivity={1}
        side={THREE.DoubleSide}
      />
    )
  }

  return (
    <meshStandardMaterial
      vertexColors
      roughness={0.82}
      metalness={0.04}
      envMapIntensity={0.55}
      side={THREE.DoubleSide}
    />
  )
}

export default function StudioBackdrop({ floorY = STUDIO_FLOOR_Y }) {
  const geos = useMemo(
    () => STRIPS.map(([x0, x1, color, glossy]) => makeLStrip(x0, x1, color, floorY, glossy)),
    [floorY],
  )

  const seamY = floorY + 0.003

  return (
    <group>
      {STRIPS.map(([, , , glossy], i) => (
        <mesh key={i} geometry={geos[i]} receiveShadow>
          <StripMaterial glossy={glossy} />
        </mesh>
      ))}

      <mesh position={[0, seamY, WALL_Z + 0.01]}>
        <boxGeometry args={[240, 0.006, 0.02]} />
        <meshStandardMaterial color="#505050" roughness={1} metalness={0} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, seamY + 0.002, WALL_Z + 0.3]}>
        <planeGeometry args={[18, 0.8]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.12} depthWrite={false} />
      </mesh>

      <BackdropSpot floorY={floorY} />
    </group>
  )
}
