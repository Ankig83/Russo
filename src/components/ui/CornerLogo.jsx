import { useEffect, useRef } from 'react'
import { useAppStore } from '../../store/appStore'
import gsap from 'gsap'
import { useIsMobile } from '../../hooks/useMediaQuery'

/** Маленькая монограмма в правом верхнем углу — появляется после загрузки */
export default function CornerLogo() {
  const loadingDone = useAppStore((s) => s.loadingDone)
  const isMobile = useIsMobile()
  const size = isMobile ? 36 : 48
  const ref = useRef(null)

  useEffect(() => {
    if (!loadingDone || !ref.current) return
    gsap.fromTo(ref.current,
      { opacity: 0, scale: 0.5, transformOrigin: 'top right' },
      { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(1.4)', delay: 0.1 },
    )
  }, [loadingDone])

  if (!loadingDone) return null

  return (
    <a
      ref={ref}
      href="/"
      className="pointer-events-auto fixed z-40 opacity-0"
      style={{
        display: 'block',
        lineHeight: 0,
        top: 'max(0.75rem, var(--safe-top))',
        right: 'max(0.75rem, var(--safe-right))',
      }}
      aria-label="Руссо — на главную"
    >
      <svg
        viewBox="0 0 595.3 595.3"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="cl-metal" x1="0.35" y1="0" x2="0.65" y2="1" gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="#f8e8a8" />
            <stop offset="25%"  stopColor="#c88030" />
            <stop offset="50%"  stopColor="#fff0c0" />
            <stop offset="75%"  stopColor="#b07020" />
            <stop offset="100%" stopColor="#e4b040" />
          </linearGradient>
        </defs>
        <path
          fill="url(#cl-metal)"
          d="M281.6,56.9h32.1c70.2,0,127.7,57.5,127.7,127.7v1.2v223.7v1.2c0,70.2-57.5,127.7-127.7,127.7h-32.1
            c-19.5,0-38-4.4-54.6-12.3c0-89,0-178,0-267l0,0l0-0.7h0v-58.3h0v-41.8c0-19.4,7.9-37.1,20.7-49.9c12.8-12.8,30.5-20.7,49.9-20.7
            c19.4,0,37.1,7.9,49.9,20.7c12.8,12.8,20.7,30.5,20.7,49.9v81.2h0v18.9c0,19.4-7.9,37.1-20.7,49.9c-12.8,12.8-30.5,20.7-49.9,20.7
            c-3.6,0-7.1-0.3-10.5-0.8c-3.5-0.5-7-1.3-10.3-2.3l-5.1-1.6v203c8.3,2.2,16.9,3.4,25.9,3.4h0c54.6,0,99.3-44.2,99.3-98.2V162.9
            c0-54-44.7-98.2-99.3-98.2h0c-54.6,0-99.3,44.2-99.3,98.2v269.5c0,1.2,0,2.4,0.1,3.6v71.4c-27.2-23.5-44.5-58.1-44.5-96.6v-1.2
            V185.8v-1.2C153.9,114.4,211.4,56.9,281.6,56.9L281.6,56.9z M282.1,281.3c9,0,16.3,7.3,16.3,16.3c0,9-7.3,16.3-16.3,16.3
            c-2.4,0-4.6-0.5-6.6-1.4c2.9,3.4,6.2,6.5,9.6,8.4c3.7,2.1,8,3.3,12.5,3.3h0c7.1,0,13.6-2.9,18.3-7.6c4.7-4.7,7.6-11.2,7.6-18.3
            v-98.4h0V118c0-7.1-2.9-13.6-7.6-18.3c-4.7-4.7-11.2-7.6-18.3-7.6h0c-7.1,0-13.6,2.9-18.3,7.6c-4.7,4.7-7.6,11.2-7.6,18.3v165.9
            v1.1C274.6,282.7,278.2,281.3,282.1,281.3z"
        />
      </svg>
    </a>
  )
}
