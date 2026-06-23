/** Студия по референсу — нейтральный серый фон */
export const STUDIO_BG = '#adb1b4'

/** Y-координата пола (мировые координаты) */
export const STUDIO_FLOOR_Y = -1.5
export const REF_FLOOR_Y = STUDIO_FLOOR_Y

/** Референс: полированный пол + матовая стена (холодный серый бетон) */
export const REF_FLOOR_COLOR = '#94989b'
export const REF_WALL_COLOR = '#adb1b4'

/** Комната вокруг шкафа — уже, чем было (48×48) */
export const REF_ROOM_HALF_W = 3.1
export const REF_WALL_W = REF_ROOM_HALF_W * 2
export const REF_WALL_H = 14
export const REF_WALL_Z = -4.6
export const REF_FLOOR_FRONT = 5.8
export const REF_FLOOR_DEPTH = REF_FLOOR_FRONT - REF_WALL_Z
export const REF_FLOOR_WIDTH = REF_WALL_W

/** @deprecated — оставлено для совместимости; используй REF_FLOOR_WIDTH / DEPTH */
export const REF_FLOOR_SIZE = REF_FLOOR_DEPTH

/** Логотип на задней стене (ReferenceBackdrop) — правь здесь */
export const LOGO_WALL_WIDTH_FRAC = 0.55 / 2.25
/** 0 = пол, 1 = верх стены — центр логотипа по Y */
export const LOGO_WALL_Y_FRAC = 0.24
/** Отступ левого края логотипа от левой кромки стены, м */
export const LOGO_WALL_LEFT_MARGIN = 0.35
export const LOGO_WALL_Z_OFFSET = 0.045

export function getRefLogoWallCenterY(floorY = REF_FLOOR_Y) {
  return floorY + REF_WALL_H * LOGO_WALL_Y_FRAC
}

export function getRefLogoWallCenterX(logoW) {
  return -REF_WALL_W / 2 + LOGO_WALL_LEFT_MARGIN + logoW / 2
}

/** Высота «потолка» для лимита камеры */
export const STUDIO_WALL_H = REF_WALL_H

export const CAMERA_WALL_TOP_MARGIN = 0.35
export const ORBIT_TARGET_TOP_MARGIN = 1.2
export const ORBIT_MIN_POLAR_FLOOR = 0.35

export function getStudioWallTopY() {
  return STUDIO_FLOOR_Y + STUDIO_WALL_H
}

export function getMaxCameraY() {
  return getStudioWallTopY() - CAMERA_WALL_TOP_MARGIN
}

export function getMaxOrbitTargetY() {
  return getStudioWallTopY() - ORBIT_TARGET_TOP_MARGIN
}

/** Шкаф ближе к стене — как на продуктовом фото */
export const SHKAF_Z_OFFSET = -2.2
/** Подъём над полом — ножки не «тонут» в рельефе текстуры */
export const SHKAF_FLOOR_LIFT = 0.012

/** Без тумана — чистый студийный фон */
export const STUDIO_FOG_NEAR = 80
export const STUDIO_FOG_FAR = 120

export const ORBIT_MAX_DISTANCE_FACTOR = 3.2
export const ORBIT_MIN_DISTANCE_FACTOR = 0.22

/** OrbitControls: стартовая дистанция = maxDistance; только приближение */
export const ORBIT_MIN_DISTANCE_RATIO = 0.38

/** Поворот от стартового ракурса: горизонт 120°, вертикаль ¾ (90°) */
export const ORBIT_AZIMUTH_RANGE = (120 * Math.PI) / 180
export const ORBIT_AZIMUTH_HALF = ORBIT_AZIMUTH_RANGE / 2
export const ORBIT_POLAR_RANGE = ORBIT_AZIMUTH_RANGE * 0.75
export const ORBIT_POLAR_HALF = ORBIT_POLAR_RANGE / 2

/** Камера при загрузке: шкаф целиком в кадре — это максимальное отдаление */
export const CAMERA_FIT_MARGIN = 1.5
export const CAMERA_HEIGHT_FACTOR = 0
export const CAMERA_AIM_HEIGHT_RATIO = 0.5
export const CAMERA_AIM_Y_LIFT = 0


export const STUDIO_BG_STYLE = {
  background: STUDIO_BG,
  width: '100vw',
  height: '100vh',
}

export function kelvinToHex(kelvin) {
  const temp = kelvin / 100
  let r
  let g
  let b

  if (temp <= 66) {
    r = 255
    g = Math.min(255, Math.max(0, 99.4708025861 * Math.log(Math.max(1, temp)) - 161.1195681661))
    b =
      temp <= 19
        ? 0
        : Math.min(255, Math.max(0, 138.5177312231 * Math.log(temp - 10) - 305.0447927307))
  } else {
    r = Math.min(255, Math.max(0, 329.698727446 * (temp - 60) ** -0.1332047592))
    g = Math.min(255, Math.max(0, 288.1221695283 * (temp - 60) ** -0.0755148492))
    b = 255
  }

  const toHex = (v) => Math.round(v).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export const STUDIO_LIGHT_COLOR = kelvinToHex(6500)

export const SCENE_BACKGROUND =
  'radial-gradient(ellipse 90% 75% at 50% 80%, #6b4c3b 0%, #5c4033 18%, #3d2b1f 38%, #2a1f18 58%, #141010 78%, #0f0f0f 100%)'

export const SCENE_BG_STYLE = STUDIO_BG_STYLE
