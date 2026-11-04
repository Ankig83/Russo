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
 * false — материалы из GLB (M_AgedCopper / M_GreenAcrylic после bake).
 */
export const USE_WOOD_DOORS = false

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
  /**
   * CINEMATIC reflectors — как Blender visible_camera=false:
   * камера слой не видит, меши остаются в сцене (diffuse/glossy bounce в Cycles;
   * в three.js — для будущего probe / не кликаются).
   */
  reflector: 5,
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
export const USE_NO_LIGHTS = false

/**
 * CINEMATIC_STUDIO из D:\Temp\render_2.blend1.blend
 * Area lights KEY/FILL/BACK/TOP_RIM + CINEMATIC_CAMERA 75mm.
 * Blender Z-up → Three (x, z, -y). Aim — центр изделия.
 */
export const HERO = {
  background: '#000000',
  /**
   * IBL для бликов на меди/латуни.
   * P0: было 0.08 + LDR — металл тонул в чёрном; HDR + 0.45 читает отражения.
   */
  env: {
    url: `${assetBase}HDRI/studio_small_08_2k.hdr?v=1`,
    ldrUrl: `${assetBase}HDRI/hunyuan_gallery_eq.webp?v=1`,
    useLdr: false,
    preset: null,
    intensity: 0.45,
    background: false,
  },
  /** CINEMATIC_CAMERA: 75mm / sensor 36 → fov ≈ 27° */
  camera: {
    fov: 27,
    position: [3.345, 1.689, 11.938],
    target: [-0.407, 1.346, 0.131],
  },
  cameraMobile: {
    fov: 30,
    position: [2.4, 1.55, 9.2],
    target: [0, 1.3, 0.05],
  },
  /**
   * KEY_LIGHT — Area DISK Ø5, energy 1050, warm.
   * RectArea даёт форму как в Blender; тень пола — отдельный shadowSpot.
   */
  keyLight: {
    type: 'area',
    color: '#ffd1a5',
    position: [-3.5, 5.4, 5.2],
    aimAt: [0, 1.35, 0],
    width: 5,
    height: 5,
    /** P0: area — форма; не гасить при open */
    closedIntensity: 2.1,
    openIntensity: 1.55,
  },
  /** Shadow-only вдоль KEY — не должен быть главным «прожектором» кадра */
  shadowSpot: {
    color: '#ffd1a5',
    position: [-3.5, 5.4, 5.2],
    aimAt: [0, 1.2, 0],
    angle: 0.55,
    penumbra: 1,
    distance: 28,
    decay: 1.4,
    /** P0: было 14/10 — пятно забивало area + IBL */
    closedIntensity: 3.5,
    openIntensity: 2.4,
    shadow: {
      mapSize: 2048,
      radius: 10,
      blurSamples: 24,
      camera: { near: 0.8, far: 24 },
      bias: -0.0005,
      normalBias: 0.04,
    },
  },
  /** BACK_LIGHT — холодный rim Area DISK Ø3, energy 500 */
  rimLight: {
    type: 'area',
    color: '#a5bfff',
    position: [0, 3.0, -3.5],
    aimAt: [0, 1.55, 0],
    width: 3,
    height: 3,
    intensity: 1.15,
  },
  /** FILL_LIGHT — Area DISK Ø5, energy 240 */
  fillLight: {
    type: 'area',
    color: '#b7c6d8',
    position: [2.5, 2.5, 3.0],
    aimAt: [0, 1.3, 0],
    width: 5,
    height: 5,
    intensity: 0.72,
  },
  /** TOP_RIM_LIGHT — Area DISK Ø4, energy 950 */
  topRimLight: {
    type: 'area',
    color: '#ffeac6',
    position: [0.8, 5.0, -1.0],
    aimAt: [0, 1.7, 0],
    width: 4,
    height: 4,
    intensity: 1.25,
  },
  /** В cinematic-риге Blender kick/ambient нет */
  legKickLight: null,
  /** Тень ручки на бересте — служебный, не из Blender */
  handleShadow: {
    type: 'spot',
    color: '#ffe4c8',
    position: [2.4, 3.2, 2.2],
    aimAt: [0, 1.42, 0.4],
    angle: 0.3,
    penumbra: 0.4,
    distance: 14,
    decay: 1.2,
    intensity: 28,
    shadow: {
      mapSize: 2048,
      radius: 0.6,
      blurSamples: 4,
      bias: -0.0001,
      normalBias: 0.008,
      camera: { near: 0.4, far: 16 },
    },
  },
  accentLight: {
    color: '#ffe0bd',
    temperature: 4300,
    position: [1.6, 1.9, 2.85],
    aimAt: [0, 1.38, 0.35],
    width: 0.22,
    height: 2.1,
    closedIntensity: 0.22,
    openIntensity: 0.16,
  },
  interiorLight: {
    color: '#ffb870',
    temperature: 2700,
    position: [0, 2.22, 0.02],
    aimAt: [0, 1.1, -0.15],
    width: 1.45,
    height: 0.18,
    /** P1: лёгкий fill при закрытых; при open — читаемые ящики/акрил */
    closedIntensity: 0.18,
    openIntensity: 1.65,
  },
  /** Mossy Dark Rock из blend — без Displacement (только PBR maps) */
  floor: {
    source: 'cinematic',
    color: '#ffffff',
    radius: 8.5,
    textureRepeat: [2.0, 2.0],
    normalScale: 0.55,
    roughness: 1,
    metalness: 0,
    falloff: { inner: 2.2, outer: 7.5 },
    shadowOpacity: 0.5,
    /**
     * P1: мягкий контакт под ножками (круг, не ContactShadows-квадрат).
     * ContactShadows на hero давал чёрный прямоугольник на диске пола.
     */
    softContact: {
      enabled: true,
      radius: 1.55,
      y: 0.006,
      opacity: 0.32,
      inner: 0.35,
      outer: 1.0,
    },
  },
  /** Dark Mottled Metal — задник, имитация STUDIO_CYCLORAMA */
  cyclorama: {
    enabled: true,
    position: [0, 4.5, -4.2],
    size: [18, 10],
    color: '#ffffff',
    roughness: 0.85,
    metalness: 0.35,
    textureRepeat: [2.2, 1.1],
  },
  contactShadow: {
    position: [0, 0.04, 0],
    opacity: 0.42,
    blur: 4.5,
    far: 0.7,
    scale: 2.6,
    color: '#000000',
  },
  /** AgX exposure 0 в Blender; после поднятия IBL чуть ниже 1 */
  toneMappingExposure: 0.92,
  postprocessing: {
    aoRadius: 0.32,
    aoIntensity: 1.35,
    bloomIntensity: 0.008,
    bloomThreshold: 1.3,
    bloomSmoothing: 0.3,
    noiseOpacity: 0,
    vignetteOffset: 0.72,
    vignetteDarkness: 0.14,
    contrast: 0.02,
    brightness: 0,
    saturation: -0.02,
  },
  logo: {
    src: `${assetBase}images/russo-logo.svg`,
    position: [0, 3.55, -2.28],
    width: 3.2,
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
   * M_AgedCopper (bake Metal Brown Medium) — корпус + внутрянка дверок.
   * P0: сильный env, иначе при слабом IBL выглядит чёрным матом.
   */
  agedCopper: {
    metalness: 1,
    /** пол ниже map — не давать карте убить блик */
    roughnessMin: 0.28,
    roughnessMul: 0.92,
    env: 1.15,
    specular: 0.14,
    normalScale: 0.85,
  },
  /**
   * M_GreenAcrylic (bake Sage Green Venetian Plaster) — ящики.
   * P1: MeshPhysical + clearcoat ≈ лак/акрил в Cycles (без full transmission).
   */
  greenAcrylic: {
    metalness: 0,
    roughnessMul: 0.88,
    roughnessMin: 0.18,
    env: 0.55,
    clearcoat: 0.72,
    clearcoatRoughness: 0.2,
    specular: 0.35,
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
   * Чуть темнее GLB — иначе круг клипует в белое и тени ручек не читаются.
   */
  color: '#c9a878',
  roughness: 0.78,
  /** GLB normal = albedo, не используем; рельеф через bump */
  normalScale: 1,
  bumpScale: 0.14,
  env: 0.14,
  specular: 0.06,
  sheen: 0.08,
  sheenRoughness: 0.72,
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
  M_AgedCopper: 1.2,
  M_GreenAcrylic: 0.55,
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
    maxDistance: 16,
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
    maxDistance: 14,
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
  if (USE_HERO_LOOK && HERO.camera) {
    if (isMobile && HERO.cameraMobile) return HERO.cameraMobile
    return HERO.camera
  }
  return isMobile ? STUDIO_MOBILE.camera : STUDIO.camera
}

export function getStudioOrbitConfig(isMobile) {
  if (DEBUG_LOG_CAMERA_POSITION) return CAMERA_FRAMING_ORBIT
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

/**
 * true — постановка камеры на сайте:
 * свободный orbit (без витринных лимитов), лог pos/target в консоль + HUD.
 * После выбора кадра — false и вписать значения в HERO.camera / HERO.cameraMobile.
 */
export const DEBUG_LOG_CAMERA_POSITION = true

/** Orbit при постановке — не упираться в ±24° / panLimits */
export const CAMERA_FRAMING_ORBIT = {
  minAzimuth: -Math.PI,
  maxAzimuth: Math.PI,
  minPolar: 0.05,
  maxPolar: Math.PI / 2 - 0.02,
  minDistance: 1,
  maxDistance: 40,
  enablePan: true,
  panLimits: null,
  rotateSpeed: 0.9,
  zoomSpeed: 1,
  panSpeed: 1.1,
}

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
      /** P1: AO даёт щели/объём как слабый GI; mobile остаётся low без n8ao */
      n8ao: true,
      bloom: true,
      noise: false,
      multisampling: 4,
      normalPass: true,
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
