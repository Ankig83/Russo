import { useLayoutEffect } from 'react'
import { useThree, useLoader } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import * as THREE from 'three'
import {
  HERO,
  STUDIO,
  USE_HERO_LOOK,
  getStudioEnvIntensity,
} from '../../constants/studioScene'

/**
 * LDR equirect через TextureLoader.
 * Нельзя кормить .webp/.jpg в <Environment files> — drei берёт GainMapLoader/HDRJPGLoader
 * и Suspense зависает на обычной панораме.
 */
function LdrEquirectEnvironment({ url, intensity, background }) {
  const texture = useLoader(THREE.TextureLoader, url)
  const scene = useThree((s) => s.scene)

  useLayoutEffect(() => {
    texture.mapping = THREE.EquirectangularReflectionMapping
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true

    const prevEnv = scene.environment
    const prevBg = scene.background
    const prevIntensity = scene.environmentIntensity

    scene.environment = texture
    scene.environmentIntensity = intensity
    if (background) scene.background = texture

    return () => {
      scene.environment = prevEnv
      scene.background = prevBg
      scene.environmentIntensity = prevIntensity
    }
  }, [scene, texture, intensity, background])

  return null
}

/** IBL — cyclorama / void остаются своими, если background=false */
export default function StudioEnvironment() {
  const intensity = getStudioEnvIntensity()
  const heroEnv = USE_HERO_LOOK ? HERO.env : null
  const background = Boolean(heroEnv?.background ?? STUDIO.env?.background)

  if (heroEnv?.useLdr && heroEnv?.ldrUrl) {
    return (
      <LdrEquirectEnvironment
        url={heroEnv.ldrUrl}
        intensity={intensity}
        background={background}
      />
    )
  }

  const url = heroEnv?.url ?? STUDIO.env.url
  const preset = heroEnv?.preset ?? STUDIO.env.preset

  if (preset) {
    return <Environment preset={preset} environmentIntensity={intensity} background={background} />
  }

  return <Environment files={url} environmentIntensity={intensity} background={background} />
}
