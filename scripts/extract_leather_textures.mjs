/**
 * Leather Dark Brown карты из git shkaf.glb → public/textures/leather/*.webp
 * node scripts/extract_leather_textures.mjs [rev]
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../public/textures/leather')
const rev = process.argv[2] || '7125c60'

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
try {
  await MeshoptDecoder.ready
  io.registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
} catch {
  /* optional */
}

const buf = execSync(`git show ${rev}:public/models/shkaf.glb`, {
  maxBuffer: 200 * 1024 * 1024,
  cwd: path.join(__dirname, '..'),
})
const tmp = path.join(__dirname, '../.tmp-leather-src.glb')
fs.writeFileSync(tmp, buf)
const doc = await io.read(tmp)
fs.unlinkSync(tmp)

const mat = doc.getRoot().listMaterials().find((m) => {
  if (m.getName() !== 'Leather Dark Brown') return false
  return Boolean(m.getBaseColorTexture())
})
if (!mat) {
  console.error('Leather Dark Brown with baseColor not found in', rev)
  process.exit(1)
}

fs.mkdirSync(outDir, { recursive: true })

async function writeMap(label, tex, { size = 1024, quality = 86 } = {}) {
  if (!tex) {
    console.log(label, '— none')
    return
  }
  const img = Buffer.from(tex.getImage())
  const outPath = path.join(outDir, `${label}.webp`)
  const out = await sharp(img)
    .resize(size, size, { fit: 'fill', kernel: 'lanczos3' })
    .webp({ quality, effort: 5 })
    .toBuffer()
  fs.writeFileSync(outPath, out)
  console.log(
    'wrote',
    path.basename(outPath),
    `${(out.length / 1024).toFixed(0)}KB`,
    '←',
    tex.getName(),
    `${(img.length / 1024).toFixed(0)}KB`,
  )
}

console.log('rev', rev, 'baseFactor', mat.getBaseColorFactor())
await writeMap('baseColor', mat.getBaseColorTexture(), { size: 1024, quality: 84 })
await writeMap('roughness', mat.getMetallicRoughnessTexture(), { size: 1024, quality: 88 })
await writeMap('normal', mat.getNormalTexture(), { size: 1024, quality: 90 })
await writeMap('ao', mat.getOcclusionTexture(), { size: 512, quality: 80 })
