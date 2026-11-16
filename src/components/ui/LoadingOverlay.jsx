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
/** 'video' — чертёж на весь экран. 'mark' — объёмный логотип со световой полосой. */
const PRELOADER_KIND = 'video'
function BlueprintFilm() {
  const isMobile = useIsMobile()
  const src = `${import.meta.env.BASE_URL}video/preloader-blueprint.mp4?v=cabinet`
  const videoStyle = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: isMobile ? 'contain' : 'cover',
  }
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#111111' }}>
      {isMobile && (
        <video
          src={src}
          autoPlay
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          style={{
            ...videoStyle,
            inset: '-8%',
            width: '116%',
            height: '116%',
            objectFit: 'cover',
            filter: 'blur(28px)',
            transform: 'scale(1.08)',
          }}
        />
      )}
      <video
        src={src}
        autoPlay
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        style={videoStyle}
      />
    </div>
  )
}

function LoadingBar({ progress, isMobile, fadeRef, ink = 'light' }) {
  const pct = Math.round(progress)
  const dark = ink === 'dark'
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
        color: dark ? 'rgba(28,28,28,0.72)' : 'rgba(180,180,180,0.65)',
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
        background: dark ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.12)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: dark
            ? 'linear-gradient(90deg, #3a3a3a, #111111, #3a3a3a)'
            : 'linear-gradient(90deg, #8a8a8a, #f0f0f0, #8a8a8a)',
          transition: 'width 0.25s ease',
        }} />
      </div>
      <p style={{
        color: dark ? 'rgba(20,20,20,0.7)' : 'rgba(255,255,255,0.55)',
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
 * Прелоадер. PRELOADER_KIND = 'video' — чертёж на весь кадр.
 * 'mark' — объёмный логотип со световой полосой, докинг в угол.
 */
export default function LoadingOverlay() {
  const isMobile = useIsMobile()
  const minShowMs = isMobile ? MIN_SHOW_MS_MOBILE : MIN_SHOW_MS
  const { active, progress, item } = useProgress()
  const extrasReady = useAppStore((s) => s.extrasReady)
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
    // Первая пауза useProgress — это только GLB. Кожа и карты стартуют следом.
    const assetsReady = hasSeenActive.current && !active && extrasReady
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
  }, [active, progress, extrasReady, loadingDone, minShowMs, startMs])

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
    if (PRELOADER_KIND !== 'video' || !isLoaded || loadingDone || hidden) return
    handleDocked()
  }, [isLoaded, loadingDone, hidden, handleDocked])

  useEffect(() => {
    if (PRELOADER_KIND === 'video' || !isLoaded || loadingDone || hidden) return undefined
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
      {PRELOADER_KIND === 'video' ? (
        <BlueprintFilm />
      ) : (
        <PreloaderCanvas
          progress={progress}
          isLoaded={isLoaded}
          isMobile={isMobile}
          onDocked={handleDocked}
        />
      )}
      {!isLoaded && (
        <LoadingBar
          progress={progress}
          isMobile={isMobile}
          fadeRef={barRef}
          ink={PRELOADER_KIND === 'video' ? 'dark' : 'light'}
        />
      )}
    </div>
  )
}
