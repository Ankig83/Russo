import { STUDIO_BG_STYLE } from '../../constants/scene'

/** Лоадер 3D-сцены (Suspense fallback) */
export default function Loader() {
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={STUDIO_BG_STYLE}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-black/10 border-t-black/40" />
        <p className="text-sm tracking-widest text-black/40 uppercase">Загрузка</p>
      </div>
    </div>
  )
}
