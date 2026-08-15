import { useEffect, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'

const assetBase = import.meta.env.BASE_URL || '/'
const VERSION = 1

/** Текстуры из Blender CINEMATIC_STUDIO (Mossy Dark Rock / Dark Mottled Metal) */
export const CINEMATIC_FLOOR_URLS = [
  `${assetBase}textures/cinematic-studio/floor_color.png?v=${VERSION}`,
  `${assetBase}textures/cinematic-studio/floor_roughness.png?v=${VERSION}`,
  `${assetBase}textures/cinematic-studio/floor_normal.png?v=${VERSION}`,
]

export const CINEMATIC_CYCLORAMA_URLS = [
  `${assetBase}textures/cinematic-studio/cyclorama_color.png?v=${VERSION}`,
  `${assetBase}textures/cinematic-studio/cyclorama_roughness.png?v=${VERSION}`,
  `${assetBase}textures/cinematic-studio/cyclorama_metalness.png?v=${VERSION}`,
]

function prepMaps(loaded, { srgbFirst = true, repeat = [1, 1] } = {}) {
  const maps = loaded.map((texture) => texture.clone())
  const [repeatX, repeatY] = repeat
  maps.forEach((texture, i) => {
    texture.colorSpace = srgbFirst && i === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeatX, repeatY)
    texture.anisotropy = 8
    texture.needsUpdate = true
  })
  return maps
}

export function useCinematicFloorTextures(repeat = [2.2, 2.2]) {
  const loaded = useLoader(THREE.TextureLoader, CINEMATIC_FLOOR_URLS)
  const [repeatX, repeatY] = repeat

  const maps = useMemo(() => {
    const [map, roughnessMap, normalMap] = prepMaps(loaded, { repeat: [repeatX, repeatY] })
    return { map, roughnessMap, normalMap }
  }, [loaded, repeatX, repeatY])

  useEffect(
    () => () => Object.values(maps).forEach((texture) => texture.dispose()),
    [maps],
  )

  return maps
}

export function useCinematicCycloramaTextures(repeat = [2, 1.2]) {
  const loaded = useLoader(THREE.TextureLoader, CINEMATIC_CYCLORAMA_URLS)
  const [repeatX, repeatY] = repeat

  const maps = useMemo(() => {
    const [map, roughnessMap, metalnessMap] = prepMaps(loaded, { repeat: [repeatX, repeatY] })
    return { map, roughnessMap, metalnessMap }
  }, [loaded, repeatX, repeatY])

  useEffect(
    () => () => Object.values(maps).forEach((texture) => texture.dispose()),
    [maps],
  )

  return maps
}
