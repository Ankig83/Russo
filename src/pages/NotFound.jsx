import { Link } from 'react-router-dom'

/** Страница 404 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0f0f0f] px-6 text-white">
      <h1 className="mb-4 text-3xl font-bold tracking-wider">Страница не найдена</h1>
      <p className="mb-8 max-w-md text-center text-white/60">
        Такого раздела пока нет.
      </p>
      <Link
        to="/"
        className="rounded-md border border-white/20 px-6 py-2 text-sm tracking-wide transition-colors hover:bg-white/10"
      >
        ← На главную
      </Link>
    </div>
  )
}
