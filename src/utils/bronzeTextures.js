import * as THREE from 'three'
import { GLB_LEG_NODES, SHKAF_ROOT_NAME } from '../constants/shkafNodes'
import { HINGE_FROM_LEG, HINGE_PLATE } from '../constants/cabinetStudio'
import { findByName } from './cabinetBounds'

const assetBase = import.meta.env.BASE_URL

export const BRONZE_BASECOLOR_URL = `${assetBase}textures/bronze/bronze_baseColor.jpg`
export const BRONZE_ROUGHNESS_URL = `${assetBase}textures/bronze/bronze_roughness.jpg`
export const BRONZE_METALLIC_URL = `${assetBase}textures/bronze/bronze_metallic.jpg`
export const BRONZE_NORMAL_URL = `${assetBase}textures/bronze/bronze_normal.png`
export const BRONZE_AO_URL = `${assetBase}textures/bronze/bronze_ao.jpg`
export const BRONZE_HEIGHT_URL = `${assetBase}textures/bronze/bronze_height.jpg`

/** Обод медальона вокруг берёсты (не ручки с Material.001) */
// matching via NFD strip in isBerestaRingMesh
const BRONZE_REPEAT_LEGS = [2.4, 2.4]
const BRONZE_REPEAT_RING = [1.8, 1.8]

function loadTexture(loader, url, colorSpace) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = colorSpace
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        tex.anisotropy = 8
        tex.needsUpdate = true
        resolve(tex)
      },
      undefined,
      reject,
    )
  })
}

function cloneTiled(src, repeat) {
  const tex = src.clone()
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat[0], repeat[1])
  tex.colorSpace = src.colorSpace
  tex.needsUpdate = true
  return tex
}

export function loadBronzeTextures() {
  const loader = new THREE.TextureLoader()
  return Promise.all([
    loadTexture(loader, BRONZE_BASECOLOR_URL, THREE.SRGBColorSpace),
    loadTexture(loader, BRONZE_ROUGHNESS_URL, THREE.NoColorSpace),
    loadTexture(loader, BRONZE_METALLIC_URL, THREE.NoColorSpace),
    loadTexture(loader, BRONZE_NORMAL_URL, THREE.NoColorSpace),
    loadTexture(loader, BRONZE_AO_URL, THREE.NoColorSpace),
    loadTexture(loader, BRONZE_HEIGHT_URL, THREE.NoColorSpace),
  ]).then(([map, roughnessMap, metalnessMap, normalMap, aoMap, bumpMap]) => ({
    map,
    roughnessMap,
    metalnessMap,
    normalMap,
    aoMap,
    bumpMap,
  }))
}

function ensureUv2(mesh) {
  const geo = mesh.geometry
  if (!geo?.attributes?.uv) return
  if (!geo.attributes.uv2) geo.setAttribute('uv2', geo.attributes.uv)
}

function tuneBronzeMaterial(mat, textures, repeat) {
  if (!mat?.isMeshStandardMaterial && !mat?.isMeshPhysicalMaterial) return

  mat.map = cloneTiled(textures.map, repeat)
  mat.color.set('#ffffff')
  mat.roughnessMap = cloneTiled(textures.roughnessMap, repeat)
  mat.roughness = 1
  mat.metalnessMap = cloneTiled(textures.metalnessMap, repeat)
  mat.metalness = 1
  mat.normalMap = cloneTiled(textures.normalMap, repeat)
  mat.normalScale.set(0.55, 0.55)
  mat.aoMap = cloneTiled(textures.aoMap, repeat)
  mat.aoMapIntensity = 0.7
  mat.bumpMap = cloneTiled(textures.bumpMap, repeat)
  mat.bumpScale = 0.03

  mat.emissive.set('#000000')
  mat.emissiveIntensity = 0
  mat.transparent = false
  mat.opacity = 1
  mat.alphaMap = null
  mat.alphaTest = 0
  mat.depthWrite = true

  if ('envMapIntensity' in mat) mat.envMapIntensity = 0.22
  if ('specularIntensity' in mat) mat.specularIntensity = 0.12
  if ('specularColor' in mat) mat.specularColor.set('#e8c878')
  if ('clearcoat' in mat) mat.clearcoat = 0
  if ('clearcoatRoughness' in mat) mat.clearcoatRoughness = 1
  if ('sheen' in mat) mat.sheen = 0
  if ('transmission' in mat) mat.transmission = 0

  mat.needsUpdate = true
}

export function createBronzeMaterial(textures, repeat, name = 'M_Bronze_PBR') {
  const mat = new THREE.MeshPhysicalMaterial({
    name,
    side: THREE.DoubleSide,
    transparent: false,
    opacity: 1,
    depthWrite: true,
  })
  tuneBronzeMaterial(mat, textures, repeat)
  return mat
}

function isBerestaRingMesh(mesh) {
  const ascii = (mesh.name ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
  return /^(beziercircle|circle)(\.\d+)?$/.test(ascii)
}

/** Бронза на обод вокруг берёсты (BézierCircle / Circle*) */
export function applyBronzeBerestaRingMaterials(root, textures) {
  const shared = createBronzeMaterial(textures, BRONZE_REPEAT_RING, 'M_Bronze_BerestaRing')
  let applied = 0
  root.traverse((child) => {
    if (!child.isMesh || !isBerestaRingMesh(child)) return
    child.material = shared
    child.visible = true
    ensureUv2(child)
    applied += 1
  })
  return applied
}

/** Бронза на ножки leg_front_o / leg_letter_o */
export function applyBronzeLegMaterials(root, textures) {
  const shkafRoot = findByName(root, SHKAF_ROOT_NAME) ?? root
  const shared = createBronzeMaterial(textures, BRONZE_REPEAT_LEGS, 'M_Bronze_Legs')
  let applied = 0
  GLB_LEG_NODES.forEach((name) => {
    const leg = shkafRoot.getObjectByName(name)
    if (!leg) return
    leg.traverse((child) => {
      if (!child.isMesh) return
      child.material = shared
      child.castShadow = true
      child.receiveShadow = true
      ensureUv2(child)
      applied += 1
    })
  })
  return applied
}

/** Только ножки; обод берёсты остаётся на Material.001 из GLB */
export function applyBronzeMetalMaterials(root, textures) {
  const legs = applyBronzeLegMaterials(root, textures)
  return { rings: 0, legs }
}

const HINGE_NAME_RE = /hinge/i

export function hideCabinetHinges(root) {
  if (!root) return 0
  let hidden = 0
  root.traverse((obj) => {
    if (!HINGE_NAME_RE.test(obj.name || '')) return
    obj.visible = false
    hidden += 1
  })
  return hidden
}
const LEG_SOURCE_NAMES = ['node_0', 'node_0002', 'node_0.002']
const MAP_KEYS = ['map', 'roughnessMap', 'metalnessMap', 'normalMap', 'aoMap', 'bumpMap']

function cloneMappedMaterial(src, name, repeat, offset) {
  const mat = src.clone()
  mat.name = name
  const rx = Array.isArray(repeat) ? repeat[0] : repeat
  const ry = Array.isArray(repeat) ? repeat[1] : repeat
  MAP_KEYS.forEach((key) => {
    if (!mat[key]) return
    const tex = mat[key].clone()
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(rx, ry)
    tex.offset.set(offset[0], offset[1])
    tex.needsUpdate = true
    mat[key] = tex
  })
  if ('envMapIntensity' in mat) mat.envMapIntensity = Math.max(mat.envMapIntensity ?? 0, 1)
  mat.needsUpdate = true
  return mat
}

function findLegMaterial(root) {
  for (const name of LEG_SOURCE_NAMES) {
    const node = root.getObjectByName(name)
    if (!node) continue
    let found = null
    node.traverse((child) => {
      if (found || !child.isMesh) return
      const mat = Array.isArray(child.material) ? child.material[0] : child.material
      if (mat) found = mat
    })
    if (found) return found
  }
  return null
}

/**
 * Петли берут PBR ножек (texture_pbr_20250901), UV-окно меньше —
 * то же пятно патины, не вся атлас-карта на пластинке.
 */
export function applyHingeLegMaterial(root) {
  if (!HINGE_FROM_LEG.visible) {
    return hideCabinetHinges(root)
  }

  const src = findLegMaterial(root)
  if (!src) return 0
  const shared = cloneMappedMaterial(
    src,
    'M_Hinge_FromLeg',
    HINGE_FROM_LEG.uvRepeat,
    HINGE_FROM_LEG.uvOffset,
  )
  let applied = 0
  root.traverse((child) => {
    if (!child.isMesh) return
    const named = HINGE_NAME_RE.test(child.name)
    const parentNamed = HINGE_NAME_RE.test(child.parent?.name ?? '')
    if (!named && !parentNamed) return
    const list = Array.isArray(child.material) ? child.material : [child.material]
    if (list.every((m) => m?.name === 'M_Plaque_Rivet_Bronze_PBR')) {
      list.forEach((m) => {
        if ('envMapIntensity' in m) m.envMapIntensity = 1.25
        m.metalness = Math.max(m.metalness ?? 0, 0.92)
        m.roughness = Math.min(m.roughness ?? 1, 0.28)
        m.needsUpdate = true
      })
      applied += 1
      return
    }
    if (child.geometry) {
      child.geometry.deleteAttribute('normal')
      child.geometry.computeVertexNormals()
    }
    const next = list.map((m) => {
      if (m?.name === 'M_Plaque_Rivet_Bronze_PBR') return m
      return shared
    })
    child.material = Array.isArray(child.material) ? next : next[0]
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    mats.forEach((m) => {
      if (m) m.side = THREE.DoubleSide
    })
    child.castShadow = true
    child.receiveShadow = true
    applied += 1
  })

  const nudge = HINGE_FROM_LEG.leftBodyXNudge
  ;['hinge_left_1_body', 'hinge_left_2_body', 'hinge_left_3_body'].forEach((name) => {
    const node = root.getObjectByName(name)
    if (node) node.position.x += nudge
  })
  enrichHingeFrontPlates(root)
  return applied
}

const HINGE_DOOR_RE = /^hinge_(left|right)_[123]_door$/
let hingePlateGeo = null
let hingeRivetGeo = null
let hingeWasherGeo = null

function roundedRectShape(width, height, radius) {
  const hw = width / 2
  const hh = height / 2
  const r = Math.min(radius, hw - 1e-4, hh - 1e-4)
  const shape = new THREE.Shape()
  shape.moveTo(-hw + r, -hh)
  shape.lineTo(hw - r, -hh)
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r)
  shape.lineTo(hw, hh - r)
  shape.quadraticCurveTo(hw, hh, hw - r, hh)
  shape.lineTo(-hw + r, hh)
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r)
  shape.lineTo(-hw, -hh + r)
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh)
  return shape
}

function getHingePlateGeometry() {
  if (hingePlateGeo) return hingePlateGeo
  const width = 0.025 + HINGE_PLATE.pad * 2
  const height = 0.047 + HINGE_PLATE.pad * 2
  hingePlateGeo = new THREE.ExtrudeGeometry(roundedRectShape(width, height, HINGE_PLATE.corner), {
    depth: HINGE_PLATE.depth,
    bevelEnabled: true,
    bevelThickness: HINGE_PLATE.bevel,
    bevelSize: HINGE_PLATE.bevel,
    bevelSegments: 2,
    curveSegments: 6,
  })
  hingePlateGeo.computeVertexNormals()
  return hingePlateGeo
}

function getHingeRivetGeometry() {
  if (!hingeRivetGeo) {
    hingeRivetGeo = new THREE.SphereGeometry(HINGE_PLATE.rivetRadius, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)
    hingeRivetGeo.rotateX(-Math.PI / 2)
    hingeRivetGeo.computeVertexNormals()
  }
  if (!hingeWasherGeo) {
    hingeWasherGeo = new THREE.CylinderGeometry(
      HINGE_PLATE.rivetRadius * 1.55,
      HINGE_PLATE.rivetRadius * 1.75,
      0.0007,
      16,
    )
    hingeWasherGeo.rotateX(Math.PI / 2)
    hingeWasherGeo.computeVertexNormals()
  }
  return { dome: hingeRivetGeo, washer: hingeWasherGeo }
}

function collectDoorHingeNodes(root) {
  const nodes = []
  root.traverse((obj) => {
    if (HINGE_DOOR_RE.test(obj.name)) nodes.push(obj)
  })
  return nodes
}

function frontOverlayCenterFromNode(node) {
  const vertex = new THREE.Vector3()
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  node.updateMatrixWorld(true)
  node.traverse((child) => {
    if (!child.isMesh || !child.geometry?.attributes?.position) return
    const pos = child.geometry.attributes.position
    for (let i = 0; i < pos.count; i += 1) {
      vertex.fromBufferAttribute(pos, i)
      child.localToWorld(vertex)
      node.worldToLocal(vertex)
      maxZ = Math.max(maxZ, vertex.z)
    }
  })
  if (!Number.isFinite(maxZ)) return null
  const zMin = maxZ - 0.0025
  node.traverse((child) => {
    if (!child.isMesh || !child.geometry?.attributes?.position) return
    const pos = child.geometry.attributes.position
    for (let i = 0; i < pos.count; i += 1) {
      vertex.fromBufferAttribute(pos, i)
      child.localToWorld(vertex)
      node.worldToLocal(vertex)
      if (vertex.z < zMin) continue
      minX = Math.min(minX, vertex.x)
      maxX = Math.max(maxX, vertex.x)
      minY = Math.min(minY, vertex.y)
      maxY = Math.max(maxY, vertex.y)
    }
  })
  if (!Number.isFinite(minX)) return null
  return { x: (minX + maxX) * 0.5, y: (minY + maxY) * 0.5, z: maxZ }
}

function pickHingeMaterials(node) {
  let rivet = null
  let plate = null
  node.traverse((child) => {
    if (!child.isMesh) return
    const list = Array.isArray(child.material) ? child.material : [child.material]
    list.forEach((mat) => {
      if (!mat) return
      if (mat.name === 'M_Plaque_Rivet_Bronze_PBR') rivet = rivet ?? mat
      else plate = plate ?? mat
    })
  })
  return { plate: plate ?? rivet, rivet: rivet ?? plate }
}

/** Фаска + две полусферы заклёпок на лицевой пластине дверных петель. */
function enrichHingeFrontPlates(root) {
  const plateGeo = getHingePlateGeometry()
  const { dome, washer } = getHingeRivetGeometry()

  collectDoorHingeNodes(root).forEach((node) => {
    if (node.getObjectByName('hinge_front_plate')) return
    const center = frontOverlayCenterFromNode(node)
    if (!center) return

    const { plate: plateSrc, rivet: rivetSrc } = pickHingeMaterials(node)
    if (!plateSrc) return

    const plateMat = plateSrc.clone()
    plateMat.name = 'M_Hinge_FrontPlate'
    if ('envMapIntensity' in plateMat) plateMat.envMapIntensity = Math.max(plateMat.envMapIntensity ?? 0, 1.15)
    plateMat.roughness = Math.min(plateMat.roughness ?? 1, 0.42)
    plateMat.needsUpdate = true

    const rivetMat = (rivetSrc ?? plateSrc).clone()
    rivetMat.name = 'M_Hinge_FrontRivet'
    if ('envMapIntensity' in rivetMat) rivetMat.envMapIntensity = Math.max(rivetMat.envMapIntensity ?? 0, 1.35)
    rivetMat.metalness = Math.max(rivetMat.metalness ?? 0, 0.92)
    rivetMat.roughness = Math.min(rivetMat.roughness ?? 1, 0.24)
    rivetMat.needsUpdate = true

    const zFix = 1 / Math.max(Math.abs(node.scale.z), 1e-4)
    const plate = new THREE.Mesh(plateGeo, plateMat)
    plate.name = 'hinge_front_plate'
    plate.position.set(center.x, center.y, center.z + 0.00015)
    plate.scale.set(1, 1, zFix)
    plate.castShadow = true
    plate.receiveShadow = true
    node.add(plate)

    ;[-1, 1].forEach((sign, idx) => {
      const washerMesh = new THREE.Mesh(washer, rivetMat)
      washerMesh.name = `hinge_front_washer_${idx}`
      washerMesh.position.set(center.x, center.y + sign * HINGE_PLATE.rivetSpread, center.z + HINGE_PLATE.depth + 0.0002)
      washerMesh.scale.set(1, 1, zFix)
      washerMesh.castShadow = true
      node.add(washerMesh)

      const rivet = new THREE.Mesh(dome, rivetMat)
      rivet.name = `hinge_front_rivet_${idx}`
      rivet.position.set(
        center.x,
        center.y + sign * HINGE_PLATE.rivetSpread,
        center.z + HINGE_PLATE.depth + 0.00055,
      )
      rivet.scale.set(1, 1, zFix)
      rivet.castShadow = true
      node.add(rivet)
    })
  })
}
