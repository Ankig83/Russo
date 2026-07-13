import { NodeIO } from '@gltf-transform/core'
import { KHRTextureTransform } from '@gltf-transform/extensions'
import { prune } from '@gltf-transform/functions'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const input = process.argv[2]
const output = path.join(__dirname, '../public/models/shkaf-legs.glb')

const KEEP = new Set(['model', 'model.001'])
const RENAME = {
  model: 'leg_front_o',
  'model.001': 'leg_beck_o',
}

const io = new NodeIO().registerExtensions([KHRTextureTransform])
const document = await io.read(input)
const root = document.getRoot()

for (const node of root.listNodes()) {
  const name = node.getName()
  if (KEEP.has(name)) {
    if (RENAME[name]) node.setName(RENAME[name])
    continue
  }
  node.dispose()
}

for (const scene of root.listScenes()) {
  for (const child of [...scene.listChildren()]) {
    scene.removeChild(child)
  }
}

const legsScene = document.createScene('Legs')
for (const node of root.listNodes()) {
  legsScene.addChild(node)
}
root.setDefaultScene(legsScene)

await document.transform(prune())

await io.write(output, document)

const kept = root.listNodes().map((n) => n.getName())
console.log('Saved:', output)
console.log('Nodes:', kept)
console.log('Meshes:', root.listMeshes().length)
console.log('Materials:', root.listMaterials().map((m) => m.getName()))
