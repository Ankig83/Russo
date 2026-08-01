import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { prune } from '@gltf-transform/functions'
import path from 'path'
import { fileURLToPath } from 'url'
import os from 'os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const input = process.argv[2] ?? path.join(os.tmpdir(), 'shkaf_prev.glb')
const output = path.join(__dirname, '../public/models/shkaf-backwall.glb')

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
await MeshoptDecoder.ready
await MeshoptEncoder.ready
io.registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
})

const document = await io.read(input)
const root = document.getRoot()

const beck = root.listNodes().find((n) => n.getName() === 'Beck_W')
if (!beck) {
  console.error('Beck_W not found in', input)
  process.exit(1)
}

console.log('Beck_W t=', beck.getTranslation(), 's=', beck.getScale())
const mesh = beck.getMesh()
if (mesh) {
  for (const prim of mesh.listPrimitives()) {
    console.log('mat=', prim.getMaterial()?.getName())
  }
}

const keepNodes = new Set()
function mark(node) {
  keepNodes.add(node)
  for (const c of node.listChildren()) mark(c)
}
mark(beck)

for (const node of [...root.listNodes()]) {
  if (!keepNodes.has(node)) node.dispose()
}

for (const scene of root.listScenes()) {
  for (const child of [...scene.listChildren()]) scene.removeChild(child)
}

const scene = document.createScene('Backwall')
scene.addChild(beck)
root.setDefaultScene(scene)

await document.transform(prune())
await io.write(output, document)

console.log('Saved:', output)
console.log(
  'nodes=',
  root.listNodes().map((n) => n.getName()),
  'mats=',
  root.listMaterials().map((m) => m.getName()),
  'bytes=',
  (await import('fs')).statSync(output).size,
)
