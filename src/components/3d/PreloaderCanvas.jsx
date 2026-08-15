import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'

const LOGO_SRC = `${import.meta.env.BASE_URL}assets/russo-mark.svg`

const DEPTH = 5
const INITIAL_FRACTION = 0.42
const DOCK_FRACTION = 0.07
const DOCK_PAD_X = 0.09
const DOCK_PAD_Y = 0.08
/** Докинг в угол — медленнее, «кино» */
const DOCK_MS = 1.15
/**
 * Минимальная длительность скана/проявления из темноты.
 * Даже если ассеты уже в кэше — луч не пролетает за долю секунды.
 */
const REVEAL_MS = 1500
/** Насколько плавно догоняем target (меньше = медленнее / тяжелее) */
const REVEAL_DAMP = 1.55

function visibleSize(camera, depth) {
  const fov = THREE.MathUtils.degToRad(camera.fov)
  const height = 2 * Math.tan(fov / 2) * depth
  return { width: height * camera.aspect, height }
}

function scaleForFraction(camera, depth, fraction, rawMaxDim) {
  if (rawMaxDim <= 0) return 1
  const { width, height } = visibleSize(camera, depth)
  return (Math.min(width, height) * fraction) / rawMaxDim
}

function safeInset(side) {
  if (typeof window === 'undefined') return 0
  const n = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(`--safe-${side}`),
  )
  return Number.isFinite(n) ? n : 0
}

/**
 * Объёмный монограмм (russo-mark.svg) под тёмным стеклом.
 * Progress гоняет скан-луч и приоткрывает стекло из темноты.
 * По isLoaded — докинг в правый верхний угол.
 */
function LogoScene({ progress, isLoaded, isMobile, onDocked }) {
  const data = useLoader(SVGLoader, LOGO_SRC)
  const { camera, size } = useThree()
  const groupRef = useRef(null)
  const glassMatRef = useRef(null)
  const scanRef = useRef(null)
  const fillRef = useRef(null)
  const smooth = useRef(0)
  const revealStartedAt = useRef(0)
  const docked = useRef(false)
  const onDockedRef = useRef(onDocked)
  onDockedRef.current = onDocked

  useLayoutEffect(() => {
    if (!revealStartedAt.current) revealStartedAt.current = performance.now()
  }, [])

  const { object, material, maxDim } = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: '#d4d0c8',
      metalness: 0.95,
      roughness: 0.14,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      reflectivity: 0.95,
      envMapIntensity: 0.35,
    })
    const extrude = {
      depth: 22,
      bevelEnabled: true,
      bevelThickness: 4,
      bevelSize: 3,
      bevelSegments: 4,
      curveSegments: 16,
    }
    const group = new THREE.Group()
    data.paths.forEach((path) => {
      SVGLoader.createShapes(path).forEach((shape) => {
        const geo = new THREE.ExtrudeGeometry(shape, extrude)
        group.add(new THREE.Mesh(geo, mat))
      })
    })
    const box = new THREE.Box3().setFromObject(group)
    const sz = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(sz)
    box.getCenter(center)
    group.children.forEach((m) => m.geometry.translate(-center.x, -center.y, -center.z))
    return { object: group, material: mat, maxDim: Math.max(sz.x, sz.y) }
  }, [data])

  useLayoutEffect(() => {
    const group = groupRef.current
    if (!group || docked.current) return undefined
    const s = scaleForFraction(camera, DEPTH, INITIAL_FRACTION, maxDim)
    group.position.set(0, 0, 0)
    group.scale.set(s, -s, s)
    return () => {
      object.traverse((c) => {
        if (c.isMesh) c.geometry.dispose()
      })
      material.dispose()
    }
  }, [camera, object, material, maxDim, size.width, size.height])

  useFrame((_, delta) => {
    if (docked.current) return
    const group = groupRef.current
    if (!group) return

    group.rotation.y = Math.sin(performance.now() * 0.00028) * 0.1

    // Скан не быстрее REVEAL_MS и не обгоняет реальный progress
    const loadT = THREE.MathUtils.clamp(progress / 100, 0, 1)
    const timeT = THREE.MathUtils.clamp(
      (performance.now() - revealStartedAt.current) / REVEAL_MS,
      0,
      1,
    )
    const target = Math.min(loadT, timeT)
    smooth.current = THREE.MathUtils.damp(smooth.current, target, REVEAL_DAMP, delta)
    const t = smooth.current

    if (scanRef.current) {
      const span = maxDim * Math.abs(group.scale.x) * 1.15
      scanRef.current.position.y = span * 0.55 - t * span * 1.15
      scanRef.current.intensity = 4 + t * 14
    }
    if (fillRef.current) {
      fillRef.current.intensity = 0.15 + t * 1.6
    }
    if (glassMatRef.current) {
      glassMatRef.current.opacity = THREE.MathUtils.lerp(0.82, 0.08, t)
    }
    material.color.setRGB(
      THREE.MathUtils.lerp(0.08, 0.83, t),
      THREE.MathUtils.lerp(0.08, 0.81, t),
      THREE.MathUtils.lerp(0.07, 0.78, t),
    )
    material.metalness = THREE.MathUtils.lerp(0.4, 0.95, t)
    material.roughness = THREE.MathUtils.lerp(0.45, 0.14, t)
  })

  // Докинг: deps без onDocked — иначе каждый progress-рендер убивает GSAP через cleanup
  useEffect(() => {
    if (!isLoaded || docked.current || !groupRef.current) return undefined
    docked.current = true

    const group = groupRef.current
    const { width, height } = visibleSize(camera, DEPTH)
    const padX = isMobile ? DOCK_PAD_X + 0.02 : DOCK_PAD_X
    const padY = isMobile ? DOCK_PAD_Y + 0.02 : DOCK_PAD_Y
    const safeX = safeInset('right') / Math.max(1, size.width)
    const safeY = safeInset('top') / Math.max(1, size.height)
    const targetX = width / 2 - width * (padX + safeX * 0.5)
    const targetY = height / 2 - height * (padY + safeY * 0.5)
    const targetS = scaleForFraction(camera, DEPTH, DOCK_FRACTION, maxDim)

    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      onDockedRef.current?.()
    }

    const tl = gsap.timeline({ onComplete: finish })

    if (glassMatRef.current) {
      tl.to(glassMatRef.current, { opacity: 0, duration: 0.35, ease: 'power2.in' }, 0)
    }
    if (scanRef.current) {
      tl.to(scanRef.current, { intensity: 0, duration: 0.4, ease: 'power2.in' }, 0)
    }

    tl.to(group.position, {
      x: targetX,
      y: targetY,
      z: 0,
      duration: DOCK_MS,
      ease: 'power3.inOut',
    }, 0)

    tl.to(group.scale, {
      x: targetS,
      y: -targetS,
      z: targetS,
      duration: DOCK_MS,
      ease: 'power3.inOut',
    }, 0)

    tl.to(material, {
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in',
      onStart: () => { material.transparent = true },
    }, DOCK_MS - 0.3)

    // Страховка: если GSAP сдох — всё равно отпустить сцену
    const failsafe = setTimeout(finish, (DOCK_MS + 0.6) * 1000)

    return () => {
      clearTimeout(failsafe)
      // Не kill() на unmount после старта — finish уже/ещё вызовется; kill только если эффект реально отменяют до isLoaded
      if (!finished) {
        tl.kill()
        finish()
      }
    }
  }, [isLoaded, camera, material, maxDim, isMobile, size.width, size.height])

  const glassW = maxDim * 1.35
  const glassH = maxDim * 1.35

  return (
    <group>
      <ambientLight intensity={0.04} />
      <pointLight
        ref={fillRef}
        position={[0.4, 0.5, 2.2]}
        intensity={0.2}
        color="#e8f0ff"
        distance={12}
        decay={2}
      />
      <spotLight
        ref={scanRef}
        position={[0, 2, 3.2]}
        angle={Math.PI / 7}
        penumbra={0.25}
        intensity={4}
        color="#e0f0ff"
        distance={14}
        decay={1.5}
        castShadow={false}
      />

      <group ref={groupRef}>
        <primitive object={object} />
        <mesh position={[0, 0, maxDim * 0.55]} raycast={() => null}>
          <planeGeometry args={[glassW, glassH]} />
          <meshPhysicalMaterial
            ref={glassMatRef}
            color="#050508"
            metalness={0.15}
            roughness={0.08}
            transmission={0.15}
            thickness={0.4}
            transparent
            opacity={0.82}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  )
}

/** Отдельный лёгкий Canvas только для прелоадера — не трогает сцену шкафа */
export default function PreloaderCanvas({ progress, isLoaded, isMobile, onDocked }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'default',
      }}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0)
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
      }}
    >
      <color attach="background" args={['#000000']} />
      <PerspectiveCamera makeDefault position={[0, 0, DEPTH]} fov={42} near={0.1} far={50} />
      <Suspense fallback={null}>
        <LogoScene
          progress={progress}
          isLoaded={isLoaded}
          isMobile={isMobile}
          onDocked={onDocked}
        />
      </Suspense>
    </Canvas>
  )
}
