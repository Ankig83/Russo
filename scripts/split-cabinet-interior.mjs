/**
 * Делит shkaf-cabinet.glb на оболочку и внутренности.
 * Draco не перекодируется: из BIN вырезаются только нужные bufferView.
 * Повторный запуск по уже разрезанной оболочке останавливается.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const SOURCE = 'public/models/shkaf-cabinet.glb'
const SHELL = 'public/models/shkaf-cabinet.glb'
const INTERIOR = 'public/models/shkaf-interior.glb'

const HIDE_RE = /book_|bottle_|crystal_glass|glass_tumbler|wine_glass|dried_flowers|tray_walnut|vase_brass|Johnnie|johnnie|glengoyne|gleygoyne|tapa-|botella|Jewelry|shelf_|back_wall|modul_drawer|Cup|cork|Cork|Whiskey/i

function readGlb(path) {
  const buf = readFileSync(path)
  const jsonLen = buf.readUInt32LE(12)
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'))
  const bin = buf.subarray(20 + jsonLen + 8)
  return { json, bin }
}

function parentMap(nodes) {
  const parent = new Map()
  nodes.forEach((node, index) => {
    for (const child of node.children || []) parent.set(child, index)
  })
  return parent
}

function hiddenSet(json) {
  const nodes = json.nodes || []
  const parent = parentMap(nodes)
  const hide = new Set()
  function mark(index) {
    const name = nodes[index].name || ''
    if (HIDE_RE.test(name) || hide.has(parent.get(index))) hide.add(index)
    for (const child of nodes[index].children || []) mark(child)
  }
  nodes.forEach((_, index) => {
    if (!parent.has(index)) mark(index)
  })
  return { hide, parent }
}

function packGlb(json, bin) {
  const jsonBuf = Buffer.from(JSON.stringify(json))
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4
  const binPad = (4 - (bin.length % 4)) % 4
  const total = 12 + 8 + jsonBuf.length + jsonPad + 8 + bin.length + binPad
  const out = Buffer.alloc(total)
  out.writeUInt32LE(0x46546c67, 0)
  out.writeUInt32LE(2, 4)
  out.writeUInt32LE(total, 8)
  let offset = 12
  out.writeUInt32LE(jsonBuf.length + jsonPad, offset)
  out.writeUInt32LE(0x4e4f534a, offset + 4)
  jsonBuf.copy(out, offset + 8)
  out.fill(0x20, offset + 8 + jsonBuf.length, offset + 8 + jsonBuf.length + jsonPad)
  offset += 8 + jsonBuf.length + jsonPad
  out.writeUInt32LE(bin.length + binPad, offset)
  out.writeUInt32LE(0x004e4942, offset + 4)
  bin.copy(out, offset + 8)
  return out
}

function subset(json, bin, keepSet, rootIds, tag) {
  const oldNodes = json.nodes || []
  const nodeList = [...keepSet].sort((a, b) => a - b)
  const nodeMap = new Map(nodeList.map((id, index) => [id, index]))

  const meshIds = []
  const meshSeen = new Set()
  for (const id of nodeList) {
    const mesh = oldNodes[id].mesh
    if (mesh == null || meshSeen.has(mesh)) continue
    meshSeen.add(mesh)
    meshIds.push(mesh)
  }
  const meshMap = new Map(meshIds.map((id, index) => [id, index]))

  const matIds = []
  const matSeen = new Set()
  const accessorIds = []
  const accessorSeen = new Set()
  function takeAccessor(id) {
    if (id == null || accessorSeen.has(id)) return
    accessorSeen.add(id)
    accessorIds.push(id)
  }
  for (const id of meshIds) {
    for (const prim of json.meshes[id].primitives || []) {
      if (prim.material != null && !matSeen.has(prim.material)) {
        matSeen.add(prim.material)
        matIds.push(prim.material)
      }
      if (prim.indices != null) takeAccessor(prim.indices)
      for (const id of Object.values(prim.attributes || {})) takeAccessor(id)
      for (const target of prim.targets || []) {
        for (const id of Object.values(target)) takeAccessor(id)
      }
    }
  }
  const matMap = new Map(matIds.map((id, index) => [id, index]))
  const accessorMap = new Map(accessorIds.map((id, index) => [id, index]))

  const texIds = []
  const texSeen = new Set()
  function takeTex(info) {
    if (info?.index == null || texSeen.has(info.index)) return
    texSeen.add(info.index)
    texIds.push(info.index)
  }
  for (const id of matIds) {
    const mat = json.materials[id]
    const pbr = mat.pbrMetallicRoughness || {}
    takeTex(pbr.baseColorTexture)
    takeTex(pbr.metallicRoughnessTexture)
    takeTex(mat.normalTexture)
    takeTex(mat.occlusionTexture)
    takeTex(mat.emissiveTexture)
  }
  const texMap = new Map(texIds.map((id, index) => [id, index]))

  const imageIds = []
  const imageSeen = new Set()
  const samplerIds = []
  const samplerSeen = new Set()
  for (const id of texIds) {
    const tex = json.textures[id]
    if (!imageSeen.has(tex.source)) {
      imageSeen.add(tex.source)
      imageIds.push(tex.source)
    }
    if (tex.sampler != null && !samplerSeen.has(tex.sampler)) {
      samplerSeen.add(tex.sampler)
      samplerIds.push(tex.sampler)
    }
  }
  const imageMap = new Map(imageIds.map((id, index) => [id, index]))
  const samplerMap = new Map(samplerIds.map((id, index) => [id, index]))

  const viewIds = []
  const viewSeen = new Set()
  function takeView(id) {
    if (id == null || viewSeen.has(id)) return
    viewSeen.add(id)
    viewIds.push(id)
  }
  for (const id of accessorIds) {
    const acc = json.accessors[id]
    takeView(acc.bufferView)
    takeView(acc.sparse?.indices?.bufferView)
    takeView(acc.sparse?.values?.bufferView)
  }
  for (const id of imageIds) takeView(json.images[id].bufferView)
  for (const id of meshIds) {
    for (const prim of json.meshes[id].primitives || []) {
      takeView(prim.extensions?.KHR_draco_mesh_compression?.bufferView)
    }
  }
  const viewMap = new Map(viewIds.map((id, index) => [id, index]))

  const parts = []
  let cursor = 0
  const views = viewIds.map((id) => {
    const view = json.bufferViews[id]
    const start = view.byteOffset || 0
    const pad = (4 - (cursor % 4)) % 4
    if (pad) parts.push(Buffer.alloc(pad))
    cursor += pad
    parts.push(Buffer.from(bin.subarray(start, start + view.byteLength)))
    const next = { ...view, buffer: 0, byteOffset: cursor }
    cursor += view.byteLength
    return next
  })
  const packed = parts.length ? Buffer.concat(parts) : Buffer.alloc(0)

  function mapView(id) {
    return id == null ? undefined : viewMap.get(id)
  }
  function mapTex(info) {
    if (!info) return undefined
    return { ...info, index: texMap.get(info.index) }
  }

  const parent = parentMap(oldNodes)
  const nodes = nodeList.map((id) => {
    const node = oldNodes[id]
    const next = { ...node }
    if (node.children) {
      const children = node.children.filter((child) => nodeMap.has(child)).map((child) => nodeMap.get(child))
      if (children.length) next.children = children
      else delete next.children
    }
    if (node.mesh != null) next.mesh = meshMap.get(node.mesh)
    if (rootIds.includes(id)) {
      const parentId = parent.get(id)
      const parentName = parentId == null ? '' : (oldNodes[parentId].name || '')
      next.extras = { ...(node.extras || {}), russoParent: parentName }
    }
    return next
  })

  const meshes = meshIds.map((id) => {
    const mesh = json.meshes[id]
    return {
      ...mesh,
      primitives: mesh.primitives.map((prim) => {
        const next = { ...prim }
        if (prim.material != null) next.material = matMap.get(prim.material)
        if (prim.indices != null) next.indices = accessorMap.get(prim.indices)
        if (prim.attributes) {
          next.attributes = Object.fromEntries(
            Object.entries(prim.attributes).map(([key, value]) => [key, accessorMap.get(value)]),
          )
        }
        if (prim.extensions?.KHR_draco_mesh_compression) {
          next.extensions = {
            ...prim.extensions,
            KHR_draco_mesh_compression: {
              ...prim.extensions.KHR_draco_mesh_compression,
              bufferView: mapView(prim.extensions.KHR_draco_mesh_compression.bufferView),
            },
          }
        }
        return next
      }),
    }
  })

  const materials = matIds.map((id) => {
    const mat = structuredClone(json.materials[id])
    const pbr = mat.pbrMetallicRoughness
    if (pbr?.baseColorTexture) pbr.baseColorTexture = mapTex(pbr.baseColorTexture)
    if (pbr?.metallicRoughnessTexture) pbr.metallicRoughnessTexture = mapTex(pbr.metallicRoughnessTexture)
    if (mat.normalTexture) mat.normalTexture = mapTex(mat.normalTexture)
    if (mat.occlusionTexture) mat.occlusionTexture = mapTex(mat.occlusionTexture)
    if (mat.emissiveTexture) mat.emissiveTexture = mapTex(mat.emissiveTexture)
    return mat
  })

  const textures = texIds.map((id) => {
    const tex = { ...json.textures[id] }
    tex.source = imageMap.get(tex.source)
    if (tex.sampler != null) tex.sampler = samplerMap.get(tex.sampler)
    return tex
  })
  const images = imageIds.map((id) => {
    const image = { ...json.images[id] }
    if (image.bufferView != null) image.bufferView = mapView(image.bufferView)
    return image
  })
  const samplers = samplerIds.map((id) => ({ ...json.samplers[id] }))
  const accessors = accessorIds.map((id) => {
    const acc = { ...json.accessors[id] }
    if (acc.bufferView != null) acc.bufferView = mapView(acc.bufferView)
    else delete acc.bufferView
    return acc
  })

  const out = {
    asset: { ...json.asset, extras: { ...(json.asset?.extras || {}), russoSplit: tag } },
    scene: 0,
    scenes: [{ nodes: rootIds.map((id) => nodeMap.get(id)) }],
    nodes,
    meshes,
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: packed.length }],
  }
  if (materials.length) out.materials = materials
  if (textures.length) out.textures = textures
  if (images.length) out.images = images
  if (samplers.length) out.samplers = samplers
  if (json.extensionsUsed) out.extensionsUsed = json.extensionsUsed
  if (json.extensionsRequired) out.extensionsRequired = json.extensionsRequired
  return { json: out, bin: packed, images: images.length }
}

const { json, bin } = readGlb(SOURCE)
if (json.asset?.extras?.russoSplit) {
  throw new Error(`Уже разрезано (${json.asset.extras.russoSplit}). Источник нужен целый.`)
}
if (json.animations?.length) throw new Error('В GLB есть анимации, деление их не переносит')
if ((json.nodes || []).some((node) => node.skin != null)) throw new Error('В GLB есть skin')

const { hide, parent } = hiddenSet(json)
const all = new Set((json.nodes || []).map((_, index) => index))
const keep = new Set([...all].filter((index) => !hide.has(index)))
const sceneRoots = json.scenes[0].nodes
const shellRoots = sceneRoots.filter((index) => keep.has(index))
const interiorRoots = [...hide].filter((index) => !hide.has(parent.get(index)))

const shell = subset(json, bin, keep, shellRoots, 'shell')
const interior = subset(json, bin, hide, interiorRoots, 'interior')

writeFileSync(SHELL, packGlb(shell.json, shell.bin))
writeFileSync(INTERIOR, packGlb(interior.json, interior.bin))

const shellNames = shell.json.nodes.map((node) => node.name).filter(Boolean)
const interiorNames = interior.json.nodes.map((node) => node.name).filter(Boolean)
console.log('shell MB', (packGlb(shell.json, shell.bin).length / 1048576).toFixed(2), 'nodes', shell.json.nodes.length, 'images', shell.images)
console.log('interior MB', (packGlb(interior.json, interior.bin).length / 1048576).toFixed(2), 'nodes', interior.json.nodes.length, 'images', interior.images)
console.log('shell has door_left', shellNames.includes('door_left'), 'drawer_1', shellNames.includes('drawer_1'))
console.log('shell has book', shellNames.some((name) => name.startsWith('book_')))
console.log('interior roots', interiorRoots.map((index) => `${json.nodes[index].name} <- ${json.nodes[parent.get(index)]?.name || 'scene'}`).join(', '))
