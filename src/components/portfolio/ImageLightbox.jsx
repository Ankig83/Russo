import { useCallback, useEffect } from 'react'
import './ImageLightbox.css'

export default function ImageLightbox({ images, index, title, onChange, onClose }) {
  const total = images.length
  const previous = useCallback(
    () => onChange((index - 1 + total) % total),
    [index, total, onChange],
  )
  const next = useCallback(
    () => onChange((index + 1) % total),
    [index, total, onChange],
  )

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') previous()
      if (event.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [next, onClose, previous])

  return (
    <div
      className="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Фотография проекта «${title}»`}
      onClick={onClose}
    >
      <div className="image-lightbox__top">
        <span>{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
        <button type="button" onClick={onClose} aria-label="Закрыть фотографию">
          Закрыть <span aria-hidden="true">×</span>
        </button>
      </div>

      <img
        src={images[index]}
        alt={`${title}, фотография ${index + 1}`}
        onClick={(event) => event.stopPropagation()}
      />

      {total > 1 && (
        <>
          <button
            type="button"
            className="image-lightbox__arrow image-lightbox__arrow--left"
            onClick={(event) => {
              event.stopPropagation()
              previous()
            }}
            aria-label="Предыдущая фотография"
          >
            ‹
          </button>
          <button
            type="button"
            className="image-lightbox__arrow image-lightbox__arrow--right"
            onClick={(event) => {
              event.stopPropagation()
              next()
            }}
            aria-label="Следующая фотография"
          >
            ›
          </button>
        </>
      )}
    </div>
  )
}
