// studioScene.js
export const STUDIO = {
  backdrop: {
    topColor: '#2a2f38', // тёмно-серо-синий верх
    midColor: '#4a5058', // светлее в зоне объекта
    bottomColor: '#1a1d22', // тёмный низ (пол уходит в тень)
    curveHeight: 9, // +~40% запас по высоте
    curveRadius: 6, // +~40% — шире дуга, меньше виден стык при повороте
    width: 14, // +~40% — боковые края не влезают в кадр
    floorDepth: 7, // +~40% — пол уходит глубже за объект
  },
  camera: {
    fov: 35, // 28 — телевик, сильно приближает; 35 — шире охват
    position: [0, 1.1, 6], // было 3.2 — дальше от объекта; подбирай z колёсиком + console
    target: [0, 1.0, 0],
  },
  /** Ограничения OrbitControls — витрина, не 360° */
  orbit: {
    minAzimuth: -0.42, // ~−24° влево от фронта
    maxAzimuth: 0.42, // ~+24° вправо
    minPolar: 1.22, // не слишком сверху (≈70° от вертикали)
    maxPolar: 1.58, // не смотреть снизу (≈90°)
    minDistance: 2,
    maxDistance: 14,
    enablePan: false,
  },
  lights: {
    key: {
      // off-axis: правее и выше камеры — градиент света/тени по фасаду
      position: [3, 4, 1.8],
      width: 2.8,
      height: 3.5,
      intensity: 11,
      color: '#fff4e6',
    },
    rim: {
      // контровой сзади-сверху — блик по кромке патины
      position: [-2, 3.8, -4.5],
      width: 2.8,
      height: 3.5,
      intensity: 11,
      color: '#cfe0ff',
    },
    fill: {
      position: [-2.5, 0.6, 3.5],
      width: 2,
      height: 2,
      intensity: 0.9,
      color: '#ffffff',
    },
    ambient: 0.05,
  },
  shadow: {
    opacity: 0.62,
    blur: 1.8,
    far: 2,
    resolution: 1024,
  },
  postprocessing: {
    vignetteOffset: 0.35,
    vignetteDarkness: 0.65,
    contrast: 0.05,
    saturation: -0.1,
  },
}

export const USE_STUDIO_CAMERA = true

/** Временно: лог позиции камеры в консоль после ручного зума OrbitControls */
export const DEBUG_LOG_CAMERA_POSITION = true
