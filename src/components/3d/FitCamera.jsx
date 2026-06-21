import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { getCabinetBounds } from '../../utils/cabinetBounds'
import {
  CAMERA_AIM_HEIGHT_RATIO,
  CAMERA_DISTANCE_FACTOR,
  CAMERA_HEIGHT_FACTOR,
  ORBIT_MAX_DISTANCE_FACTOR,
  ORBIT_MIN_DISTANCE_FACTOR,
} from '../../constants/scene'
import { SHKAF_ROOT_NAME } from '../../constants/shkafNodes'

/** Подгоняет камеру и OrbitControls — фронтальный вид чуть сверху */
export default function FitCamera({ object, sceneScale = 1, placementY = 0 }) {
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
      const worldMaxDim = maxDim * sceneScale
      const distance = worldMaxDim * CAMERA_DISTANCE_FACTOR
      const heightLift = worldMaxDim * CAMERA_HEIGHT_FACTOR

      // Точка наведения чуть выше геом. центра — не «с пола»
      const aimLocalY = box.min.y + size.y * CAMERA_AIM_HEIGHT_RATIO
      const target = new THREE.Vector3(
        center.x * sceneScale,
        (placementY + aimLocalY) * sceneScale,
        center.z * sceneScale,
      )

      camera.position.set(target.x, target.y + heightLift, target.z + distance)
      camera.near = 0.05
      camera.far = 200
      camera.updateProjectionMatrix()
      camera.lookAt(target)

      if (controls) {
        controls.target.copy(target)
        controls.minDistance = worldMaxDim * ORBIT_MIN_DISTANCE_FACTOR
        controls.maxDistance = worldMaxDim * ORBIT_MAX_DISTANCE_FACTOR
        controls.update()
      }

      fittedFor.current = object.uuid
      return true
    }

    if (apply()) return

    const retry = setTimeout(apply, 200)
    return () => clearTimeout(retry)
  }, [object, camera, controls, sceneScale, placementY])

  return null
}

export { SHKAF_ROOT_NAME as FLOOR_NODE_NAME }
