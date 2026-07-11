import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import gsap from 'gsap'
import { useAppStore } from '../../store/appStore'

const MIN_SHOW_MS = 7500

/** Прогресс-бар + текст «загрузка» */
function LoadingBar({ progress }) {
  const pct = Math.round(progress)
  return (
    <div style={{
      position: 'absolute',
      bottom: '10%',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 220,
      textAlign: 'center',
      userSelect: 'none',
    }}>
      {/* Подпись */}
      <p style={{
        color: 'rgba(200,160,60,0.7)',
        fontSize: 11,
        letterSpacing: '0.25em',
        textTransform: 'uppercase',
        marginBottom: 10,
        fontFamily: 'sans-serif',
      }}>
        загрузка
      </p>

      {/* Трек */}
      <div style={{
        width: '100%',
        height: 1,
        background: 'rgba(255,255,255,0.1)',
        borderRadius: 1,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #c88030, #f8e8a0, #c88030)',
          borderRadius: 1,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Процент */}
      <p style={{
        color: 'rgba(200,160,60,0.5)',
        fontSize: 10,
        letterSpacing: '0.15em',
        marginTop: 8,
        fontFamily: 'monospace',
      }}>
        {pct} %
      </p>
    </div>
  )
}

/** CSS-анимация: цикл металлических оттенков (золото → серебро → медь → бронза → платина) */
const SHIMMER_STYLE = `
  @keyframes lgo-metal-shimmer {
    0%   { filter: sepia(1) saturate(4.0) hue-rotate(0deg)   brightness(1.0); }
    15%  { filter: sepia(0) saturate(0.0) hue-rotate(0deg)   brightness(2.2); }
    30%  { filter: sepia(1) saturate(5.0) hue-rotate(-22deg) brightness(0.85); }
    50%  { filter: sepia(1) saturate(3.5) hue-rotate(18deg)  brightness(1.15); }
    65%  { filter: sepia(0.2) saturate(0.8) hue-rotate(0deg) brightness(1.9); }
    82%  { filter: sepia(1) saturate(4.5) hue-rotate(6deg)   brightness(1.2); }
    100% { filter: sepia(1) saturate(4.0) hue-rotate(0deg)   brightness(1.0); }
  }
  .lgo-shimmer {
    animation: lgo-metal-shimmer 5s ease-in-out infinite;
  }
`

export default function LoadingOverlay() {
  const { active, progress } = useProgress()
  const wrapRef  = useRef(null)
  const logoRef  = useRef(null)   /* float — на этом div */
  const setLoadingDone = useAppStore((s) => s.setLoadingDone)
  const [hidden, setHidden] = useState(false)
  const startMs  = useRef(Date.now())
  const exitDone = useRef(false)

  /* CSS для шиммера */
  useEffect(() => {
    const el = document.createElement('style')
    el.textContent = SHIMMER_STYLE
    document.head.appendChild(el)
    return () => document.head.removeChild(el)
  }, [])

  /* Левитация — только float, без вращения */
  useEffect(() => {
    const el = logoRef.current
    if (!el) return
    const t = gsap.to(el, {
      y: -24,
      duration: 2.4,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    })
    return () => t.kill()
  }, [])

  /* Улёт после ≥7.5 сек + GLB загружен */
  useEffect(() => {
    if (active || exitDone.current) return

    const elapsed = Date.now() - startMs.current
    const delay   = Math.max(0, MIN_SHOW_MS - elapsed)

    const timer = setTimeout(() => {
      if (exitDone.current) return
      exitDone.current = true

      const logo = logoRef.current
      const wrap = wrapRef.current
      if (!logo || !wrap) return

      const rect    = logo.getBoundingClientRect()
      const targetX = window.innerWidth  - rect.right   + rect.width  * 0.5 - 24
      const targetY = -(rect.top - 24)

      gsap.killTweensOf(logo)

      const tl = gsap.timeline({ onComplete: () => {
        setLoadingDone()
        setHidden(true)
      }})

      tl.to(logo, {
        x: targetX,
        y: targetY,
        scale: 0.13,
        duration: 1.0,
        ease: 'power3.inOut',
      }, 0)

      tl.to(wrap, {
        opacity: 0,
        duration: 0.45,
        ease: 'power2.in',
        delay: 0.6,
      }, 0)
    }, delay)

    return () => clearTimeout(timer)
  }, [active, setLoadingDone])

  if (hidden) return null

  return (
    <div
      ref={wrapRef}
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: '#050505' }}
    >
      <LoadingBar progress={progress} />

      {/* Float-контейнер */}
      <div
        ref={logoRef}
        style={{ willChange: 'transform', transformOrigin: 'center center' }}
      >
        {/* Объёмная тень на контейнере, шиммер — на img */}
        <div style={{
          filter: 'drop-shadow(0 14px 28px rgba(0,0,0,0.95)) drop-shadow(0 4px 8px rgba(180,100,0,0.45))',
        }}>
          <img
            src="/assets/russo-mark.svg"
            alt=""
            width={360}
            height={360}
            draggable={false}
            className="lgo-shimmer"
            style={{ display: 'block' }}
          />
        </div>
      </div>
    </div>
  )
}
