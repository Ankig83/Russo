/**
 * Restore Cube / Cube.001 from cinematic-cabinet (correct local TRS),
 * then optionally replace mesh with beveled verts that share the same
 * local space after scale-bake (scale forced to 1 on node).
 *
 * Mode: restore | bevel
 *   restore — exact mesh+TRS from cinematic-cabinet
 *   bevel   — TRS loc/rot from cabinet, scale=1, mesh from inner-door-frames
 *             ONLY safe if frames were beveled from the SAME local mesh
 *             with scale applied (not from raw blend with different TRS)
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { meshopt } from '@gltf-transform/functions'
import fs from 'fs'

await MeshoptDecoder.ready
await MeshoptEncoder.ready

const MODE = process.argv[2] || 'restore'

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  })

const SITE = 'd:/PycharmProjects/Russo/public/models/shkaf.glb'
const CAB = 'd:/PycharmProjects/Russo/public/models/shkaf.cinematic-cabinet.glb'
const FRAMES = 'd:/PycharmProjects/Russo/public/models/inner-door-frames.glb'

const site = await io.read(SITE)
const cab = await io.read(CAB)
const frames = MODE === 'bevel' ? await io.read(FRAMES) : null

function copyAccessor(doc, acc) {
  if (!acc) return null
  const arr = acc.getArray()
  return doc
    .createAccessor(acc.getName() || '')
    .setType(acc.getType())
    .setArray(arr.slice ? arr.slice() : new arr.constructor(Array.from(arr)))
    .setNormalized(acc.getNormalized())
}

function copyMesh(doc, srcMesh, name, material) {
  const mesh = doc.createMesh(name)
  for (const prim of srcMesh.listPrimitives()) {
    const np = doc.createPrimitive().setMode(prim.getMode())
    for (const sem of prim.listSemantics()) {
      const a = copyAccessor(doc, prim.getAttribute(sem))
      if (a) np.setAttribute(sem, a)
    }
    const idx = copyAccessor(doc, prim.getIndices())
    if (idx) np.setIndices(idx)
    if (material) np.setMaterial(material)
    else if (prim.getMaterial()) np.setMaterial(prim.getMaterial())
    mesh.addPrimitive(np)
  }
  return mesh
}

function findNode(doc, name) {
  return doc.getRoot().listNodes().find((n) => n.getName() === name)
}

function detachAndDispose(doc, name) {
  const n = findNode(doc, name)
  if (!n) return
  const mesh = n.getMesh()
  for (const p of doc.getRoot().listNodes()) {
    if (p.listChildren().includes(n)) p.removeChild(n)
  }
  for (const sc of doc.getRoot().listScenes()) {
    if (sc.listChildren().includes(n)) sc.removeChild(n)
  }
  n.dispose()
  if (mesh) mesh.dispose()
  console.log('removed', name)
}

const siteMat = site.getRoot().listMaterials().find((m) => m.getName() === 'Material.002')
if (!siteMat) throw new Error('Material.002 missing')

for (const name of ['door_inner_frame_L', 'door_inner_frame_R', 'Cube', 'Cube.001']) {
  detachAndDispose(site, name)
}

const shkaf = findNode(site, 'shkaf')
if (!shkaf) throw new Error('no shkaf')

for (const name of ['Cube', 'Cube.001']) {
  const src = findNode(cab, name)
  if (!src?.getMesh()) throw new Error(`cab missing ${name}`)

  const node = site.createNode(name)
  shkaf.addChild(node)

  if (MODE === 'restore') {
    node.setMesh(copyMesh(site, src.getMesh(), `${name}_mesh`, siteMat))
    node.setTranslation(src.getTranslation())
    node.setRotation(src.getRotation())
    node.setScale(src.getScale())
  } else {
    // Bevel export keeps local TRS under its own shkaf empty — use that pair.
    const bevel = frames.getRoot().listNodes().find((n) => n.getName() === name)
    if (!bevel?.getMesh()) throw new Error(`frames missing ${name}`)
    node.setMesh(copyMesh(site, bevel.getMesh(), `${name}_mesh`, siteMat))
    node.setTranslation(bevel.getTranslation())
    node.setRotation(bevel.getRotation())
    node.setScale(bevel.getScale())
  }

  console.log('ok', MODE, name, {
    t: [...node.getTranslation()].map((v) => +v.toFixed(4)),
    s: [...node.getScale()].map((v) => +v.toFixed(4)),
    verts: node.getMesh().listPrimitives()[0].getAttribute('POSITION').getCount(),
  })
}

await site.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
await io.write(SITE, site)
console.log('DONE', MODE, fs.statSync(SITE).size)
