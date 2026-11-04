import { create } from 'zustand'
import { CABINET_LOOK, CABINET_TUNE } from '../constants/cabinetStudio'
import { cabinetFlags } from './cabinetQuery'

const WOOD_NAME = /^(drawer_[12]|door_(left|right)_wood|modul_drawer(_back)?)$/
const LEATHER_NAME = /leather_rim/i
const BACK_WALL_NAME = /^back_wall/
const DETAIL_NAME = /^door_(left|right)_detail_/
const MEDALLION_NAME = /^medallion(_plate)?$/i
const BASE_NAME = /^(node_0(\.\d+)?|node_000\d)$/i
const METAL_INSIDE_NAME = [
  /^jewelry[_\s]?case/i,
  /^vase_brass$/i,
  /^urn(\.\d+|_?\d+)?$/i,
  /^base(\.\d+|_?\d+)?$/i,
  /^handle(\.\d+|_?\d+)?$/i,
  /^handle_attach_/i,
  /^spout(\.\d+|_?\d+)?$/i,
  /^liquid/i,
  /^botella-/i,
  /^door_prop_/i,
]
/** Бокалы / стаканы / бутылка / графин — transmission, не chrome metal env. */
const GLASS_PROP_NAME =
  /^(wine_glass_|glass_tumbler_|crystal_glass_|bottle_short|shelf_glass|cup$|tapa-gleygoyne|johnnie walker)/i
const PROP_WOOD_NAME = /^(tray_walnut|book_0\d)$/i

function materialNamesOf(mesh) {
  const list = Array.isArray(mesh?.material) ? mesh.material : [mesh?.material]
  return list.map((mat) => mat?.name || '').filter(Boolean)
}

function isCoffee(name) {
  return /agedcopper|coffee_pot|^coffee$/i.test(name || '')
}

function isWoodMat(name) {
  return /walnut|wood/i.test(name || '')
}

/** Медь корпуса — примитив corpus_main с coffee/aged copper. Имя corpus_main_1, если материалов ещё нет. */
export function classifyCabinetMesh(name, materialNames = []) {
  const mats = materialNames.filter(Boolean)
  // Кожа без bake: отдельный env (не lit 0.08 — иначе серый обод).
  if (LEATHER_NAME.test(name)) return { env: 'leather_lit', light: null }
  if (BACK_WALL_NAME.test(name)) return { env: null, light: 'back_wall' }
  if (DETAIL_NAME.test(name)) return { env: null, light: 'details' }
  if (MEDALLION_NAME.test(name)) return { env: 'medallion', light: null }
  if (/^door_(left|right)_panel_authored/.test(name)) return { env: 'door_panel', light: null }
  if (BASE_NAME.test(name)) return { env: 'base', light: null }
  if (/^corpus_main/.test(name)) {
    const coffee = mats.some(isCoffee)
    const wood = mats.some(isWoodMat)
    if (coffee && !wood) return { env: 'copper_corpus', light: null }
    if (wood && !coffee) return { env: 'wood_lit', light: 'corpus' }
    if (name === 'corpus_main_1') return { env: 'copper_corpus', light: null }
    return { env: null, light: null }
  }
  // Дверки/ящики без bake: env не wood_lit (0.08 / слайдер 0), иначе тон расходится.
  if (WOOD_NAME.test(name) || PROP_WOOD_NAME.test(name)) return { env: null, light: null }
  if (GLASS_PROP_NAME.test(name)) return { env: 'glass_prop', light: null }
  if (METAL_INSIDE_NAME.some((re) => re.test(name))) return { env: 'metal_inside', light: null }
  return { env: null, light: null }
}

function meshMaterials(mesh) {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material]
}

function setMeshMaterials(mesh, list) {
  mesh.material = Array.isArray(mesh.material) ? list : list[0]
}

function signatureOf(entry) {
  return `${entry.env || '-'}|${entry.light || '-'}`
}

function isLitMaterial(mat) {
  return Boolean(mat?.isMeshStandardMaterial || mat?.isMeshPhysicalMaterial)
}

let lastGroups = ''

function logGroups(rows) {
  const text = rows.map((row) => `${row.mesh}\t${row.env || '—'}\t${row.light || '—'}\t${row.uuid}`).join('\n')
  if (text === lastGroups) return
  lastGroups = text
  console.log('[tune] меш → env-группа, light-группа, material.uuid')
  console.table(rows)
}

/**
 * После prepareMaterials / finishCabinetWood / лайтмапов / ореха / меди.
 * Общий материал мешей из разных групп клонируется.
 */
export function applyCabinetTune(root, scene, values = useCabinetTune.getState()) {
  if (!root || !values) return null
  if (scene) scene.environmentIntensity = values.environmentIntensity

  const entries = []
  root.traverse((mesh) => {
    if (!mesh.isMesh) return
    const group = classifyCabinetMesh(mesh.name || '', materialNamesOf(mesh))
    entries.push({ mesh, ...group })
  })

  const byUuid = new Map()
  for (const entry of entries) {
    for (const mat of meshMaterials(entry.mesh)) {
      if (!mat) continue
      if (!byUuid.has(mat.uuid)) byUuid.set(mat.uuid, [])
      byUuid.get(mat.uuid).push(entry)
    }
  }

  for (const entry of entries) {
    const list = meshMaterials(entry.mesh)
    const next = list.map((mat) => {
      if (!mat) return mat
      const users = byUuid.get(mat.uuid) || []
      const sigs = new Set(users.map(signatureOf))
      if (sigs.size <= 1) return mat
      if (signatureOf(entry) === signatureOf(users[0])) return mat
      const clone = mat.clone()
      delete clone.userData.tuneAppliedEnv
      console.log('[tune] clone', mat.name, mat.uuid, '→', clone.uuid, entry.mesh.name)
      return clone
    })
    setMeshMaterials(entry.mesh, next)
  }

  const rows = []
  const sample = {}

  for (const entry of entries) {
    for (const mat of meshMaterials(entry.mesh)) {
      if (!isLitMaterial(mat)) continue
      if (mat.userData?.jewelryOwnLook && values.envMapIntensity.jewelry != null) {
        mat.envMapIntensity = values.envMapIntensity.jewelry * values.environmentIntensity
      } else if (entry.env && values.envMapIntensity[entry.env] != null) {
        mat.envMapIntensity = values.envMapIntensity[entry.env] * values.environmentIntensity
      } else if ('envMapIntensity' in mat) {
        if (mat.userData.tuneAppliedEnv !== mat.envMapIntensity) {
          mat.userData.tuneBaseEnv = mat.envMapIntensity
        }
        const next = (mat.userData.tuneBaseEnv ?? mat.envMapIntensity) * values.environmentIntensity
        mat.userData.tuneAppliedEnv = next
        mat.envMapIntensity = next
      }

      if (entry.env === 'copper_corpus' || entry.env === 'base') {
        if (mat.userData.tuneBaseRoughness == null) mat.userData.tuneBaseRoughness = mat.roughness
        mat.roughness = Math.min(1, mat.userData.tuneBaseRoughness + (values.roughnessAdd[entry.env] || 0))
      }

      if (mat.lightMap) {
        if (!values.lightmaps) mat.lightMapIntensity = 0
        else if (entry.light && values.lightMapIntensity[entry.light] != null) {
          mat.lightMapIntensity = values.lightMapIntensity[entry.light]
        } else {
          mat.lightMapIntensity = CABINET_LOOK.lightmap.intensity
        }
      }
      mat.needsUpdate = true

      if (entry.env && sample[entry.env] == null) {
        sample[entry.env] = { mesh: entry.mesh.name, uuid: mat.uuid, envMapIntensity: mat.envMapIntensity }
      }
    }
    const mat = meshMaterials(entry.mesh).find(Boolean)
    if (entry.env || entry.light) {
      rows.push({
        mesh: entry.mesh.name,
        env: entry.env,
        light: entry.light,
        material: mat?.name || '',
        uuid: mat?.uuid || '',
      })
    }
  }

  logGroups(rows)
  console.log('[tune] envMapIntensity', sample)
  if (typeof window !== 'undefined') window.__CABINET_TUNE__ = sample
  return sample
}

export function tuneSnapshot(state = useCabinetTune.getState()) {
  return {
    exposure: state.exposure,
    environmentIntensity: state.environmentIntensity,
    envMapIntensity: { ...state.envMapIntensity },
    lightMapIntensity: { ...state.lightMapIntensity },
    roughnessAdd: { ...state.roughnessAdd },
    lightmaps: state.lightmaps,
    realtime: state.realtime,
    ao: state.ao,
    aoIntensity: state.aoIntensity,
    bloomIntensity: state.bloomIntensity,
    bloomThreshold: state.bloomThreshold,
    lamps: { ...state.lamps },
  }
}

function mergeTune(state, partial) {
  return {
    ...partial,
    envMapIntensity: partial.envMapIntensity
      ? { ...state.envMapIntensity, ...partial.envMapIntensity }
      : state.envMapIntensity,
    lightMapIntensity: partial.lightMapIntensity
      ? { ...state.lightMapIntensity, ...partial.lightMapIntensity }
      : state.lightMapIntensity,
    roughnessAdd: partial.roughnessAdd
      ? { ...state.roughnessAdd, ...partial.roughnessAdd }
      : state.roughnessAdd,
    lamps: partial.lamps ? { ...state.lamps, ...partial.lamps } : state.lamps,
  }
}

const bootFlags = cabinetFlags()

export const useCabinetTune = create((set) => ({
  ...CABINET_TUNE,
  envMapIntensity: { ...CABINET_TUNE.envMapIntensity },
  lightMapIntensity: { ...CABINET_TUNE.lightMapIntensity },
  roughnessAdd: { ...CABINET_TUNE.roughnessAdd },
  lamps: { ...CABINET_TUNE.lamps },
  realtime: bootFlags.realtime,
  ao: bootFlags.ao,
  patch: (partial) => set((state) => mergeTune(state, partial)),
}))
