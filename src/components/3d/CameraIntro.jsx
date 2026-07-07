import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { STUDIO, CAMERA_INTRO } from '../../constants/studioScene'

/** Плавный въезд камеры на старте — как «представление» героя в CHILE20 */
export default function CameraIntro() {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const done = useRef(false)

  useEffect(() => {
    if (!CAMERA_INTRO.enabled || done.current) return
    if (!camera || !controls) return
    done.current = true

    const [tx, ty, tz] = STUDIO.camera.position
    const [fx, fy, fz] = CAMERA_INTRO.from
    const [ax, ay, az] = STUDIO.camera.target

    camera.position.set(fx, fy, fz)
    controls.enabled = false
    controls.target.set(ax, ay, az)
    controls.update()

    const tween = gsap.to(camera.position, {
      x: tx,
      y: ty,
      z: tz,
      duration: CAMERA_INTRO.duration,
      delay: CAMERA_INTRO.delay,
      ease: CAMERA_INTRO.ease,
      onUpdate: () => {
        camera.lookAt(ax, ay, az)
        controls.update()
      },
      onComplete: () => {
        controls.enabled = true
      },
    })

    return () => tween.kill()
  }, [camera, controls])

  return null
}
