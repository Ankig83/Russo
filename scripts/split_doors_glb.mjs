/**
 * Оффлайн-bake: combined door → door_left / door_right (+ декор фасада).
 * gltf-transform на shkaf.source.glb (без meshopt-бага), потом meshopt+webp.
 *
 * Usage:
 *   node scripts/split_doors_glb.mjs [in.glb] [out.glb]
 *   node scripts/split_doors_glb.mjs --blender
 *     → public/models/shkaf-blender.glb (без meshopt/webp, для Blender 3.x)
 *
 * Default in:  public/models/shkaf.source.glb
 * Default out: public/models/shkaf.glb
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'
import * as THREE from 'three'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const COMBINED_NAMES = ['node_0001', 'node_0.001']
const FACADE_LEFT = [
  'Beresta_L',
  'кож_обод_L_facade',
  'ручка_левая',
  'ручка_левая_1',
]
const FACADE_RIGHT = [
  'Beresta_R',
  'кож_обод_R_facade',
  'ручка_правая',
  'ручка_правая_1',
]

const args = process.argv.slice(2).filter((a) => a !== '--blender')
const blenderOnly = process.argv.includes('--blender')
const inPath = path.resolve(
  args[0] || path.join(ROOT, 'public/models/shkaf.source.glb'),
)
const outPath = path.resolve(
  args[1]
    || (blenderOnly
      ? path.join(ROOT, 'public/models/shkaf-blender.glb')
      : path.join(ROOT, 'public/models/shkaf.glb')),
)

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

console.log('Read:', inPath)
const document = await io.read(inPath)
const root = document.getRoot()

function findNode(name) {
  return root.listNodes().find((n) => n.getName() === name) || null
}

/** Parent node или Scene (gltf: top-level nodes висят на Scene). */
function getParentContainer(node) {
  const p = node.getParentNode()
  if (p) return p
  for (const scene of root.listScenes()) {
    if (scene.listChildren().includes(node)) return scene
  }
  return null
}

function localMatrix(node) {
  // Scene — identity
  if (!node || typeof node.getTranslation !== 'function') {
    return new THREE.Matrix4().identity()
  }
  const t = node.getTranslation() || [0, 0, 0]
  const r = node.getRotation() || [0, 0, 0, 1]
  const s = node.getScale() || [1, 1, 1]
  return new THREE.Matrix4().compose(
    new THREE.Vector3(t[0], t[1], t[2]),
    new THREE.Quaternion(r[0], r[1], r[2], r[3]),
    new THREE.Vector3(s[0], s[1], s[2]),
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
    // top-level under Scene — Scene TRS = I
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

function splitPrimitive(prim, seamX) {
  const pos = prim.getAttribute('POSITION')
  if (!pos) return { left: null, right: null }
  const posArr = pos.getArray()
  const indices = prim.getIndices()
  const idxArr = indices
    ? Array.from(indices.getArray())
    : Array.from({ length: pos.getCount() }, (_, i) => i)

  const leftTris = []
  const rightTris = []
  for (let t = 0; t < idxArr.length; t += 3) {
    const i0 = idxArr[t]
    const i1 = idxArr[t + 1]
    const i2 = idxArr[t + 2]
    const cx = (posArr[i0 * 3] + posArr[i1 * 3] + posArr[i2 * 3]) / 3
    ;(cx < seamX ? leftTris : rightTris).push(i0, i1, i2)
  }

  const makeHalf = (tris) => {
    if (tris.length < 9) return null
    const used = new Map()
    const newIdx = []
    let next = 0
    for (const old of tris) {
      let mapped = used.get(old)
      if (mapped == null) {
        mapped = next
        used.set(old, next)
        next += 1
      }
      newIdx.push(mapped)
    }

    const half = document.createPrimitive()
    half.setMode(prim.getMode())
    if (prim.getMaterial()) half.setMaterial(prim.getMaterial())

    for (const semantic of prim.listSemantics()) {
      const attr = prim.getAttribute(semantic)
      const itemSize = attr.getElementSize()
      const src = attr.getArray()
      const ArrayCtor = src.constructor
      const dst = new ArrayCtor(next * itemSize)
      used.forEach((newI, oldI) => {
        for (let c = 0; c < itemSize; c += 1) {
          dst[newI * itemSize + c] = src[oldI * itemSize + c]
        }
      })
      const acc = document.createAccessor().setType(attr.getType()).setArray(dst)
      if (attr.getNormalized()) acc.setNormalized(true)
      half.setAttribute(semantic, acc)
    }

    const IdxCtor = newIdx.length > 65535 ? Uint32Array : Uint16Array
    half.setIndices(
      document.createAccessor().setType('SCALAR').setArray(new IdxCtor(newIdx)),
    )
    return half
  }

  return { left: makeHalf(leftTris), right: makeHalf(rightTris) }
}

let combined = null
for (const name of COMBINED_NAMES) {
  combined = findNode(name)
  if (combined) break
}
if (!combined) {
  console.error('Combined door не найден')
  process.exit(1)
}

const already = findNode('door_left')
if (already?.getExtras()?.v46SplitDoors || findNode('door_left_panel_0')) {
  console.log('Уже split — skip')
  process.exit(0)
}

const parent = getParentContainer(combined)
if (!parent) {
  console.error('нет parent/scene')
  process.exit(1)
}
const mesh = combined.getMesh()
if (!mesh) {
  console.error('нет mesh')
  process.exit(1)
}
const prims = mesh.listPrimitives()
console.log(
  'Combined:',
  combined.getName(),
  'prims=',
  prims.length,
  'parent=',
  parent.getName?.() || parent.propertyType,
)

let localMinX = Infinity
let localMaxX = -Infinity
prims.forEach((prim) => {
  const pos = prim.getAttribute('POSITION')
  if (!pos) return
  const arr = pos.getArray()
  for (let i = 0; i < pos.getCount(); i += 1) {
    localMinX = Math.min(localMinX, arr[i * 3])
    localMaxX = Math.max(localMaxX, arr[i * 3])
  }
})
const seamX = (localMinX + localMaxX) * 0.5

let minX = Infinity
let maxX = -Infinity
let minY = Infinity
let maxY = -Infinity
let minZ = Infinity
let maxZ = -Infinity
const combinedWorld = worldMatrix(combined)
const corner = new THREE.Vector3()
prims.forEach((prim) => {
  const pos = prim.getAttribute('POSITION')
  if (!pos) return
  const arr = pos.getArray()
  for (let i = 0; i < pos.getCount(); i += 1) {
    corner.set(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]).applyMatrix4(combinedWorld)
    minX = Math.min(minX, corner.x)
    maxX = Math.max(maxX, corner.x)
    minY = Math.min(minY, corner.y)
    maxY = Math.max(maxY, corner.y)
    minZ = Math.min(minZ, corner.z)
    maxZ = Math.max(maxZ, corner.z)
  }
})
console.log(`seamX=${seamX.toFixed(4)} worldX=[${minX.toFixed(3)}, ${maxX.toFixed(3)}]`)

const parentWorldInv = worldMatrix(parent).clone().invert()
const midY = (minY + maxY) * 0.5
const midZ = (minZ + maxZ) * 0.5
const hingeL = new THREE.Vector3(minX, midY, midZ).applyMatrix4(parentWorldInv)
const hingeR = new THREE.Vector3(maxX, midY, midZ).applyMatrix4(parentWorldInv)

const doorLeft = document.createNode('door_left')
doorLeft.setExtras({ v46SplitDoors: true })
doorLeft.setTranslation([hingeL.x, hingeL.y, hingeL.z])
parent.addChild(doorLeft)

const doorRight = document.createNode('door_right')
doorRight.setExtras({ v46SplitDoors: true })
doorRight.setTranslation([hingeR.x, hingeR.y, hingeR.z])
parent.addChild(doorRight)

const leftPrims = []
const rightPrims = []
prims.forEach((prim, i) => {
  const { left, right } = splitPrimitive(prim, seamX)
  if (left) {
    leftPrims.push(left)
    console.log(`  prim[${i}] L tris≈${(left.getIndices()?.getCount() || 0) / 3}`)
  }
  if (right) {
    rightPrims.push(right)
    console.log(`  prim[${i}] R tris≈${(right.getIndices()?.getCount() || 0) / 3}`)
  }
})
if (!leftPrims.length || !rightPrims.length) {
  console.error('empty split')
  process.exit(1)
}

const leftMesh = document.createMesh('door_left_panel')
leftPrims.forEach((p) => leftMesh.addPrimitive(p))
const rightMesh = document.createMesh('door_right_panel')
rightPrims.forEach((p) => rightMesh.addPrimitive(p))

const leftMeshNode = document.createNode('door_left_panel_0')
leftMeshNode.setMesh(leftMesh)
parent.addChild(leftMeshNode)
setNodeTRS(leftMeshNode, parentWorldInv.clone().multiply(combinedWorld))
reparentKeepWorld(leftMeshNode, doorLeft)

const rightMeshNode = document.createNode('door_right_panel_0')
rightMeshNode.setMesh(rightMesh)
parent.addChild(rightMeshNode)
setNodeTRS(rightMeshNode, parentWorldInv.clone().multiply(combinedWorld))
reparentKeepWorld(rightMeshNode, doorRight)

const facade = findNode('closed_doors_facade')
if (facade) {
  const fscl = facade.getScale() || [1, 1, 1]
  if (
    Math.abs(fscl[0] - 1) > 1e-5
    || Math.abs(fscl[1] - 1) > 1e-5
    || Math.abs(fscl[2] - 1) > 1e-5
  ) {
    const facadeParent = facade.getParentNode()
    const kids = [...facade.listChildren()]
    if (facadeParent) {
      kids.forEach((k) => reparentKeepWorld(k, facadeParent))
      facade.setScale([1, 1, 1])
      kids.forEach((k) => reparentKeepWorld(k, facade))
    }
  }
}

FACADE_LEFT.forEach((name) => {
  const n = findNode(name)
  if (n) {
    reparentKeepWorld(n, doorLeft)
    console.log('  → door_left:', name)
  }
})
FACADE_RIGHT.forEach((name) => {
  const n = findNode(name)
  if (n) {
    reparentKeepWorld(n, doorRight)
    console.log('  → door_right:', name)
  }
})

detachFromParent(combined)
combined.setMesh(null)
console.log('Removed', combined.getName())

if (facade) {
  if (facade.listChildren().length === 0) {
    detachFromParent(facade)
    console.log('Removed empty facade')
  } else {
    facade.setExtras({ ...(facade.getExtras() || {}), v46DecorMovedToDoors: true })
  }
}

const stillUsed = root.listNodes().some((n) => n.getMesh() === mesh)
if (!stillUsed) mesh.dispose()

const rawPath = path.join(ROOT, 'public/models/_split_raw.glb')
console.log('Write raw:', rawPath)
await io.write(rawPath, document)
console.log(`Raw ${(fs.statSync(rawPath).size / 1024 / 1024).toFixed(1)} MB`)

// Backup current optimized shkaf.glb
const bak = path.join(ROOT, 'public/models/shkaf.pre-split.glb')
if (fs.existsSync(outPath) && !fs.existsSync(bak)) {
  fs.copyFileSync(outPath, bak)
  console.log('Backup out →', bak)
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const shell = process.platform === 'win32'
function runGltf(...args) {
  console.log('>', 'gltf-transform', ...args)
  const r = spawnSync(npx, ['--yes', '@gltf-transform/cli@4.2.1', ...args], {
    cwd: ROOT,
    stdio: 'inherit',
    shell,
  })
  if (r.status !== 0) throw new Error(`gltf-transform ${args[0]} failed`)
}

const tmpDedup = path.join(ROOT, 'public/models/_split_dedup.glb')
const tmpMeshopt = path.join(ROOT, 'public/models/_split_meshopt.glb')
runGltf('dedup', rawPath, tmpDedup)

if (blenderOnly) {
  // Blender 3.1: нет EXT_meshopt_compression / часто нет webp
  fs.copyFileSync(tmpDedup, outPath)
  for (const p of [rawPath, tmpDedup]) {
    try {
      fs.unlinkSync(p)
    } catch {
      /* ignore */
    }
  }
  console.log(`Blender GLB: ${outPath} (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(1)} MB)`)
  console.log('Импорт: File → Import → glTF 2.0 → shkaf-blender.glb')
  process.exit(0)
}

runGltf('meshopt', tmpDedup, tmpMeshopt, '--level', 'medium')

// CLI webp ломается на некоторых PNG — Pillow из optimize_shkaf_glb.py
console.log('webp (python)…')
const webpScript = path.join(ROOT, 'scripts', '_split_webp_pass.py')
fs.writeFileSync(
  webpScript,
  `from pathlib import Path
import sys
sys.path.insert(0, 'scripts')
from optimize_shkaf_glb import png_to_webp_in_glb, validate_meshopt
src = Path(r${JSON.stringify(tmpMeshopt)})
out = Path(r${JSON.stringify(outPath)})
webp = png_to_webp_in_glb(src)
validate_meshopt(webp)
out.write_bytes(webp.read_bytes())
try: webp.unlink()
except: pass
print('OUT', out.stat().st_size/1e6)
`,
)
const py = spawnSync('python', [webpScript], { cwd: ROOT, stdio: 'inherit', shell })
try {
  fs.unlinkSync(webpScript)
} catch {
  /* ignore */
}
if (py.status !== 0) throw new Error('python webp failed')

for (const p of [rawPath, tmpDedup, tmpMeshopt]) {
  try {
    fs.unlinkSync(p)
  } catch {
    /* ignore */
  }
}

console.log(`Done: ${outPath} (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(1)} MB)`)
console.log('Bump SHKAF_MODEL_VERSION in shkafNodes.js + index.html preload')
