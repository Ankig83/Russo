// studioScene.js — все настройки студии, правки только здесь
const assetBase = import.meta.env.BASE_URL

/**
 * true  — материалы из GLB + applyRawMaterialPipeline (USE_MATERIAL_FIXUPS управляет fixups).
 * false — legacy: delit-патина + applyStudioMaterialFixups после load (async useEffect).
 */
export const USE_RAW_GLB_MATERIALS = true

/** true — anti-glare: beresta matte, corpus satin, cap specular/env */
export const USE_MATERIAL_FIXUPS = true

/** Sculpted light: HDRI + key/rim + beresta на круг */
export const USE_SCULPTED_LIGHT = true
/** Как Blender World + мягкий key/rim для объёма */
export const USE_HDRI_ONLY = false

/** Плитка пола из Blender (POL.glb) */
export const STUDIO_FLOOR_TILE_VERSION = '3'
export const STUDIO_FLOOR_TILE_PATH = `${assetBase}models/studio-floor-tile.glb?v=${STUDIO_FLOOR_TILE_VERSION}`
export const USE_STUDIO_FLOOR_TILE = true

/** RectArea: двери (0) vs корпус (1) — раздельный свет */
export const USE_SPLIT_CORPUS_LIGHT = true
export const LIGHT_LAYERS = {
  doors: 0,
  corpus: 1,
}

/**
 * Hero-look в стиле adidas CHILE20 (Active Theory): тёмная сцена,
 * светящийся вертикальный луч-портал за шкафом + контровой свет.
 * Переключатель — не ломает обычную студию.
 */
export const USE_HERO_LOOK = true

/** Настройки геройской сцены: лайтбокс-стена + отражающий пол */
export const HERO = {
  /** Тёмный фон, чтобы лайтбокс читался */
  background: '#050505',
  /** Светящаяся стена-лайтбокс за шкафом — молочный рассеянный свет */
  lightbox: {
    /** молочно-белый (чуть тёплый) */
    color: '#fff6ec',
    /** высота как у бывшего луча, ширина ~3 шкафа */
    position: [0, 3.0, -2.4],
    width: 4.2,
    height: 6.4,
    /** яркость (>1 → уходит за bloom threshold, светится как луч) */
    strength: 2.6,
    /** мягкость краёв (0..0.5 от размера) */
    feather: 0.14,
  },
  /** Рассеянный fill-свет от лайтбокса на шкаф (area light) */
  fillLight: {
    color: '#fff4ea',
    position: [0, 2.7, -1.95],
    aimAt: [0, 1.2, 0],
    width: 4.2,
    height: 6.0,
    intensity: 2.4,
  },
  /** Ободковый свет сверху-сзади — очерчивает силуэт */
  rimLight: {
    color: '#ffe9d6',
    position: [0.6, 3.4, -2.0],
    intensity: 2.0,
    distance: 8,
    decay: 2,
  },
  /** Отражающий пол (drei MeshReflectorMaterial) */
  floor: {
    color: '#070707',
    size: 44,
    resolution: 512,
    mirror: 0.78,
    blur: [220, 80],
    mixBlur: 1.1,
    mixStrength: 3.4,
    roughness: 0.82,
    metalness: 0.55,
  },
  /** Объёмный логотип РУССО (экструзия из SVG) на лайтбоксе выше шкафа */
  logo: {
    src: `${assetBase}images/russo-logo.svg`,
    /** позиция центра знака (ниже, чем раньше — по сетке лайтбокса) */
    position: [0, 3.55, -2.28],
    /** целевая ширина знака в мире (чуть меньше — пропорционально) */
    width: 3.2,
    /** глубина экструзии в единицах SVG (до масштабирования) */
    depth: 18,
    color: '#0c0c0c',
    metalness: 0.55,
    roughness: 0.36,
  },
}

/** PBR — satin/металл, без зеркального засвета (split light на корпус) */
export const CORPUS_PBR = {
  patina: { metalness: 0.88, roughness: 0.5, env: 0.68, specular: 0.12 },
  bodyShell: {
    metalness: 0.74,
    roughness: 0.56,
    env: 0.38,
    specular: 0.1,
    colorTint: '#8a7058',
  },
  baseCopper: {
    metalness: 0.78,
    roughness: 0.6,
    env: 0.34,
    specular: 0.1,
    color: '#2a150c',
  },
  /** Простая тёмная медь для корпуса shkaf и ножек — плоский тон, слабые блики */
  plainDarkCopper: {
    color: '#5c2e17',
    metalness: 0.7,
    roughness: 0.4,
    env: 0.26,
    specular: 0.07,
  },
  /**
   * Панель двери (patina_PBR) — гладкий матовый премиум как в референсе.
   * relief-карты снимаются, свет ложится ровно, без зерна.
   */
  doorPanel: {
    /** оставить текстуру GLB (true) или сделать сплошной цвет (false) */
    useAlbedo: false,
    /** молочный матовый как в референсе (эксперимент, без старой текстуры) */
    color: '#d8d0c4',
    metalness: 0.0,
    roughness: 0.6,
    env: 0.35,
    specular: 0.1,
  },
}

/** Береста — matte, без белого засвета от RectArea + HDRI */
export const BERESTA_PBR = {
  color: '#ffffff',
  roughness: 0.88,
  bumpScale: 0.024,
  env: 0.14,
  specular: 0.05,
}

/**
 * Только envMapIntensity — цвет/roughness/metalness из GLB не трогаем.
 * Металл читается от HDRI; matte — слабее env.
 */
export const MATERIAL_ENV_INTENSITY = {
  door_right: 1.0,
  door_left: 1.0,
  base_copper: 0.85,
  'Scratched copper metal': 0.9,
  'M_Brass_Premium.001': 0.95,
  'M_Brass_Rivet': 0.85,
  door_side: 0.75,
  door_back: 0.75,
  'door_back.001': 0.75,
  'M_Beresta_Final.001': 0.12,
  'berestf_insige_M.001': 0.12,
  'bes=resta_W_M': 0.12,
  'Leather Dark Brown': 0.18,
  prostranstva: 0.2,
  avtorskie_m: 0.2,
  project_M: 0.2,
  about: 0.2,
  default: 0.65,
}

/** Потолок KHR specular — главный источник белых полос на металле */
export const MATERIAL_SPECULAR_CAP = 0.18

export const STUDIO = {
  /** IBL — background={false}, cyclorama из StudioBackdrop */
  env: {
    url: `${assetBase}HDRI/ferndale_studio_03_2k.exr?v=1`,
    /** если задан — url игнорируется (drei preset: studio, warehouse, …) */
    preset: null,
    intensity: 0.92,
    /** floor env = intensity × floorEnvScale */
    floorEnvScale: 0.45,
  },
  backdrop: {
    floorColor: '#0e0e0e',
    wallBottomColor: '#0a0a0a',
    wallTopColor: '#121212',
    wallZ: -5.5,
    wallHeight: 11,
    width: 52,
    floorFront: 7,
  },
  floorTile: {
    /** одна плитка, м */
    tileSize: [2, 2],
    /** плоскость пола, м — центр в (0, 0, 0); 11×11 плиток = 22×22 */
    planeSize: [22, 22],
    /** env задаётся в StudioFloor: STUDIO.env.intensity × envScale */
    roughness: 0.5,
    metalness: 0.14,
    envScale: 0.45,
    specular: 0.09,
  },
  horizon: {
    size: 36,
    y: -0.04,
    color: '#060606',
    edgeColor: '#0c0c0e',
    roughness: 0.84,
    metalness: 0.08,
    /** env = STUDIO.env.intensity × envScale */
    envScale: 0.14,
  },
  camera: {
    fov: 34,
    position: [0, 1.0, 5.25],
    target: [0, 1.0, 0],
  },
  /** Шкаф — центр плоскости пола (getCabinetPlacement → origin) */
  object: {
    position: [0, 0, 0],
  },
  orbit: {
    minAzimuth: -0.42,
    maxAzimuth: 0.42,
    minPolar: 1.22,
    maxPolar: 1.58,
    minDistance: 2,
    maxDistance: 12,
    enablePan: true,
  },
  lights: {
    key: {
      position: [3.8, 3.8, 3.5],
      width: 5.5,
      height: 6.5,
      intensity: 0.22,
      color: '#fff4ea',
    },
    rim: {
      position: [-4.0, 3.4, -2.5],
      /** выше центра шкафа — меньше удар по полу слева */
      aimAt: [0, 1.35, 0],
      width: 2.2,
      height: 3.5,
      intensity: 0.1,
      color: '#b8c8e8',
    },
    fill: {
      position: [0, 2.2, 5.0],
      width: 3.5,
      height: 3.0,
      intensity: 0.04,
      color: '#f0f0f0',
    },
    /** Береста — узкий фронтальный, без пересвета круга */
    beresta: {
      position: [0, 1.55, 2.8],
      target: [0, 1.12, 0],
      width: 2.2,
      height: 2.0,
      intensity: 0.12,
      color: '#fff5e8',
    },
    ambient: 0.04,
    corpus: {
      position: [0, 1.05, 4.2],
      width: 3.8,
      height: 6.5,
      intensity: 0.15,
      color: '#e8d0b0',
    },
    corpusRim: {
      position: [0, 3.2, -2.8],
      width: 5.0,
      height: 1.6,
      intensity: 0.14,
      color: '#b0a090',
    },
    /** Directional — тени; intensity низкий, чтобы не заливать пол */
    shadow: {
      position: [3.5, 8, 3.2],
      target: [0, 1.05, 0],
      intensity: 0.16,
      color: '#fff0e6',
      mapSize: 1536,
      radius: 2.5,
      camera: { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 18 },
      bias: -0.0002,
      normalBias: 0.03,
    },
  },
  shadow: {
    position: [0, 0.002, 0],
    opacity: 0.62,
    blur: 2.2,
    far: 4.2,
    resolution: 1024,
    scale: 9,
    color: '#000000',
  },
  postprocessing: {
    aoRadius: 1.6,
    aoIntensity: 1.5,
    bloomIntensity: 0.07,
    bloomThreshold: 0.88,
    bloomSmoothing: 0.2,
    noiseOpacity: 0.025,
    vignetteOffset: 0.68,
    vignetteDarkness: 0.32,
    contrast: 0.08,
    brightness: 0.01,
    saturation: 0.05,
  },
}

/**
 * Временный look по референсу: чёрная пустота, rim справа-сзади, мягкий fill слева.
 * false — вернуть обычную студию с полом и HDRI.
 */
export const USE_REFERENCE_VOID_LOOK = false

/** Пресет окружения / света / камеры для USE_REFERENCE_VOID_LOOK */
export const REFERENCE_VOID = {
  background: '#000000',
  envIntensity: 0.2,
  showBackdrop: false,
  showFloor: false,
  showHorizon: false,
  showEnvironment: true,
  splitCorpusLight: false,
  contactShadows: false,
  directionalShadow: false,
  toneMappingExposure: 1.0,
  postFX: false,
  camera: {
    fov: 38,
    position: [0, 0.88, 5.85],
    target: [0, 1.05, 0],
  },
  orbit: {
    minAzimuth: -0.55,
    maxAzimuth: 0.55,
    minPolar: 1.18,
    maxPolar: 1.62,
    minDistance: 2.2,
    maxDistance: 14,
    enablePan: true,
  },
  lights: {
    ambient: 0.02,
    rim: {
      position: [6.2, 3.6, -3.8],
      aimAt: [0, 1.08, 0],
      width: 2.4,
      height: 7.5,
      intensity: 1.6,
      color: '#ffffff',
    },
    fill: {
      position: [-5.2, 2.0, 4.8],
      width: 4.8,
      height: 5.8,
      intensity: 0.38,
      color: '#ddd8ce',
    },
  },
  postprocessing: {
    aoIntensity: 0,
    bloomIntensity: 0.11,
    bloomThreshold: 0.9,
    noiseOpacity: 0,
    vignetteOffset: 0.55,
    vignetteDarkness: 0.48,
    contrast: 0.2,
    brightness: -0.04,
    saturation: -0.1,
  },
}

export function isReferenceVoidLook() {
  return USE_REFERENCE_VOID_LOOK
}

/** Split corpus light отключаем в reference void — иначе корпус на layer 1 без IBL даёт артефакты */
export function getEffectiveSplitCorpusLight() {
  if (USE_REFERENCE_VOID_LOOK && REFERENCE_VOID.splitCorpusLight === false) return false
  return USE_SPLIT_CORPUS_LIGHT
}

/** IBL intensity — единая точка для пола/горизонта/Environment */
export function getStudioEnvIntensity() {
  if (USE_REFERENCE_VOID_LOOK) return REFERENCE_VOID.envIntensity
  return STUDIO.env.intensity
}

export function getFloorTileEnvIntensity() {
  return STUDIO.env.intensity * STUDIO.floorTile.envScale
}

export function getHorizonEnvIntensity() {
  return STUDIO.env.intensity * (STUDIO.horizon.envScale ?? 0.14)
}

/** @deprecated — use STUDIO.env.url */
export const STUDIO_HDRI_URL = STUDIO.env.url

/** @deprecated — use STUDIO.env.intensity */
export const HDRI_ENVIRONMENT_INTENSITY = STUDIO.env.intensity

export const USE_STUDIO_CAMERA = true

/** Плавный въезд камеры на старте (из точки from → в STUDIO.camera.position) */
export const CAMERA_INTRO = {
  enabled: true,
  from: [0, 2.0, 9.6],
  duration: 2.4,
  delay: 0.2,
  ease: 'power3.out',
}

export const DEBUG_LOG_CAMERA_POSITION = false

/**
 * GPU-профили — Scene выбирает tier автоматически (desktop → medium).
 * forceTier: 'low'|'medium'|'high' или ?perf=low в URL
 */
export const STUDIO_PERFORMANCE = {
  // 'medium' стабилен на слабых/AMD GPU: без N8AO/normalPass/шума — чётче и без потери WebGL-контекста
  forceTier: 'medium',
  defaultTier: 'medium',
  tiers: {
    low: {
      dpr: [1, 1],
      antialias: false,
      postFX: true,
      n8ao: false,
      bloom: false,
      noise: false,
      multisampling: 0,
      normalPass: false,
      shadowMapSize: 512,
      contactShadowResolution: 512,
      floorPlaneSize: [14, 14],
      pcfSoftShadows: false,
    },
    medium: {
      dpr: [1, 1.75],
      antialias: true,
      postFX: true,
      n8ao: false,
      bloom: true,
      noise: false,
      multisampling: 4,
      normalPass: false,
      shadowMapSize: 1024,
      contactShadowResolution: 1024,
      floorPlaneSize: [18, 18],
      pcfSoftShadows: true,
    },
    high: {
      dpr: [1, 1.5],
      antialias: true,
      postFX: true,
      n8ao: true,
      bloom: true,
      noise: true,
      multisampling: 2,
      normalPass: true,
      shadowMapSize: 1536,
      contactShadowResolution: 1024,
      floorPlaneSize: [22, 22],
      pcfSoftShadows: true,
    },
  },
}
