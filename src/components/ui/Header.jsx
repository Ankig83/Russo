import { useIsMobile } from '../../hooks/useMediaQuery'
import { useShkafStore } from '../../store/shkafStore'

// const LOGO_HEADER = `${import.meta.env.BASE_URL}assets/brand/logo-header.svg`

/** HTML-оверлей поверх Canvas: лого и подсказка */
export default function Header() {
  const isMobile = useIsMobile()
  const doorsOpen = useShkafStore((s) => s.doorsOpen)

  return (
    <header className="pointer-events-none absolute inset-0 z-10 flex flex-col px-6 pb-6 pt-2 md:px-8 md:pb-8 md:pt-3">
      {/* <Link to="/" className="pointer-events-auto block w-fit -translate-y-2 md:-translate-y-10">
        <img
          src={LOGO_HEADER}
          alt="Руссо"
          className="h-10 w-auto md:h-24"
          draggable={false}
        />
      </Link> */}

      <div className="mt-auto flex flex-col items-center gap-2 pb-4">
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
