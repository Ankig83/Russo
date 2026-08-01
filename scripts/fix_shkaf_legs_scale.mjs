/**
 * Запекает scale нод ножек в геометрию shkaf-legs.glb.
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dequantize, prune } from '@gltf-transform/functions'
import { MeshoptDecoder } from 'meshoptimizer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const output = path.resolve(__dirname, '../public/models/shkaf-legs.glb')
const LEG_NODES = ['leg_front_o', 'leg_beck_o']

await MeshoptDecoder.ready

const ioRead = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

const document = await ioRead.read(output)
await document.transform(dequantize())

for (const node of document.getRoot().listNodes()) {
  const name = node.getName()
  if (!LEG_NODES.includes(name)) continue

  const [sx, sy, sz] = node.getScale()
  const mesh = node.getMesh()
  if (!mesh) continue

  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')
    if (!pos) continue
    const arr = pos.getArray()
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] *= sx
      arr[i + 1] *= sy
      arr[i + 2] *= sz
    }
    pos.setArray(arr)
  }

  node.setScale([1, 1, 1])
  console.log(`${name}: baked scale [${sx.toFixed(4)}]`)
}

await document.transform(prune())

// Пишем без meshopt — иначе scale нод восстанавливается при пересжатии
const ioWrite = new NodeIO()
await ioWrite.write(output, document)

const check = await ioWrite.read(output)
for (const node of check.getRoot().listNodes()) {
  if (!LEG_NODES.includes(node.getName())) continue
  console.log(`verify ${node.getName()} scale:`, node.getScale().map((v) => +v.toFixed(4)))
}

console.log('Saved:', output)
