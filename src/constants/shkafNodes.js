/** Путь к GLB-модели */
/** Увеличивай версию после каждого re-export из Blender (сброс кэша useGLTF) */
export const SHKAF_MODEL_VERSION = '15'
export const SHKAF_MODEL_PATH = `/models/shkaf.glb?v=${SHKAF_MODEL_VERSION}`

/** HDRI из лёгкого GLB слабый — используем studio Environment на сайте */
export const USE_GLB_ENVIRONMENT = false

/** Корневой узел шкафа в Blender */
export const SHKAF_ROOT_NAME = 'shkaf'

/** Показывать только шкаф — скрыть декор HDRI-сцены (камни, крем, лишние детали) */
export const HIDE_SCENE_DECOR = true

/** Ящики без текстовой подписи (кликабельны, но label не показываем) */
export const HIDDEN_DRAWER_LABELS = ['drawer_1', 'drawer_6']

/** Ящики с 3D-табличкой вместо текстовой подписи */
export const DRAWER_PLAQUES = {
  drawer_5: '/assets/labels/portfolio.png',
}

/**
 * Сопоставление section.id → имя ноды из GLB.
 *
 * В текущем экспорте есть опечатки в именах (Blender):
 *   drawer_2  →  drfwer_2   (f/r перепутаны)
 *   drawer_3  →  drawe_3    (пропущена r)
 *   drawer_5  →  draver_5   (v вместо w)
 *
 * После переименования объектов в Blender — обновить значения здесь
 * и поднять SHKAF_MODEL_VERSION на 1.
 */
export const SHKAF_NODE_MAP = {
  door_left:  'door_left',
  door_right: 'door_right',
  drawer_1:   'drawer_1',   // верхний большой
  drawer_2:   null,         // пока не активен
  drawer_3:   'drawe_3',    // третий (опечатка в Blender)
  drawer_4:   'drawer_4',   // нижний левый 1
  drawer_5:   'draver_5',   // нижний правый 1 (опечатка в Blender)
  drawer_6:   'drawer_6',   // нижний левый 2
}
