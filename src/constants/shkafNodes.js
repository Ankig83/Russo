const assetBase = import.meta.env.BASE_URL

/** Путь к GLB-модели */
/** Увеличивай версию после каждого re-export из Blender (сброс кэша useGLTF) */
export const SHKAF_MODEL_VERSION = '17'
export const SHKAF_MODEL_PATH = `${assetBase}models/shkaf.glb?v=${SHKAF_MODEL_VERSION}`

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
  drawer_5: `${assetBase}assets/labels/portfolio.png`,
}

/** Декоративные ноды — не кликабельны */
export const INACTIVE_DRAWER_NODES = new Set()

/** Декоративные mesh — без hover, клика и анимации (124_ = нижняя планка) */
export const INACTIVE_MESH_NAMES = new Set(['124_'])

/**
 * Парные ящики: крышка → корпус (.1).
 * drawe_3 — опечатка в Blender (drawer_3); внутренний child переименовывается в drawer_3.1.
 */
export const DRAWER_LID_TO_BODY = {
  drawe_3: 'drawer_3.1',
  drawer_4: 'drawer_4.1',
  draver_5: 'drawer_5.1',
  drawer_6: 'drawer_6.1',
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
  drawer_3:   'drawe_3',    // «О нас» — крышка (опечатка в Blender), корпус drawer_3.1
  drawer_4:   'drawer_4',    // «Контакты» — нижний левый (#3)
  drawer_5:   'draver_5',    // «Портфолио» — нижний правый (#4)
  drawer_6:   'drawer_6',    // «Эскизы» — нижний правый, крышка + drawer_6.1
}
