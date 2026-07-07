import { useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { HERO } from '../../constants/studioScene'

/**
 * Объёмный логотип РУССО: пути SVG → ExtrudeGeometry (реальный 3D-рельеф).
 * Ловит свет от лайтбокса и сцены — читается как выпуклый знак.
 */
export default function HeroLogo() {
  const { logo } = HERO
  const data = useLoader(SVGLoader, logo.src)

  const { object, scale } = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(logo.color),
      metalness: logo.metalness,
      roughness: logo.roughness,
      side: THREE.DoubleSide,
    })

    const extrude = {
      depth: logo.depth,
      bevelEnabled: true,
      bevelThickness: logo.depth * 0.18,
      bevelSize: logo.depth * 0.14,
      bevelSegments: 3,
      curveSegments: 12,
    }

    const inner = new THREE.Group()
    data.paths.forEach((path) => {
      SVGLoader.createShapes(path).forEach((shape) => {
        const geo = new THREE.ExtrudeGeometry(shape, extrude)
        const mesh = new THREE.Mesh(geo, material)
        mesh.castShadow = true
        mesh.receiveShadow = true
        inner.add(mesh)
      })
    })

    // Центрируем знак в начале координат
    const box = new THREE.Box3().setFromObject(inner)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    inner.children.forEach((mesh) =>
      mesh.geometry.translate(-center.x, -center.y, -center.z),
    )

    const worldScale = size.x > 0 ? logo.width / size.x : 1
    return { object: inner, scale: worldScale }
  }, [data, logo.color, logo.metalness, logo.roughness, logo.depth, logo.width])

  return (
    <group
      position={logo.position}
      // SVG ось Y вниз → отражаем по Y, чтобы знак был не перевёрнут
      scale={[scale, -scale, scale]}
      raycast={() => null}
    >
      <primitive object={object} />
    </group>
  )
}
