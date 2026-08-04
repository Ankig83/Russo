/**
 * Собирает один корректный shkaf.glb:
 *   base    = обычный GLB (door_left/right + все ящики)
 *   overlay = последний экспорт (фасад + новые ножки + Beck_W)
 *
 * Usage:
 *   node scripts/merge_shkaf_glb.mjs [base.glb] [overlay.glb] [out.glb]
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { copyToDocument, prune, unpartition } from '@gltf-transform/functions'
import { MeshoptDecoder } from 'meshoptimizer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const basePath = path.resolve(
  process.argv[2] || path.join(root, 'public/models/_prev_shkaf.glb'),
)
const overlayPath = path.resolve(
  process.argv[3] || 'C:/Users/KiGi/Documents/shkaf_1.glb',
)
const outPath = path.resolve(
  process.argv[4] || path.join(root, 'public/models/shkaf.glb'),
)

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

function findNode(doc, name) {
  return doc.getRoot().listNodes().find((n) => n.getName() === name) || null
}

function parentOf(doc, node) {
  for (const n of doc.getRoot().listNodes()) {
    if (n.listChildren().includes(node)) return n
  }
  for (const s of doc.getRoot().listScenes()) {
    if (s.listChildren().includes(node)) return s
  }
  return null
}

/** Collect node + descendants (depth-first). */
function collectSubtree(node, out = []) {
  out.push(node)
  for (const c of node.listChildren()) collectSubtree(c, out)
  return out
}

/**
 * Copy a node subtree from source → target, reparent under `parent` (Scene|Node).
 * Returns the copied root node in target.
 */
function copySubtree(targetDoc, sourceDoc, sourceRoot, parent) {
  const nodes = collectSubtree(sourceRoot)
  const map = copyToDocument(targetDoc, sourceDoc, nodes)

  // Re-wire child links among copies (copyToDocument copies nodes but not graph edges for children)
  for (const src of nodes) {
    const dst = map.get(src)
    // clear any accidental children then rebuild from source topology
    for (const c of [...dst.listChildren()]) dst.removeChild(c)
  }
  for (const src of nodes) {
    const dst = map.get(src)
    for (const child of src.listChildren()) {
      const dstChild = map.get(child)
      if (dstChild) dst.addChild(dstChild)
    }
  }

  const copiedRoot = map.get(sourceRoot)
  parent.addChild(copiedRoot)
  return copiedRoot
}

function detachAndDispose(doc, node) {
  const p = parentOf(doc, node)
  if (p) p.removeChild(node)
  // dispose subtree bottom-up
  const nodes = collectSubtree(node).reverse()
  for (const n of nodes) n.dispose()
}

console.log('base   ', basePath)
console.log('overlay', overlayPath)
console.log('out    ', outPath)

const { io, doc: base } = await load(basePath)
const { doc: overlay } = await load(overlayPath)

const scene = base.getRoot().listScenes()[0]
if (!scene) throw new Error('base: no scene')

const shkaf = findNode(base, 'shkaf')
if (!shkaf) throw new Error('base: shkaf not found')

// Убрать старые X-ножки
for (const name of ['model', 'model.001']) {
  const n = findNode(base, name)
  if (n) {
    detachAndDispose(base, n)
    console.log('removed', name)
  }
}

// Заменить Table_Top_Frame ножками из overlay.
// Важно: в overlay Frame — child shkaf (local ≈ [6.85,…]);
// в prev Frame был sibling в корне сцены. Кладём ПОД shkaf, иначе ноги уезжают на +7м.
const oldFrame = findNode(base, 'Table_Top_Frame')
if (oldFrame) {
  detachAndDispose(base, oldFrame)
  console.log('removed old Table_Top_Frame')
}
const overlayFrame = findNode(overlay, 'Table_Top_Frame')
if (!overlayFrame) throw new Error('overlay: Table_Top_Frame not found')
const newFrame = copySubtree(base, overlay, overlayFrame, shkaf)
newFrame.setName('Table_Top_Frame')
console.log(
  'legs:',
  newFrame.listChildren().map((c) => c.getName()).join(', '),
)

// Beck_W под shkaf
const oldBeck = findNode(base, 'Beck_W')
if (oldBeck) detachAndDispose(base, oldBeck)
const overlayBeck = findNode(overlay, 'Beck_W')
if (overlayBeck) {
  const beck = copySubtree(base, overlay, overlayBeck, shkaf)
  beck.setName('Beck_W')
  console.log('Beck_W → shkaf')
}

// closed_doors_facade в корень сцены
const oldFacade = findNode(base, 'closed_doors_facade')
if (oldFacade) detachAndDispose(base, oldFacade)
const overlayFacade = findNode(overlay, 'closed_doors_facade')
if (!overlayFacade) throw new Error('overlay: closed_doors_facade not found')
const facade = copySubtree(base, overlay, overlayFacade, scene)
facade.setName('closed_doors_facade')
console.log(
  'facade:',
  facade.listChildren().map((c) => c.getName()).join(', '),
)

await base.transform(prune(), unpartition())

const names = base.getRoot().listNodes().map((n) => n.getName())
const need = [
  'shkaf',
  'door_left',
  'door_right',
  'drawer_1',
  'drawer_2',
  'drawer_tl',
  'drawer_tr',
  'drawer_bl',
  'drawer_br',
  'Table_Top_Frame',
  'Beck_W',
  'closed_doors_facade',
  'BézierCurve',
  'BézierCurve.001',
  'BézierCurve004',
  'BézierCurve004.001',
]
console.log(
  'check',
  need.map((n) => `${n}:${names.includes(n)}`).join(' '),
)
console.log(
  'scene roots:',
  scene.listChildren().map((c) => c.getName()).join(', '),
)
console.log(
  'frame parent:',
  parentOf(base, newFrame)?.getName?.() || parentOf(base, newFrame)?.propertyType,
)

await io.write(outPath, base)
const mb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2)
console.log('wrote', outPath, `(${mb} MB)`)
