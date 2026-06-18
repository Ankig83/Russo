import { Link } from 'react-router-dom'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { useShkafStore } from '../../store/shkafStore'

/** HTML-оверлей поверх Canvas: лого и подсказка */
export default function Header() {
  const isMobile = useIsMobile()
  const doorsOpen = useShkafStore((s) => s.doorsOpen)

  return (
    <header className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-6 md:p-8">
      <Link
        to="/"
        className="pointer-events-auto w-fit text-2xl font-bold tracking-[0.3em] text-neutral-800 md:text-3xl"
      >
        РУССО
      </Link>

      <div className="flex flex-col items-center gap-2 pb-4">
          <div className={doorsOpen ? '' : 'animate-bounce'}>
            <svg
              className="h-6 w-6 text-neutral-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={doorsOpen ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'}
              />
            </svg>
          </div>
          <p className="text-sm tracking-wide text-neutral-500 md:text-base">
            {doorsOpen
              ? isMobile
                ? 'нажми, чтобы закрыть'
                : 'закрой шкаф'
              : isMobile
                ? 'нажми на шкаф'
                : 'открой шкаф'}
          </p>
        </div>
    </header>
  )
}
