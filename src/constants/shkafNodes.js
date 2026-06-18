/** Путь к GLB-модели */
/** Увеличивай версию после каждого re-export из Blender (сброс кэша useGLTF) */
export const SHKAF_MODEL_VERSION = '8'
export const SHKAF_MODEL_PATH = `/models/shkaf.glb?v=${SHKAF_MODEL_VERSION}`

/** HDRI из лёгкого GLB слабый — используем studio Environment на сайте */
export const USE_GLB_ENVIRONMENT = false

/** Корневой узел шкафа в Blender */
export const SHKAF_ROOT_NAME = 'shkaf'

/** Показывать только шкаф — скрыть декор HDRI-сцены (камни, крем, лишние детали) */
export const HIDE_SCENE_DECOR = true

/**
 * Сопоставление section.id → имя ноды из GLB.
 * door_left / door_right уже есть в экспорте.
 */
export const SHKAF_NODE_MAP = {
  door_left: 'door_left',
  door_right: 'door_right',
  drawer_1: null,
  drawer_2: null,
  drawer_3: null,
  drawer_4: null,
  drawer_5: null,
}
