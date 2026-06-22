import { STUDIO_BG_STYLE } from '../../constants/scene'

/** Лоадер 3D-сцены (Suspense fallback) */
export default function Loader({ progress = 0, isMobile = false }) {
  const pct = Math.round(progress)

  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={STUDIO_BG_STYLE}
    >
      <div className="flex max-w-xs flex-col items-center gap-4 px-6 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-black/10 border-t-black/40" />
        <p className="text-sm tracking-widest text-black/40 uppercase">Загрузка</p>
        {pct > 0 && (
          <p className="text-lg font-medium tabular-nums text-black/50">{pct}%</p>
        )}
        {isMobile && (
          <p className="text-xs leading-relaxed text-black/35">
            Модель ~20 МБ — на мобильном интернете загрузка может занять 2–4 минуты. Не закрывайте
            страницу.
          </p>
        )}
      </div>
    </div>
  )
}
