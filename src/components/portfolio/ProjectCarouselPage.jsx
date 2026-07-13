import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import GradientCarousel from './GradientCarousel'
import ImageLightbox from './ImageLightbox'
import EditorialBackdrop from '../ui/EditorialBackdrop'
import { getCategory, getProject } from '../../constants/portfolioProjects'

/** Страница проекта: полноэкранная градиент-карусель фото + оверлей с описанием */
export default function ProjectCarouselPage({ category }) {
  const { slug } = useParams()
  const meta = getCategory(category)
  const project = getProject(category, slug)
  const [lightboxIndex, setLightboxIndex] = useState(null)

  useEffect(() => {
    if (project) document.title = `${project.title} — Руссо`
    return () => {
      document.title = 'РУССО — мебельная компания'
    }
  }, [project])

  if (!project) {
    return (
      <div className="editorial-page flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <EditorialBackdrop />
        <h1 className="mb-4 text-2xl font-semibold">Проект не найден</h1>
        <Link
          to={meta?.route ?? '/'}
          className="rounded-md border border-white/20 px-6 py-2 text-sm tracking-wide transition-colors hover:bg-white/10"
        >
          ← К разделу
        </Link>
      </div>
    )
  }

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-[#060606]">
      <GradientCarousel
        images={project.images}
        onImageClick={setLightboxIndex}
      />

      {/* Верхний оверлей: назад + название */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-3 px-5 md:px-8"
        style={{ paddingTop: 'max(1.25rem, calc(1rem + var(--safe-top)))' }}
      >
        <Link
          to={meta?.route ?? '/'}
          className="pointer-events-auto inline-flex w-fit items-center gap-2 text-sm tracking-wide text-white/70 transition-colors hover:text-white"
        >
          ← {meta?.title ?? 'Назад'}
        </Link>
      </div>

      {/* Нижний оверлей: описание проекта */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-5 text-center md:px-8"
        style={{ paddingBottom: 'max(1.5rem, calc(1rem + var(--safe-bottom)))' }}
      >
        <h1 className="max-w-3xl text-lg font-medium tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] md:text-2xl">
          {project.title}
        </h1>
        <p className="mt-1 text-xs tracking-[0.2em] text-[#e4b040] uppercase md:text-sm">
          {project.city}
          {project.year ? ` · ${project.year}` : ''}
        </p>
        <p className="mt-3 hidden max-w-xl text-xs text-white/40 md:block">
          Потяните, чтобы листать · нажмите на фото, чтобы открыть
        </p>
      </div>

      {lightboxIndex != null && (
        <ImageLightbox
          images={project.images}
          index={lightboxIndex}
          title={project.title}
          onChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}
