/** Студийная сцена — нейтральный фон */
export const STUDIO_BG = '#c0c0c0'

/** Y-координата пола студийного фона (мировые координаты) */
export const STUDIO_FLOOR_Y = -1.5

/** Туман — скрывает дальние края сцены (цвет = фон canvas) */
export const STUDIO_FOG_NEAR = 35
export const STUDIO_FOG_FAR = 70

/** Макс. отдаление камеры от шкафа = maxDim × factor */
export const ORBIT_MAX_DISTANCE_FACTOR = 2.1
export const ORBIT_MIN_DISTANCE_FACTOR = 0.38

export const STUDIO_BG_STYLE = {
  background: STUDIO_BG,
  width: '100vw',
  height: '100vh',
}

/** Цветовая температура 6500K → hex (для color света) */
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

/** Основной свет — 6500K сверху */
export const STUDIO_LIGHT_COLOR = kelvinToHex(6500)

/** @deprecated — старый тёмный градиент */
export const SCENE_BACKGROUND =
  'radial-gradient(ellipse 90% 75% at 50% 80%, #6b4c3b 0%, #5c4033 18%, #3d2b1f 38%, #2a1f18 58%, #141010 78%, #0f0f0f 100%)'

export const SCENE_BG_STYLE = STUDIO_BG_STYLE
