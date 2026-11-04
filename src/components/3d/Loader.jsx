import { CABINET_BACKGROUND } from '../../constants/cabinetStudio'

/** Лоадер 3D-сцены (Suspense fallback) */
export default function Loader() {
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: CABINET_BACKGROUND }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
        <p className="text-sm tracking-widest text-white/40 uppercase">Загрузка</p>
      </div>
    </div>
  )
}
