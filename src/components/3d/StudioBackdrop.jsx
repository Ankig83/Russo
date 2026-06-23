import * as THREE from 'three'
import { Suspense, useMemo, useEffect } from 'react'
import { useLoader } from '@react-three/fiber'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { STUDIO_FLOOR_Y, STUDIO_WALL_H, STUDIO_BG } from '../../constants/scene'
import ExhibitionTrackLights from './ExhibitionTrackLights'
import ExhibitionOverhead from './ExhibitionOverhead'

const BRAND_LOGO_WALL = `${import.meta.env.BASE_URL}assets/brand/russo-11.png?v=11`

/**
 * Золотой знак на чёрной полосе за шкафом — РУССО-11.png
 * LOGO_WALL_WIDTH_FRAC — ширина (доля от чёрной полосы CENTER_W)
 * LOGO_WALL_SCALE       — доп. масштаб
 * LOGO_WALL_Y_FRAC      — высота центра: 0 = пол, 1 = потолок стены
 * LOGO_WALL_Z_OFFSET    — выдвиг от стены к камере
 * (только StudioBackdrop — на reference-studio правь scene.js → LOGO_WALL_Y_FRAC)
 */
const LOGO_WALL_WIDTH_FRAC = 0.98
const LOGO_WALL_SCALE = 0.58
const LOGO_WALL_Y_FRAC = 0.55
const LOGO_WALL_Z_OFFSET = 0.8

/** Обрезка текстуры РУССО-11.png (2481×2481) — только вертикальный знак */
const LOGO_WALL_TEX = { x: 641, y: 237, w: 1199, h: 2007, srcW: 2481, srcH: 2481 }
const LOGO_WALL_ASPECT = LOGO_WALL_TEX.w / LOGO_WALL_TEX.h

function applyLogoWallCrop(texture) {
  const { x, y, w, h, srcW, srcH } = LOGO_WALL_TEX
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.repeat.set(w / srcW, h / srcH)
  texture.offset.set(x / srcW, (srcH - y - h) / srcH)
}

/**
 * Студийный фон — L-полосы пол→стена.
 * Центр: чёрное зеркало. Соседние полосы: светлый алюминий.
 */

const WALL_Z = -7
const FLOOR_D = 28
const WALL_H = STUDIO_WALL_H

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
      color: 0x040404,
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

function BrandWallDecal({ floorY, map, z, renderOrder }) {
  const texture = useLoader(THREE.TextureLoader, map)
  texture.colorSpace = THREE.SRGBColorSpace
  applyLogoWallCrop(texture)

  const stripeW = CENTER_W * LOGO_WALL_WIDTH_FRAC * LOGO_WALL_SCALE
  const stripeH = stripeW / LOGO_WALL_ASPECT
  const y = floorY + WALL_H * LOGO_WALL_Y_FRAC

  return (
    <mesh position={[0, y, z]} renderOrder={renderOrder}>
      <planeGeometry args={[stripeW, stripeH]} />
      <meshBasicMaterial
        map={texture}
        transparent
        alphaTest={0.005}
        toneMapped={false}
        depthWrite={false}
        depthTest
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-4}
        polygonOffsetUnits={-4}
        blending={THREE.NormalBlending}
      />
    </mesh>
  )
}

function BackWallLogo({ floorY }) {
  return (
    <BrandWallDecal
      floorY={floorY}
      map={BRAND_LOGO_WALL}
      z={WALL_Z + LOGO_WALL_Z_OFFSET}
      renderOrder={100}
    />
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
  const ceilingY = floorY + WALL_H
  const ceilingZ = WALL_Z + FLOOR_D / 2

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
          roughness={0.16}
          metalness={0.62}
          envMapIntensity={1.15}
          clearcoat={0.42}
          clearcoatRoughness={0.18}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Потолок — закрывает серый фон над стенами при взгляде вверх */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, ceilingY, ceilingZ]}
        receiveShadow
      >
        <planeGeometry args={[240, FLOOR_D + 24]} />
        <meshStandardMaterial color={STUDIO_BG} roughness={0.95} metalness={0} side={THREE.DoubleSide} />
      </mesh>

      <CenterMirrorFloor floorY={floorY} />

      <Suspense fallback={null}>
        <BackWallLogo floorY={floorY} />
      </Suspense>

      <ExhibitionOverhead floorY={floorY} wallH={WALL_H} />

      <mesh position={[0, seamY, WALL_Z + 0.01]}>
        <boxGeometry args={[240, 0.006, 0.02]} />
        <meshStandardMaterial color="#505050" roughness={1} metalness={0} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, seamY + 0.002, WALL_Z + 0.3]}>
        <planeGeometry args={[18, 0.8]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.12} depthWrite={false} />
      </mesh>
    </group>
  )
}
