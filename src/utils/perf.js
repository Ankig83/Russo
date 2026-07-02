/**
 * Замеры времени загрузки Russo.
 * Включено в dev или: localStorage.setItem('russo:perf', '1') / ?perf=1
 */

const PREFIX = 'РУССО:perf'
const REQUIRED_MILESTONES = ['webgl', 'assets', 'materials', 'camera']

function isEnabled() {
  if (import.meta.env.DEV) return true
  try {
    if (typeof window !== 'undefined') {
      if (window.localStorage?.getItem('russo:perf') === '1') return true
      if (new URLSearchParams(window.location.search).has('perf')) return true
    }
  } catch {
    /* ignore */
  }
  return false
}

class PerfLogger {
  constructor() {
    this.enabled = isEnabled()
    this.origin = typeof performance !== 'undefined' ? performance.now() : 0
    this.active = new Map()
    this.records = []
    this.milestones = new Set()
    this.summaryPrinted = false
  }

  /** Мгновенная отметка от старта сессии */
  mark(name) {
    if (!this.enabled) return
    const ms = performance.now() - this.origin
    this.records.push({ name, ms, kind: 'mark' })
    console.log(`${PREFIX} [mark] ${name} @ ${ms.toFixed(1)} ms`)
  }

  start(name) {
    if (!this.enabled) return
    this.active.set(name, performance.now())
  }

  /** @returns {number|undefined} длительность в ms */
  end(name) {
    if (!this.enabled) return
    const started = this.active.get(name)
    if (started == null) {
      console.warn(`${PREFIX} end без start: ${name}`)
      return
    }
    this.active.delete(name)
    const ms = performance.now() - started
    this.records.push({ name, ms, kind: 'phase' })
    console.log(`${PREFIX} ${name} — ${ms.toFixed(1)} ms`)
    return ms
  }

  measure(name, fn) {
    if (!this.enabled) return fn()
    this.start(name)
    try {
      return fn()
    } finally {
      this.end(name)
    }
  }

  async measureAsync(name, fn) {
    if (!this.enabled) return fn()
    this.start(name)
    try {
      return await fn()
    } finally {
      this.end(name)
    }
  }

  milestone(name) {
    if (!this.enabled) return
    this.milestones.add(name)
    if (
      !this.summaryPrinted &&
      REQUIRED_MILESTONES.every((m) => this.milestones.has(m))
    ) {
      requestAnimationFrame(() => this.summary())
    }
  }

  summary() {
    if (!this.enabled || this.summaryPrinted) return
    this.summaryPrinted = true

    const phases = this.records.filter((r) => r.kind === 'phase')
    if (!phases.length) return

    const total = performance.now() - this.origin
    const sorted = [...phases].sort((a, b) => b.ms - a.ms)
    const rows = sorted.map(({ name, ms }) => ({
      этап: name,
      'мс': Math.round(ms * 10) / 10,
      '% загрузки': `${((ms / total) * 100).toFixed(1)}%`,
    }))

    console.group(`${PREFIX} итог загрузки (${total.toFixed(0)} ms)`)
    console.table(rows)
    console.log(`${PREFIX} самые долгие:`, sorted.slice(0, 3).map((r) => r.name).join(', '))
    console.groupEnd()
  }
}

export const perf = new PerfLogger()
