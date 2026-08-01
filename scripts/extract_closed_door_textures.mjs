/**
 * Извлекает PBR-карты из doors-closed.glb без перекодирования (исходные PNG).
 * node scripts/extract_closed_door_textures.mjs
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const input = path.join(__dirname, '../public/models/doors-closed.glb')
const outDir = path.join(__dirname, '../public/textures/doors-ai')

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
try {
  await MeshoptDecoder.ready
  io.registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
} catch {
  // meshopt optional for this GLB
}

const doc = await io.read(input)
const mat = doc.getRoot().listMaterials()[0]
if (!mat) {
  console.error('no material')
  process.exit(1)
}

fs.mkdirSync(outDir, { recursive: true })

function extFor(mime) {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/webp') return 'webp'
  return 'png'
}

function writeTex(tex, basename) {
  if (!tex) return null
  const mime = tex.getMimeType() || 'image/png'
  const img = tex.getImage()
  if (!img) return null
  const file = `${basename}.${extFor(mime)}`
  const full = path.join(outDir, file)
  fs.writeFileSync(full, Buffer.from(img))
  console.log('wrote', file, img.byteLength)
  return file
}

const base = writeTex(mat.getBaseColorTexture(), 'doors_ai_baseColor')
const mr = writeTex(mat.getMetallicRoughnessTexture(), 'doors_ai_metallicRoughness')
const nrm = writeTex(mat.getNormalTexture(), 'doors_ai_normal')

console.log('done', { base, mr, nrm, outDir })
