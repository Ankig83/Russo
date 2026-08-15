import { Link } from 'react-router-dom'
import EditorialBackdrop from '../components/ui/EditorialBackdrop'

/** Страница 404 */
export default function NotFound() {
  return (
    <div className="editorial-page">
      <EditorialBackdrop />
      <div
        className="pf-shell"
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeContent: 'center',
          gap: 24,
          textAlign: 'center',
        }}
      >
        <p className="pf-eyebrow">404</p>
        <h1 className="pf-display">Страница не найдена</h1>
        <p className="pf-body" style={{ marginInline: 'auto' }}>
          Такого раздела пока нет.
        </p>
        <Link to="/" className="pf-link pf-link--accent" style={{ justifyContent: 'center' }}>
          ← На главную
        </Link>
      </div>
    </div>
  )
}
