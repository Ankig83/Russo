import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import {
  REF_FLOOR_COLOR,
  REF_FLOOR_DEPTH,
  REF_FLOOR_FRONT,
  REF_FLOOR_WIDTH,
  REF_FLOOR_Y,
  REF_ROOM_HALF_W,
  REF_WALL_COLOR,
  REF_WALL_H,
  REF_WALL_W,
  REF_WALL_Z,
  LOGO_WALL_WIDTH_FRAC,
  LOGO_WALL_Z_OFFSET,
  getRefLogoWallCenterX,
  getRefLogoWallCenterY,
} from '../../constants/scene'
import { createCementTextures, disposeCementTextures } from '../../utils/createCementTextures'

const TILE = 3.2
const WALL_NORMAL = new THREE.Vector2(0.85, 0.85)
const FLOOR_NORMAL = new THREE.Vector2(0.55, 0.55)

const LOGO_WALL = `${import.meta.env.BASE_URL}assets/brand/logo-wall-black.png?v=2`
const LOGO_ASPECT = 1889 / 750

function applyRepeat(textures, repeatX, repeatY) {
  textures.map.repeat.set(repeatX, repeatY)
  textures.normalMap.repeat.set(repeatX, repeatY)
  textures.roughnessMap.repeat.set(repeatX, repeatY)
}

/** Матовая штукатурка — стена */
function WallCementMaterial({ textures }) {
  return (
    <meshStandardMaterial
      map={textures.map}
      normalMap={textures.normalMap}
      roughnessMap={textures.roughnessMap}
      roughness={0.96}
      metalness={0}
      envMapIntensity={0.15}
      normalScale={WALL_NORMAL}
      side={THREE.DoubleSide}
    />
  )
}

/** Полированный/закрытый бетон — пол с мягкими бликами */
function FloorCementMaterial({ textures }) {
  return (
    <meshPhysicalMaterial
      map={textures.map}
      normalMap={textures.normalMap}
      roughnessMap={textures.roughnessMap}
      roughness={0.42}
      metalness={0}
      envMapIntensity={1.35}
      clearcoat={0.22}
      clearcoatRoughness={0.35}
      normalScale={FLOOR_NORMAL}
      side={THREE.DoubleSide}
    />
  )
}

/** Чёрный логотип РУССО на задней стене (PNG — SVG через TextureLoader не отображается) */
function BackWallLogo({ logoCenterX, logoCenterY, logoW, logoH, logoZ }) {
  const meshRef = useRef(null)
  const texture = useLoader(THREE.TextureLoader, LOGO_WALL)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8

  useLayoutEffect(() => {
    meshRef.current?.position.set(logoCenterX, logoCenterY, logoZ)
  }, [logoCenterX, logoCenterY, logoZ])

  return (
    <mesh ref={meshRef} renderOrder={20}>
      <planeGeometry args={[logoW, logoH]} />
      <meshBasicMaterial
        map={texture}
        transparent
        alphaTest={0.02}
        toneMapped={false}
        depthWrite={false}
        depthTest
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-4}
        polygonOffsetUnits={-4}
      />
    </mesh>
  )
}

/**
 * Студия по референсу: матовая цементная стена + полированный бетонный пол.
 */
export default function ReferenceBackdrop({ floorY = REF_FLOOR_Y }) {
  const wallY = floorY + REF_WALL_H / 2
  const floorCenterZ = (REF_FLOOR_FRONT + REF_WALL_Z) / 2
  const sideWallCenterZ = floorCenterZ

  const floorTex = useMemo(() => {
    const tex = createCementTextures(REF_FLOOR_COLOR, { variant: 'floor', contrast: 1.08 })
    applyRepeat(tex, REF_FLOOR_WIDTH / TILE, REF_FLOOR_DEPTH / TILE)
    return tex
  }, [])
  const wallTex = useMemo(() => {
    const tex = createCementTextures(REF_WALL_COLOR, { variant: 'wall', contrast: 1.02 })
    applyRepeat(tex, REF_WALL_W / TILE, REF_WALL_H / TILE)
    return tex
  }, [])
  const sideWallTex = useMemo(() => {
    const tex = createCementTextures(REF_WALL_COLOR, { variant: 'wall', contrast: 1.02 })
    applyRepeat(tex, REF_FLOOR_DEPTH / TILE, REF_WALL_H / TILE)
    return tex
  }, [])

  useEffect(() => () => {
    disposeCementTextures(floorTex)
    disposeCementTextures(wallTex)
    disposeCementTextures(sideWallTex)
  }, [floorTex, wallTex, sideWallTex])

  const logoCenterY = getRefLogoWallCenterY(floorY)
  const logoW = REF_WALL_W * LOGO_WALL_WIDTH_FRAC
  const logoH = logoW / LOGO_ASPECT
  const logoZ = REF_WALL_Z + LOGO_WALL_Z_OFFSET
  const logoCenterX = getRefLogoWallCenterX(logoW)

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY, floorCenterZ]} receiveShadow>
        <planeGeometry args={[REF_FLOOR_WIDTH, REF_FLOOR_DEPTH]} />
        <FloorCementMaterial textures={floorTex} />
      </mesh>

      <mesh position={[0, wallY, REF_WALL_Z]} receiveShadow>
        <planeGeometry args={[REF_WALL_W, REF_WALL_H]} />
        <WallCementMaterial textures={wallTex} />
      </mesh>

      <mesh rotation={[0, Math.PI / 2, 0]} position={[-REF_ROOM_HALF_W, wallY, sideWallCenterZ]} receiveShadow>
        <planeGeometry args={[REF_FLOOR_DEPTH, REF_WALL_H]} />
        <WallCementMaterial textures={sideWallTex} />
      </mesh>

      <mesh rotation={[0, -Math.PI / 2, 0]} position={[REF_ROOM_HALF_W, wallY, sideWallCenterZ]} receiveShadow>
        <planeGeometry args={[REF_FLOOR_DEPTH, REF_WALL_H]} />
        <WallCementMaterial textures={sideWallTex} />
      </mesh>

      <mesh position={[0, floorY + 0.002, REF_WALL_Z + 0.02]}>
        <boxGeometry args={[REF_WALL_W, 0.004, 0.02]} />
        <meshStandardMaterial color="#8a8e91" roughness={1} metalness={0} />
      </mesh>

      <Suspense fallback={null}>
        <BackWallLogo
          key={`${logoCenterX.toFixed(3)}-${logoCenterY.toFixed(3)}-${logoW.toFixed(3)}`}
          logoCenterX={logoCenterX}
          logoCenterY={logoCenterY}
          logoW={logoW}
          logoH={logoH}
          logoZ={logoZ}
        />
      </Suspense>
    </group>
  )
}
