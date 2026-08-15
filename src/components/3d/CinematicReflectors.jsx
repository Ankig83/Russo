import { Suspense, useLayoutEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import { LIGHT_LAYERS } from '../../constants/studioScene'

const assetBase = import.meta.env.BASE_URL || '/'
export const CINEMATIC_REFLECTORS_PATH = `${assetBase}models/cinematic-reflectors.glb?v=2`

/**
 * REFLECTOR_* из CINEMATIC_STUDIO.
 * Как в Blender: visible_camera=false, visible_diffuse/glossy/shadow=true —
 * камера слой reflector не рендерит, меши не удаляем (остаются в графе сцены).
 */
function ReflectorsInner() {
  const { scene } = useGLTF(CINEMATIC_REFLECTORS_PATH)

  useLayoutEffect(() => {
    scene.traverse((child) => {
      child.raycast = () => null
      child.layers.disableAll()
      child.layers.enable(LIGHT_LAYERS.reflector)
      if (!child.isMesh) return
      child.castShadow = false
      child.receiveShadow = true
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach((mat) => {
        if (!mat) return
        // Доп. страховка, если слой камеры когда-то включат
        mat.colorWrite = false
        mat.depthWrite = false
        mat.envMapIntensity = 0.05
        mat.needsUpdate = true
      })
    })
  }, [scene])

  return <primitive object={scene} />
}

export default function CinematicReflectors() {
  return (
    <Suspense fallback={null}>
      <ReflectorsInner />
    </Suspense>
  )
}

useGLTF.preload(CINEMATIC_REFLECTORS_PATH)
