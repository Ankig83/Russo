/**
 * Create door_left / door_right hinge pivots for cinematic shkaf.glb
 * and reparent door meshes (frames, skins, bins, trim) under them.
 *
 * Hinges = outer edges (same convention as scripts/split_doors_glb.mjs).
 *
 * Usage: node scripts/setup_door_pivots.mjs [in.glb] [out.glb]
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as THREE from 'three'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { dequantize, meshopt } from '@gltf-transform/functions'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const LEFT_MESHES = [
  'Cube', // inner frame
  'node_0.007', // outer skin Material.006
  'node_0.012', // bin Material.010
  'node_0.013', // bin Material.010
  'node_0.010', // trim Material.008
]
const RIGHT_MESHES = [
  'Cube.001',
  'node_0.006',
  'node_0.003',
  'node_0.004',
  'node_0.011',
]

const inPath = path.resolve(process.argv[2] || path.join(ROOT, 'public/models/shkaf.glb'))
const outPath = path.resolve(process.argv[3] || inPath)

await MeshoptDecoder.ready
await MeshoptEncoder.ready

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  })

console.log('Read', inPath)
const document = await io.read(inPath)
await document.transform(dequantize())

const root = document.getRoot()

function findNode(name) {
  return root.listNodes().find((n) => n.getName() === name) || null
}

function localMatrix(node) {
  if (!node || typeof node.getTranslation !== 'function') {
    return new THREE.Matrix4().identity()
  }
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...(node.getTranslation() || [0, 0, 0])),
    new THREE.Quaternion(...(node.getRotation() || [0, 0, 0, 1])),
    new THREE.Vector3(...(node.getScale() || [1, 1, 1])),
  )
}

function worldMatrix(node) {
  if (!node || node.propertyType === 'Scene') return new THREE.Matrix4().identity()
  const chain = []
  let n = node
  while (n && typeof n.getParentNode === 'function') {
    chain.unshift(n)
    const p = n.getParentNode()
    if (p) {
      n = p
      continue
    }
    break
  }
  const m = new THREE.Matrix4().identity()
  for (const c of chain) m.multiply(localMatrix(c))
  return m
}

function setNodeTRS(node, matrix) {
  const pos = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const scl = new THREE.Vector3()
  matrix.decompose(pos, quat, scl)
  node.setTranslation([pos.x, pos.y, pos.z])
  node.setRotation([quat.x, quat.y, quat.z, quat.w])
  node.setScale([scl.x, scl.y, scl.z])
}

function detachFromParent(node) {
  const oldParent = node.getParentNode()
  if (oldParent) {
    oldParent.removeChild(node)
    return
  }
  for (const scene of root.listScenes()) {
    if (scene.listChildren().includes(node)) scene.removeChild(node)
  }
}

function reparentKeepWorld(node, newParent) {
  if (!node || !newParent || node.getParentNode() === newParent) return
  const world = worldMatrix(node)
  const parentWorld = worldMatrix(newParent)
  const local = parentWorld.clone().invert().multiply(world)
  detachFromParent(node)
  newParent.addChild(node)
  setNodeTRS(node, local)
}

function worldAABB(node) {
  const mesh = node.getMesh()
  if (!mesh) return null
  const mw = worldMatrix(node)
  const min = new THREE.Vector3(Infinity, Infinity, Infinity)
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
  const v = new THREE.Vector3()
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')
    if (!pos) continue
    const a = pos.getArray()
    for (let i = 0; i < pos.getCount(); i += 1) {
      v.set(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]).applyMatrix4(mw)
      min.min(v)
      max.max(v)
    }
  }
  return { min, max }
}

function unionAABB(nodes) {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity)
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
  for (const n of nodes) {
    const bb = worldAABB(n)
    if (!bb) continue
    min.min(bb.min)
    max.max(bb.max)
  }
  if (!Number.isFinite(min.x)) return null
  return { min, max }
}

// Remove stale pivots if re-running
for (const name of ['door_left', 'door_right']) {
  const existing = findNode(name)
  if (!existing) continue
  // Move children back to shkaf before dispose
  const shkafTmp = findNode('shkaf')
  for (const child of [...existing.listChildren()]) {
    if (shkafTmp) reparentKeepWorld(child, shkafTmp)
  }
  detachFromParent(existing)
  existing.dispose()
  console.log('removed old', name)
}

const shkaf = findNode('shkaf')
if (!shkaf) throw new Error('shkaf root missing')

const leftNodes = LEFT_MESHES.map(findNode).filter(Boolean)
const rightNodes = RIGHT_MESHES.map(findNode).filter(Boolean)
console.log(
  'left',
  leftNodes.map((n) => n.getName()),
  'right',
  rightNodes.map((n) => n.getName()),
)
if (leftNodes.length < 2 || rightNodes.length < 2) {
  throw new Error('too few door meshes found')
}

const leftBB = unionAABB(leftNodes)
const rightBB = unionAABB(rightNodes)
if (!leftBB || !rightBB) throw new Error('AABB failed')

const midYL = (leftBB.min.y + leftBB.max.y) * 0.5
const midZL = (leftBB.min.z + leftBB.max.z) * 0.5
const midYR = (rightBB.min.y + rightBB.max.y) * 0.5
const midZR = (rightBB.min.z + rightBB.max.z) * 0.5

// Внутренние петли у шва (как door_left/right Empty в Blender ~±0.54).
// Внешний край + текущие DOOR_*_OPEN_ANGLE давали распах ~180° не в ту сторону.
const hingeLWorld = new THREE.Vector3(leftBB.max.x, midYL, midZL)
const hingeRWorld = new THREE.Vector3(rightBB.min.x, midYR, midZR)
const shkafWorldInv = worldMatrix(shkaf).clone().invert()
const hingeL = hingeLWorld.clone().applyMatrix4(shkafWorldInv)
const hingeR = hingeRWorld.clone().applyMatrix4(shkafWorldInv)

console.log('hingeL local', [...hingeL].map((v) => +v.toFixed(4)))
console.log('hingeR local', [...hingeR].map((v) => +v.toFixed(4)))
console.log('leftBB X', leftBB.min.x.toFixed(3), leftBB.max.x.toFixed(3))
console.log('rightBB X', rightBB.min.x.toFixed(3), rightBB.max.x.toFixed(3))

const doorLeft = document.createNode('door_left')
// v46SplitDoors: setClosedDoorsLook не прячет рабочие двери при отсутствии facade
doorLeft.setExtras({ cinematicDoorPivot: true, v46SplitDoors: true })
doorLeft.setTranslation([hingeL.x, hingeL.y, hingeL.z])
doorLeft.setRotation([0, 0, 0, 1])
doorLeft.setScale([1, 1, 1])
shkaf.addChild(doorLeft)

const doorRight = document.createNode('door_right')
doorRight.setExtras({ cinematicDoorPivot: true, v46SplitDoors: true })
doorRight.setTranslation([hingeR.x, hingeR.y, hingeR.z])
doorRight.setRotation([0, 0, 0, 1])
doorRight.setScale([1, 1, 1])
shkaf.addChild(doorRight)

for (const n of leftNodes) {
  reparentKeepWorld(n, doorLeft)
  console.log('→ door_left', n.getName())
}
for (const n of rightNodes) {
  reparentKeepWorld(n, doorRight)
  console.log('→ door_right', n.getName())
}

await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
await io.write(outPath, document)
console.log('DONE', outPath, fs.statSync(outPath).size)
