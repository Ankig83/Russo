/** Размеры шкафа (placeholder-геометрия) */
export const CABINET_WIDTH = 2
export const CABINET_HEIGHT = 2.5
export const CABINET_DEPTH = 0.6
export const CABINET_WALL = 0.05

export const DOOR_WIDTH = 0.95
export const DOOR_HEIGHT = 2.3
export const DOOR_THICKNESS = 0.05

export const DRAWER_HEIGHT = 0.35
export const DRAWER_DEPTH = 0.45
export const DRAWER_GAP = 0.05

/** Анимации GSAP */
export const DOOR_ROTATION_AXIS = 'y'
/**
 * Угол открытия от closed (Y=0).
 * Петли из Blender door_left/right (внешний край). Знаки как в классическом Russo.
 */
export const DOOR_OPEN_ANGLE = (140 * Math.PI) / 180
export const DOOR_LEFT_OPEN_ANGLE = -DOOR_OPEN_ANGLE
export const DOOR_RIGHT_OPEN_ANGLE = DOOR_OPEN_ANGLE
export const DOOR_OPEN_DURATION = 0.8
/** Выдвижение ящика к камере (~6 см в метрах сцены) */
export const DRAWER_PULL_DISTANCE = 0.12
export const DRAWER_OPEN_DURATION = 0.55
/** Пауза после выдвижения, чтобы жест успел прочитаться */
export const NAVIGATE_DELAY_MS = 280

/** Масштаб на мобильных */
export const DESKTOP_SCALE = 1
export const MOBILE_SCALE = 0.75

/** Цвета материалов */
export const COLOR_BODY = '#3d2b1f'
export const COLOR_DOOR = '#5c4033'
export const COLOR_DRAWER = '#6b4c3b'
export const COLOR_HANDLE = '#c9a962'
