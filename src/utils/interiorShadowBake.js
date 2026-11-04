import * as THREE from 'three'
import { CABINET_LOOK } from '../constants/cabinetStudio'

const assetBase = import.meta.env.BASE_URL
const loader = new THREE.TextureLoader()
let pending = null

function loadOne(name, channel) {
  return loader
    .loadAsync(`${assetBase}${CABINET_LOOK.interiorShadow.dir}${name}.png`)
    .then((tex) => {
      // UV из glTF уже перевёрнута по V — как у lightmap HDR.
      tex.flipY = false
      tex.colorSpace = THREE.NoColorSpace
      tex.channel = channel
      tex.anisotropy = 4
      tex.needsUpdate = true
      return [name, tex]
    })
    .catch(() => [name, null])
}

export function loadInteriorShadowBake() {
  if (!pending) {
    const entries = Object.entries(CABINET_LOOK.interiorShadow.channels)
    pending = Promise.all(entries.map(([name, channel]) => loadOne(name, channel))).then(
      (rows) => new Map(rows.filter(([, tex]) => tex)),
    )
  }
  return pending
}

/** Узел GLB → его меш или примитивы `name_N` / `Mesh_N`. */
function meshesOf(node) {
  if (node.isMesh) return [node]
  return node.children.filter(
    (child) => child.isMesh && (child.name.startsWith(`${node.name}_`) || /^Mesh_\d+/.test(child.name)),
  )
}

export function collectInteriorShadowTargets(model) {
  const targets = []
  for (const name of Object.keys(CABINET_LOOK.interiorShadow.channels)) {
    const node = model.getObjectByName(name)
    if (!node) continue
    meshesOf(node).forEach((mesh) => targets.push({ name, mesh }))
  }
  return targets
}

function wants(mat) {
  const cfg = CABINET_LOOK.interiorShadow
  if (!mat || !('aoMap' in mat)) return false
  if (cfg.skipMaterial.test(mat.name || '')) return false
  if (mat.lightMap && !cfg.overLightMap) return false
  return true
}

export function syncInteriorShadow(targets, textures) {
  if (!textures) return
  const intensity = CABINET_LOOK.interiorShadow.intensity
  for (const { name, mesh } of targets) {
    const tex = textures.get(name)
    if (!tex) continue
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    let changed = false
    const next = list.map((mat) => {
      if (!wants(mat)) {
        if (mat?.aoMap === tex) {
          mat.aoMap = null
          mat.needsUpdate = true
        }
        return mat
      }
      if (mat.aoMap === tex) {
        if (mat.aoMapIntensity !== intensity) mat.aoMapIntensity = intensity
        return mat
      }
      const own = mat.userData.interiorShadow === mesh.uuid ? mat : mat.clone()
      own.userData.interiorShadow = mesh.uuid
      own.aoMap = tex
      own.aoMapIntensity = intensity
      own.needsUpdate = true
      changed = true
      return own
    })
    if (changed) mesh.material = Array.isArray(mesh.material) ? next : next[0]
  }
}
