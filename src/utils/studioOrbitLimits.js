import {
  STUDIO_FLOOR_Y,
  getMaxCameraY,
  getMaxOrbitTargetY,
} from '../constants/scene'

/** Ограничивает камеру и OrbitControls внутри «коробки» студии по высоте */
export function applyStudioOrbitLimits(camera, controls) {
  if (!controls) return

  const maxCameraY = getMaxCameraY()
  const maxTargetY = getMaxOrbitTargetY()
  const minTargetY = STUDIO_FLOOR_Y + 0.4

  if (controls.target.y > maxTargetY) {
    const dy = controls.target.y - maxTargetY
    controls.target.y = maxTargetY
    camera.position.y -= dy
  } else if (controls.target.y < minTargetY) {
    const dy = controls.target.y - minTargetY
    controls.target.y = minTargetY
    camera.position.y -= dy
  }

  const maxLift = Math.max(0.2, maxCameraY - controls.target.y)
  const offset = camera.position.clone().sub(controls.target)

  if (camera.position.y > maxCameraY) {
    const horiz = Math.sqrt(offset.x * offset.x + offset.z * offset.z) || 0.001
    const horizScale = Math.min(1, maxLift / Math.max(offset.y, 0.001))
    offset.y = maxLift
    offset.x = (offset.x / horiz) * horiz * horizScale
    offset.z = (offset.z / horiz) * horiz * horizScale
    camera.position.copy(controls.target).add(offset)
  }

  const lift = camera.position.y - controls.target.y
  if (lift > maxLift) {
    offset.y = maxLift
    camera.position.copy(controls.target).add(offset)
  }

  const newDist = camera.position.distanceTo(controls.target)
  if (newDist > controls.maxDistance) {
    offset.normalize().multiplyScalar(controls.maxDistance)
    camera.position.copy(controls.target).add(offset)
  }
}
