const assetBase = import.meta.env.BASE_URL

/** Путь к GLB-модели */
/** Увеличивай версию после каждого re-export из Blender (сброс кэша useGLTF) */
export const SHKAF_MODEL_VERSION = '19'
export const SHKAF_MODEL_PATH = `${assetBase}models/shkaf.glb?v=${SHKAF_MODEL_VERSION}`

/** HDRI из GLB шкафа — не используем, сцена настраивается отдельно */
export const USE_GLB_ENVIRONMENT = false

/** Корневой узел шкафа в Blender */
export const SHKAF_ROOT_NAME = 'shkaf'

/**
 * Normal map на door_left / door_right.
 * 0 — отключить (микрогрань патины без blur в GLB → точечные блики в r3f).
 * 0.3–0.5 — вернуть рельеф мягче; 1 — как в экспорте Blender.
 */
export const DOOR_NORMAL_SCALE = 0
export const DOOR_SURFACE_MATERIALS = ['door_left', 'door_right']

/** Показывать только шкаф — скрыть декор HDRI-сцены (камни, крем, лишние детали) */
export const HIDE_SCENE_DECOR = true

/** Ящики без текстовой подписи (кликабельны, но label не показываем) */
export const HIDDEN_DRAWER_LABELS = []

/** Ящики с 3D-табличкой вместо текстовой подписи */
export const DRAWER_PLAQUES = {}

/** Декоративные ноды — не кликабельны */
export const INACTIVE_DRAWER_NODES = new Set(['drawer_1', 'drawer_2'])

/** Декоративные mesh — без hover, клика и анимации */
export const INACTIVE_MESH_NAMES = new Set()

/** Парные ящики: крышка → корпус (.1) */
export const DRAWER_LID_TO_BODY = {}

/**
 * Сопоставление section.id → имя ноды из GLB.
 * После переименования объектов в Blender — обновить значения здесь
 * и поднять SHKAF_MODEL_VERSION на 1.
 */
export const SHKAF_NODE_MAP = {
  door_left:  'door_left',
  door_right: 'door_right',
  drawer_tl:  'drawer_tl', // верхний левый
  drawer_tr:  'drawer_tr', // верхний правый
  drawer_bl:  'drawer_bl', // нижний левый
  drawer_br:  'drawer_br', // нижний правый
}
