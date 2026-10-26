import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { CABINET_LOOK } from '../constants/cabinetStudio'

const assetBase = import.meta.env.BASE_URL
const loader = new RGBELoader()
const cache = new Map()

const UV_NAMES = [
  ['uv', 0],
  ['uv1', 1],
  ['uv2', 2],
]

function collectNamed(root, name) {
  const found = []
  root.traverse((obj) => {
    if (obj.name === name) found.push(obj)
  })
  return found
}

function meshesOf(node) {
  const own = node.children.filter((child) => child.isMesh)
  if (node.isMesh) return [node, ...own]
  return own
}

function uvBounds(attr) {
  let minU = Infinity
  let minV = Infinity
  let maxU = -Infinity
  let maxV = -Infinity
  for (let i = 0; i < attr.count; i += 1) {
    const u = attr.getX(i)
    const v = attr.getY(i)
    if (u < minU) minU = u
    if (v < minV) minV = v
    if (u > maxU) maxU = u
    if (v > maxV) maxV = v
  }
  return { minU, minV, maxU, maxV }
}

function inspectUv(geometry) {
  const eps = CABINET_LOOK.lightmap.uvEpsilon
  const rows = []
  for (const [name, channel] of UV_NAMES) {
    const attr = geometry?.getAttribute?.(name)
    if (!attr) continue
    const box = uvBounds(attr)
    const inside =
      box.minU >= -eps &&
      box.minV >= -eps &&
      box.maxU <= 1 + eps &&
      box.maxV <= 1 + eps
    rows.push({ name, channel, inside, ...box })
  }
  return rows
}

function fmtUv(row) {
  const n = (v) => (Number.isFinite(v) ? v.toFixed(3) : '?')
  return `${row.name} [${n(row.minU)}..${n(row.maxU)}, ${n(row.minV)}..${n(row.maxV)}]`
}

/**
 * Канал из конфига сверяется с UV, которая целиком лежит в [0,1].
 * Тайловый шпон выходит за диапазон. Если в [0,1] несколько слоёв,
 * берётся канал конфига и пишется предупреждение.
 */
function resolveChannel(mesh, configured) {
  const rows = inspectUv(mesh.geometry)
  const wanted = rows.find((row) => row.channel === configured)
  const inside = rows.filter((row) => row.inside)
  if (!wanted) {
    console.warn(
      `[lightmap] ${mesh.name}: нет атрибута канала ${configured}. Есть: ${rows.map((row) => row.name).join(', ') || 'ничего'}`,
    )
    return null
  }
  if (!wanted.inside) {
    const alt = inside[0]
    console.warn(
      `[lightmap] ${mesh.name}: канал ${configured} (${fmtUv(wanted)}) выходит за [0,1]. ` +
        (alt ? `Похоже на lightmap канал ${alt.channel} (${fmtUv(alt)}).` : 'Канала в [0,1] нет, карта не назначена.'),
    )
    return alt ? alt.channel : null
  }
  if (inside.length > 1) {
    console.warn(
      `[lightmap] ${mesh.name}: в [0,1] несколько UV (${inside.map(fmtUv).join('; ')}). Назначен канал ${configured} из конфига.`,
    )
  }
  return configured
}

function prepareTexture(tex, gl) {
  tex.flipY = false
  if (CABINET_LOOK.lightmap.mipmaps) {
    tex.generateMipmaps = true
    tex.minFilter = THREE.LinearMipmapLinearFilter
  } else {
    tex.generateMipmaps = false
    tex.minFilter = THREE.LinearFilter
  }
  tex.magFilter = THREE.LinearFilter
  const maxAniso = gl?.capabilities?.getMaxAnisotropy?.() ?? 1
  tex.anisotropy = maxAniso
  tex.needsUpdate = true
  return tex
}

function loadOne(file, gl) {
  if (!cache.has(file)) {
    const url = `${assetBase}textures/cycles-bake/lm/${file}`
    const pending = loader.loadAsync(url).then((tex) => prepareTexture(tex, gl))
    pending.catch(() => cache.delete(file))
    cache.set(file, pending)
  }
  return cache.get(file).then((tex) => prepareTexture(tex, gl))
}

export function loadCabinetLightmaps(gl) {
  const files = [...new Set(Object.values(CABINET_LOOK.lightmaps).map((entry) => entry.file))]
  return Promise.all(files.map((file) => loadOne(file, gl))).then(() => gl)
}

function textureFor(file, channel) {
  const cached = cache.get(file)
  return cached?.then?.((tex) => {
    if (tex.channel === channel) return tex
    const copy = tex.clone()
    copy.channel = channel
    copy.needsUpdate = true
    return copy
  })
}

function assignToMesh(mesh, tex, channel) {
  const useChannel = resolveChannel(mesh, channel)
  if (useChannel == null) return false
  const map = tex.channel === useChannel ? tex : tex.clone()
  map.channel = useChannel
  map.needsUpdate = true
  const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  const next = list.map((mat) => {
    if (!mat) return mat
    if (mat.lightMap === map && mat.lightMapIntensity === CABINET_LOOK.lightmap.intensity) return mat
    const cloned = mat.clone()
    cloned.lightMap = map
    cloned.lightMapIntensity = CABINET_LOOK.lightmap.intensity
    cloned.needsUpdate = true
    return cloned
  })
  mesh.material = Array.isArray(mesh.material) ? next : next[0]
  return true
}

export async function applyCabinetLightmaps(root, gl) {
  if (!root) return { applied: [], missing: [] }
  const applied = []
  const litMeshes = new Set()

  for (const [name, entry] of Object.entries(CABINET_LOOK.lightmaps)) {
    const nodes = collectNamed(root, name)
    if (nodes.length === 0) {
      console.warn(`[lightmap] узел «${name}» не найден`)
      continue
    }
    const skip = entry.skipMaterial ? new RegExp(entry.skipMaterial, 'i') : null
    const tex = await textureFor(entry.file, entry.channel)
    if (!tex) {
      console.warn(`[lightmap] нет текстуры ${entry.file} для «${name}»`)
      continue
    }
    let hits = 0
    for (const node of nodes) {
      const meshes = meshesOf(node)
      if (meshes.length === 0) {
        console.warn(`[lightmap] «${name}» не Mesh и без дочерних Mesh`)
        continue
      }
      for (const mesh of meshes) {
        const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        if (skip && list.every((mat) => skip.test(mat?.name || ''))) continue
        const before = list.map((mat) => mat)
        const ok = assignToMesh(mesh, tex, entry.channel)
        if (!ok) continue
        if (skip) {
          const current = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          const restored = current.map((mat, index) => (skip.test(before[index]?.name || '') ? before[index] : mat))
          mesh.material = Array.isArray(mesh.material) ? restored : restored[0]
          if (restored.every((mat, index) => mat === before[index])) continue
        }
        litMeshes.add(mesh)
        hits += 1
      }
    }
    if (hits === 0) {
      console.warn(`[lightmap] «${name}» найден, но карта не легла ни на один меш`)
    } else {
      applied.push(name)
    }
  }

  const waiting = []
  const bare = []
  const bakeRe = new RegExp(`^${CABINET_LOOK.awaitingBake}`, 'i')
  root.traverse((obj) => {
    if (!obj.isMesh) return
    if (bakeRe.test(obj.name || '')) waiting.push(obj.name)
    if (!litMeshes.has(obj)) bare.push(obj.name)
  })
  if (waiting.length) {
    console.warn(`[lightmap] ждут bake: ${waiting.join(', ')}`)
  }
  if (bare.length) {
    console.warn(`[lightmap] без карты (${bare.length}): ${bare.join(', ')}`)
  }
  return { applied, missing: bare }
}
