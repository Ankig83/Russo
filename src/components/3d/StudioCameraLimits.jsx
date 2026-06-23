import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { applyStudioOrbitLimits } from '../../utils/studioOrbitLimits'

/**
 * Не даёт камере и обзору вылетать выше потолка студии.
 * Потолок: STUDIO_FLOOR_Y + STUDIO_WALL_H в scene.js
 */
export default function StudioCameraLimits() {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)

  useEffect(() => {
    if (!controls) return
    const onChange = () => applyStudioOrbitLimits(camera, controls)
    onChange()
    controls.addEventListener('change', onChange)
    return () => controls.removeEventListener('change', onChange)
  }, [camera, controls])

  useFrame(() => {
    if (controls) applyStudioOrbitLimits(camera, controls)
  })

  return null
}
