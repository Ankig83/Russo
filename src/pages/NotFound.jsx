import { Link } from 'react-router-dom'
import EditorialBackdrop from '../components/ui/EditorialBackdrop'

/** Страница 404 */
export default function NotFound() {
  return (
    <div className="editorial-page flex min-h-screen flex-col items-center justify-center px-6">
      <EditorialBackdrop />
      <div className="editorial-panel w-full max-w-xl rounded-[2rem] px-7 py-14 text-center">
        <p className="mb-3 text-xs tracking-[0.35em] text-[#d29a52]">404</p>
        <h1 className="mb-4 text-3xl font-light tracking-wide">Страница не найдена</h1>
        <p className="mb-8 text-white/50">Такого раздела пока нет.</p>
        <Link
          to="/"
          className="inline-flex rounded-full border border-[#d6a15b]/30 px-7 py-3 text-xs uppercase tracking-[0.2em] text-[#f0d8b3]"
        >
          ← На главную
        </Link>
      </div>
    </div>
  )
}
