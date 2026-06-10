import { Link } from 'react-router-dom'

/** Общий layout для страниц-заглушек */
export default function StubPage({ title, description }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0f0f0f] px-6 text-white">
      <h1 className="mb-4 text-3xl font-bold tracking-wider">{title}</h1>
      <p className="mb-8 max-w-md text-center text-white/60">{description}</p>
      <Link
        to="/"
        className="rounded-md border border-white/20 px-6 py-2 text-sm tracking-wide transition-colors hover:bg-white/10"
      >
        ← На главную
      </Link>
    </div>
  )
}
