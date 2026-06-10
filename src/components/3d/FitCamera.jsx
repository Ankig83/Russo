import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { getCabinetBounds, FLOOR_NODE_NAME } from '../../utils/cabinetBounds'

const CAMERA_DISTANCE_FACTOR = 2.2

/** Подгоняет камеру и OrbitControls под шкаф (без пола) */
export default function FitCamera({ object, exclude = [FLOOR_NODE_NAME] }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const fittedFor = useRef(null)

  useEffect(() => {
    if (!object) return

    // Пересчёт при новом экспорте GLB (новый uuid клона)
    if (fittedFor.current === object.uuid) return

    const apply = () => {
      const { box, center, size } = getCabinetBounds(object, exclude)
      if (box.isEmpty()) return false

      const maxDim = Math.max(size.x, size.y, size.z)
      const distance = maxDim * CAMERA_DISTANCE_FACTOR

      camera.position.set(
        center.x + distance * 0.2,
        center.y + size.y * 0.35,
        center.z + distance,
      )
      camera.near = 0.05
      camera.far = 200
      camera.updateProjectionMatrix()
      camera.lookAt(center)

      if (controls) {
        controls.target.copy(center)
        controls.minDistance = maxDim * 0.6
        controls.maxDistance = maxDim * 5
        controls.update()
      }

      fittedFor.current = object.uuid
      return true
    }

    if (apply()) return

    const retry = setTimeout(apply, 200)
    return () => clearTimeout(retry)
  }, [object, camera, controls, exclude])

  return null
}

export { FLOOR_NODE_NAME }
