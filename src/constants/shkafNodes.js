/** Путь к GLB-модели */
/** Увеличивай версию после каждого re-export из Blender (сброс кэша useGLTF) */
export const SHKAF_MODEL_VERSION = '9'
export const SHKAF_MODEL_PATH = `/models/shkaf.glb?v=${SHKAF_MODEL_VERSION}`

/** HDRI из лёгкого GLB слабый — используем studio Environment на сайте */
export const USE_GLB_ENVIRONMENT = false

/** Корневой узел шкафа в Blender */
export const SHKAF_ROOT_NAME = 'shkaf'

/** Показывать только шкаф — скрыть декор HDRI-сцены (камни, крем, лишние детали) */
export const HIDE_SCENE_DECOR = true

/**
 * Сопоставление section.id → имя ноды из GLB.
 * Проверено по структуре shkaf.glb (node names: door_left, door_right, drawer_1..6).
 */
export const SHKAF_NODE_MAP = {
  door_left: 'door_left',
  door_right: 'door_right',
  drawer_1: 'drawer_1',
  drawer_2: 'drawer_2',
  drawer_3: 'drawer_3',
  drawer_4: 'drawer_4',
  drawer_5: 'drawer_5',
  drawer_6: 'drawer_6',
}
