import * as THREE from 'three'

/** sRGB — albedo / emissive color */
const SRGB_SLOTS = ['map', 'emissiveMap', 'sheenColorMap', 'specularColorMap']

/** Linear — data maps (ORM, normal, AO…) */
const LINEAR_SLOTS = [
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'alphaMap',
  'lightMap',
  'clearcoatMap',
  'clearcoatNormalMap',
  'clearcoatRoughnessMap',
  'transmissionMap',
  'thicknessMap',
  'specularIntensityMap',
  'iridescenceMap',
  'iridescenceThicknessMap',
  'anisotropyMap',
]

function setColorSpace(tex, space) {
  if (tex && tex.colorSpace !== space) tex.colorSpace = space
}

/** glTF: baseColor → sRGB, metallicRoughness / normal → linear */
export function fixGltfTextureColorSpaces(object) {
  object.traverse((child) => {
    if (!child.isMesh) return

    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((mat) => {
      if (!mat) return

      SRGB_SLOTS.forEach((slot) => setColorSpace(mat[slot], THREE.SRGBColorSpace))
      LINEAR_SLOTS.forEach((slot) => setColorSpace(mat[slot], THREE.NoColorSpace))
    })
  })
}
