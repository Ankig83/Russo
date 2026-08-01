import { useEffect, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'

const assetBase = import.meta.env.BASE_URL || '/'
const VERSION = 1

export const ROOM_CONCRETE_URLS = [
  `${assetBase}textures/room-concrete/concrete_baseColor.webp?v=${VERSION}`,
  `${assetBase}textures/room-concrete/concrete_roughness.webp?v=${VERSION}`,
  `${assetBase}textures/room-concrete/concrete_normal.webp?v=${VERSION}`,
]

export function useRoomConcreteTextures(repeat = [3, 3]) {
  const loaded = useLoader(THREE.TextureLoader, ROOM_CONCRETE_URLS)
  const [repeatX, repeatY] = repeat

  const maps = useMemo(() => {
    const [map, roughnessMap, normalMap] = loaded.map((texture) => texture.clone())
    map.colorSpace = THREE.SRGBColorSpace
    roughnessMap.colorSpace = THREE.NoColorSpace
    normalMap.colorSpace = THREE.NoColorSpace

    for (const texture of [map, roughnessMap, normalMap]) {
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(repeatX, repeatY)
      texture.anisotropy = 8
      texture.needsUpdate = true
    }

    return { map, roughnessMap, normalMap }
  }, [loaded, repeatX, repeatY])

  useEffect(
    () => () => Object.values(maps).forEach((texture) => texture.dispose()),
    [maps],
  )

  return maps
}
