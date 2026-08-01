import * as THREE from 'three'
import {
  CLOSED_DOORS_NODE_NAME,
  LEATHER_HARDWARE,
  LEATHER_RIM_FIT,
  findDoorPivotNode,
} from '../constants/shkafNodes'
import { LIGHT_LAYERS } from '../constants/studioScene'

const RIM_L = 'кож_обод_L'
const RIM_R = 'кож_обод_R'
const HANDLE_RIVET_PREFIX = 'leather_handle_rivet'
const RIM_RIVETS_NAME = 'leather_rim_rivets'

const rivetMaterial = new THREE.MeshPhysicalMaterial({
  name: 'M_Leather_Hardware',
  color: LEATHER_HARDWARE.color,
  metalness: LEATHER_HARDWARE.metalness,
  roughness: LEATHER_HARDWARE.roughness,
  envMapIntensity: LEATHER_HARDWARE.env,
  clearcoat: 0,
})

/** Тонкая выпуклая заклёпка — общая геометрия для instancing. */
const rivetGeometry = new THREE.SphereGeometry(1, 12, 8)

/** Placeholder до applyLeatherAccentMaterials (PBR leather-mix). */
function tuneLeatherRimMaterial(mat) {
  if (!mat?.isMeshStandardMaterial && !mat?.isMeshPhysicalMaterial) return
  mat.color.set('#2a1810')
  mat.map = null
  mat.metalness = 0
  mat.roughness = 0.9
  mat.envMapIntensity = 0.12
  if ('clearcoat' in mat) mat.clearcoat = 0
  if ('sheen' in mat) mat.sheen = 0
  mat.side = THREE.DoubleSide
  mat.needsUpdate = true
}

/**
 * Сужает ремешок (5→3см), наращивает глубину и губу на торец у шва.
 * Исходник — полукольцо в XZ, тонкое по Y.
 */
function reshapeLeatherRimGeometry(geometry, fit = LEATHER_RIM_FIT) {
  const geo = geometry.clone()
  const pos = geo.attributes.position
  if (!pos) return geo

  let rMin = Infinity
  let rMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const r = Math.hypot(x, z)
    rMin = Math.min(rMin, r)
    rMax = Math.max(rMax, r)
    yMin = Math.min(yMin, y)
    yMax = Math.max(yMax, y)
  }

  const oldWidth = Math.max(rMax - rMin, 1e-6)
  const newWidth = oldWidth * (fit.widthScale ?? 0.6)
  const ySpan = Math.max(yMax - yMin, 1e-6)
  const edgeDepth = fit.edgeDepth ?? 0.02
  const seamOverlap = fit.seamOverlap ?? 0.016
  const seamZone = fit.seamZone ?? 0.11

  for (let i = 0; i < pos.count; i += 1) {
    let x = pos.getX(i)
    let y = pos.getY(i)
    let z = pos.getZ(i)
    const r = Math.hypot(x, z)
    const ang = Math.atan2(z, x)

    // радиус: наружный край на месте, внутренний ближе → уже ремешок
    const t = THREE.MathUtils.clamp((r - rMin) / oldWidth, 0, 1)
    const newR = rMax - newWidth + t * newWidth
    x = Math.cos(ang) * newR
    z = Math.sin(ang) * newR

    // глубина: было ~2мм наклейка → профиль с заходом на торец
    // (после Rx(-90) +Y исходника уходит в −Z двери)
    const yT = THREE.MathUtils.clamp((y - yMin) / ySpan, 0, 1)
    let seam = 0
    if (x < seamZone) {
      seam = 1 - x / seamZone
      // губа к центру шва — перекрыть торец берёсты
      x -= seamOverlap * seam
    }
    const depth = edgeDepth * (0.35 + 0.65 * seam)
    y = -0.001 + yT * depth

    pos.setXYZ(i, x, y, z)
  }

  pos.needsUpdate = true
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

function prepareRimMesh(mesh, name) {
  mesh.name = name
  mesh.geometry = reshapeLeatherRimGeometry(mesh.geometry)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.layers.enable(LIGHT_LAYERS.doors)
  mesh.layers.enable(LIGHT_LAYERS.accent)
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  mats.forEach((mat) => {
    if (!mat) return
    mat.name = 'Leather Dark Brown'
    tuneLeatherRimMaterial(mat)
  })
  addRimRivets(mesh)
}

/** Ряд небольших заклёпок по центру кожаного ремешка. */
function addRimRivets(rim) {
  if (rim.getObjectByName(RIM_RIVETS_NAME)) return
  const count = LEATHER_HARDWARE.rimRivetsPerHalf
  const radius = 0.5002 - LEATHER_HARDWARE.rimRivetRadialInset
  const size = LEATHER_HARDWARE.rimRivetRadius
  const instances = new THREE.InstancedMesh(rivetGeometry, rivetMaterial, count)
  instances.name = RIM_RIVETS_NAME
  instances.castShadow = true
  instances.receiveShadow = true
  instances.layers.enable(LIGHT_LAYERS.doors)

  const matrix = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const scale = new THREE.Vector3(size, size * 0.48, size)
  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5) / count
    const angle = -Math.PI / 2 + t * Math.PI
    position.set(
      Math.cos(angle) * radius,
      -0.006,
      Math.sin(angle) * radius,
    )
    matrix.compose(position, quaternion, scale)
    instances.setMatrixAt(i, matrix)
  }
  instances.instanceMatrix.needsUpdate = true
  rim.add(instances)
}

/** Две металлические крепёжные заклёпки на концах кожаной ручки. */
function addHandleRivets(root) {
  root.traverse((child) => {
    if (!child.isMesh || !/ручка/i.test(child.name || '')) return
    if (child.getObjectByName(`${HANDLE_RIVET_PREFIX}_0`)) return

    const geometry = child.geometry
    if (!geometry?.attributes?.position) return
    if (!geometry.boundingBox) geometry.computeBoundingBox()
    const box = geometry.boundingBox
    if (!box) return

    const inset = LEATHER_HARDWARE.handleRivetEndInset
    const radius = LEATHER_HARDWARE.handleRivetRadius
    const y = (box.min.y + box.max.y) * 0.5
    const z = box.max.z + 0.007
    const endX = [box.min.x + inset, box.max.x - inset]

    endX.forEach((x, index) => {
      const rivet = new THREE.Mesh(rivetGeometry, rivetMaterial)
      rivet.name = `${HANDLE_RIVET_PREFIX}_${index}`
      rivet.position.set(x, y, z)
      rivet.scale.set(radius, radius, radius * 0.5)
      rivet.castShadow = true
      rivet.receiveShadow = true
      rivet.layers.enable(LIGHT_LAYERS.doors)
      child.add(rivet)
    })
  })
}

function getBerestaRadius(beresta) {
  if (!beresta?.isMesh) return 0.484
  const geo = beresta.geometry
  if (!geo.boundingBox) geo.computeBoundingBox()
  const box = geo.boundingBox
  if (!box) return 0.484
  const sx = Math.abs(beresta.scale.x || 1)
  const sy = Math.abs(beresta.scale.y || 1)
  return 0.5 * Math.max(box.max.x - box.min.x, box.max.y - box.min.y) * Math.max(sx, sy)
}

/**
 * Полукольцо XZ → плоскость двери XY; L зеркалим.
 * outerPad держит наружный край чуть снаружи берёсты.
 */
function placeRimOnBeresta(rim, beresta, side, fit = LEATHER_RIM_FIT) {
  if (!rim || !beresta) return
  rim.position.copy(beresta.position)
  rim.rotation.set(-Math.PI / 2, 0, 0)

  // исходный rMax ≈ 0.500; масштабируем под радиус берёсты
  const berestaR = getBerestaRadius(beresta)
  const srcRMax = 0.5002
  const s = (berestaR * (fit.outerPad ?? 1.015)) / srcRMax
  rim.scale.set(side === 'left' ? -s : s, s, s)
  rim.position.z += fit.frontZ ?? 0.003
}

function takeRimFromScene(scene, name) {
  const src = scene.getObjectByName(name)
  if (!src?.isMesh) return null
  const rim = src.clone(true)
  prepareRimMesh(rim, name)
  return rim
}

/**
 * Вешает кожаный ободок на door_left / door_right (видно при открытых дверях)
 * и копию на closed_doors_facade (закрытый AI-фасад).
 */
export function attachLeatherRims(model, rimScene) {
  if (!model || !rimScene) return 0
  let attached = 0

  ;([
    { side: 'left', rimName: RIM_L, berestaName: 'Beresta_L' },
    { side: 'right', rimName: RIM_R, berestaName: 'Beresta_R' },
  ]).forEach(({ side, rimName, berestaName }) => {
    const door = findDoorPivotNode(model, side)
    if (!door) return
    if (door.getObjectByName(rimName)) return

    const rim = takeRimFromScene(rimScene, rimName)
    if (!rim) return
    const beresta = door.getObjectByName(berestaName)
    placeRimOnBeresta(rim, beresta, side)
    door.add(rim)
    attached += 1
  })

  const facade = model.getObjectByName(CLOSED_DOORS_NODE_NAME)
  if (facade) {
    ;([
      { side: 'left', rimName: RIM_L, berestaName: 'Beresta_L' },
      { side: 'right', rimName: RIM_R, berestaName: 'Beresta_R' },
    ]).forEach(({ side, rimName, berestaName }) => {
      const facadeRimName = `${rimName}_facade`
      if (facade.getObjectByName(facadeRimName)) return
      const rim = takeRimFromScene(rimScene, rimName)
      if (!rim) return
      rim.name = facadeRimName
      const beresta = facade.getObjectByName(berestaName)
      placeRimOnBeresta(rim, beresta, side)
      facade.add(rim)
      attached += 1
    })
  }

  addHandleRivets(model)
  return attached
}
