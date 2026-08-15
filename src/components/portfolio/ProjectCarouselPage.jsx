import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import GradientCarousel from './GradientCarousel'
import ImageLightbox from './ImageLightbox'
import EditorialBackdrop from '../ui/EditorialBackdrop'
import { getCategory, getProject } from '../../constants/portfolioProjects'
import './ProjectCarouselPage.css'

/** Страница проекта: галерейная карусель + редакционный оверлей */
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
      <div className="editorial-page project-stage__missing">
        <EditorialBackdrop />
        <h1 className="pf-heading">Проект не найден</h1>
        <Link to={meta?.route ?? '/'} className="pf-link pf-link--accent">
          ← К разделу
        </Link>
      </div>
    )
  }

  return (
    <div className="project-stage editorial-page">
      <GradientCarousel images={project.images} onImageClick={setLightboxIndex} />

      <div className="project-stage__chrome">
        <div className="project-stage__top">
          <Link to={meta?.route ?? '/'} className="pf-link">
            ← {meta?.title ?? 'Назад'}
          </Link>
        </div>

        <div className="project-stage__bottom">
          <p className="pf-caption" style={{ color: 'var(--pf-accent)' }}>
            {project.city}
            {project.year ? ` · ${project.year}` : ''}
          </p>
          <h1 className="project-stage__title">{project.title}</h1>
          {project.description ? (
            <p className="pf-body" style={{ color: 'rgba(245,245,245,0.55)', maxWidth: '42ch' }}>
              {project.description}
            </p>
          ) : null}
          <p className="project-stage__hint">
            Потяните, чтобы листать · нажмите фото, чтобы открыть
          </p>
        </div>
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
