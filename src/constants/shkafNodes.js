const assetBase = import.meta.env.BASE_URL

/** Путь к GLB-модели */
/** Увеличивай версию после каждого re-export из Blender (сброс кэша useGLTF) */
/** v64 — door panels restored (authored UV, original birch). Walnut samples automap. */
export const SHKAF_MODEL_VERSION = '69'
export const SHKAF_MODEL_PATH = `${assetBase}models/shkaf-cabinet.glb?v=${SHKAF_MODEL_VERSION}`
export const STUDIO_SCENE_VERSION = '1'
export const STUDIO_SCENE_PATH = `${assetBase}models/studio-scene.glb?v=${STUDIO_SCENE_VERSION}`

/** Ножки model / model.001 из нового экспорта shkaf_.glb — НЕ сжимать meshopt (scale запечён в геометрию) */
export const SHKAF_LEGS_MODEL_VERSION = '3'
export const SHKAF_LEGS_MODEL_PATH = `${assetBase}models/shkaf-legs.glb?v=${SHKAF_LEGS_MODEL_VERSION}`

/** Задняя стенка Beck_W из предыдущего shkaf.glb (не попала в shkaf_for_D) */
export const SHKAF_BACKWALL_MODEL_VERSION = '1'
export const SHKAF_BACKWALL_MODEL_PATH = `${assetBase}models/shkaf-backwall.glb?v=${SHKAF_BACKWALL_MODEL_VERSION}`
/** false — Beck_W уже в основном GLB (v37+) */
export const USE_ATTACH_BACKWALL = false

/** Кожаный ободок вокруг берёсты (из старого shkaf — ОкружностьБезье + Leather Dark Brown) */
export const SHKAF_LEATHER_RIM_VERSION = '1'
export const SHKAF_LEATHER_RIM_PATH = `${assetBase}models/shkaf-leather-rim.glb?v=${SHKAF_LEATHER_RIM_VERSION}`
/** false — ободки/ручки/заклёпки уже в основном GLB (v37+) */
export const USE_ATTACH_LEATHER_RIM = false
/**
 * Доводка ободка после аттача (геометрия плоская — морфим под торец/ширину).
 * widthScale 0.6 ≈ 5см → 3см по радиальной ширине ремешка.
 */
export const LEATHER_RIM_FIT = {
  /** радиальная ширина ремешка относительно исходной */
  widthScale: 0.58,
  /** чуть снаружи края берёсты */
  outerPad: 1.018,
  /** глубина захода на торец (локальные ед. до поворота) */
  edgeDepth: 0.028,
  /** вытягивание к центру шва — перекрыть торец берёсты */
  seamOverlap: 0.018,
  /** зона шва от диаметра (x≈0), в которой наращиваем губу */
  seamZone: 0.12,
  /** вынос перед плоскостью берёсты — читается объём + тень */
  frontZ: 0.005,
}

/** Детализация кожи — геометрия, не нарисованный слой. */
export const LEATHER_HARDWARE = {
  /** Мелкие заклёпки по каждой половине обода (было 32 → ×1.875). */
  rimRivetsPerHalf: 60,
  /** Было 0.007 — минус 50% */
  rimRivetRadius: 0.0035,
  rimRivetRadialInset: 0.012,
  rimWasherRadius: 0.005,
  rimWasherHeight: 0.0008,
  handleRivetRadius: 0.0075,
  handleRivetEndInset: 0.01,
  handleRivetFront: 0.0015,
  /** Зазор спинки ручки от плоскости берёсты */
  handleSeatGap: 0.0012,
  color: '#b48445',
  roughness: 0.34,
  metalness: 0.86,
  env: 0.4,
}
/**
 * Донастройка после attach на новый корпус (shkaf_for_D сдвинут по X ≈ +0.028).
 * position — локальный offset на узле shkaf; scale — множитель к текущему scale.
 */
export const GLB_BACKWALL_ALIGN = {
  // 0.048 увёл вправо; дельта корпуса ≈ +0.028
  position: [0.026, 0, 0],
  scale: 1,
}

/**
 * AI-фасад закрытых дверей.
 * Closed → нода closed_doors_facade; open → door_* с теми же PBR-картами.
 *
 * USE_BAKED_CLOSED_DOORS=true — фасад уже в shkaf.glb (не грузим doors-closed.glb ~90MB).
 */
export const SHKAF_CLOSED_DOORS_VERSION = '2'
export const SHKAF_CLOSED_DOORS_PATH = `${assetBase}models/doors-closed.glb?v=${SHKAF_CLOSED_DOORS_VERSION}`
export const USE_CLOSED_DOORS_FACADE = false
/** true — closed_doors_facade уже в shkaf.glb; отдельный doors-closed.glb не качаем */
export const USE_BAKED_CLOSED_DOORS = true
/** true — карты с фасада на лице door_* (изнанка — тёмная медь) */
export const USE_AI_DOOR_TEXTURES = false
export const CLOSED_DOORS_NODE_NAME = 'closed_doors_facade'
/**
 * Подгонка группы к фасаду шкафа.
 * Новый экспорт ~на +0.68 по Z относительно рабочих дверей.
 */
export const CLOSED_DOORS_ALIGN = {
  position: [0, 0, -0.675],
  scale: [1.015, 1, 1],
}

/**
 * Зазор фаски по центру: Beresta_L/R в GLB сходятся внахлёст и перекрывают
 * V-шов дверок. Сдвигаем каждую половину от шва на эту величину (локальные ед.).
 * Крутить, если шов шире/уже меди, чем у полотна.
 */
export const BERESTA_SEAM_HALF_GAP = 0.012

/**
 * Closed facade: сдвиг каждой половины бересты к центру (только position.x).
 * Цель — щель ≈ 5–7 мм (0.006). Было 0.014 → вплотную.
 */
export const BERESTA_SEAM_HALF_OVERLAP = 0.007

/**
 * false — ножки/медальон уже верные в GLB (shkaf_for_site), не fitX / snap.
 * true — старый runtime-fit под ширину корпуса.
 */
export const USE_RUNTIME_LEG_FIT = false

/**
 * true — ножки уже в основном GLB (node_0* + medallion / раньше Table_Top_Frame).
 * false — подтягивать отдельно через attachGlbLegs(shkaf-legs.glb).
 */
export const USE_BAKED_LEGS = true

/**
 * false — не клонировать dual-pair / медальон и не трогать сечение лент.
 * Ножки = геометрия из shkaf.glb as-is.
 */
export const USE_RUNTIME_LEG_PIPELINE = false

/** HDRI из GLB шкафа — не используем, сцена настраивается отдельно */
export const USE_GLB_ENVIRONMENT = false

/** Корневой узел шкафа в Blender */
export const SHKAF_ROOT_NAME = 'SHKAF'

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
  'berestf_insige_M.002',
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
  /** Внутренний круг на ящиках — береста из GLB (не wood-stain) */
  'berestf_insige_M.001': {
    kind: 'door',
    bumpScale: 0.1,
    useNormalMap: true,
    useRoughnessMap: false,
  },
  'berestf_insige_M.002': {
    kind: 'door',
    bumpScale: 0.1,
    useNormalMap: true,
    useRoughnessMap: false,
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
  'Btresta_inside.001': 'berestf_insige_M.002',
  'Btresta_inside.002': 'berestf_insige_M.002',
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
  /** v45: база-∞ (старый экспорт) */
  'Table_Top_Frame',
  /** Закрытый AI-фасад (baked в основной GLB) — иначе hideSceneDecor скроет */
  'closed_doors_facade',
  /** Внутренний каркас дверок (Cube / Cube.001) */
  'Cube',
  'Cube.001',
  'door_inner_frame_L',
  'door_inner_frame_R',
  /**
   * v46 doors_front_back.glb: корень экспорта + ножки/двери/медальоны
   * лежат siblings в сцене (не внутри shkaf).
   * Three.js GLTFLoader склеивает «.001» → «001» (node_0.001 → node_0001).
   */
  'shkaf_closed_export',
  'node_0',
  'node_0.001',
  'node_0.002',
  'node_0001',
  'node_0002',
  'leg_cross_medallion_logo',
  'leg_cross_medallion_rivet_0',
  'leg_cross_medallion_rivet_1',
  'leg_cross_medallion_logo.001',
  'leg_cross_medallion_rivet_0.001',
  'leg_cross_medallion_rivet_1.001',
  'leg_cross_medallion_logo001',
  'leg_cross_medallion_rivet_0001',
  'leg_cross_medallion_rivet_1001',
  /** v47: внутренний круг бересты вынесен в корень сцены */
  'Btresta_inside.001',
  'Btresta_inside.002',
  'Btresta_inside001',
  'Btresta_inside002',
]

/**
 * Ножки в основном GLB.
 * v46: node_0 / node_0002 (ленты), node_0001 — полотно дверей (M_ClosedDoors_AI).
 */
export const GLB_LEG_NODES = USE_BAKED_LEGS
  ? ['node_0', 'node_0.002', 'node_0002', 'BézierCurve', 'BézierCurve.001', 'BézierCurve004', 'BézierCurve004.001', 'Table_Top_Frame']
  : ['leg_front_o', 'leg_letter_o']

/** Top-level siblings шкафа в v46+ (после sanitization имён GLTFLoader) */
export const CABINET_SCENE_ROOT_RE = /^(shkaf|node_0|leg_cross_medallion|closed_doors|Table_Top|door_|Btresta_inside)/i
/**
 * Позиции ножек на узле shkaf — из shkaf-legs.glb (геометрия центрирована в mesh,
 * в отличие от main shkaf.glb где offset вшит в вершины).
 */
export const GLB_LEG_TRANSFORMS = {
  leg_front_o: { position: [6.8722, 0.2391, 0.6595] },
  leg_beck_o: { position: [6.8722, 0.2391, 0.2335] },
}
/**
 * Старые X-ножки (model / model.001) в shkaf_for_D.glb — битый X-transform (−25).
 * Прячем, когда активна база Table_Top_Frame.
 */
export const BAKED_LEG_HIDE_NODES = ['model', 'model.001']
/** bbox.min.y шкафа с ножками — fallback, если ножки ещё не в дереве */
export const GLB_LEG_FLOOR_MIN_Y = 0.0222
export const USE_PROCEDURAL_LEGS = false

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
export const DRAWER_FRONT_NODES = [
  'drawer_tl',
  'drawer_tl.001',
  'drawer_tl.002',
  'drawer_tl.003',
  'drawer_tr',
  'drawer_bl',
  'drawer_br',
]

/** @deprecated 2D-оверлеи — таблички теперь в GLB */
export const DRAWER_PLAQUES = {}

/** Декоративные ноды — не кликабельны (drawer_1/drawer_2 — контейнеры, не трогаем) */
export const INACTIVE_DRAWER_NODES = new Set()

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
 * v57 cinematic: drawer_tl / drawer_tl.001 / .002 / .003 = tl / bl / tr / br.
 */
export const SHKAF_NODE_MAP = {
  door_left: DOOR_PIVOT_NODES.left,
  door_right: DOOR_PIVOT_NODES.right,
  drawer_1: 'drawer_1',
  drawer_2: 'drawer_2',
}
