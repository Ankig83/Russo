import { useEffect } from 'react'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'

const _box = new THREE.Box3()
const _size = new THREE.Vector3()
const _corner = new THREE.Vector3()

/**
 * Металлическая табличка на фасаде ящика.
 * Mesh добавляется как child ноды — двигается вместе с ящиком.
 */
export default function DrawerPlaque({ node, imageUrl, visible }) {
  const texture = useLoader(THREE.TextureLoader, imageUrl)

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
  }, [texture])

  useEffect(() => {
    if (!node || !visible) return

    node.updateWorldMatrix(true, true)
    _box.makeEmpty()
    node.traverse((child) => {
      if (child.isMesh) _box.expandByObject(child)
    })
    if (_box.isEmpty()) return

    _box.getSize(_size)

    const plaqueW = _size.x * 0.36
    const plaqueH = plaqueW * 0.38

    // Правый верхний угол фасада
    _corner.set(
      _box.max.x - _size.x * 0.1,
      _box.max.y - _size.y * 0.1,
      _box.max.z + 0.004,
    )
    const localPos = node.worldToLocal(_corner.clone())

    const geometry = new THREE.PlaneGeometry(plaqueW, plaqueH)
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false,
      toneMapped: false,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.copy(localPos)
    mesh.renderOrder = 10
    node.add(mesh)

    return () => {
      node.remove(mesh)
      geometry.dispose()
      material.dispose()
    }
  }, [node, visible, texture])

  return null
}
