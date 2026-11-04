import * as THREE from 'three'
import { CORPUS_AGED_COPPER } from '../constants/cabinetStudio'

const assetBase = import.meta.env.BASE_URL

export const AGED_COPPER_COLOR_URL = `${assetBase}textures/aged-copper/aged_copper_baseColor.png`
export const AGED_COPPER_ROUGHNESS_URL = `${assetBase}textures/aged-copper/aged_copper_roughness.png`
export const AGED_COPPER_NORMAL_URL = `${assetBase}textures/aged-copper/aged_copper_normal.png`

const CORPUS_NODES = ['corpus_main']
const KEEP_MAT = /walnut|wood|берёст|beresta/i
const REPLACE_MAT = /coffee_pot|coffee/i

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

export function loadAgedCopperTextures() {
  const loader = new THREE.TextureLoader()
  return Promise.all([
    loadTexture(loader, AGED_COPPER_COLOR_URL, THREE.SRGBColorSpace),
    loadTexture(loader, AGED_COPPER_ROUGHNESS_URL, THREE.NoColorSpace),
    loadTexture(loader, AGED_COPPER_NORMAL_URL, THREE.NoColorSpace),
  ]).then(([map, roughnessMap, normalMap]) => ({ map, roughnessMap, normalMap }))
}

function createAgedCopperMaterial(textures) {
  const { repeat, metalness, env, normalScale } = CORPUS_AGED_COPPER
  return new THREE.MeshPhysicalMaterial({
    name: 'M_Corpus_AgedCopper',
    map: cloneTiled(textures.map, repeat),
    color: '#ffffff',
    roughnessMap: cloneTiled(textures.roughnessMap, repeat),
    roughness: 1,
    metalness,
    normalMap: cloneTiled(textures.normalMap, repeat),
    normalScale: new THREE.Vector2(normalScale, normalScale),
    envMapIntensity: env,
    side: THREE.DoubleSide,
  })
}

function shouldReplace(mat) {
  if (!mat?.name) return true
  if (KEEP_MAT.test(mat.name)) return false
  return REPLACE_MAT.test(mat.name) || mat.name === 'coffee_pot'
}

/** Только корпус. Кофейники с тем же coffee_pot не трогаем. */
export function applyAgedCopperToCorpus(root, textures) {
  const shared = createAgedCopperMaterial(textures)
  let applied = 0
  for (const name of CORPUS_NODES) {
    const node = root.getObjectByName(name)
    if (!node) continue
    node.traverse((child) => {
      if (!child.isMesh) return
      const list = Array.isArray(child.material) ? child.material : [child.material]
      if (!list.some(shouldReplace)) return
      const next = list.map((m) => (shouldReplace(m) ? shared : m))
      child.material = Array.isArray(child.material) ? next : next[0]
      child.castShadow = true
      child.receiveShadow = true
      applied += 1
    })
  }
  return applied
}
