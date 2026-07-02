import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { STUDIO } from '../../constants/studioScene'

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  varying vec2 vUv;
  uniform vec3 topColor;
  uniform vec3 midColor;
  uniform vec3 bottomColor;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    float y = vUv.y;
    // мягче переходы, чуть смещаем mid вверх — меньше «полосы» на изгибе
    vec3 col = y < 0.42
      ? mix(bottomColor, midColor, smoothstep(0.0, 0.42, y))
      : mix(midColor, topColor, smoothstep(0.42, 1.0, y));

    // лёгкий noise скрывает геометрический стык и banding градиента
    float n = hash(vUv * 180.0) - 0.5;
    col += n * 0.012;

    gl_FragColor = vec4(col, 1.0);
  }
`

/** Циклорама: пол → изгиб → стена, градиент в шейдере. Тень на пол — ContactShadows. */
export default function StudioBackdrop() {
  const { width, curveHeight, curveRadius, floorDepth, topColor, midColor, bottomColor } =
    STUDIO.backdrop

  const geometry = useMemo(() => {
    const segsFloor = 32
    const segsCurve = 48
    const segsWall = 16

    const points = []
    for (let i = 0; i <= segsFloor; i++) {
      const t = i / segsFloor
      points.push(new THREE.Vector2(-floorDepth + t * floorDepth, 0))
    }
    for (let i = 1; i <= segsCurve; i++) {
      const a = (i / segsCurve) * (Math.PI / 2)
      points.push(
        new THREE.Vector2(curveRadius * Math.sin(a), curveRadius * (1 - Math.cos(a))),
      )
    }
    if (curveHeight > curveRadius) {
      for (let i = 1; i <= segsWall; i++) {
        const t = i / segsWall
        points.push(
          new THREE.Vector2(curveRadius, curveRadius + t * (curveHeight - curveRadius)),
        )
      }
    }

    const shape = points.map((p) => new THREE.Vector3(0, p.y, -p.x))
    const geo = new THREE.BufferGeometry()
    const vertices = []
    const uvs = []
    const halfW = width / 2
    const uvScale = curveHeight

    for (let i = 0; i < shape.length - 1; i++) {
      const a = shape[i]
      const b = shape[i + 1]
      const va = THREE.MathUtils.clamp(a.y / uvScale, 0, 1)
      const vb = THREE.MathUtils.clamp(b.y / uvScale, 0, 1)

      vertices.push(-halfW, a.y, a.z, halfW, a.y, a.z, -halfW, b.y, b.z)
      vertices.push(halfW, a.y, a.z, halfW, b.y, b.z, -halfW, b.y, b.z)
      uvs.push(0, va, 1, va, 0, vb, 1, va, 1, vb, 0, vb)
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geo.computeVertexNormals()
    return geo
  }, [width, curveHeight, curveRadius, floorDepth])

  const uniforms = useRef({
    topColor: { value: new THREE.Color(topColor) },
    midColor: { value: new THREE.Color(midColor) },
    bottomColor: { value: new THREE.Color(bottomColor) },
  })

  return (
    <mesh geometry={geometry} position={[0, 0, 1.5]} raycast={() => null}>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms.current}
        side={THREE.FrontSide}
      />
    </mesh>
  )
}
