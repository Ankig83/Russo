/**
 * Вшивает GLB-медальон в public/models/shkaf.glb на перекрестье передних ∞.
 *
 * Usage:
 *   node scripts/inject_leg_medallion.mjs [medallion.glb] [shkaf.glb]
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { copyToDocument, prune, unpartition } from '@gltf-transform/functions'
import { MeshoptDecoder } from 'meshoptimizer'
import * as THREE from 'three'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const medalPath = path.resolve(
  process.argv[2]
    || 'C:/Users/KiGi/Downloads/4f049c48-df95-4fcd-bc87-be5fbcac090a..glb',
)
const shkafPath = path.resolve(
  process.argv[3] || path.join(root, 'public/models/shkaf.glb'),
)
const archivePath = path.join(root, 'public/models/leg-medallion.glb')

/** LOCK — как LEG_MEDALLION.radius / forwardBias */
const TARGET_RADIUS = 0.125
const FORWARD_BIAS = 0.024

async function load(filePath) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  try {
    await MeshoptDecoder.ready
    io.registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
  } catch {
    /* optional */
  }
  return { io, doc: await io.read(filePath) }
}

function parentMap(doc) {
  const parent = new Map()
  for (const n of doc.getRoot().listNodes()) {
    for (const c of n.listChildren()) parent.set(c, n)
  }
  for (const s of doc.getRoot().listScenes()) {
    for (const c of s.listChildren()) parent.set(c, s)
  }
  return parent
}

function worldMatrix(node, parent) {
  const mats = []
  let cur = node
  while (cur && cur.propertyType === 'Node') {
    const t = cur.getTranslation() || [0, 0, 0]
    const r = cur.getRotation() || [0, 0, 0, 1]
    const s = cur.getScale() || [1, 1, 1]
    mats.unshift(
      new THREE.Matrix4().compose(
        new THREE.Vector3(...t),
        new THREE.Quaternion(...r),
        new THREE.Vector3(...s),
      ),
    )
    cur = parent.get(cur)
  }
  const w = new THREE.Matrix4()
  for (const m of mats) w.multiply(m)
  return w
}

function meshWorldBox(node, parent) {
  const mesh = node.getMesh()
  if (!mesh) return null
  const w = worldMatrix(node, parent)
  const box = new THREE.Box3()
  const v = new THREE.Vector3()
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')
    if (!pos) continue
    const arr = pos.getArray()
    for (let i = 0; i < arr.length; i += 3) {
      v.set(arr[i], arr[i + 1], arr[i + 2]).applyMatrix4(w)
      box.expandByPoint(v)
    }
  }
  return box.isEmpty() ? null : box
}

function localBBox(mesh) {
  const box = new THREE.Box3()
  const v = new THREE.Vector3()
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')
    if (!pos) continue
    const arr = pos.getArray()
    for (let i = 0; i < arr.length; i += 3) {
      v.set(arr[i], arr[i + 1], arr[i + 2])
      box.expandByPoint(v)
    }
  }
  return box
}

function findNode(doc, name) {
  return doc.getRoot().listNodes().find((n) => n.getName() === name) || null
}

function detachDispose(doc, node, parent) {
  const p = parent.get(node)
  if (p) p.removeChild(node)
  const stack = [node]
  const all = []
  while (stack.length) {
    const n = stack.pop()
    all.push(n)
    stack.push(...n.listChildren())
  }
  all.reverse().forEach((n) => n.dispose())
}

function toAscii(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isRibbon(name) {
  return /^BezierCurve(\.\d+)?$/i.test(toAscii(name))
    || /^BezierCurve\d+/i.test(toAscii(name))
}

console.log('medallion', medalPath)
console.log('shkaf    ', shkafPath)

fs.copyFileSync(medalPath, archivePath)
console.log('archived ', archivePath)

const { io, doc: shkaf } = await load(shkafPath)
const { doc: medalDoc } = await load(medalPath)

const parents = parentMap(shkaf)
const shkafRoot = findNode(shkaf, 'shkaf')
if (!shkafRoot) throw new Error('shkaf node missing')

// убрать старые procedural/orphan медальоны
for (const n of [...shkaf.getRoot().listNodes()]) {
  if (/^leg_cross_medallion/i.test(n.getName() || '')) {
    console.log('remove stale', n.getName())
    detachDispose(shkaf, n, parents)
  }
}

const ribbonBoxes = []
for (const n of shkaf.getRoot().listNodes()) {
  if (!isRibbon(n.getName())) continue
  const box = meshWorldBox(n, parents)
  if (!box) continue
  const c = box.getCenter(new THREE.Vector3())
  ribbonBoxes.push({ name: n.getName(), box, c })
}
if (!ribbonBoxes.length) throw new Error('no ribbon legs')

ribbonBoxes.sort((a, b) => b.c.z - a.c.z)
const front = ribbonBoxes.slice(0, Math.min(2, ribbonBoxes.length))
const frontBox = new THREE.Box3()
front.forEach((b) => frontBox.union(b.box))
const cross = frontBox.getCenter(new THREE.Vector3())
const target = new THREE.Vector3(cross.x, cross.y, frontBox.max.z + FORWARD_BIAS)
console.log(
  'front ribbons',
  front.map((b) => b.name).join(', '),
  'target',
  target.toArray().map((x) => +x.toFixed(4)),
)

const srcNode = medalDoc.getRoot().listNodes().find((n) => n.getMesh())
if (!srcNode) throw new Error('medallion mesh node missing')
const srcMesh = srcNode.getMesh()
const srcBox = localBBox(srcMesh)
const srcSize = srcBox.getSize(new THREE.Vector3())
const srcCenter = srcBox.getCenter(new THREE.Vector3())
const diameter = Math.max(srcSize.x, srcSize.z)
const scale = (TARGET_RADIUS * 2) / diameter
console.log('src size', srcSize.toArray().map((x) => +x.toFixed(4)), 'scale', +scale.toFixed(5))

const map = copyToDocument(shkaf, medalDoc, [srcNode, srcMesh])
const dstNode = map.get(srcNode)
const dstMesh = map.get(srcMesh)

// материал — чтобы pipeline не принял за латунь Material.001
for (const prim of dstMesh.listPrimitives()) {
  const mat = prim.getMaterial()
  if (mat) mat.setName('M_Leg_Medallion_GLB')
}
dstNode.setName('leg_cross_medallion')
dstMesh.setName('leg_cross_medallion')

// Геометрия лежит в XZ (тонкая по Y) → Rx(-90), чтобы лицо смотрело в +Z
const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
const sVec = new THREE.Vector3(scale, scale, scale)
const scaledCenter = srcCenter.clone().multiply(sVec)
const rotatedCenter = scaledCenter.clone().applyQuaternion(q)

// world = T * R * S * v  →  T = target - R*(S*center)
// но parent = shkaf → нужен local
const shkafWorld = worldMatrix(shkafRoot, parents)
const shkafInv = shkafWorld.clone().invert()

const worldPos = target.clone().sub(rotatedCenter)
const worldMat = new THREE.Matrix4().compose(worldPos, q, sVec)
const localMat = new THREE.Matrix4().multiplyMatrices(shkafInv, worldMat)
const lp = new THREE.Vector3()
const lq = new THREE.Quaternion()
const ls = new THREE.Vector3()
localMat.decompose(lp, lq, ls)

dstNode.setTranslation(lp.toArray())
dstNode.setRotation([lq.x, lq.y, lq.z, lq.w])
dstNode.setScale(ls.toArray())

shkafRoot.addChild(dstNode)

// задняя пара — зеркало
const back = ribbonBoxes.slice(-Math.min(2, ribbonBoxes.length))
const backBox = new THREE.Box3()
back.forEach((b) => backBox.union(b.box))
const backCross = backBox.getCenter(new THREE.Vector3())
const backTarget = new THREE.Vector3(
  backCross.x,
  backCross.y,
  backBox.min.z - FORWARD_BIAS,
)
const qBack = q.clone().multiply(
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI),
)
const rotatedCenterBack = scaledCenter.clone().applyQuaternion(qBack)
const worldPosBack = backTarget.clone().sub(rotatedCenterBack)
const worldMatBack = new THREE.Matrix4().compose(worldPosBack, qBack, sVec)
const localMatBack = new THREE.Matrix4().multiplyMatrices(shkafInv, worldMatBack)
const lpB = new THREE.Vector3()
const lqB = new THREE.Quaternion()
const lsB = new THREE.Vector3()
localMatBack.decompose(lpB, lqB, lsB)

// тот же mesh — второй инстанс на задней паре
const dstBack = shkaf.createNode('leg_cross_medallion_back')
dstBack.setMesh(dstMesh)
dstBack.setTranslation(lpB.toArray())
dstBack.setRotation([lqB.x, lqB.y, lqB.z, lqB.w])
dstBack.setScale(lsB.toArray())
shkafRoot.addChild(dstBack)

console.log('front local', lp.toArray().map((x) => +x.toFixed(4)))
console.log('back  local', lpB.toArray().map((x) => +x.toFixed(4)))

await shkaf.transform(prune(), unpartition())
await io.write(shkafPath, shkaf)
const mb = (fs.statSync(shkafPath).size / 1024 / 1024).toFixed(2)
console.log('wrote', shkafPath, `(${mb} MB)`)
