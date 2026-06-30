const assetBase = import.meta.env.BASE_URL

export const USE_STUDIO_GLB = true

export const STUDIO_MODEL_VERSION = '1'
export const STUDIO_MODEL_PATH = `${assetBase}models/studio.glb?v=${STUDIO_MODEL_VERSION}`

export const STUDIO_ANCHOR_NODE = 'shkaf_anchor'

/** Смещение шкафа от shkaf_anchor (мир, +Z = к камере / под прожектор) */
export const SHKAF_MOUNT_OFFSET = [0, 0, 2.8]

/** HDR — отражения без «зеркала» на меди */
export const STUDIO_ENV_INTENSITY = 0.1

/**
 * Ключевой прожектор — сзади-сверху (как light_spot_main в studio.glb).
 * Свет идёт на пол и бока шкафа, не в лицо дверям (+Z к камере).
 */
export const STUDIO_KEY_SPOT_INTENSITY = 220
export const STUDIO_KEY_SPOT_POSITION = [0, 7, -4]
export const STUDIO_KEY_SPOT_TARGET = [0, 0.15, 0.2]
export const STUDIO_KEY_SPOT_ANGLE = 0.65
export const STUDIO_KEY_SPOT_PENUMBRA = 0.88

/** Рим слева сзади — контур, без фронтального блика */
export const STUDIO_RIM_INTENSITY = 0.2
export const STUDIO_RIM_POSITION = [-5, 5, -2]

/** Hemisphere — общая яркость, почти без specular-hotspot */
export const STUDIO_HEMISPHERE_INTENSITY = 0.5
export const STUDIO_HEMISPHERE_SKY = '#ebe6dc'
export const STUDIO_HEMISPHERE_GROUND = '#353230'

export const STUDIO_AMBIENT_INTENSITY = 0.1

/** Экспозиция — ярче сцена, блики контролирует угол света */
export const STUDIO_TONE_MAPPING_EXPOSURE = 0.92

/** Узлы studio.glb, которые не рендерим (стены / купол) */
export const STUDIO_HIDDEN_NODES = new Set(['studio_backdrop'])
