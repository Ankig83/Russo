import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { useIsMobile } from '../../hooks/useMediaQuery'
import './GradientCarousel.css'

/*
 * React-порт 3D-карусели с реактивным градиентом.
 * Оригинал: github.com/clementgrellier/gradientslider (MIT, Clément Grellier).
 * Логика (физика инерции, извлечение палитры, рендер градиента) сохранена,
 * DOM создаётся императивно внутри effect на ref-контейнерах — без ре-рендеров React на кадр.
 */

// Физика
const FRICTION = 0.9
const WHEEL_SENS = 0.6
const DRAG_SENS = 1.0

// Визуал (desktop / mobile)
const MAX_ROTATION = 28
const MAX_DEPTH = 140
const MAX_ROTATION_M = 20
const MAX_DEPTH_M = 90
const MIN_SCALE = 0.92
const SCALE_RANGE = 0.1
const GAP = 28

// Тёмный базовый фон Руссо (в него уходят градиенты)
const BASE_RGB = [6, 6, 6]

function mod(n, m) {
  return ((n % m) + m) % m
}

function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h
  let s
  const l = (max + min) / 2
  if (max === min) {
    h = 0
    s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }
  return [h * 360, s, l]
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360
  h /= 360
  let r
  let g
  let b
  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

function fallbackFromIndex(idx) {
  const h = (idx * 37) % 360
  const s = 0.6
  return { c1: hslToRgb(h, s, 0.5), c2: hslToRgb(h, s, 0.68) }
}

function extractColors(img, idx) {
  try {
    const MAX = 48
    const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1
    const tw = ratio >= 1 ? MAX : Math.max(16, Math.round(MAX * ratio))
    const th = ratio >= 1 ? Math.max(16, Math.round(MAX / ratio)) : MAX

    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, tw, th)
    const data = ctx.getImageData(0, 0, tw, th).data

    const H_BINS = 36
    const S_BINS = 5
    const SIZE = H_BINS * S_BINS
    const wSum = new Float32Array(SIZE)
    const rSum = new Float32Array(SIZE)
    const gSum = new Float32Array(SIZE)
    const bSum = new Float32Array(SIZE)

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] / 255
      if (a < 0.05) continue
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const [h, s, l] = rgbToHsl(r, g, b)
      if (l < 0.1 || l > 0.92 || s < 0.08) continue
      const w = a * (s * s) * (1 - Math.abs(l - 0.5) * 0.6)
      const hi = Math.max(0, Math.min(H_BINS - 1, Math.floor((h / 360) * H_BINS)))
      const si = Math.max(0, Math.min(S_BINS - 1, Math.floor(s * S_BINS)))
      const bidx = hi * S_BINS + si
      wSum[bidx] += w
      rSum[bidx] += r * w
      gSum[bidx] += g * w
      bSum[bidx] += b * w
    }

    let pIdx = -1
    let pW = 0
    for (let i = 0; i < SIZE; i++) {
      if (wSum[i] > pW) {
        pW = wSum[i]
        pIdx = i
      }
    }
    if (pIdx < 0 || pW <= 0) return fallbackFromIndex(idx)

    const pHue = Math.floor(pIdx / S_BINS) * (360 / H_BINS)

    let sIdx = -1
    let sW = 0
    for (let i = 0; i < SIZE; i++) {
      const w = wSum[i]
      if (w <= 0) continue
      const h = Math.floor(i / S_BINS) * (360 / H_BINS)
      let dh = Math.abs(h - pHue)
      dh = Math.min(dh, 360 - dh)
      if (dh >= 25 && w > sW) {
        sW = w
        sIdx = i
      }
    }

    const avgRGB = (bi) => {
      const w = wSum[bi] || 1e-6
      return [Math.round(rSum[bi] / w), Math.round(gSum[bi] / w), Math.round(bSum[bi] / w)]
    }

    const [pr, pg, pb] = avgRGB(pIdx)
    let [h1, s1] = rgbToHsl(pr, pg, pb)
    s1 = Math.max(0.45, Math.min(1, s1 * 1.15))
    const c1 = hslToRgb(h1, s1, 0.5)

    let c2
    if (sIdx >= 0 && sW >= pW * 0.6) {
      const [sr, sg, sb] = avgRGB(sIdx)
      let [h2, s2] = rgbToHsl(sr, sg, sb)
      s2 = Math.max(0.45, Math.min(1, s2 * 1.05))
      c2 = hslToRgb(h2, s2, 0.7)
    } else {
      c2 = hslToRgb(h1, s1, 0.7)
    }
    return { c1, c2 }
  } catch {
    return fallbackFromIndex(idx)
  }
}

export default function GradientCarousel({ images, onImageClick }) {
  const isMobile = useIsMobile()
  const stageRef = useRef(null)
  const cardsRef = useRef(null)
  const bgRef = useRef(null)

  useEffect(() => {
    const stage = stageRef.current
    const cardsRoot = cardsRef.current
    const bgCanvas = bgRef.current
    if (!stage || !cardsRoot || !bgCanvas || !images?.length) return undefined

    const bgCtx = bgCanvas.getContext('2d', { alpha: false })
    const rot = isMobile ? MAX_ROTATION_M : MAX_ROTATION
    const depth = isMobile ? MAX_DEPTH_M : MAX_DEPTH

    let items = []
    let positions = new Float32Array(0)
    let activeIndex = -1
    let gradPalette = []
    const gradCurrent = { r1: 20, g1: 20, b1: 20, r2: 16, g2: 16, b2: 16 }

    let CARD_W = 300
    let STEP = CARD_W + GAP
    let TRACK = 0
    let SCROLL_X = 0
    let VW_HALF = window.innerWidth * 0.5
    let vX = 0
    let rafId = null
    let bgRAF = null
    let lastTime = 0
    let lastBgDraw = 0
    let bgFastUntil = 0
    let destroyed = false

    // ---- Cards ----
    function createCards() {
      cardsRoot.innerHTML = ''
      items = []
      const fragment = document.createDocumentFragment()
      images.forEach((src, i) => {
        const card = document.createElement('article')
        card.className = 'gcar-card'
        card.dataset.index = String(i)
        card.tabIndex = 0
        card.setAttribute('role', 'button')
        card.setAttribute('aria-label', `Открыть фотографию ${i + 1}`)
        card.style.willChange = 'transform'
        card.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onImageClick?.(i)
          }
        })
        const img = new Image()
        img.className = 'gcar-card__img'
        img.decoding = 'async'
        img.loading = i < 4 ? 'eager' : 'lazy'
        img.fetchPriority = i < 4 ? 'high' : 'auto'
        img.draggable = false
        img.src = src
        card.appendChild(img)
        fragment.appendChild(card)
        items.push({ el: card, x: i * STEP })
      })
      cardsRoot.appendChild(fragment)
    }

    function measure() {
      const sample = items[0]?.el
      if (!sample) return
      const r = sample.getBoundingClientRect()
      CARD_W = r.width || CARD_W
      STEP = CARD_W + GAP
      TRACK = items.length * STEP
      items.forEach((it, i) => {
        it.x = i * STEP
      })
      positions = new Float32Array(items.length)
    }

    function computeTransformComponents(screenX) {
      const norm = Math.max(-1, Math.min(1, screenX / VW_HALF))
      const absNorm = Math.abs(norm)
      const invNorm = 1 - absNorm
      const ry = -norm * rot
      const tz = invNorm * depth
      const scale = MIN_SCALE + invNorm * SCALE_RANGE
      return { norm, invNorm, ry, tz, scale }
    }

    function transformForScreenX(screenX) {
      const { ry, tz, scale } = computeTransformComponents(screenX)
      return {
        transform: `translate3d(${screenX}px,-50%,${tz}px) rotateY(${ry}deg) scale(${scale})`,
        z: tz,
      }
    }

    function updateTransforms() {
      const half = TRACK / 2
      let closestIdx = -1
      let closestDist = Infinity
      for (let i = 0; i < items.length; i++) {
        let pos = items[i].x - SCROLL_X
        if (pos < -half) pos += TRACK
        if (pos > half) pos -= TRACK
        positions[i] = pos
        const dist = Math.abs(pos)
        if (dist < closestDist) {
          closestDist = dist
          closestIdx = i
        }
      }
      const prevIdx = (closestIdx - 1 + items.length) % items.length
      const nextIdx = (closestIdx + 1) % items.length
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        const pos = positions[i]
        const norm = Math.max(-1, Math.min(1, pos / VW_HALF))
        const { transform, z } = transformForScreenX(pos)
        it.el.style.transform = transform
        it.el.style.zIndex = String(1000 + Math.round(z))
        const isCore = i === closestIdx || i === prevIdx || i === nextIdx
        const blur = isCore ? 0 : 2 * Math.pow(Math.abs(norm), 1.1)
        it.el.style.filter = `blur(${blur.toFixed(2)}px)`
      }
      if (closestIdx !== activeIndex) setActiveGradient(closestIdx)
    }

    // ---- Palette / gradient ----
    function buildPalette() {
      gradPalette = items.map((it, i) => {
        const img = it.el.querySelector('img')
        if (!img?.complete || !img.naturalWidth) return fallbackFromIndex(i)
        return extractColors(img, i)
      })
    }

    function setActiveGradient(idx) {
      if (!bgCtx || idx < 0 || idx >= items.length || idx === activeIndex) return
      activeIndex = idx
      const pal = gradPalette[idx] || { c1: [40, 40, 40], c2: [24, 24, 24] }
      const to = {
        r1: pal.c1[0],
        g1: pal.c1[1],
        b1: pal.c1[2],
        r2: pal.c2[0],
        g2: pal.c2[1],
        b2: pal.c2[2],
      }
      bgFastUntil = performance.now() + 800
      gsap.to(gradCurrent, { ...to, duration: 0.5, ease: 'power2.out' })
    }

    function resizeBG() {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
      const w = bgCanvas.clientWidth || stage.clientWidth
      const h = bgCanvas.clientHeight || stage.clientHeight
      const tw = Math.floor(w * dpr)
      const th = Math.floor(h * dpr)
      if (bgCanvas.width !== tw || bgCanvas.height !== th) {
        bgCanvas.width = tw
        bgCanvas.height = th
        bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
    }

    function drawBackground() {
      if (destroyed) return
      const now = performance.now()
      const minInterval = now < bgFastUntil ? 16 : 33
      if (now - lastBgDraw < minInterval) {
        bgRAF = requestAnimationFrame(drawBackground)
        return
      }
      lastBgDraw = now
      resizeBG()
      const w = bgCanvas.clientWidth || stage.clientWidth
      const h = bgCanvas.clientHeight || stage.clientHeight

      bgCtx.fillStyle = `rgb(${BASE_RGB[0]},${BASE_RGB[1]},${BASE_RGB[2]})`
      bgCtx.fillRect(0, 0, w, h)

      const time = now * 0.0002
      const cx = w * 0.5
      const cy = h * 0.5
      const a1 = Math.min(w, h) * 0.35
      const a2 = Math.min(w, h) * 0.28
      const x1 = cx + Math.cos(time) * a1
      const y1 = cy + Math.sin(time * 0.8) * a1 * 0.4
      const x2 = cx + Math.cos(-time * 0.9 + 1.2) * a2
      const y2 = cy + Math.sin(-time * 0.7 + 0.7) * a2 * 0.5
      const rr1 = Math.max(w, h) * 0.75
      const rr2 = Math.max(w, h) * 0.65
      const fade = `rgba(${BASE_RGB[0]},${BASE_RGB[1]},${BASE_RGB[2]},0)`

      const g1 = bgCtx.createRadialGradient(x1, y1, 0, x1, y1, rr1)
      g1.addColorStop(0, `rgba(${gradCurrent.r1},${gradCurrent.g1},${gradCurrent.b1},0.55)`)
      g1.addColorStop(1, fade)
      bgCtx.fillStyle = g1
      bgCtx.fillRect(0, 0, w, h)

      const g2 = bgCtx.createRadialGradient(x2, y2, 0, x2, y2, rr2)
      g2.addColorStop(0, `rgba(${gradCurrent.r2},${gradCurrent.g2},${gradCurrent.b2},0.4)`)
      g2.addColorStop(1, fade)
      bgCtx.fillStyle = g2
      bgCtx.fillRect(0, 0, w, h)

      bgRAF = requestAnimationFrame(drawBackground)
    }

    // ---- Physics loop ----
    function tick(t) {
      if (destroyed) return
      const dt = lastTime ? (t - lastTime) / 1000 : 0
      lastTime = t
      SCROLL_X = mod(SCROLL_X + vX * dt, TRACK)
      const decay = Math.pow(FRICTION, dt * 60)
      vX *= decay
      if (Math.abs(vX) < 0.02) vX = 0
      updateTransforms()
      rafId = requestAnimationFrame(tick)
    }

    function startCarousel() {
      cancelCarousel()
      lastTime = 0
      rafId = requestAnimationFrame((t) => {
        updateTransforms()
        tick(t)
      })
    }
    function cancelCarousel() {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = null
    }
    function cancelBG() {
      if (bgRAF) cancelAnimationFrame(bgRAF)
      bgRAF = null
    }

    // ---- Events ----
    const onWheel = (e) => {
      e.preventDefault()
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      vX += delta * WHEEL_SENS * 20
    }
    const onDragStart = (e) => e.preventDefault()

    let dragging = false
    let lastX = 0
    let lastT = 0
    let lastDelta = 0
    let dragStartX = 0
    let moved = false

    const onPointerDown = (e) => {
      dragging = true
      lastX = e.clientX
      dragStartX = e.clientX
      lastT = performance.now()
      lastDelta = 0
      moved = false
      try {
        stage.setPointerCapture(e.pointerId)
      } catch {
        /* noop */
      }
      stage.classList.add('gcar-dragging')
    }
    const onPointerMove = (e) => {
      if (!dragging) return
      const now = performance.now()
      const dx = e.clientX - lastX
      if (Math.abs(e.clientX - dragStartX) > 8) moved = true
      const dt = Math.max(1, now - lastT) / 1000
      SCROLL_X = mod(SCROLL_X - dx * DRAG_SENS, TRACK)
      lastDelta = dx / dt
      lastX = e.clientX
      lastT = now
    }
    const onPointerUp = (e) => {
      if (!dragging) return
      dragging = false
      try {
        stage.releasePointerCapture(e.pointerId)
      } catch {
        /* noop */
      }
      vX = -lastDelta * DRAG_SENS
      stage.classList.remove('gcar-dragging')

      if (!moved) {
        const element = document.elementFromPoint(e.clientX, e.clientY)
        const card = element?.closest?.('.gcar-card')
        const index = Number(card?.dataset?.index)
        if (Number.isInteger(index)) onImageClick?.(index)
      }
    }

    let resizeTimer = null
    const onResize = () => {
      const prevStep = STEP || 1
      const ratio = SCROLL_X / (items.length * prevStep)
      measure()
      VW_HALF = window.innerWidth * 0.5
      SCROLL_X = mod(ratio * TRACK, TRACK)
      updateTransforms()
      resizeBG()
    }
    const onResizeDebounced = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(onResize, 80)
    }
    const onVisibility = () => {
      if (document.hidden) {
        cancelCarousel()
        cancelBG()
      } else {
        startCarousel()
        drawBackground()
      }
    }

    stage.addEventListener('wheel', onWheel, { passive: false })
    stage.addEventListener('dragstart', onDragStart)
    stage.addEventListener('pointerdown', onPointerDown)
    stage.addEventListener('pointermove', onPointerMove)
    stage.addEventListener('pointerup', onPointerUp)
    stage.addEventListener('pointercancel', onPointerUp)
    window.addEventListener('resize', onResizeDebounced)
    document.addEventListener('visibilitychange', onVisibility)

    // ---- Init ----
    function waitForImages() {
      return Promise.all(
        items.map((it) => {
          const img = it.el.querySelector('img')
          if (!img || img.complete) return Promise.resolve()
          return new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true })
            img.addEventListener('error', resolve, { once: true })
          })
        }),
      )
    }

    async function init() {
      createCards()
      measure()
      updateTransforms()
      buildPalette()
      setActiveGradient(0)
      resizeBG()
      drawBackground()
      startCarousel()

      // Палитра по загруженным фото — без блокировки старта карусели
      waitForImages().then(() => {
        if (destroyed) return
        buildPalette()
        updateTransforms()
      })
    }

    init()

    return () => {
      destroyed = true
      cancelCarousel()
      cancelBG()
      clearTimeout(resizeTimer)
      gsap.killTweensOf(gradCurrent)
      stage.removeEventListener('wheel', onWheel)
      stage.removeEventListener('dragstart', onDragStart)
      stage.removeEventListener('pointerdown', onPointerDown)
      stage.removeEventListener('pointermove', onPointerMove)
      stage.removeEventListener('pointerup', onPointerUp)
      stage.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('resize', onResizeDebounced)
      document.removeEventListener('visibilitychange', onVisibility)
      cardsRoot.innerHTML = ''
    }
  }, [images, isMobile, onImageClick])

  return (
    <div ref={stageRef} className="gcar-stage">
      <canvas ref={bgRef} className="gcar-bg" />
      <div ref={cardsRef} className="gcar-cards" />
    </div>
  )
}
