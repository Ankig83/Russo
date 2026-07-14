const assetBase = import.meta.env.BASE_URL

/** Путь к GLB-модели */
/** Увеличивай версию после каждого re-export из Blender (сброс кэша useGLTF) */
export const SHKAF_MODEL_VERSION = '34'
export const SHKAF_MODEL_PATH = `${assetBase}models/shkaf.glb?v=${SHKAF_MODEL_VERSION}`

/** Ножки model / model.001 из нового экспорта shkaf_.glb */
export const SHKAF_LEGS_MODEL_VERSION = '1'
export const SHKAF_LEGS_MODEL_PATH = `${assetBase}models/shkaf-legs.glb?v=${SHKAF_LEGS_MODEL_VERSION}`

/** HDRI из GLB шкафа — не используем, сцена настраивается отдельно */
export const USE_GLB_ENVIRONMENT = false

/** Корневой узел шкафа в Blender */
export const SHKAF_ROOT_NAME = 'shkaf'

/**
 * Pivot-ноды в GLB — каркас двери, вращение при открытии (материал base_copper).
 * Не путать с mesh-панелями дверка_левая / Дверка_правая.
 */
export const DOOR_PIVOT_NODES = {
  left: 'door_left',
  right: 'door_right',
}

/** Запасные имена pivot в GLB (опечатки / старые экспорты) */
export const DOOR_PIVOT_ALIASES = {
  left: ['door_left'],
  right: ['door_right', 'door_righr', 'door_left.001'],
}

/** Найти pivot двери по каноническому имени или алиасу из GLB */
export function findDoorPivotNode(root, side) {
  const names = DOOR_PIVOT_ALIASES[side] ?? [DOOR_PIVOT_NODES[side]]
  for (const name of names) {
    const node = root.getObjectByName(name)
    if (node) return node
  }
  return null
}

/**
 * Mesh-панели с патиной (дочерние к pivot).
 * shkaf v31: Beresta_L / Beresta_R; старые имена — дверка_левая / Дверка_правая.
 */
export const DOOR_PANEL_NODES = {
  left: 'Beresta_L',
  right: 'Beresta_R',
}

/**
 * Normal map — из GLB (copper_normal2), масштаб рельефа.
 */
export const PATINA_NORMAL_SCALE = 0
/** Множитель к metalnessMap.b (карта v2 даёт ~0.75–0.95 при 1.0) */
export const PATINA_METALNESS = 1
/** Фиксированная satin-roughness на дверях (без ORM из GLB) */
export const PATINA_ROUGHNESS = 0.82

/** @deprecated используй PATINA_NORMAL_SCALE */
export const DOOR_NORMAL_SCALE = PATINA_NORMAL_SCALE

/** Имена материалов GLB на панелях (shkaf_2: door_left.001 + Metal047B / eb7750e8…) */
export const DOOR_SURFACE_MATERIALS = ['door_left.001', 'door_left', 'door_right']
export const PATINA_MATERIALS = ['door_left.001', 'door_left', 'door_right']

/** Верх/низ корпуса (metal02) — normal из GLB даёт лишний блеск в r3f */
export const BODY_SHELL_MATERIALS = ['Scratched copper metal']

/** Основной корпус — shkaf/base_copper, metal02-капсы, кромки door_side/back (не патина!) */
export const MAIN_BODY_MATERIALS = [
  ...BODY_SHELL_MATERIALS,
  'base_copper',
  'door_side',
  'door_side.001',
  'door_back',
  'door_back.001',
  'door_back.002',
]

/** Патина + корпус — MR из GLB даёт зеркальный IBL при вращении */
export const CORPUS_REFLECTIVE_MATERIALS = [
  ...PATINA_MATERIALS,
  ...MAIN_BODY_MATERIALS,
]

export const BERESTA_MATERIALS = [
  'M_Beresta_Final.001',
  'berestf_insige_M.001',
  'bes=resta_W_M',
]

/**
 * Профили бересты — разные текстуры, не смешивать в один material.
 * mesh в GLB: Beresta_L/R → M_Beresta_Final, Btresta_inside → insige, Beck_W → bes=resta_W_M
 */
export const BERESTA_MATERIAL_PROFILES = {
  /** Круги на дверях — береста_темная из GLB, bump от albedo */
  'M_Beresta_Final.001': {
    kind: 'door',
    bumpScale: 0.1,
    useNormalMap: false,
    useRoughnessMap: false,
  },
  /** Внутренняя обивка ящиков — bereza_medallion_texture */
  'berestf_insige_M.001': {
    kind: 'surface',
    roughness: 0.88,
    repeat: [1, 1],
  },
  /** Задняя стенка Beck_W — отдельная текстура (не как на дверях) */
  'bes=resta_W_M': {
    kind: 'surface',
    roughness: 0.86,
    repeat: [1, 1],
  },
}

/** Mesh → ожидаемый материал (для отладки) */
export const BERESTA_MESH_MAP = {
  Beresta_L: 'M_Beresta_Final.001',
  Beresta_R: 'M_Beresta_Final.001',
  'Btresta_inside.001': 'berestf_insige_M.001',
  'Btresta_inside.002': 'berestf_insige_M.001',
  Beck_W: 'bes=resta_W_M',
}
/**
 * Простая тёмная медь (без текстуры): корпус shkaf (Material.002).
 * Ножки (M_BlackCopper_v3) — материал копируется с корпуса в attachGlbLegs.
 */
export const PLAIN_DARK_COPPER_MATERIALS = ['Material.002', 'Material.004']

/**
 * Панель двери (сама дверка, БЕЗ бересты и круга) — материал patina_PBR
 * на нодах door_left / door_right. Делаем гладкой премиум-поверхностью
 * (снимаем relief-карты, ровный матовый металл). Берёста M_Beresta_Final.001 — не трогаем!
 */
export const DOOR_PANEL_SURFACE_MATERIALS = ['patina_PBR']

/** door_side / door_back — те же PBR что base_copper (CORPUS_PBR) */
export const PLAIN_COPPER_MATERIALS = [
  'door_side',
  'door_side.001',
  'door_back',
  'door_back.001',
  'door_back.002',
]

/** Ручки, заклёпки — тёмная латунь, без белых полос от specular + RectAreaLight */
export const BRASS_HANDLE_MATERIALS = [
  'M_Brass_Premium.001',
  'M_Brass_Rivet',
  'Gold',
]

/** Показывать только шкаф — скрыть декор HDRI-сцены (камни, крем, лишние детали) */
export const HIDE_SCENE_DECOR = true

/**
 * Узлы вне shkaf в корне GLB (shkaf_22) — часть шкафа, не декор.
 * attachCabinetSceneRoots в Shkaf.jsx вешает их на shkaf до hideSceneDecor.
 */
export const CABINET_SCENE_ROOTS = [
  SHKAF_ROOT_NAME,
  ...DOOR_PIVOT_ALIASES.left,
  ...DOOR_PIVOT_ALIASES.right,
  'Beck_W',
]

/**
 * Ножки: shkaf-legs.glb (model / model.001 из shkaf_.glb).
 * Старые leg_* в shkaf.glb заменяются в attachGlbLegs до placement.
 */
export const GLB_LEG_NODES = ['leg_front_o', 'leg_beck_o']
/**
 * Позиции ножек на узле shkaf — из shkaf-legs.glb (геометрия центрирована в mesh,
 * в отличие от main shkaf.glb где offset вшит в вершины).
 */
export const GLB_LEG_TRANSFORMS = {
  leg_front_o: { position: [6.8722, 0.2391, 0.6595] },
  leg_beck_o: { position: [6.8722, 0.2391, 0.2335] },
}
/** bbox.min.y шкафа с ножками — fallback, если ножки ещё не в дереве */
export const GLB_LEG_FLOOR_MIN_Y = 0.0222
export const USE_PROCEDURAL_LEGS = false

/** Ящики без текстовой подписи (кликабельны, но label не показываем) */
export const HIDDEN_DRAWER_LABELS = []

/** 3D-таблички на фасадах ящиков (mesh в GLB, привязываются к drawer_* в Shkaf.jsx) */
export const DRAWER_TABL_NODES = {
  drawer_tl: 'tabl_1',
  drawer_tr: 'tabl_2',
  drawer_bl: 'tabl_3',
  drawer_br: 'tabl_4',
}

/** Материалы табличек — текст на меди */
export const PLAQUE_MATERIALS = ['prostranstva', 'avtorskie_m', 'project_M', 'about']

/**
 * Материал таблички → section.id (совпадает с позицией в GLB):
 * tabl_1/prostranstva → tl, tabl_2/avtorskie_m → tr,
 * tabl_3/project_M → bl, tabl_4/about → br
 */
export const PLAQUE_MATERIAL_TO_SECTION = {
  prostranstva: 'drawer_tl',
  avtorskie_m: 'drawer_tr',
  project_M: 'drawer_bl',
  about: 'drawer_br',
}

/** Фронты ящиков drawer_tl/tr/bl/br — кликабельны вместе с tabl_* */
export const DRAWER_FRONT_NODES = ['drawer_tl', 'drawer_tr', 'drawer_bl', 'drawer_br']

/** @deprecated 2D-оверлеи — таблички теперь в GLB */
export const DRAWER_PLAQUES = {}

/** Декоративные ноды — не кликабельны (drawer_1/drawer_2 — контейнеры, не трогаем) */
export const INACTIVE_DRAWER_NODES = new Set(['drawer_1', 'drawer_2'])

/** @deprecated группы ящиков не используются — каждый ящик кликается сам */
export const DRAWER_GROUP_SECTIONS = {}

/** @deprecated маппинг на группы не используется */
export const DRAWER_NODE_TO_GROUP = {}

/** Декоративные mesh — без hover, клика и анимации */
export const INACTIVE_MESH_NAMES = new Set()

/** Парные ящики: крышка → корпус (.1) */
export const DRAWER_LID_TO_BODY = {}

/**
 * Сопоставление section.id → имя ноды из GLB.
 * Рабочие 4 ящика — отдельные mesh-фронты drawer_tl/tr/bl/br (прямые дети shkaf).
 * После переименования объектов в Blender — обновить значения здесь
 * и поднять SHKAF_MODEL_VERSION на 1.
 */
export const SHKAF_NODE_MAP = {
  door_left: DOOR_PIVOT_NODES.left,
  door_right: DOOR_PIVOT_NODES.right,
  drawer_tl: 'drawer_tl',
  drawer_tr: 'drawer_tr',
  drawer_bl: 'drawer_bl',
  drawer_br: 'drawer_br',
}
