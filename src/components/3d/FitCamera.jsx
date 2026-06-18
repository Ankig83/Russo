import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { getCabinetBounds } from '../../utils/cabinetBounds'
import { SHKAF_ROOT_NAME } from '../../constants/shkafNodes'

const CAMERA_DISTANCE_FACTOR = 2.4

/** Подгоняет камеру и OrbitControls под узел shkaf */
export default function FitCamera({ object }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const fittedFor = useRef(null)

  useEffect(() => {
    if (!object) return
    if (fittedFor.current === object.uuid) return

    const apply = () => {
      const { box, center, size } = getCabinetBounds(object, SHKAF_ROOT_NAME)
      if (box.isEmpty()) return false

      const maxDim = Math.max(size.x, size.y, size.z)
      const distance = maxDim * CAMERA_DISTANCE_FACTOR

      camera.position.set(
        center.x + distance * 0.15,
        center.y + size.y * 0.2,
        center.z + distance * 0.85,
      )
      camera.near = 0.05
      camera.far = 200
      camera.updateProjectionMatrix()
      camera.lookAt(center)

      if (controls) {
        controls.target.copy(center)
        controls.minDistance = maxDim * 0.5
        controls.maxDistance = maxDim * 4
        controls.update()
      }

      fittedFor.current = object.uuid
      return true
    }

    if (apply()) return

    const retry = setTimeout(apply, 200)
    return () => clearTimeout(retry)
  }, [object, camera, controls])

  return null
}

export { SHKAF_ROOT_NAME as FLOOR_NODE_NAME }
