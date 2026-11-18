import { russoLog } from './russoLog'

const marks = {
  firstFrameMs: null,
  overlayExitMs: null,
  interactiveMs: null,
}
const reported = new Set()

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

/**
 * Два разных момента, не один флаг:
 * first-frame — следующий кадр после того, как модель уже в сцене;
 * overlay-exit — прелоадер начинает исчезать;
 * interactive — двери и ящики можно нажимать.
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
  }
  russoLog('info', 'load', reason, summary)
  if (typeof window !== 'undefined') {
    window.__RUSSO_LOAD = { ...(window.__RUSSO_LOAD || {}), ...summary, rows }
  }
  if (reason !== 'interactive' && marks.firstFrameMs != null && marks.overlayExitMs != null) {
    reportLoadTiming('interactive')
  }
}
