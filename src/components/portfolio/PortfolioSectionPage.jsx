import { Link } from 'react-router-dom'
import { getCategory, getProjectsByCategory } from '../../constants/portfolioProjects'
import EditorialBackdrop from '../ui/EditorialBackdrop'
import './PortfolioSectionPage.css'

/** Hub раздела портфолио — галерейная сетка без «карточного» хрома */
export default function PortfolioSectionPage({ category }) {
  const meta = getCategory(category)
  const projects = getProjectsByCategory(category)

  return (
    <div className="editorial-page">
      <EditorialBackdrop />
      <div className="pf-shell pf-hub">
        <Link to="/" className="pf-link">
          ← На главную
        </Link>

        <header className="pf-hub__header">
          <div>
            <p className="pf-eyebrow" style={{ marginBottom: 16 }}>
              Портфолио
            </p>
            <h1 className="pf-display">{meta?.title ?? 'Раздел'}</h1>
          </div>
          {meta?.subtitle ? (
            <p className="pf-body pf-hub__lead">{meta.subtitle}</p>
          ) : null}
        </header>

        {projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="pf-grid">
            {projects.map((project, index) => (
              <ProjectTile
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

function ProjectTile({ project, route, index }) {
  return (
    <Link to={`${route}/${project.slug}`} className="pf-tile">
      <div className="pf-tile__media">
        <img src={project.cover} alt={project.title} loading="lazy" />
      </div>
      <div className="pf-tile__meta">
        <p className="pf-caption">
          {String(index + 1).padStart(2, '0')}
          {' · '}
          {project.city}
          {project.year ? ` · ${project.year}` : ''}
        </p>
        <h2 className="pf-tile__title">{project.title}</h2>
      </div>
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="pf-empty">
      <p className="pf-heading" style={{ marginBottom: 16 }}>
        Проекты скоро появятся
      </p>
      <p className="pf-body" style={{ maxWidth: '42ch' }}>
        Готовим работы для этого раздела. Загляните позже или откройте другие
        разделы портфолио.
      </p>
    </div>
  )
}
