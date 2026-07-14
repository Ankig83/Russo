/**
 * Диагностика загрузки и кликов шкафа.
 * Консоль: фильтр «РУССО». Состояние: window.__RUSSO
 * HUD: всегда на главной (можно скрыть: localStorage.setItem('russo:debug','0'))
 */

const PREFIX = 'РУССО'
export const RUSSO_BUILD = '2026-07-13-p0-fixes'
const listeners = new Set()

function isHudEnabled() {
  const env = import.meta.env ?? {}
  if (!env.DEV && env.VITE_SUPPORT_DIAGNOSTICS !== 'true') {
    return false
  }
  try {
    if (typeof window === 'undefined') return true
    if (window.localStorage?.getItem('russo:debug') === '0') return false
    if (new URLSearchParams(window.location.search).get('debug') === '0') return false
  } catch {
    /* ignore */
  }
  return true
}

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

const t0 = nowMs()

export const russoState = {
  bootAt: Date.now(),
  assetsActive: false,
  assetsProgress: 0,
  assetsDoneAt: null,
  overlayWaitingMinMs: false,
  overlayDone: false,
  canvasReady: false,
  shkafReady: false,
  drawers: [],
  doorsOpen: false,
  animating: false,
  activeDrawerId: null,
  lastEvent: 'boot',
  lastHit: null,
  ready: false,
  readyAt: null,
  hudEnabled: true,
}

function emit() {
  russoState.hudEnabled = isHudEnabled()
  listeners.forEach((fn) => {
    try {
      fn(russoState)
    } catch {
      /* ignore */
    }
  })
  try {
    if (typeof window !== 'undefined') window.__RUSSO = { ...russoState }
  } catch {
    /* ignore */
  }
}

export function subscribeRussoDebug(fn) {
  listeners.add(fn)
  fn(russoState)
  return () => listeners.delete(fn)
}

function stamp() {
  return `+${(nowMs() - t0).toFixed(0)}ms`
}

export function russoLog(level, scope, message, data) {
  const tag = `${PREFIX}:${scope}`
  const line = `${tag} ${stamp()} ${message}`
  const args = data !== undefined ? [line, data] : [line]
  if (level === 'warn') console.warn(...args)
  else if (level === 'error') console.error(...args)
  else if (level === 'group') {
    console.groupCollapsed(line)
    if (data !== undefined) console.log(data)
    console.groupEnd()
  } else console.log(...args)
}

export function russoPatch(partial) {
  Object.assign(russoState, partial)
  emit()
}

function recomputeReady() {
  const ready =
    !russoState.assetsActive &&
    russoState.overlayDone &&
    russoState.canvasReady &&
    russoState.shkafReady

  if (ready && !russoState.ready) {
    russoState.ready = true
    russoState.readyAt = Date.now()
    russoState.lastEvent = 'READY'
    console.log(
      `%c${PREFIX} ${stamp()} ✅ ГОТОВО К РАБОТЕ — можно открывать шкаф и кликать ящики`,
      'color:#c88030;font-weight:bold;font-size:13px',
    )
    console.log(`${PREFIX}:ready`, {
      assetsProgress: russoState.assetsProgress,
      drawers: russoState.drawers,
      elapsedMs: Math.round(nowMs() - t0),
    })
  } else if (!ready && russoState.ready) {
    russoState.ready = false
    russoState.readyAt = null
  }
  emit()
}

export function russoBoot() {
  russoLog('info', 'boot', `старт приложения · build ${RUSSO_BUILD}`)
  russoPatch({ lastEvent: 'boot' })
}

export function russoAssetsProgress({ active, progress, item }) {
  const pct = Math.round(progress ?? 0)
  const wasActive = russoState.assetsActive
  russoPatch({
    assetsActive: !!active,
    assetsProgress: pct,
    lastEvent: active ? `load ${pct}%` : russoState.lastEvent,
  })

  if (active && (pct === 0 || pct === 25 || pct === 50 || pct === 75 || pct >= 100)) {
    russoLog('info', 'load', `ассеты ${pct}%${item ? ` (${item})` : ''}`)
  }

  if (wasActive && !active) {
    russoPatch({ assetsDoneAt: Date.now(), lastEvent: 'assets done' })
    russoLog('info', 'load', 'ассеты загружены (useProgress active=false)', {
      progress: pct,
    })
    recomputeReady()
  }
}

export function russoOverlayPhase(phase, data) {
  if (phase === 'waiting-min') {
    russoPatch({ overlayWaitingMinMs: true, lastEvent: 'overlay min-wait' })
    russoLog(
      'info',
      'load',
      'ассеты уже готовы — ждём минимальный показ лого (это НЕ лаг сцены)',
      data,
    )
  } else if (phase === 'exit-start') {
    russoLog('info', 'load', 'лого улетает в угол — оверлей закрывается', data)
  } else if (phase === 'done') {
    russoPatch({ overlayDone: true, overlayWaitingMinMs: false, lastEvent: 'overlay done' })
    russoLog('info', 'load', 'оверлей скрыт')
    recomputeReady()
  }
}

export function russoCanvasReady() {
  russoPatch({ canvasReady: true, lastEvent: 'canvas ready' })
  russoLog('info', 'scene', 'WebGL Canvas создан')
  recomputeReady()
}

export function russoShkafReady(info) {
  russoPatch({
    shkafReady: true,
    drawers: info?.drawers ?? [],
    lastEvent: 'shkaf ready',
  })
  russoLog('info', 'shkaf', 'модель подготовлена, ящики зарегистрированы', info)
  recomputeReady()
}

export function russoInteractState({ doorsOpen, animating, activeDrawerId }) {
  russoPatch({
    doorsOpen: !!doorsOpen,
    animating: !!animating,
    activeDrawerId: activeDrawerId ?? null,
  })
}

/** Описание объекта raycast для лога */
export function describeHitObject(object) {
  if (!object) return null
  const mats = object.isMesh && object.material
    ? (Array.isArray(object.material) ? object.material : [object.material])
        .map((m) => m?.name)
        .filter(Boolean)
    : []
  const chain = []
  let cur = object
  while (cur && chain.length < 8) {
    if (cur.name) chain.push(cur.name)
    cur = cur.parent
  }
  return {
    name: object.name || '(unnamed)',
    type: object.type,
    materials: mats,
    chain: chain.join(' ← '),
  }
}

/**
 * Лог решения по клику.
 * @param {'ignore-drag'|'blocked'|'doors'|'drawer'|'miss-close'} outcome
 */
export function russoClick(outcome, details) {
  const hit = details?.hit ? describeHitObject(details.hit) : null
  const payload = { outcome, ...details, hit }
  delete payload.hitObject
  russoPatch({
    lastEvent: outcome,
    lastHit: {
      at: Date.now(),
      outcome,
      sectionId: details?.sectionId ?? null,
      route: details?.route ?? null,
      node: details?.nodeName ?? null,
      reason: details?.reason ?? null,
      object: hit?.name ?? null,
      materials: hit?.materials ?? [],
      chain: hit?.chain ?? null,
      dragPx: details?.dragPx ?? null,
    },
  })

  const label = {
    'ignore-drag': '❌ клик отброшен (сдвиг пальца/мыши > порога — похоже на orbit)',
    blocked: '⏳ клик заблокирован (идёт анимация / ящик уже выбран)',
    doors: '🚪 двери open/close',
    drawer: '📦 ящик → переход',
    'miss-close': '🚪 мимо ящика при открытых дверях → закрытие',
  }[outcome] ?? outcome

  russoLog('group', 'click', label, payload)
}
