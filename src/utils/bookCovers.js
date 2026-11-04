import * as THREE from 'three'
import { SHKAF_MODEL_VERSION } from '../constants/shkafNodes'

const assetBase = import.meta.env.BASE_URL
const loader = new THREE.TextureLoader()

function loadTex(file, colorSpace) {
  return new Promise((resolve, reject) => {
    loader.load(
      `${assetBase}textures/cabinet-props/${file}?v=${SHKAF_MODEL_VERSION}`,
      (tex) => {
        tex.colorSpace = colorSpace
        tex.flipY = false
        tex.needsUpdate = true
        resolve(tex)
      },
      undefined,
      reject,
    )
  })
}

/** Обложки из Blender: в GLB jpeg «book a diff» уходил в чёрный. */
export async function loadBookCoverTextures() {
  const [coverA, coverB, bump, norm] = await Promise.all([
    loadTex('book_cover_a.png', THREE.SRGBColorSpace),
    loadTex('book_cover_b.png', THREE.SRGBColorSpace),
    loadTex('book_cover_a_bump.png', THREE.NoColorSpace),
    loadTex('book_cover_a_norm.png', THREE.NoColorSpace),
  ])
  return { coverA, coverB, bump, norm }
}

export function applyBookCovers(root, textures) {
  if (!root || !textures?.coverA) return 0
  let applied = 0
  root.traverse((obj) => {
    if (!obj.isMesh || !/^book_0\d/i.test(obj.name || '')) return
    const list = Array.isArray(obj.material) ? obj.material : [obj.material]
    const next = list.map((mat) => {
      if (!mat || !/cover/i.test(mat.name || '')) return mat
      const use = mat.clone()
      const top = /Cover_B/i.test(use.name)
      use.map = top ? textures.coverB : textures.coverA
      use.normalMap = textures.norm
      use.bumpMap = textures.bump
      use.bumpScale = 0.04
      if (use.normalScale) use.normalScale.set(0.85, 0.85)
      use.metalness = 0
      use.roughness = 0.55
      use.color.set('#ffffff')
      use.emissive.set('#c4a06a')
      use.emissiveMap = use.map
      use.emissiveIntensity = 0.16
      use.envMapIntensity = 0.4
      use.needsUpdate = true
      return use
    })
    obj.material = Array.isArray(obj.material) ? next : next[0]
    applied += 1
  })
  return applied
}
