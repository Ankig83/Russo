import * as THREE from 'three'

/**
 * Процедурные материалы Blender без PBR-карт в GLB.
 * Берём текстуры с sourceMaterialName и подкрашиваем под нужный вид.
 */
/** Акцентные детали — ремень, не экономим на качестве материала */
const ACCENT_MESH_NAMES = new Set(['145_', '17_', '19_'])

export const PROCEDURAL_MATERIAL_FIXUPS = {
  // Кожаный ободок с заклёпками вокруг бересты (145_) — процедурный без карт
  'Материал.005': {
    sourceMaterialName: 'Brown Leather 4',
    color: '#1e0e08',
    metalness: 0.1,
    roughness: 0.58,
    envMapIntensity: 1.1,
    normalScale: 2.0,
  },
  // Ножки шкафа
  M_BlackCopper_v3: {
    sourceMaterialName: 'Rough copper metal',
    color: '#1c1814',
    metalness: 0.88,
    roughness: 0.38,
    envMapIntensity: 1.1,
  },
  // Основное полотно дверей — без текстуры в экспорте
  'Oxidized Copper': {
    sourceMaterialName: 'Scratched copper metal',
    color: '#5a4a38',
    metalness: 0.75,
    roughness: 0.45,
    envMapIntensity: 0.9,
  },
  // Латунные детали на дверях
  'M_Brass_Premium.001': {
    sourceMaterialName: 'Rough copper metal',
    color: '#b8922a',
    metalness: 0.85,
    roughness: 0.35,
    envMapIntensity: 1.0,
  },
  M_Brass_Rivet: {
    sourceMaterialName: 'Rough copper metal',
    color: '#3d3528',
    metalness: 0.9,
    roughness: 0.4,
    envMapIntensity: 0.95,
  },
  // Серебристые/белые вставки на дверях
  'material_2.001': {
    sourceMaterialName: 'Scratched copper metal',
    color: '#8a8078',
    metalness: 0.7,
    roughness: 0.5,
    envMapIntensity: 0.85,
  },
  // Золотые элементы
  Gold: {
    sourceMaterialName: 'Rough copper metal',
    color: '#c9a040',
    metalness: 0.92,
    roughness: 0.28,
    envMapIntensity: 1.05,
  },
  'Материал.003': {
    sourceMaterialName: 'Scratched copper metal',
    color: '#6b5c4a',
    metalness: 0.7,
    roughness: 0.45,
    envMapIntensity: 0.9,
  },
}

function collectMaterialsByName(object) {
  const map = new Map()
  object.traverse((child) => {
    if (!child.isMesh) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((mat) => {
      if (mat?.name && !map.has(mat.name)) map.set(mat.name, mat)
    })
  })
  return map
}

function cloneWithSourceMaps(source, fixup) {
  const mat = source.clone()
  mat.name = fixup.targetName ?? mat.name
  mat.color = new THREE.Color(fixup.color)
  mat.metalness = fixup.metalness
  mat.roughness = fixup.roughness
  mat.envMapIntensity = fixup.envMapIntensity ?? 0.85
  if (fixup.normalScale && mat.normalMap) {
    mat.normalScale = mat.normalScale ?? new THREE.Vector2(1, 1)
    mat.normalScale.set(fixup.normalScale, fixup.normalScale)
  }
  mat.needsUpdate = true
  return mat
}

/** Подставить текстуры для процедурных материалов */
export function applyProceduralMaterialFixups(object) {
  const materialsByName = collectMaterialsByName(object)
  const cache = new Map()

  object.traverse((child) => {
    if (!child.isMesh) return

    const applyToMaterial = (mat) => {
      const fixup = PROCEDURAL_MATERIAL_FIXUPS[mat?.name]
      if (!fixup || mat.map) return mat

      const source = materialsByName.get(fixup.sourceMaterialName)
      if (!source?.map) return mat

      if (!cache.has(mat.name)) {
        cache.set(
          mat.name,
          cloneWithSourceMaps(source, { ...fixup, targetName: mat.name }),
        )
      }

      return cache.get(mat.name)
    }

    if (Array.isArray(child.material)) {
      child.material = child.material.map(applyToMaterial)
    } else {
      child.material = applyToMaterial(child.material)
    }
  })
}
