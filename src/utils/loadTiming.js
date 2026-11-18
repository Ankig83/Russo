import { FileLoader } from 'three'
import { GLTFLoader } from 'three-stdlib'
import { EffectComposer } from 'postprocessing'
import { russoLog } from './russoLog'

const marks = {
  firstFrameMs: null,
  overlayExitMs: null,
  interactiveMs: null,
}
const reported = new Set()
const stages = []
const glbFetches = []
let lastMarkName = null
let probesInstalled = false
let expectCabinetParse = false
let renderArmed = false

const CABINET_FILE = 'shkaf-cabinet.glb'

function kb(bytes) {
  return Math.round((bytes || 0) / 1024)
}

function resourceRows() {
  if (typeof performance === 'undefined') return []
  return performance
    .getEntriesByType('resource')
    .filter((entry) => /\.(glb|hdr|png|webp|jpe?g|mp4)(\?|$)/i.test(entry.name))
    .map((entry) => ({
      file: entry.name.split('/').pop(),
      startMs: Math.round(entry.startTime),
      endMs: Math.round(entry.responseEnd),
      durMs: Math.round(entry.duration),
      kb: kb(entry.transferSize),
      cached: entry.transferSize === 0 && entry.decodedBodySize > 0,
    }))
    .sort((a, b) => a.startMs - b.startMs)
}

function glbEndMs() {
  const row = resourceRows().find((item) => item.file.startsWith('shkaf-cabinet.glb'))
  return row ? row.endMs : null
}

function stageGaps() {
  const gaps = []
  for (let i = 1; i < stages.length; i += 1) {
    gaps.push({
      from: stages[i - 1].name,
      to: stages[i].name,
      ms: stages[i].ms - stages[i - 1].ms,
    })
  }
  return gaps
}

function publishStages() {
  if (typeof window === 'undefined') return
  window.__RUSSO_LOAD = {
    ...(window.__RUSSO_LOAD || {}),
    stages,
    gaps: stageGaps(),
    glbFetches,
  }
}

/** Одна отметка этапа. Повтор (StrictMode в dev) пишется отдельно, цепочка не затирается. */
export function markStage(name, extra) {
  if (typeof performance === 'undefined') return null
  const ms = Math.round(performance.now())
  const count = stages.filter((row) => row.name === name).length
  const markName = count === 0 ? `russo:${name}` : `russo:${name}:${count + 1}`
  const detail = extra || undefined
  performance.mark(markName, detail ? { detail } : undefined)
  if (lastMarkName) {
    try {
      performance.measure(`${lastMarkName} → ${markName}`, lastMarkName, markName)
    } catch {
      /* отметка уже снята */
    }
  }
  lastMarkName = markName
  const sincePrev = stages.length ? ms - stages[stages.length - 1].ms : 0
  const row = { name, ms, sincePrev, ...(extra || {}) }
  stages.push(row)
  publishStages()
  russoLog('info', 'load', name, { ms, sincePrev, ...(extra || {}) })
  return row
}

function cabinetResourceEntries() {
  if (typeof performance === 'undefined') return []
  return performance
    .getEntriesByType('resource')
    .filter((entry) => entry.name.includes(CABINET_FILE))
    .map((entry) => ({
      url: entry.name,
      startMs: Math.round(entry.startTime),
      endMs: Math.round(entry.responseEnd),
      transfer: entry.transferSize,
      encoded: entry.encodedBodySize,
      decoded: entry.decodedBodySize,
      delivery: entry.deliveryType || null,
      protocol: entry.nextHopProtocol || null,
    }))
}

function recordGlbResponse(response, requestUrl, cacheMode) {
  let preloadHref = null
  if (typeof document !== 'undefined') {
    preloadHref = document.querySelector('link[rel="preload"][as="fetch"]')?.href || null
  }
  glbFetches.push({
    requestUrl,
    responseUrl: response.url,
    status: response.status,
    cacheMode,
    cacheControl: response.headers.get('cache-control'),
    expires: response.headers.get('expires'),
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
    vary: response.headers.get('vary'),
    contentLength: response.headers.get('content-length'),
    preloadHref,
    sameAsPreload: preloadHref != null && response.url === preloadHref,
    serviceWorker: !!(typeof navigator !== 'undefined' && navigator.serviceWorker && navigator.serviceWorker.controller),
  })
  publishStages()
}

function captureRender(via, run) {
  const capture = renderArmed
  if (capture) {
    renderArmed = false
    markStage('first-render-start', { via })
  }
  try {
    return run()
  } finally {
    if (capture) {
      markStage('first-render-end', { via })
      requestAnimationFrame(() => markStage('first-presented', { via }))
    }
  }
}

/**
 * Пробы не меняют загрузку: тот же fetch, тот же parse, тот же render.
 * glb-downloaded — FileLoader отдал байты. gltf-parsed — onLoad после разбора, включая Draco.
 * first-render-* — вход и выход реального рендера (composer, если он уже подменил gl.render).
 * first-presented — следующий кадр браузера, не сам useFrame.
 */
export function installCabinetLoadProbes() {
  if (probesInstalled || typeof window === 'undefined') return
  probesInstalled = true

  const origFetch = window.fetch.bind(window)
  window.fetch = (input, init) => {
    const requestUrl = typeof input === 'string' ? input : input?.url || ''
    const cabinet = requestUrl.includes(CABINET_FILE)
    const cacheMode = init?.cache || (typeof Request !== 'undefined' && input instanceof Request ? input.cache : 'default')
    const pending = origFetch(input, init)
    if (!cabinet) return pending
    return pending.then((response) => {
      recordGlbResponse(response, requestUrl, cacheMode)
      return response
    })
  }

  const origLoad = FileLoader.prototype.load
  FileLoader.prototype.load = function loadCabinet(url, onLoad, onProgress, onError) {
    if (!String(url).includes(CABINET_FILE)) {
      return origLoad.call(this, url, onLoad, onProgress, onError)
    }
    return origLoad.call(this, url, (data) => {
      expectCabinetParse = true
      markStage('glb-downloaded', {
        bytes: data?.byteLength || 0,
        resources: cabinetResourceEntries(),
      })
      if (onLoad) onLoad(data)
    }, onProgress, onError)
  }

  const origParse = GLTFLoader.prototype.parse
  GLTFLoader.prototype.parse = function parseCabinet(data, path, onLoad, onError) {
    if (!expectCabinetParse) return origParse.call(this, data, path, onLoad, onError)
    expectCabinetParse = false
    const draco = !!this.dracoLoader
    return origParse.call(this, data, path, (gltf) => {
      const decoders = performance
        .getEntriesByType('resource')
        .filter((entry) => /draco|decoder/i.test(entry.name))
        .map((entry) => ({
          file: entry.name.split('/').pop(),
          startMs: Math.round(entry.startTime),
          endMs: Math.round(entry.responseEnd),
          transfer: entry.transferSize,
        }))
      markStage('gltf-parsed', { draco, decoders })
      if (onLoad) onLoad(gltf)
    }, onError)
  }

  const origComposerRender = EffectComposer.prototype.render
  EffectComposer.prototype.render = function renderCabinet(deltaTime) {
    return captureRender('composer', () => origComposerRender.call(this, deltaTime))
  }
}

/** Следующий рендер после подготовки модели — первый, который её рисует. */
export function armFirstRender() {
  renderArmed = true
}

/** Запасной путь, если composer ещё не перехватил кадр. */
export function watchFirstRender(gl) {
  if (!gl || gl.render?.__russo) return
  const orig = gl.render.bind(gl)
  function wrapped(scene, camera) {
    return captureRender('webgl', () => orig(scene, camera))
  }
  wrapped.__russo = true
  gl.render = wrapped
}

/**
 * first-frame — следующий кадр после useFrame. Это не доказательство, что кадр нарисован.
 * Рисование — first-render-start / first-render-end, показ — first-presented.
 * overlay-exit — прелоадер скрыт. interactive — оба прежних момента есть.
 */
export function markFirstFrame() {
  if (marks.firstFrameMs != null || typeof requestAnimationFrame === 'undefined') return
  requestAnimationFrame(() => {
    if (marks.firstFrameMs != null) return
    marks.firstFrameMs = Math.round(performance.now())
    reportLoadTiming('first-frame')
  })
}

export function reportLoadTiming(reason) {
  if (reported.has(reason) || typeof performance === 'undefined') return
  if (reason === 'overlay-exit') marks.overlayExitMs = Math.round(performance.now())
  if (reason === 'interactive') marks.interactiveMs = Math.round(performance.now())
  reported.add(reason)
  const rows = resourceRows()
  const downloaded = rows.reduce((sum, row) => sum + row.kb, 0)
  const summary = {
    reason,
    firstFrameMs: marks.firstFrameMs,
    glbEndMs: glbEndMs(),
    overlayExitMs: marks.overlayExitMs,
    interactiveMs: marks.interactiveMs,
    files: rows.length,
    downloadedKb: downloaded,
    rows,
    stages,
    gaps: stageGaps(),
    glbFetches,
  }
  russoLog('info', 'load', reason, summary)
  if (typeof window !== 'undefined') {
    window.__RUSSO_LOAD = { ...(window.__RUSSO_LOAD || {}), ...summary, rows }
  }
  if (reason !== 'interactive' && marks.firstFrameMs != null && marks.overlayExitMs != null) {
    reportLoadTiming('interactive')
  }
}
