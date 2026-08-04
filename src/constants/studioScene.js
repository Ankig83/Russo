// studioScene.js — все настройки студии, правки только здесь
const assetBase = import.meta.env.BASE_URL

/**
 * true  — материалы из GLB + applyRawMaterialPipeline (USE_MATERIAL_FIXUPS управляет fixups).
 * false — legacy: delit-патина + applyStudioMaterialFixups после load (async useEffect).
 */
export const USE_RAW_GLB_MATERIALS = true

/** true — anti-glare: beresta matte, corpus satin, cap specular/env */
export const USE_MATERIAL_FIXUPS = true

/**
 * Тёмное дерево (dark-wood-stain) на корпус снаружи + внутри + дверки.
 * false — вернуть материалы из GLB.
 */
export const USE_WOOD_DOORS = true

/**
 * Бронза (bronze-unity pack) только на ножки.
 * false — ножки как корпус (Material.002 / dark-wood-stain), без отдельного pack.
 */
export const USE_BRONZE_METAL = false

/** Sculpted light: HDRI + key/rim + beresta на круг */
export const USE_SCULPTED_LIGHT = true
/** Как Blender World + мягкий key/rim для объёма */
export const USE_HDRI_ONLY = false

/** Плитка пола из Blender (POL.glb) */
export const STUDIO_FLOOR_TILE_VERSION = '3'
export const STUDIO_FLOOR_TILE_PATH = `${assetBase}models/studio-floor-tile.glb?v=${STUDIO_FLOOR_TILE_VERSION}`
export const USE_STUDIO_FLOOR_TILE = true

/** RectArea: двери (0) vs корпус (1) — раздельный свет */
export const USE_SPLIT_CORPUS_LIGHT = false
export const LIGHT_LAYERS = {
  doors: 0,
  corpus: 1,
  accent: 2,
  interior: 3,
  /** Пол — отдельно, чтобы узкий handleShadow (ortho) не рисовал прямоугольник на бетоне */
  floor: 4,
}

/**
 * Hero-look в стиле adidas CHILE20 (Active Theory): тёмная сцена,
 * светящийся вертикальный луч-портал за шкафом + контровой свет.
 * Переключатель — не ломает обычную студию.
 */
export const USE_HERO_LOOK = true

/** Gallery rig из HERO — без StudioLights / directional; IBL — через HERO.env. */
export const HERO_LIGHTBOX_ONLY = true

/**
 * true — выключить ВСЕ источники и IBL (HeroBackdrop / StudioLights / Environment).
 * Сцена остаётся чёрной; меши видны только если есть unlit/emissive.
 */
export const USE_NO_LIGHTS = true

/**
 * Premium catalog lighting (Loewe / Poltrona Frau):
 * warm key + cool rim + soft fill + brass accent + interior LED.
 * Старые значения закомментированы ниже для отката.
 */
export const HERO = {
  background: '#000000',
  /**
   * IBL — микроблики / контактные тона на меди и бересте.
   * background={false}: void остаётся чёрным, HDRI только как envMap.
   * Poly Haven studio_small_08 — компактная студия, мягкие софтбоксы.
   */
  env: {
    url: `${assetBase}HDRI/studio_small_08_2k.hdr?v=1`,
    preset: null,
    /** IBL только формирует микроблики; основной рисунок даёт key. */
    intensity: 0.16,
  },
  /*
   * PREV — rect-area rig (до three-point retune):
   * keyLight: { color:'#ffe3cc', position:[-3.4,4.1,4.4], aimAt:[0,1.28,0.02],
   *   width:6.8, height:7.2, closedIntensity:1.12, openIntensity:0.62 }
   * rimLight: { color:'#dce8ff', position:[1.2,4.0,-2.8], aimAt:[0,1.55,0],
   *   width:1.6, height:3.6, intensity:0.1 }
   * fillLight: { color:'#dce6f2', position:[3.4,2.4,3.6], aimAt:[0,1.25,0.05],
   *   width:5.4, height:6.2, intensity:0.16 }
   */
  /**
   * KEY — spot сбоку-сверху под ~45°. Именно spot, а не RectAreaLight:
   * area-свет в three.js не умеет castShadow, поэтому ручки не давали тень
   * на берестяной круг. Этот же источник рисует тень шкафа на полу.
   */
  keyLight: {
    color: '#fff4e0',
    temperature: 4200,
    position: [3.5, 4.3, 3.5],
    aimAt: [0, 1.3, 0.05],
    angle: 0.55,
    penumbra: 1,
    distance: 24,
    decay: 1.4,
    closedIntensity: 22,
    openIntensity: 12,
    shadow: {
      mapSize: 2048,
      /** Мягче на полу — край shadow-map не читается как прямоугольник */
      radius: 12,
      blurSamples: 28,
      camera: { near: 0.8, far: 20 },
      /** -0.0005 + normalBias 0.02 — убирает shadow acne (полосы на корпусе/полу) */
      bias: -0.0005,
      normalBias: 0.02,
    },
  },
  /** RIM / contre-jour — spot сзади, холодный: отделяет корпус от чёрного фона */
  rimLight: {
    color: '#e0f4ff',
    temperature: 7000,
    position: [-2.7, 3.9, -3.0],
    aimAt: [0.1, 1.85, 0.2],
    angle: 0.34,
    penumbra: 0.85,
    distance: 20,
    decay: 1.4,
    intensity: 38,
  },
  /** FILL — ambient ~12% от key: поднимает глухие тени, не убивая контраст */
  fillLight: {
    color: '#dce6f2',
    intensity: 0.045,
  },
  /**
   * Kick на перекрестье ∞ / медальон — key целится в корпус (y≈1.3),
   * низ тонет в тени корпуса. Без castShadow, чтобы не плодить вторую тень на полу.
   */
  legKickLight: {
    color: '#ffe6c8',
    position: [0.95, 1.15, 3.4],
    /** в перекрестье ∞ / лицо медальона (не в корпус) */
    aimAt: [0, 0.28, -0.2],
    angle: 0.48,
    penumbra: 0.88,
    distance: 14,
    decay: 1.3,
    /** сильнее при открытых дверях — низ иначе в тени корпуса */
    closedIntensity: 36,
    openIntensity: 48,
  },
  /**
   * Выключено: узкий ortho directional рисовал на полу чёрный прямоугольник
   * (проекция frustum). Тени ручек на бересте даёт key-spot.
   */
  handleShadow: null,
  /** Узкий accent на латунь (рейки / ручки) */
  accentLight: {
    color: '#ffe0bd',
    temperature: 4300,
    position: [1.6, 1.9, 2.85],
    aimAt: [0, 1.38, 0.35],
    width: 0.22,
    height: 2.1,
    closedIntensity: 0.28,
    openIntensity: 0.2,
  },
  /** Interior warm LED ~2700K — только при открытых дверях */
  interiorLight: {
    color: '#ffb870',
    temperature: 2700,
    position: [0, 2.22, 0.02],
    aimAt: [0, 1.1, -0.15],
    width: 1.35,
    height: 0.14,
    closedIntensity: 0,
    openIntensity: 2.85,
  },
  /** Пол — матовый бетон (текстура), без отражений, falloff в void */
  floor: {
    color: '#ffffff',
    radius: 6.2,
    textureRepeat: [2.6, 2.6],
    normalScale: 0.18,
    roughness: 1,
    metalness: 0,
    falloff: { inner: 1.15, outer: 3.9 },
    /** Ниже — меньше «заливка» shadowMaterial, читается только тень от key */
    shadowOpacity: 0.38,
  },
  /**
   * Contact shadow под ножками — размывается по мере удаления от точки касания.
   * Основную перспективную тень на полу даёт keyLight (spot, castShadow),
   * поэтому отдельный shadow-spot в hero не нужен.
   */
  /** Мягкий контакт только под ножками — scale больше корпуса давал квадрат на полу */
  contactShadow: {
    position: [0, 0.04, 0],
    opacity: 0.42,
    blur: 4.5,
    far: 0.7,
    scale: 2.6,
    color: '#000000',
  },
  /** Hero post — мягче AO / контраст, чтобы тени не уходили в pure black */
  toneMappingExposure: 0.9,
  postprocessing: {
    /** Узкий AO — мелкие контактные тени вместо широкой грязной каймы. */
    aoRadius: 0.24,
    aoIntensity: 0.72,
    bloomIntensity: 0.02,
    bloomThreshold: 1.05,
    bloomSmoothing: 0.28,
    noiseOpacity: 0,
    vignetteOffset: 0.78,
    vignetteDarkness: 0.08,
    contrast: 0.015,
    brightness: 0.012,
    saturation: -0.01,
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
   * Панель двери (patina_PBR) — сохраняем GLB baseColor с патиной.
   * В hero-lightbox режиме HDRI выключен, поэтому pure-metal карта тонет в тени:
   * умеренный metalness даёт читать albedo под прямым RectAreaLight.
   */
  doorPanel: {
    useAlbedo: true,
    color: '#ffffff',
    metalness: 0.38,
    roughness: 0.68,
    env: 0.42,
    specular: 0.08,
  },
}

/** Береста — тёплая, с рельефом прожилок (normal + bump из GLB) */
export const BERESTA_PBR = {
  /**
   * Множитель albedo. #ffffff = как в GLB (baseColorFactor не задан).
   * Не тинтить — иначе уходит от оригинальной береста_темная.
   */
  color: '#ffffff',
  roughness: 0.74,
  /** GLB normal = albedo, не используем; рельеф через bump */
  normalScale: 1,
  bumpScale: 0.1,
  env: 0.18,
  specular: 0.08,
  sheen: 0.1,
  sheenRoughness: 0.68,
  sheenColor: '#d8a860',
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
    url: `${assetBase}HDRI/studio_small_08_2k.hdr?v=2`,
    /** если задан — url игнорируется (drei preset: studio, warehouse, …) */
    preset: null,
    intensity: 0.34,
    /** floor env = intensity × floorEnvScale */
    floorEnvScale: 0.45,
  },
  backdrop: {
    floorColor: '#ffffff',
    wallBottomColor: '#737d7c',
    wallTopColor: '#4b5655',
    wallZ: -5.5,
    wallHeight: 11,
    width: 52,
    floorFront: 7,
    /** Стены остаются физическими, но углы вынесены за кадр как в референсе. */
    roomLeftX: -7.5,
    roomRightX: 7.5,
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
    color: '#ffffff',
    edgeColor: '#68706d',
    roughness: 0.91,
    metalness: 0,
    /** env = STUDIO.env.intensity × envScale */
    envScale: 1.05,
  },
  camera: {
    fov: 32,
    position: [0, 1.28, 5.15],
    target: [0, 1.28, 0],
  },
  /** Шкаф — центр корпуса на x=0 (лайтбокс / логотип); alignOffset — ручной дотюнинг */
  object: {
    position: [0, 0, 0],
    alignOffset: [0, 0, 0],
  },
  orbit: {
    minAzimuth: -0.42,
    maxAzimuth: 0.42,
    minPolar: 1.22,
    maxPolar: 1.58,
    /** Приближение — без изменений; отдаление — не дальше стартового кадра (см. STUDIO_CAMERA_START_DISTANCE) */
    minDistance: 2,
    maxDistance: 12,
    enablePan: true,
    /** Ограничения ПКМ-pan относительно STUDIO.camera.target */
    panLimits: {
      targetOffset: { x: 0.3, y: 0.38, z: 0.25 },
      minCameraY: 0.55,
      maxCameraY: 2.75,
    },
  },
  lights: {
    key: {
      position: [-3.8, 4.4, 4.2],
      width: 6.8,
      height: 7.5,
      intensity: 0.82,
      color: '#fff1e3',
    },
    rim: {
      position: [-4.0, 3.4, -2.5],
      /** выше центра шкафа — меньше удар по полу слева */
      aimAt: [0, 1.35, 0],
      width: 2.2,
      height: 3.5,
      intensity: 0.07,
      color: '#cbd7de',
    },
    fill: {
      position: [3.8, 2.2, 4.5],
      width: 5.5,
      height: 6.2,
      intensity: 0.19,
      color: '#dce4e5',
    },
    /** Береста — узкий фронтальный, без пересвета круга */
    beresta: null,
    ambient: 0.085,
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
    /** Большой spot спереди-слева: перспективная мягкая тень уходит к задней стене. */
    shadow: {
      position: [-4.6, 7.2, 4.8],
      target: [0.15, 0.9, -0.55],
      intensity: 10,
      color: '#fff0e6',
      angle: 1.02,
      penumbra: 1,
      distance: 22,
      decay: 1.55,
      mapSize: 2048,
      radius: 8,
      blurSamples: 24,
      camera: { near: 0.5, far: 24 },
      bias: -0.00012,
      normalBias: 0.018,
    },
  },
  shadow: {
    position: [0, 0.043, 0],
    opacity: 0.28,
    blur: 3.8,
    far: 0.48,
    resolution: 1024,
    scale: 3.4,
    color: '#000000',
  },
  postprocessing: {
    aoRadius: 0.28,
    aoIntensity: 0.62,
    bloomIntensity: 0,
    bloomThreshold: 1.15,
    bloomSmoothing: 0.2,
    noiseOpacity: 0,
    vignetteOffset: 0.62,
    vignetteDarkness: 0.24,
    contrast: 0.06,
    brightness: 0,
    saturation: -0.035,
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

/** Дистанция hero-камеры на старте — max zoom out (desktop) */
export const STUDIO_CAMERA_START_DISTANCE = getStudioCameraStartDistance(STUDIO.camera)

/**
 * Hero-кадр на мобильных (<768px) — отдельно от десктопа.
 * Старт: крупный план шкафа (3/4), логотип на лайтбоксе за кадром.
 * Отдаление двумя пальцами открывает лайтбокс и знак РУССО.
 */
export const STUDIO_MOBILE = {
  camera: {
    fov: 34,
    position: [0, 1.22, 5.8],
    target: [0, 1.22, 0],
  },
  orbit: {
    minAzimuth: -0.55,
    maxAzimuth: 0.55,
    minPolar: 1.1,
    maxPolar: 1.65,
    minDistance: 1.5,
    maxDistance: 10,
    /** Два пальца: pinch = zoom, сдвиг = pan (как ПКМ на десктопе) */
    enablePan: true,
    panLimits: {
      targetOffset: { x: 0.3, y: 0.42, z: 0.25 },
      minCameraY: 0.35,
      maxCameraY: 2.75,
    },
    rotateSpeed: 0.72,
    zoomSpeed: 0.9,
    panSpeed: 1,
  },
}

export function getStudioCameraStartDistance(cam) {
  const p = cam.position
  const t = cam.target
  return Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2])
}

export function getStudioCameraConfig(isMobile) {
  return isMobile ? STUDIO_MOBILE.camera : STUDIO.camera
}

export function getStudioOrbitConfig(isMobile) {
  if (!isMobile) return STUDIO.orbit
  return { ...STUDIO.orbit, ...STUDIO_MOBILE.orbit }
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
  if (USE_HERO_LOOK && HERO.env?.intensity != null) return HERO.env.intensity
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

/** Плавный въезд камеры на старте — выключен, используем STUDIO.camera */
export const CAMERA_INTRO = {
  enabled: false,
  from: [0, 2.0, 9.6],
  duration: 2.4,
  delay: 0.2,
  ease: 'power3.out',
}

export const DEBUG_LOG_CAMERA_POSITION = true

/**
 * GPU-профили — Scene выбирает tier автоматически (desktop → medium).
 * forceTier: 'low'|'medium'|'high' или ?perf=low в URL
 */
export const STUDIO_PERFORMANCE = {
  // null = mobile/слабые устройства получают low автоматически.
  // Для диагностики профиль можно переопределить через ?perf=low|medium|high.
  forceTier: null,
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
