/** Фон страницы — тёмная студия */
export const SCENE_BG = '#0a0a0a'
export const SCENE_CANVAS_BG = '#0e0e0e'
export const SCENE_BG_STYLE = {
  background: SCENE_BG,
  width: '100vw',
  height: '100dvh',
  minHeight: '100vh',
}

/** ACES exposure */
export const TONE_MAPPING_EXPOSURE = 1.08
/** Макс. отдаление камеры от шкафа = maxDim × factor */
export const ORBIT_MAX_DISTANCE_FACTOR = 3.5
export const ORBIT_MIN_DISTANCE_FACTOR = 0.38

/** Начальная позиция камеры (FitCamera) */
export const CAMERA_DISTANCE_FACTOR = 3.0
/** Подъём камеры над точкой наведения — доля от maxDim шкафа */
export const CAMERA_HEIGHT_FACTOR = 0.55
/** Высота точки наведения — доля от высоты bbox (0.5 = геом. центр) */
export const CAMERA_AIM_HEIGHT_RATIO = 0.28

/** @deprecated */
export const STUDIO_BG = SCENE_BG
export const STUDIO_CANVAS_BG = SCENE_CANVAS_BG
export const STUDIO_BG_STYLE = SCENE_BG_STYLE
export const STUDIO_FLOOR_Y = 0
