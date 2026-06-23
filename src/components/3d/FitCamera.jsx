import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { getCabinetBounds, SHKAF_ROOT_NAME } from '../../utils/cabinetBounds'
import {
  CAMERA_AIM_HEIGHT_RATIO,
  CAMERA_AIM_Y_LIFT,
  CAMERA_FIT_MARGIN,
  CAMERA_HEIGHT_FACTOR,
  ORBIT_AZIMUTH_HALF,
  ORBIT_MIN_DISTANCE_FACTOR,
  ORBIT_MIN_DISTANCE_RATIO,
  ORBIT_MIN_POLAR_FLOOR,
  ORBIT_POLAR_HALF,
  getMaxCameraY,
} from '../../constants/scene'
import { applyStudioOrbitLimits } from '../../utils/studioOrbitLimits'

const _aimLocal = new THREE.Vector3()
const _offset = new THREE.Vector3()
const _spherical = new THREE.Spherical()

/** Силуэт шкафа на экране при фронтальном виде (камера смотрит вдоль −Z) */
function getScreenSpan(root, localSize) {
  const m = root.matrixWorld.elements
  const { x: sx, y: sy, z: sz } = localSize
  return {
    width: Math.abs(m[0]) * sx + Math.abs(m[4]) * sy + Math.abs(m[8]) * sz,
    height: Math.abs(m[1]) * sx + Math.abs(m[5]) * sy + Math.abs(m[9]) * sz,
  }
}

function getFrontFitDistance(camera, screenW, screenH, margin) {
  const vTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  const hTan = Math.tan(vTan * camera.aspect)
  return Math.max(screenH / (2 * vTan), screenW / (2 * hTan)) * margin
}

/** Подгоняет камеру и OrbitControls — фронтальный вид, плотный кадр */
export default function FitCamera({ object, fitToken = 0 }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const fittedFor = useRef(null)

  useEffect(() => {
    if (!object) return

    const fitKey = `${object.uuid}:${fitToken}`
    if (fittedFor.current === fitKey) return

    let cancelled = false

    const apply = () => {
      if (cancelled) return false

      const { box, size, center, root } = getCabinetBounds(object, SHKAF_ROOT_NAME)
      if (box.isEmpty() || !root) return false

      root.updateWorldMatrix(true, true)

      const { width: screenW, height: screenH } = getScreenSpan(root, size)
      const worldMaxDim = Math.max(size.x, size.y, size.z)

      _aimLocal.set(center.x, box.min.y + size.y * CAMERA_AIM_HEIGHT_RATIO, center.z)
      const target = _aimLocal.clone().applyMatrix4(root.matrixWorld)
      target.y += CAMERA_AIM_Y_LIFT

      const maxCameraY = getMaxCameraY()
      const cameraY = Math.min(target.y + screenH * CAMERA_HEIGHT_FACTOR, maxCameraY)
      const distance = getFrontFitDistance(camera, screenW, screenH, CAMERA_FIT_MARGIN)

      camera.position.set(target.x, cameraY, target.z + distance)
      camera.near = 0.05
      camera.far = 200
      camera.updateProjectionMatrix()
      camera.lookAt(target)

      if (controls) {
        controls.target.copy(target)
        controls.maxDistance = distance
        controls.minDistance = Math.max(
          worldMaxDim * ORBIT_MIN_DISTANCE_FACTOR,
          distance * ORBIT_MIN_DISTANCE_RATIO,
        )

        _offset.copy(camera.position).sub(target)
        _spherical.setFromVector3(_offset)

        controls.minAzimuthAngle = _spherical.theta - ORBIT_AZIMUTH_HALF
        controls.maxAzimuthAngle = _spherical.theta + ORBIT_AZIMUTH_HALF
        controls.minPolarAngle = Math.max(
          ORBIT_MIN_POLAR_FLOOR,
          _spherical.phi - ORBIT_POLAR_HALF,
        )
        controls.maxPolarAngle = Math.min(Math.PI - 0.08, _spherical.phi + ORBIT_POLAR_HALF)

        applyStudioOrbitLimits(camera, controls)
        controls.update()
      }

      fittedFor.current = fitKey
      return true
    }

    const raf = requestAnimationFrame(() => {
      if (apply()) return
      setTimeout(apply, 150)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [object, camera, controls, fitToken])

  return null
}

export { SHKAF_ROOT_NAME as FLOOR_NODE_NAME }
