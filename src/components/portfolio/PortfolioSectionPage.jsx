import { Link } from 'react-router-dom'
import { getCategory, getProjectsByCategory } from '../../constants/portfolioProjects'

/** Hub раздела портфолио: сетка проектов категории (или empty state) */
export default function PortfolioSectionPage({ category }) {
  const meta = getCategory(category)
  const projects = getProjectsByCategory(category)

  return (
    <div className="min-h-dvh w-full bg-[#0b0b0b] text-white">
      <div
        className="mx-auto max-w-6xl px-5 md:px-8"
        style={{
          paddingTop: 'max(3.5rem, calc(2rem + var(--safe-top)))',
          paddingBottom: 'max(3rem, calc(2rem + var(--safe-bottom)))',
        }}
      >
        <Link
          to="/"
          className="mb-10 inline-flex items-center gap-2 text-sm tracking-wide text-white/50 transition-colors hover:text-white"
        >
          ← На главную
        </Link>

        <header className="mb-10 md:mb-14">
          <p className="mb-3 text-[11px] uppercase tracking-[0.35em] text-[#c88030]">
            Портфолио
          </p>
          <h1 className="text-3xl font-semibold tracking-wide md:text-5xl">
            {meta?.title ?? 'Раздел'}
          </h1>
          {meta?.subtitle && (
            <p className="mt-4 max-w-2xl text-sm text-white/50 md:text-base">
              {meta.subtitle}
            </p>
          )}
        </header>

        {projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} route={meta.route} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ProjectCard({ project, route }) {
  return (
    <Link
      to={`${route}/${project.slug}`}
      className="group block overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] transition-colors hover:border-[#c88030]/60"
    >
      <div className="aspect-[4/3] overflow-hidden bg-black">
        <img
          src={project.cover}
          alt={project.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
      </div>
      <div className="p-4">
        <h2 className="text-base font-medium leading-snug md:text-lg">
          {project.title}
        </h2>
        <p className="mt-1 text-sm text-white/45">
          {project.city}
          {project.year ? `, ${project.year}` : ''}
        </p>
      </div>
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-6 py-20 text-center">
      <p className="mb-2 text-lg text-white/70">Проекты скоро появятся</p>
      <p className="max-w-md text-sm text-white/40">
        Мы готовим работы для этого раздела. Загляните позже или посмотрите другие
        разделы портфолио.
      </p>
    </div>
  )
}
