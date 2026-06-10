/** Путь к GLB-модели */
/** Увеличивай версию после каждого re-export из Blender (сброс кэша useGLTF) */
export const SHKAF_MODEL_VERSION = '3'
export const SHKAF_MODEL_PATH = `/models/shkaf.glb?v=${SHKAF_MODEL_VERSION}`

/**
 * Сопоставление section.id → имя ноды из GLB.
 * Заполнить после просмотра console.log(nodes) в Shkaf.jsx.
 */
export const SHKAF_NODE_MAP = {
  door_left: null,
  door_right: null,
  drawer_1: null,
  drawer_2: null,
  drawer_3: null,
  drawer_4: null,
  drawer_5: null,
}
