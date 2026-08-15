import { useEffect, useRef, useState, useCallback } from 'react'
import { useProgress } from '@react-three/drei'
import gsap from 'gsap'
import { useAppStore } from '../../store/appStore'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { russoAssetsProgress, russoOverlayPhase } from '../../utils/russoLog'
import PreloaderCanvas from '../3d/PreloaderCanvas'

/** Короткий hold, чтобы скан/лого успели — не блокируем после ready на секунды */
const MIN_SHOW_MS = 700
const MIN_SHOW_MS_MOBILE = 550
/** Если useProgress завис на active — всё равно отпускаем сцену */
const MAX_WAIT_MS = 45000
/** Если dock/LogoScene завис — снимаем оверлей без ожидания onDocked */
const DOCK_FAILSAFE_MS = 1800

function LoadingBar({ progress, isMobile, fadeRef }) {
  const pct = Math.round(progress)
  return (
    <div
      ref={fadeRef}
      style={{
        position: 'absolute',
        bottom: isMobile ? 'max(12%, calc(1.5rem + var(--safe-bottom)))' : '10%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: isMobile ? 180 : 220,
        textAlign: 'center',
        userSelect: 'none',
        zIndex: 2,
      }}
    >
      <p style={{
        color: 'rgba(180,180,180,0.65)',
        fontSize: isMobile ? 10 : 11,
        letterSpacing: '0.28em',
        textTransform: 'uppercase',
        marginBottom: 10,
        fontFamily: 'sans-serif',
      }}>
        загрузка
      </p>
      <div style={{
        width: '100%',
        height: 1,
        background: 'rgba(255,255,255,0.12)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #8a8a8a, #f0f0f0, #8a8a8a)',
          transition: 'width 0.25s ease',
        }} />
      </div>
      <p style={{
        color: 'rgba(255,255,255,0.55)',
        fontSize: 11,
        letterSpacing: '0.2em',
        marginTop: 8,
        fontFamily: 'monospace',
      }}>
        {pct} %
      </p>
    </div>
  )
}

/**
 * Кинематографичный прелоадер:
 * чёрный void + 3D монограмм (russo-mark) под тёмным стеклом,
 * скан-луч по progress, докинг в угол → CornerLogo.
 */
export default function LoadingOverlay() {
  const isMobile = useIsMobile()
  const minShowMs = isMobile ? MIN_SHOW_MS_MOBILE : MIN_SHOW_MS
  const { active, progress, item } = useProgress()
  const wrapRef = useRef(null)
  const barRef = useRef(null)
  const setLoadingDone = useAppStore((s) => s.setLoadingDone)
  const loadingDone = useAppStore((s) => s.loadingDone)
  const [hidden, setHidden] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [startMs] = useState(() => Date.now())
  const exitDone = useRef(false)
  const fadeStarted = useRef(false)
  const hasSeenActive = useRef(false)

  useEffect(() => {
    if (active) hasSeenActive.current = true
    // progress=100 тоже считаем «видели загрузку» — кэш / быстрый старт
    if (progress >= 100) hasSeenActive.current = true
    russoAssetsProgress({ active, progress, item })
  }, [active, progress, item])

  useEffect(() => {
    if (loadingDone || exitDone.current) return undefined

    const elapsed = Date.now() - startMs
    const assetsReady = hasSeenActive.current && !active
    const timedOut = elapsed >= MAX_WAIT_MS
    if (!assetsReady && !timedOut) return undefined

    const delay = assetsReady ? Math.max(0, minShowMs - elapsed) : 0

    if (delay > 0) {
      russoOverlayPhase('waiting-min', {
        minShowMs,
        elapsedMs: elapsed,
        waitMoreMs: delay,
      })
    }

    const timer = setTimeout(() => {
      if (exitDone.current) return
      exitDone.current = true
      russoOverlayPhase('exit-start', {
        elapsedMs: Date.now() - startMs,
        timedOut,
      })
      if (barRef.current) {
        gsap.to(barRef.current, { opacity: 0, duration: 0.55, ease: 'power2.in' })
      }
      setIsLoaded(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [active, progress, loadingDone, minShowMs, startMs])

  // Жёсткий failsafe: оверлей не может висеть бесконечно
  useEffect(() => {
    const t = setTimeout(() => {
      if (exitDone.current || loadingDone) return
      exitDone.current = true
      russoOverlayPhase('exit-start', { failsafe: true })
      setIsLoaded(true)
    }, MAX_WAIT_MS)
    return () => clearTimeout(t)
  }, [loadingDone])

  const handleDocked = useCallback(() => {
    if (fadeStarted.current || loadingDone) return
    fadeStarted.current = true
    const wrap = wrapRef.current
    const finish = () => {
      setLoadingDone()
      setHidden(true)
      russoOverlayPhase('done')
    }
    if (wrap) {
      gsap.to(wrap, {
        opacity: 0,
        duration: 0.5,
        ease: 'power2.inOut',
        onComplete: finish,
      })
    } else {
      finish()
    }
  }, [setLoadingDone, loadingDone])

  // Root cause зависания: isLoaded=true, но LogoScene/Suspense не вызвал onDocked
  useEffect(() => {
    if (!isLoaded || loadingDone || hidden) return undefined
    const t = setTimeout(() => {
      russoOverlayPhase('dock-failsafe')
      handleDocked()
    }, DOCK_FAILSAFE_MS)
    return () => clearTimeout(t)
  }, [isLoaded, loadingDone, hidden, handleDocked])

  if (hidden || loadingDone) return null

  return (
    <div
      ref={wrapRef}
      className="pointer-events-none fixed inset-0 z-50"
      style={{ background: '#000000' }}
    >
      <PreloaderCanvas
        progress={progress}
        isLoaded={isLoaded}
        isMobile={isMobile}
        onDocked={handleDocked}
      />
      {!isLoaded && (
        <LoadingBar progress={progress} isMobile={isMobile} fadeRef={barRef} />
      )}
    </div>
  )
}
