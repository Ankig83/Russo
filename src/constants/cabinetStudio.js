const assetBase = import.meta.env.BASE_URL

/**
 * Свет и камеры с live Blender-сцены (Z-up → Three Y-up: (x, y, z) → (x, z, -y)).
 * Area lights в GLB не едут — здесь те же координаты / размеры / цвет.
 */
export const BLENDER_AIM = [0, 1.28, -0.05]

/** Cycles Watts → RectAreaLight intensity. Ниже, потому что блик софтбоксов уже в HDR студии. */
export const AREA_ENERGY_SCALE = 0.014

/** Каталожный кроп как Cycles-кадр: телефото, почти уровень глаз, 3/4 справа. */
export const CABINET_CAMERA = {
  desktop: {
    position: [1.63, 1.79, 5.66],
    target: [0, 1.18, 0.02],
    fov: 28,
    near: 0.05,
    far: 100,
  },
  mobile: {
    position: [1.99, 1.92, 6.9],
    target: [0, 1.18, 0.02],
    fov: 30,
    near: 0.05,
    far: 120,
  },
}

export const CABINET_ORBIT = {
  desktop: {
    minAzimuth: -1.15,
    maxAzimuth: 1.15,
    minPolar: 0.35,
    maxPolar: Math.PI / 2 - 0.08,
    minDistance: 3.6,
    maxDistance: 10,
    enablePan: true,
    rotateSpeed: 0.85,
    zoomSpeed: 0.9,
    panSpeed: 0.8,
  },
  mobile: {
    minAzimuth: -1.2,
    maxAzimuth: 1.2,
    minPolar: 0.4,
    maxPolar: Math.PI / 2 - 0.1,
    minDistance: 5,
    maxDistance: 12,
    enablePan: true,
    rotateSpeed: 0.7,
    zoomSpeed: 0.85,
    panSpeed: 0.7,
  },
}

export const CABINET_ENV = {
  url: `${assetBase}textures/cycles-bake/studio_cycles_2k_raw.hdr`,
  get intensity() {
    return CABINET_LOOK.environmentIntensity
  },
  background: false,
}

/**
 * Числа вида Cycles. Каждое значение используется кодом как есть.
 *
 * environmentIntensity: three r184 WebGLRenderer.js (~2686) при пустом
 * material.envMap подменяет uniform на scene.environmentIntensity.
 * material.envMapIntensity в этом случае не читается. Поэтому здесь 1,
 * а блик режется по материалам (envMapIntensity).
 *
 * tone.exposure: Blender −0.85 EV = 2^-0.85. Множитель стоит ДО AgX.
 * gl.toneMappingExposure на композер не полагаемся: EffectComposer ставит
 * NoToneMapping, а uniform экспозиции рендерер пишет только при refreshMaterial.
 *
 * compare: STUDIO_Camera, matrix_world. sensor_fit = VERTICAL, поэтому
 * вертикальный FOV от sensorHeight 24 мм. 36 мм — ширина сенсора, на FOV не влияет.
 * Оси: Blender (x, y, z) → three (x, z, −y).
 */
export const CABINET_LOOK = {
  environmentIntensity: 1,
  envMapIntensity: {
    metal: 1,
    lit: 0.08,
    rest: 0.3,
  },
  lightmap: {
    intensity: Math.PI,
    mipmaps: true,
    uvEpsilon: 0.02,
  },
  /**
   * Имя узла GLB → файл, канал TEXCOORD, опционально материалы, которым карту не ставить.
   * corpus_main и back_wall в рантайме — Group: карта идёт на дочерние Mesh.
   */
  lightmaps: {
    door_left_wood: { file: 'door_left_wood.hdr', channel: 2 },
    door_right_wood: { file: 'door_right_wood.hdr', channel: 2 },
    drawer_1: { file: 'drawer_1.hdr', channel: 2 },
    drawer_2: { file: 'drawer_2.hdr', channel: 2 },
    corpus_main: { file: 'corpus_main.hdr', channel: 2, skipMaterial: 'agedcopper|coffee' },
    back_wall: { file: 'back_wall.hdr', channel: 1 },
    modul_drawer: { file: 'modul_drawer.hdr', channel: 1 },
    modul_drawer_back: { file: 'modul_drawer_back.hdr', channel: 1 },
    drawer_leather_rim_top: { file: 'drawer_leather_rim_top.hdr', channel: 1 },
    drawer_leather_rim_bot: { file: 'drawer_leather_rim_bot.hdr', channel: 1 },
  },
  awaitingBake: 'door_(left|right)_detail_',
  realtime: false,
  ao: {
    radius: 0.2,
    intensity: 0.5,
    mobileScale: 0.8,
  },
  tone: {
    mode: 'agx',
    exposure: 2 ** -0.85,
    contrast: 0.06,
  },
  compare: {
    blenderLocation: [1.36801, -6.386, 2.44019],
    blenderForward: [-0.20475, 0.96329, -0.17365],
    position: [1.36801, 2.44019, 6.386],
    forward: [-0.20475, -0.17365, -0.96329],
    targetDistance: 8,
    focalLength: 58,
    sensorWidth: 36,
    sensorHeight: 24,
  },
  walnut: {
    roughnessFloor: 0.55,
    roughness: 0.72,
    dir: 'textures/cycles-bake/walnut/',
    files: {
      baseColor: 'walnut_baseColor.png',
      roughness: 'walnut_roughness.png',
      normal: 'walnut_normal.png',
    },
  },
}

export const CABINET_BACKGROUND = '#000000'

export const CABINET_EXPOSURE = 1.05

/**
 * Циклорама из studio-scene.glb целиком (пол + ков + стена).
 * Слой 1: RectArea шкафа не сереют стены. Пятно света — шейдер, как в Cycles.
 */
export const STUDIO_FLOOR = {
  layer: 1,
  color: '#d6d0c8',
  falloffInner: 1.55,
  falloffOuter: 4.6,
  wallFadeY: [0.28, 2.1],
  contact: {
    radius: 1.35,
    y: 0.004,
    opacity: 0.62,
    inner: 0.14,
    outer: 0.92,
  },
  catcher: {
    radius: 2.8,
    y: 0.002,
    opacity: 0.72,
  },
  mobile: {
    falloffInner: 1.75,
    falloffOuter: 5.6,
    contact: {
      radius: 1.5,
      y: 0.004,
      opacity: 0.58,
      inner: 0.16,
      outer: 1.02,
    },
    catcher: {
      radius: 3.2,
      y: 0.002,
      opacity: 0.68,
    },
  },
}

/** Петли = материал ножек (node_0 / Material.002), меньшее UV-окно = тот же масштаб пятна. */
export const HINGE_FROM_LEG = {
  visible: false,
  uvRepeat: 0.14,
  uvOffset: [0.41, 0.37],
  /** Левые body сидят на 3 см ближе к центру, чем правые — штыри тонут в корпусе. */
  leftBodyXNudge: -0.031,
}

/** Передняя накладка дверных петель — лёгкий объём поверх плоского overlay из GLB. */
export const HINGE_PLATE = {
  pad: 0.0014,
  depth: 0.0017,
  bevel: 0.00055,
  corner: 0.0034,
  rivetRadius: 0.0033,
  rivetSpread: 0.014,
}

/** Корпус: coffee_pot → public/textures/aged-copper (bake Metal Brown Medium). */
export const CORPUS_AGED_COPPER = {
  repeat: [2.4, 3.2],
  metalness: 0.86,
  env: 1,
  normalScale: 0.55,
}

/** Внутренние зеркала: геометрия door_*_inner + MeshReflectorMaterial. */
export const CABINET_MIRROR = {
  names: ['door_left_inner', 'door_right_inner'],
  desktopResolution: 1024,
  mobileResolution: 512,
  mirror: 1,
  mixStrength: 1,
  mixBlur: 0,
  roughness: 0.04,
  metalness: 1,
  color: '#ffffff',
  envMapIntensity: 0.15,
  reflectorOffset: 0.002,

  pose: {
    door_left_inner: {
      rotateX: 0,
      rotateY: 0,
      offset: [0, 0, 0],
      scale: [1, 1, 1],
    },
    door_right_inner: {
      rotateX: Math.PI,
      rotateY: 0,
      offset: [0, 0, 0],
      scale: [1, 1, 1],
    },
  },
}

export const CABINET_LIGHTS = {
  ambient: 0.04,
  aim: BLENDER_AIM,
  key: {
    position: [-2.25, 3.05, 2.2],
    width: 1.65,
    height: 2.35,
    intensity: 540 * AREA_ENERGY_SCALE,
    color: '#f3eadc',
  },
  fill: {
    position: [2.35, 2.25, 1.55],
    width: 1.85,
    height: 2.35,
    intensity: 150 * AREA_ENERGY_SCALE,
    color: '#f0f5ff',
  },
  rimLeft: {
    position: [-1.45, 1.85, -0.75],
    width: 0.48,
    height: 2.3,
    intensity: 120 * AREA_ENERGY_SCALE * 0.45,
    color: '#f5f7ff',
  },
  rimRight: {
    position: [1.45, 1.78, -0.75],
    width: 0.48,
    height: 2.2,
    intensity: 110 * AREA_ENERGY_SCALE * 0.45,
    color: '#f5f7ff',
  },
  interior: {
    position: [0, 2.145, 0.04],
    aim: [0, 1.35, 0.04],
    width: 0.46,
    height: 0.12,
    intensity: 32 * AREA_ENERGY_SCALE,
    color: '#f7f5f0',
  },
  backdropSpot: {
    position: [0, 2.5, 0.2],
    aim: [0, 1.4, -2.4],
    intensity: 0,
    color: '#9ea8b8',
    angle: 0.85,
    penumbra: 0.55,
  },
  shadow: {
    position: [-2.25, 3.05, 2.2],
    intensity: 2.2,
    color: '#f3eadc',
    mapSize: 2048,
    radius: 2.2,
    bias: -0.0004,
    normalBias: 0.03,
    layers: [0, 1],
  },
  /** Тёплый spot внутри корпуса: полки и крышки ящиков. RectArea тень не бросает. */
  interiorSpot: {
    position: [0.02, 1.78, 0.02],
    aim: [0.05, 1.05, 0.42],
    intensity: 10,
    color: '#ffd7ae',
    angle: 0.92,
    penumbra: 0.62,
    distance: 2.35,
    decay: 2,
    mapSize: 1024,
    bias: -0.00035,
    normalBias: 0.02,
  },
  /** Было 5.2 без тени — заливало пол и убивало контакт. */
  floorPool: {
    position: [-0.55, 3.55, 2.05],
    aim: [0, 0, 0.2],
    intensity: 0,
    color: '#f3eadc',
    angle: 0.95,
    penumbra: 0.88,
    distance: 10,
    decay: 2,
  },
}

export const CABINET_POST = {
  aoRadius: CABINET_LOOK.ao.radius,
  aoIntensity: CABINET_LOOK.ao.intensity,
  bloomIntensity: 0.18,
  bloomThreshold: 0.85,
  bloomSmoothing: 0.25,
  vignetteOffset: 0.22,
  vignetteDarkness: 0.58,
  contrast: CABINET_LOOK.tone.contrast,
  brightness: 0,
  saturation: 0.04,
  noiseOpacity: 0,
}

export const STUDIO_PERFORMANCE = {
  forceTier: null,
  defaultTier: 'medium',
  tiers: {
    low: {
      dpr: [1, 1],
      antialias: false,
      postFX: true,
      n8ao: true,
      n8aoQuality: 'low',
      bloom: false,
      noise: false,
      multisampling: 0,
      normalPass: true,
      shadowMapSize: 1024,
      contactShadowResolution: 512,
      pcfSoftShadows: false,
    },
    medium: {
      dpr: [1, 1.75],
      antialias: true,
      postFX: true,
      n8ao: true,
      n8aoQuality: 'medium',
      bloom: true,
      noise: false,
      multisampling: 4,
      normalPass: true,
      shadowMapSize: 2048,
      contactShadowResolution: 1024,
      pcfSoftShadows: true,
    },
    high: {
      dpr: [1, 2],
      antialias: true,
      postFX: true,
      n8ao: true,
      n8aoQuality: 'high',
      bloom: true,
      noise: false,
      multisampling: 8,
      normalPass: true,
      shadowMapSize: 2048,
      contactShadowResolution: 2048,
      pcfSoftShadows: true,
    },
  },
}

export function getCabinetCamera(isMobile) {
  return isMobile ? CABINET_CAMERA.mobile : CABINET_CAMERA.desktop
}

export function getCabinetOrbit(isMobile) {
  return isMobile ? CABINET_ORBIT.mobile : CABINET_ORBIT.desktop
}
