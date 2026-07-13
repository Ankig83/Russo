import { Link } from 'react-router-dom'
import EditorialBackdrop from './EditorialBackdrop'

/** Общий layout для страниц-заглушек */
export default function StubPage({ title, description }) {
  return (
    <div className="editorial-page flex min-h-screen flex-col items-center justify-center px-6">
      <EditorialBackdrop />
      <div className="editorial-panel w-full max-w-xl rounded-[2rem] px-7 py-14 text-center md:px-14">
        <p className="mb-4 text-[10px] uppercase tracking-[0.42em] text-[#d29a52]">РУССО</p>
        <h1 className="mb-5 text-3xl font-light tracking-[0.08em] md:text-5xl">{title}</h1>
        <p className="mx-auto mb-9 max-w-md text-sm leading-7 text-white/55">{description}</p>
        <Link
          to="/"
          className="inline-flex rounded-full border border-[#d6a15b]/30 px-7 py-3 text-xs uppercase tracking-[0.2em] text-[#f0d8b3] transition hover:border-[#e1ae69]/70 hover:bg-[#d09345]/10"
        >
          ← На главную
        </Link>
      </div>
    </div>
  )
}
