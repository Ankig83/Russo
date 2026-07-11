import { useMemo } from 'react'
import * as THREE from 'three'
import { CORPUS_PBR } from '../../constants/studioScene'

/**
 * Кованый X-каркас ножек из профиля 40×20 мм (заменяет leg_front_o / leg_beck_o в GLB).
 * Контур «бабочки» — якорные точки сняты с GLB (leg_*_o), траектория — кубические дуги.
 */

/** Якоря из GLB (shkaf-local → сцена): верх широкий, низ ±0.415, X в центре. */
const L = -0.425
const R = 0.415
const B = 0.028
const T = 0.512
const FOOT_L = -0.415
const FOOT_R = 0.415
const Z_FRONT = 0.179
const Z_BACK = -0.262

const PROFILE_W = 0.04
const PROFILE_D = 0.02
const FORGED_SEGMENTS = 34

/** Выпуклость верхних/нижних плеч и прогиб нижней дуги (подогнано под GLB). */
const UPPER_AMP = 0.055
const LOWER_AMP = 0.135
const BOTTOM_SAG = 0.038

const UP = new THREE.Vector3(0, 1, 0)

function cubicPoint(a, c1, c2, b, t) {
  const inv = 1 - t
  const inv2 = inv * inv
  const inv3 = inv2 * inv
  const t2 = t * t
  const t3 = t2 * t
  return [
    inv3 * a[0] + 3 * inv2 * t * c1[0] + 3 * inv * t2 * c2[0] + t3 * b[0],
    inv3 * a[1] + 3 * inv2 * t * c1[1] + 3 * inv * t2 * c2[1] + t3 * b[1],
    inv3 * a[2] + 3 * inv2 * t * c1[2] + 3 * inv * t2 * c2[2] + t3 * b[2],
  ]
}

function segmentTransform(a, b) {
  const va = new THREE.Vector3(...a)
  const vb = new THREE.Vector3(...b)
  const dir = new THREE.Vector3().subVectors(vb, va)
  const length = dir.length()
  const mid = new THREE.Vector3().addVectors(va, vb).multiplyScalar(0.5)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    UP,
    dir.clone().normalize(),
  )
  return { position: mid.toArray(), quaternion, length }
}

function addForgedCurve(segments, start, c1, c2, end, count = FORGED_SEGMENTS) {
  let prev = start
  for (let i = 1; i <= count; i += 1) {
    const next = cubicPoint(start, c1, c2, end, i / count)
    segments.push(segmentTransform(prev, next))
    prev = next
  }
}

function addLine(segments, a, b) {
  segments.push(segmentTransform(a, b))
}

function crossCenter(z, midY) {
  return [0, midY, z]
}

function outwardBulge(start, end, midY, amplitude) {
  const mx = (start[0] + end[0]) / 2
  const my = (start[1] + end[1]) / 2
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const len = Math.hypot(dx, dy) || 1
  const px = -dy / len
  const py = dx / len
  const vx = mx
  const vy = my - midY
  const sign = px * vx + py * vy >= 0 ? 1 : -1
  return [sign * px * amplitude, sign * py * amplitude]
}

function forgedArmControls(start, end, z, midY, amplitude, bulge) {
  const [bx, by] = outwardBulge(start, end, midY, amplitude)
  const sign = bulge === 'inward' ? -1 : 1
  const ox = bx * sign
  const oy = by * sign
  const c1 = [
    start[0] + (end[0] - start[0]) * 0.33 + ox * 1.05,
    start[1] + (end[1] - start[1]) * 0.33 + oy * 1.05,
    z,
  ]
  const c2 = [
    start[0] + (end[0] - start[0]) * 0.67 + ox * 1.05,
    start[1] + (end[1] - start[1]) * 0.67 + oy * 1.05,
    z,
  ]
  return [c1, c2]
}

function addBowArm(segments, start, end, z, midY, amplitude, bulge) {
  const [c1, c2] = forgedArmControls(start, end, z, midY, amplitude, bulge)
  addForgedCurve(segments, start, c1, c2, end)
}

function addBottomArc(segments, bottomLeft, bottomRight, z, sag) {
  const c1 = [
    bottomLeft[0] + (bottomRight[0] - bottomLeft[0]) * 0.33,
    bottomLeft[1] - sag,
    z,
  ]
  const c2 = [
    bottomLeft[0] + (bottomRight[0] - bottomLeft[0]) * 0.67,
    bottomRight[1] - sag,
    z,
  ]
  addForgedCurve(segments, bottomLeft, c1, c2, bottomRight)
}

/**
 * Замкнутая «бабочка»: TL→TR → TR→центр→BL → дуга по полу → BR→центр→TL.
 * Одно пересечение X в центре (y = midY).
 */
function buildBowTieFrame(z) {
  const segments = []
  const bottomLeft = [FOOT_L, B, z]
  const bottomRight = [FOOT_R, B, z]
  const topLeft = [L, T, z]
  const topRight = [R, T, z]
  const midY = (B + T) / 2
  const center = crossCenter(z, midY)

  addLine(segments, topLeft, topRight)

  addBowArm(segments, topRight, center, z, midY, UPPER_AMP, 'inward')
  addBowArm(segments, center, bottomLeft, z, midY, LOWER_AMP, 'outward')

  addBottomArc(segments, bottomLeft, bottomRight, z, BOTTOM_SAG)

  addBowArm(segments, bottomRight, center, z, midY, LOWER_AMP, 'outward')
  addBowArm(segments, center, topLeft, z, midY, UPPER_AMP, 'inward')

  return segments
}

function buildSegments() {
  const front = buildBowTieFrame(Z_FRONT)
  const back = buildBowTieFrame(Z_BACK)
  const depthConnectors = []

  addLine(depthConnectors, [FOOT_L, B, Z_FRONT], [FOOT_L, B, Z_BACK])
  addLine(depthConnectors, [FOOT_R, B, Z_FRONT], [FOOT_R, B, Z_BACK])
  addLine(depthConnectors, [L, T, Z_FRONT], [L, T, Z_BACK])
  addLine(depthConnectors, [R, T, Z_FRONT], [R, T, Z_BACK])

  return [...front, ...back, ...depthConnectors]
}

export default function CabinetLegs() {
  const material = useMemo(() => {
    const p = CORPUS_PBR.plainDarkCopper
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(p.color),
      metalness: 0.88,
      roughness: 0.32,
      envMapIntensity: 0.9,
      clearcoat: 0.08,
      clearcoatRoughness: 0.55,
    })
  }, [])

  const segments = useMemo(buildSegments, [])

  return (
    <group raycast={() => null}>
      {segments.map(({ position, quaternion, length }, i) => (
        <mesh
          key={i}
          position={position}
          quaternion={quaternion}
          material={material}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[PROFILE_W, length * 1.02, PROFILE_D]} />
        </mesh>
      ))}
    </group>
  )
}
