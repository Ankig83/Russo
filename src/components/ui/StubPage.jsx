import { Link } from 'react-router-dom'
import EditorialBackdrop from './EditorialBackdrop'

/** Общий layout для страниц-заглушек */
export default function StubPage({ title, description }) {
  return (
    <div className="editorial-page">
      <EditorialBackdrop />
      <div
        className="pf-shell"
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeContent: 'center',
          gap: 20,
          textAlign: 'center',
        }}
      >
        <p className="pf-eyebrow">РУССО</p>
        <h1 className="pf-display">{title}</h1>
        <p className="pf-body" style={{ marginInline: 'auto', maxWidth: '42ch' }}>
          {description}
        </p>
        <Link to="/" className="pf-link pf-link--accent" style={{ justifyContent: 'center' }}>
          ← На главную
        </Link>
      </div>
    </div>
  )
}
