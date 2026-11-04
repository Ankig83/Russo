import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import { MeshReflectorMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { CABINET_MIRROR } from '../../constants/cabinetStudio'
import { useIsMobile } from '../../hooks/useMediaQuery'

const _pos = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _scl = new THREE.Vector3()
const _euler = new THREE.Euler()
const _extraQ = new THREE.Quaternion()

function applyPoseTweak(position, quaternion, scale, name) {
  const tweak = CABINET_MIRROR.pose?.[name]
  if (!tweak) return
  _euler.set(tweak.rotateX || 0, tweak.rotateY || 0, 0, 'XYZ')
  _extraQ.setFromEuler(_euler)
  quaternion.multiply(_extraQ)
  if (tweak.offset) {
    position.x += tweak.offset[0]
    position.y += tweak.offset[1]
    position.z += tweak.offset[2]
  }
  if (tweak.scale) {
    scale.x *= tweak.scale[0]
    scale.y *= tweak.scale[1]
    scale.z *= tweak.scale[2]
  }
}

function syncMirrorToSource(source, mesh) {
  source.updateWorldMatrix(true, false)
  source.getWorldPosition(_pos)
  source.getWorldQuaternion(_quat)
  source.getWorldScale(_scl)
  applyPoseTweak(_pos, _quat, _scl, source.name)
  mesh.position.copy(_pos)
  mesh.quaternion.copy(_quat)
  mesh.scale.copy(_scl)
}

function findMirrorMeshes(root) {
  const meshes = []
  for (const name of CABINET_MIRROR.names) {
    const node = root.getObjectByName(name)
    if (!node) continue
    if (node.isMesh) meshes.push(node)
    else {
      node.traverse((child) => {
        if (child.isMesh) meshes.push(child)
      })
    }
  }
  return meshes
}

/**
 * Виньетка амальгамы: светлее в центре, темнее к краям.
 * Без точек: UV лицевой грани зеркала растянуты, точки тянутся в полосы «под шпон».
 */
function createAgedSilverTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const half = size / 2
  const grad = ctx.createRadialGradient(half, half * 0.85, size * 0.04, half, half, size * 0.6)
  grad.addColorStop(0, '#ffffff')
  grad.addColorStop(0.55, '#9a9a9a')
  grad.addColorStop(1, '#1a1a1a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function DoorMirror({ source, glowMap }) {
  const isMobile = useIsMobile()
  const resolution = isMobile ? CABINET_MIRROR.mobileResolution : CABINET_MIRROR.desktopResolution
  const { scene } = useThree()
  const meshRef = useRef(null)

  useLayoutEffect(() => {
    source.visible = false
    if (meshRef.current) syncMirrorToSource(source, meshRef.current)
    return () => {
      source.visible = true
    }
  }, [source])

  useFrame(() => {
    const mesh = meshRef.current
    if (mesh) syncMirrorToSource(source, mesh)
  }, -1)

  if (!scene) return null

  return createPortal(
    <mesh
      ref={meshRef}
      name={`mirror_${source.name}`}
      geometry={source.geometry}
      renderOrder={2}
    >
      <MeshReflectorMaterial
        resolution={resolution}
        mirror={CABINET_MIRROR.mirror}
        mixStrength={CABINET_MIRROR.mixStrength}
        mixBlur={CABINET_MIRROR.mixBlur}
        blur={CABINET_MIRROR.blur}
        roughness={CABINET_MIRROR.roughness}
        metalness={CABINET_MIRROR.metalness}
        color={CABINET_MIRROR.color}
        envMapIntensity={CABINET_MIRROR.envMapIntensity}
        reflectorOffset={CABINET_MIRROR.reflectorOffset}
        emissive={CABINET_MIRROR.glow.color}
        emissiveMap={glowMap}
        emissiveIntensity={CABINET_MIRROR.glow.intensity}
        side={THREE.DoubleSide}
      />
    </mesh>,
    scene,
  )
}

/** Честное плоское зеркало: портал в scene, world-матрица inner каждый кадр. */
export default function DoorMirrors({ root }) {
  const sources = useMemo(() => findMirrorMeshes(root), [root])
  const glowMap = useMemo(() => createAgedSilverTexture(), [])
  useEffect(() => () => glowMap.dispose(), [glowMap])
  return sources.map((src) => <DoorMirror key={`${src.uuid}-follow`} source={src} glowMap={glowMap} />)
}
