import { useMemo } from 'react'
import * as THREE from 'three'
import { CORPUS_PBR } from '../../constants/studioScene'

/**
 * Процедурный перекрещённый Х-каркас ножек (заменяет кривую GLB-геометрию
 * leg_front_o / leg_beck_o). Координаты — в локальном пространстве модели shkaf,
 * измерены из GLB. Рендерится соседним к <primitive object={model}> в той же
 * группе, поэтому совпадает со шкафом по позиции.
 */

// Габариты из измерений GLB (леги: X ±0.4, Y 0.024→0.516, front z≈0.18, back z≈-0.26)
const L = -0.4
const R = 0.39
const B = 0.028
const T = 0.512
const Z_FRONT = 0.179
const Z_BACK = -0.262

const STRUT_RADIUS = 0.026
const RUNNER_RADIUS = 0.022

// Х-крест на каждой раме + нижние продольные соединители (жёсткость, не «хлипко»)
const STRUTS = [
  // передняя рама
  { a: [L, B, Z_FRONT], b: [R, T, Z_FRONT], r: STRUT_RADIUS },
  { a: [R, B, Z_FRONT], b: [L, T, Z_FRONT], r: STRUT_RADIUS },
  // задняя рама
  { a: [L, B, Z_BACK], b: [R, T, Z_BACK], r: STRUT_RADIUS },
  { a: [R, B, Z_BACK], b: [L, T, Z_BACK], r: STRUT_RADIUS },
  // нижние полозья спереди-назад (левый/правый)
  { a: [L, B, Z_FRONT], b: [L, B, Z_BACK], r: RUNNER_RADIUS },
  { a: [R, B, Z_FRONT], b: [R, B, Z_BACK], r: RUNNER_RADIUS },
]

const UP = new THREE.Vector3(0, 1, 0)

function strutTransform(a, b) {
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

export default function CabinetLegs() {
  const material = useMemo(() => {
    const p = CORPUS_PBR.plainDarkCopper
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(p.color),
      metalness: 1.0,
      roughness: 0.36,
      envMapIntensity: 1.35,
    })
  }, [])

  const struts = useMemo(
    () => STRUTS.map((s) => ({ ...strutTransform(s.a, s.b), r: s.r })),
    [],
  )

  return (
    <group raycast={() => null}>
      {struts.map(({ position, quaternion, length, r }, i) => (
        <mesh
          key={i}
          position={position}
          quaternion={quaternion}
          material={material}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[r, r, length, 20]} />
        </mesh>
      ))}
      {/* сферы-стыки в центре крестов, чтобы скрыть пересечение труб */}
      {[Z_FRONT, Z_BACK].map((z, i) => (
        <mesh
          key={`joint-${i}`}
          position={[(L + R) / 2, (B + T) / 2, z]}
          material={material}
          castShadow
        >
          <sphereGeometry args={[STRUT_RADIUS * 1.5, 16, 16]} />
        </mesh>
      ))}
    </group>
  )
}
