import { Link } from 'react-router-dom'
import { getCategory, getProjectsByCategory } from '../../constants/portfolioProjects'
import EditorialBackdrop from '../ui/EditorialBackdrop'
import './PortfolioSectionPage.css'

/** Hub раздела портфолио: сетка проектов категории (или empty state) */
export default function PortfolioSectionPage({ category }) {
  const meta = getCategory(category)
  const projects = getProjectsByCategory(category)

  return (
    <div className="editorial-page w-full">
      <EditorialBackdrop />
      <div
        className="relative mx-auto max-w-6xl px-5 md:px-8"
        style={{
          paddingTop: 'max(3.5rem, calc(2rem + var(--safe-top)))',
          paddingBottom: 'max(3rem, calc(2rem + var(--safe-bottom)))',
        }}
      >
        <Link
          to="/"
          className="mb-12 inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/45 transition-colors hover:text-[#e5bd85]"
        >
          ← На главную
        </Link>

        <header className="mb-12 md:mb-16">
          <p className="mb-4 text-[10px] uppercase tracking-[0.45em] text-[#d69c52]">
            Портфолио
          </p>
          <h1 className="max-w-4xl text-4xl font-light leading-tight tracking-[0.04em] md:text-6xl">
            {meta?.title ?? 'Раздел'}
          </h1>
          {meta?.subtitle && (
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/45 md:text-base">
              {meta.subtitle}
            </p>
          )}
        </header>

        {projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="project-grid grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                route={meta.route}
                index={index}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ProjectCard({ project, route, index }) {
  return (
    <Link
      to={`${route}/${project.slug}`}
      className="project-card group"
    >
      <div className="project-card__surface">
        <div className="project-card__image aspect-[4/3] bg-black">
          <img
            src={project.cover}
            alt={project.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.06]"
          />
        </div>
        <div className="flex items-center gap-4 p-5 md:p-6">
          <span className="project-card__number">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-normal leading-snug tracking-wide md:text-lg">
              {project.title}
            </h2>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#d7a360]/65">
              {project.city}
              {project.year ? ` · ${project.year}` : ''}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="editorial-panel flex flex-col items-center justify-center rounded-[2rem] px-6 py-20 text-center">
      <p className="mb-2 text-lg text-white/70">Проекты скоро появятся</p>
      <p className="max-w-md text-sm text-white/40">
        Мы готовим работы для этого раздела. Загляните позже или посмотрите другие
        разделы портфолио.
      </p>
    </div>
  )
}
