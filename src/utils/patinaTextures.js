import * as THREE from 'three'
import { DOOR_PANEL_NODES } from '../constants/shkafNodes'
import { PATINA_DIFFUSE_URL, PATINA_METALLIC_URL } from '../constants/patinaTextures'

const DOOR_PANEL_NAMES = Object.values(DOOR_PANEL_NODES)

function loadTexture(loader, url, colorSpace) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = colorSpace
        tex.needsUpdate = true
        resolve(tex)
      },
      undefined,
      reject,
    )
  })
}

export function loadPatinaTextures() {
  const loader = new THREE.TextureLoader()
  return Promise.all([
    loadTexture(loader, PATINA_DIFFUSE_URL, THREE.SRGBColorSpace),
    loadTexture(loader, PATINA_METALLIC_URL, THREE.NoColorSpace),
  ]).then(([diffuse, metalness]) => ({ diffuse, metalness }))
}

/** delit + metallic v2 — только mesh-панели дверей */
export function applyDoorPanelPatinaTextures(root, { diffuse, metalness }) {
  DOOR_PANEL_NAMES.forEach((panelName) => {
    const mesh = root.getObjectByName(panelName)
    if (!mesh?.isMesh || !mesh.material) return

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    materials.forEach((mat) => {
      mat.map = diffuse
      mat.metalnessMap = metalness
      mat.normalMap = null
      mat.roughnessMap = null
      mat.needsUpdate = true
    })
  })
}
