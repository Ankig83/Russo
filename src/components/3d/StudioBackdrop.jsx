import * as THREE from 'three'
import { useMemo, useEffect } from 'react'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { STUDIO_FLOOR_Y } from '../../constants/scene'

/**
 * Студийный фон — L-полосы пол→стена.
 * Центр: чёрное зеркало. Соседние полосы: светлый алюминий.
 */

const WALL_Z = -7
const FLOOR_D = 28
const WALL_H = 18

const CENTER_X0 = -1.5
const CENTER_X1 = 1.5
const CENTER_W = CENTER_X1 - CENTER_X0

/** variant: 'matte' | 'aluminum' */
const STRIPS = [
  { x0: -120, x1: -4.5, variant: 'matte', color: '#5c5c5c' },
  { x0: -4.5, x1: -1.5, variant: 'aluminum' },
  { x0: 1.5, x1: 4.5, variant: 'aluminum' },
  { x0: 4.5, x1: 120, variant: 'matte', color: '#5c5c5c' },
]

const UV_SCALE = 0.22
const ALUMINUM_NORMAL_SCALE = new THREE.Vector2(0.35, 0.35)

/** Процедурная текстура brushed aluminum */
function createAluminumTextures() {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const grad = ctx.createLinearGradient(0, 0, 0, size)
  grad.addColorStop(0, '#e8eaee')
  grad.addColorStop(0.45, '#f6f7fa')
  grad.addColorStop(1, '#d8dbe0')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)

  for (let y = 0; y < size; y += 1) {
    const n = (Math.sin(y * 0.35) + 1) * 0.5
    const v = Math.floor(210 + n * 35)
    ctx.strokeStyle = `rgba(${v},${v},${v + 4},0.28)`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(size, y + (Math.random() - 0.5) * 1.5)
    ctx.stroke()
  }

  const map = new THREE.CanvasTexture(canvas)
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.colorSpace = THREE.SRGBColorSpace

  // Normal map — горизонтальные бороздки алюминия
  const nCanvas = document.createElement('canvas')
  nCanvas.width = size
  nCanvas.height = size
  const nCtx = nCanvas.getContext('2d')
  nCtx.fillStyle = '#8080ff'
  nCtx.fillRect(0, 0, size, size)
  for (let y = 0; y < size; y += 2) {
    nCtx.strokeStyle = y % 4 === 0 ? '#9090ff' : '#7070ff'
    nCtx.lineWidth = 1
    nCtx.beginPath()
    nCtx.moveTo(0, y)
    nCtx.lineTo(size, y)
    nCtx.stroke()
  }

  const normalMap = new THREE.CanvasTexture(nCanvas)
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping

  return { map, normalMap }
}

function shadeVertex(baseHex, y, z, floorY, zFront, zWall) {
  const c = new THREE.Color(baseHex)
  let shade = 1

  const onFloor = y <= floorY + 0.001
  if (onFloor) {
    const depth = (z - zWall) / (zFront - zWall)
    shade = 0.78 + depth * 0.16
    if (depth < 0.08) shade *= 0.76
  } else {
    const height = (y - floorY) / WALL_H
    shade = 0.62 + height * 0.42
    if (height < 0.12) shade *= 0.8
  }

  c.multiplyScalar(shade)
  return c
}

function makeMatteLStrip(xStart, xEnd, baseColor, floorY) {
  const geo = new THREE.BufferGeometry()
  const y0 = floorY
  const y1 = floorY + WALL_H
  const z0 = WALL_Z + FLOOR_D
  const z1 = WALL_Z

  const positions = [
    [xStart, y0, z0],
    [xEnd, y0, z0],
    [xStart, y0, z1],
    [xEnd, y0, z1],
    [xStart, y1, z1],
    [xEnd, y1, z1],
  ]

  const verts = new Float32Array(positions.flat())
  const colors = new Float32Array(positions.length * 3)

  positions.forEach(([x, y, z], i) => {
    const c = shadeVertex(baseColor, y, z, floorY, z0, z1)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  })

  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4])
  geo.computeVertexNormals()
  return geo
}

function makeAluminumLStrip(xStart, xEnd, floorY) {
  const geo = new THREE.BufferGeometry()
  const y0 = floorY
  const y1 = floorY + WALL_H
  const z0 = WALL_Z + FLOOR_D
  const z1 = WALL_Z

  const positions = [
    [xStart, y0, z0],
    [xEnd, y0, z0],
    [xStart, y0, z1],
    [xEnd, y0, z1],
    [xStart, y1, z1],
    [xEnd, y1, z1],
  ]

  const verts = new Float32Array(positions.flat())
  const uvs = new Float32Array(positions.length * 2)

  positions.forEach(([x, y, z], i) => {
    const onFloor = y <= floorY + 0.001
    if (onFloor) {
      uvs[i * 2] = x * UV_SCALE
      uvs[i * 2 + 1] = z * UV_SCALE
    } else {
      uvs[i * 2] = x * UV_SCALE
      uvs[i * 2 + 1] = (y - floorY) * UV_SCALE
    }
  })

  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geo.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4])
  geo.computeVertexNormals()
  return geo
}

function makeCenterWallGeo(floorY) {
  const geo = new THREE.BufferGeometry()
  const y0 = floorY
  const y1 = floorY + WALL_H
  const z = WALL_Z + 0.01

  const verts = new Float32Array([
    CENTER_X0, y0, z,
    CENTER_X1, y0, z,
    CENTER_X0, y1, z,
    CENTER_X1, y1, z,
  ])

  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  geo.setIndex([0, 1, 2, 1, 3, 2])
  geo.computeVertexNormals()
  return geo
}

function CenterMirrorFloor({ floorY }) {
  const zCenter = WALL_Z + FLOOR_D / 2

  const reflector = useMemo(() => {
    const geo = new THREE.PlaneGeometry(CENTER_W, FLOOR_D)
    const mirror = new Reflector(geo, {
      clipBias: 0.003,
      textureWidth: 1024,
      textureHeight: 1024,
      color: 0x0a0a0a,
    })
    mirror.rotation.x = -Math.PI / 2
    mirror.position.set(0, floorY + 0.004, zCenter)
    return mirror
  }, [floorY, zCenter])

  useEffect(() => () => {
    reflector.geometry.dispose()
    reflector.material.dispose()
  }, [reflector])

  return <primitive object={reflector} />
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

function MatteMaterial() {
  return (
    <meshStandardMaterial
      vertexColors
      roughness={0.88}
      metalness={0.02}
      envMapIntensity={0.45}
      side={THREE.DoubleSide}
    />
  )
}

function AluminumMaterial({ map, normalMap }) {
  return (
    <meshPhysicalMaterial
      map={map}
      normalMap={normalMap}
      normalScale={ALUMINUM_NORMAL_SCALE}
      color="#ffffff"
      metalness={0.94}
      roughness={0.18}
      envMapIntensity={1.75}
      clearcoat={0.35}
      clearcoatRoughness={0.12}
      side={THREE.DoubleSide}
    />
  )
}

export default function StudioBackdrop({ floorY = STUDIO_FLOOR_Y }) {
  const aluminumTextures = useMemo(() => createAluminumTextures(), [])

  useEffect(() => () => {
    aluminumTextures.map.dispose()
    aluminumTextures.normalMap.dispose()
  }, [aluminumTextures])

  const stripGeos = useMemo(
    () =>
      STRIPS.map(({ x0, x1, variant, color }) =>
        variant === 'aluminum'
          ? makeAluminumLStrip(x0, x1, floorY)
          : makeMatteLStrip(x0, x1, color, floorY),
      ),
    [floorY],
  )

  const centerWallGeo = useMemo(() => makeCenterWallGeo(floorY), [floorY])
  const seamY = floorY + 0.003

  return (
    <group>
      {STRIPS.map(({ variant }, i) => (
        <mesh key={i} geometry={stripGeos[i]} receiveShadow>
          {variant === 'aluminum' ? (
            <AluminumMaterial
              map={aluminumTextures.map}
              normalMap={aluminumTextures.normalMap}
            />
          ) : (
            <MatteMaterial />
          )}
        </mesh>
      ))}

      <mesh geometry={centerWallGeo} receiveShadow>
        <meshPhysicalMaterial
          color="#050505"
          roughness={0.04}
          metalness={0.9}
          envMapIntensity={2.5}
          clearcoat={1}
          clearcoatRoughness={0.02}
          side={THREE.DoubleSide}
        />
      </mesh>

      <CenterMirrorFloor floorY={floorY} />

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
