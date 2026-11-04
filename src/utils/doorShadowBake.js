import * as THREE from 'three'
import { CABINET_LOOK } from '../constants/cabinetStudio'

const assetBase = import.meta.env.BASE_URL
const UV_ATTR = ['uv', 'uv1', 'uv2', 'uv3']

let pending = null

export function loadDoorShadowBake() {
  if (!pending) {
    pending = new THREE.TextureLoader()
      .loadAsync(`${assetBase}${CABINET_LOOK.doorShadow.file}`)
      .then((tex) => {
        tex.colorSpace = THREE.NoColorSpace
        tex.channel = CABINET_LOOK.doorShadow.channel
        tex.wrapS = THREE.ClampToEdgeWrapping
        tex.wrapT = THREE.ClampToEdgeWrapping
        tex.anisotropy = 8
        tex.needsUpdate = true
        return tex
      })
    pending.catch(() => {
      pending = null
    })
  }
  return pending
}

/** Лицевая панель (+ её примитивы) и круг с ручками одной дверки. */
function doorFaceMeshes(model, side) {
  const meshes = []
  const panel = model.getObjectByName(`door_${side}_panel`)
  if (panel?.isMesh) meshes.push(panel)
  panel?.children.forEach((child) => {
    if (child.isMesh && child.name.startsWith(`door_${side}_panel`)) meshes.push(child)
  })
  const handle = model.getObjectByName(`door_${side}_handle`)
  if (handle?.isMesh) meshes.push(handle)
  return meshes
}

const _m = new THREE.Matrix4()
const _inv = new THREE.Matrix4()
const _v = new THREE.Vector3()

/** Вызывать при закрытых дверях: UV = планарная проекция фасада, как в Blender. */
function writePlanarUv(mesh, model) {
  const { bounds, channel } = CABINET_LOOK.doorShadow
  const geo = mesh.geometry
  const pos = geo.getAttribute('position')
  if (!pos) return null
  model.updateWorldMatrix(true, true)
  _inv.copy(model.matrixWorld).invert()
  _m.multiplyMatrices(_inv, mesh.matrixWorld)
  const w = bounds.x1 - bounds.x0
  const h = bounds.y1 - bounds.y0
  const uv = new Float32Array(pos.count * 2)
  let minU = Infinity
  let maxU = -Infinity
  for (let i = 0; i < pos.count; i += 1) {
    _v.fromBufferAttribute(pos, i).applyMatrix4(_m)
    const u = (_v.x - bounds.x0) / w
    uv[i * 2] = u
    uv[i * 2 + 1] = (_v.y - bounds.y0) / h
    if (u < minU) minU = u
    if (u > maxU) maxU = u
  }
  geo.setAttribute(UV_ATTR[channel], new THREE.BufferAttribute(uv, 2))
  return [minU, maxU]
}

/**
 * Готовит меши фасада: планарная UV + собственные клоны материалов (у чужих мешей
 * с тем же материалом нет uv3 — сэмпл из угла дал бы чёрное).
 */
export function prepareDoorShadowTargets(model) {
  const targets = { left: [], right: [] }
  const uvRange = {}
  for (const side of ['left', 'right']) {
    for (const mesh of doorFaceMeshes(model, side)) {
      uvRange[mesh.name] = writePlanarUv(mesh, model)?.map((n) => n.toFixed(3))
      targets[side].push(mesh)
    }
  }
  return { targets, uvRange }
}

function ensureMaterial(mesh, tex, intensity) {
  const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  let changed = false
  const next = list.map((mat) => {
    if (!mat || !('aoMap' in mat)) return mat
    if (mat.aoMap === tex) {
      if (mat.aoMapIntensity !== intensity) mat.aoMapIntensity = intensity
      return mat
    }
    const own = mat.userData.doorShadow ? mat : mat.clone()
    own.userData.doorShadow = true
    own.aoMap = tex
    own.aoMapIntensity = intensity
    own.needsUpdate = true
    changed = true
    return own
  })
  if (changed) mesh.material = Array.isArray(mesh.material) ? next : next[0]
}

/** Сила тени гаснет с углом открытия: bake верен только для закрытой позы. */
export function syncDoorShadow(targets, tex, doors, openAngles, axis) {
  if (!tex) return
  const base = CABINET_LOOK.doorShadow.intensity
  for (const side of ['left', 'right']) {
    const door = doors[side]
    const open = door ? Math.min(1, Math.abs(door.rotation[axis] / openAngles[side])) : 0
    const intensity = base * (1 - open) ** 2
    targets[side].forEach((mesh) => ensureMaterial(mesh, tex, intensity))
  }
}
