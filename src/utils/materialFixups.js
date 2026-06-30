import * as THREE from 'three'

/**
 * Процедурные материалы Blender без PBR-карт в GLB.
 * Берём текстуры с sourceMaterialName и подкрашиваем под нужный вид.
 */
/** Акцентные детали — ремень, не экономим на качестве материала */
const ACCENT_MESH_NAMES = new Set(['145_', '17_', '19_'])

/** Материалы корпуса и дверей — baked медь без metallic в GLB */
export const COPPER_BODY_MATERIALS = new Set([
  'base_copper',
  'door_left',
  'door_right',
  'door_side',
  'door_back',
  'door_back.001',
  'youtub',
  'Oxidized Copper',
  'Oxidized used copper metal',
  'M_BlackCopper_v3',
  'Материал.003',
])

export const PROCEDURAL_MATERIAL_FIXUPS = {
  // Кожаный ободок с заклёпками вокруг бересты (145_) — процедурный без карт
  'Материал.005': {
    sourceMaterialName: 'Brown Leather 4',
    color: '#1e0e08',
    metalness: 0.08,
    roughness: 0.72,
    envMapIntensity: 0.18,
    normalScale: 1.6,
  },
  // Ножки шкафа
  M_BlackCopper_v3: {
    sourceMaterialName: 'Rough copper metal',
    color: '#1c1814',
    metalness: 0.88,
    roughness: 0.38,
    envMapIntensity: 1.1,
  },
  // Основное полотно дверей (Blender: youtub / base_copper)
  youtub: {
    sourceMaterialName: 'Oxidized used copper metal',
    color: '#7a4a32',
    metalness: 0.8,
    roughness: 0.62,
    envMapIntensity: 0.28,
  },
  base_copper: {
    metalness: 0.8,
    roughness: 0.62,
    envMapIntensity: 0.28,
  },
  door_left: {
    metalness: 0.8,
    roughness: 0.62,
    envMapIntensity: 0.28,
    specularIntensity: 0.1,
  },
  door_right: {
    metalness: 0.8,
    roughness: 0.62,
    envMapIntensity: 0.28,
  },
  door_side: {
    metalness: 0.8,
    roughness: 0.62,
    envMapIntensity: 0.28,
  },
  door_back: {
    metalness: 0.8,
    roughness: 0.62,
    envMapIntensity: 0.28,
  },
  'door_back.001': {
    metalness: 0.8,
    roughness: 0.62,
    envMapIntensity: 0.28,
  },
  // Основное полотно дверей — без текстуры в экспорте
  'Oxidized Copper': {
    sourceMaterialName: 'Scratched copper metal',
    color: '#6a4a38',
    metalness: 0.8,
    roughness: 0.62,
    envMapIntensity: 0.28,
  },
  // Латунные детали на дверях
  'M_Brass_Premium.001': {
    sourceMaterialName: 'Rough copper metal',
    color: '#b8922a',
    metalness: 0.72,
    roughness: 0.48,
    envMapIntensity: 0.35,
    specularIntensity: 0.12,
  },
  M_Brass_Rivet: {
    sourceMaterialName: 'Rough copper metal',
    color: '#3d3528',
    metalness: 0.75,
    roughness: 0.52,
    envMapIntensity: 0.32,
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

function applyPbrFixup(mat, fixup) {
  if (fixup.metalness != null) mat.metalness = fixup.metalness
  if (fixup.roughness != null) mat.roughness = Math.max(mat.roughness ?? 0, fixup.roughness)
  if (fixup.envMapIntensity != null) mat.envMapIntensity = fixup.envMapIntensity
  if (fixup.color) mat.color = new THREE.Color(fixup.color)
  if (fixup.normalScale && mat.normalMap) {
    mat.normalScale = mat.normalScale ?? new THREE.Vector2(1, 1)
    mat.normalScale.set(fixup.normalScale, fixup.normalScale)
  }
  if (mat.isMeshPhysicalMaterial) {
    if (fixup.specularIntensity != null) mat.specularIntensity = fixup.specularIntensity
    mat.clearcoat = 0
    if (mat.name?.startsWith('Leather')) {
      mat.sheen = 0.12
      mat.sheenRoughness = 0.85
    }
  }
  mat.needsUpdate = true
}

/** Подставить текстуры для процедурных материалов */
export function applyProceduralMaterialFixups(object) {
  const materialsByName = collectMaterialsByName(object)
  const cache = new Map()

  object.traverse((child) => {
    if (!child.isMesh) return

    const applyToMaterial = (mat) => {
      const fixup = PROCEDURAL_MATERIAL_FIXUPS[mat?.name]
      if (!fixup) return mat

      // Baked PBR — только параметры, текстуру не трогаем
      if (mat.map && COPPER_BODY_MATERIALS.has(mat.name)) {
        applyPbrFixup(mat, fixup)
        return mat
      }

      // PBR-only (door_left, base_copper без clone)
      if (!fixup.sourceMaterialName) {
        applyPbrFixup(mat, fixup)
        return mat
      }

      if (mat.map) return mat

      const source = materialsByName.get(fixup.sourceMaterialName)
      if (!source?.map) {
        applyPbrFixup(mat, fixup)
        return mat
      }

      if (!cache.has(mat.name)) {
        const cloned = source.clone()
        cloned.name = mat.name
        applyPbrFixup(cloned, { ...fixup, targetName: mat.name })
        cache.set(mat.name, cloned)
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

/** Кожа — приглушить блеск после загрузки GLB */
const LEATHER_MATERIAL_PREFIX = 'Leather'

/** Финальная настройка PBR под студийный свет (ближе к Cycles) */
export function applyStudioMaterialTuning(object, envMapIntensity = 0.28) {
  object.traverse((child) => {
    if (!child.isMesh) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((mat) => {
      if (!mat?.isMeshStandardMaterial || !mat.name) return

      if (COPPER_BODY_MATERIALS.has(mat.name)) {
        mat.metalness = Math.min(mat.metalness ?? 1, 0.8)
        mat.roughness = Math.max(mat.roughness ?? 0.2, 0.62)
        mat.envMapIntensity = envMapIntensity
        if (mat.isMeshPhysicalMaterial) {
          mat.specularIntensity = 0.1
          mat.clearcoat = 0
        }
        mat.needsUpdate = true
        return
      }

      if (mat.name.startsWith(LEATHER_MATERIAL_PREFIX)) {
        mat.metalness = 0
        mat.roughness = Math.max(mat.roughness ?? 0.5, 0.72)
        mat.envMapIntensity = 0.15
        if (mat.isMeshPhysicalMaterial) {
          mat.specularIntensity = 0.08
          mat.sheen = 0.12
          mat.sheenRoughness = 0.85
        }
        mat.needsUpdate = true
        return
      }

      if (mat.name === 'M_Brass_Premium.001' || mat.name === 'M_Brass_Rivet') {
        mat.metalness = Math.min(mat.metalness ?? 0.85, 0.75)
        mat.roughness = Math.max(mat.roughness ?? 0.3, 0.48)
        mat.envMapIntensity = 0.35
        if (mat.isMeshPhysicalMaterial) mat.specularIntensity = 0.12
        mat.needsUpdate = true
      }
    })
  })
}

/** @deprecated — используй applyStudioMaterialTuning */
export function applyCopperMetalness(object, envMapIntensity = 0.28) {
  applyStudioMaterialTuning(object, envMapIntensity)
}
