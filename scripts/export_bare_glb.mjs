import { NodeIO } from '@gltf-transform/core'
import { KHRTextureTransform } from '@gltf-transform/extensions'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.dirname(fileURLToPath(import.meta.url))
const input = path.join(root, '../public/models/shkaf.glb')
const output = 'C:/Users/SIMPSONS/Downloads/shkaf_2222_bare.glb'

const io = new NodeIO().registerExtensions([KHRTextureTransform])
const doc = await io.read(input)
const rootNode = doc.getRoot()

const meshCount = rootNode.listMeshes().length

for (const material of rootNode.listMaterials()) {
  material.setBaseColorFactor([0.55, 0.52, 0.48, 1])
  material.setMetallicFactor(0.1)
  material.setRoughnessFactor(0.65)
  material.setBaseColorTexture(null)
  material.setMetallicRoughnessTexture(null)
  material.setNormalTexture(null)
  material.setOcclusionTexture(null)
  material.setEmissiveTexture(null)
  material.setEmissiveFactor([0, 0, 0])
}

for (const texture of [...rootNode.listTextures()]) {
  texture.dispose()
}

await io.write(output, doc)

const size = fs.statSync(output).size
console.log('Meshes:', meshCount)
console.log('Materials:', rootNode.listMaterials().length)
console.log('Textures left:', rootNode.listTextures().length)
console.log('Saved:', output, size, 'bytes')
