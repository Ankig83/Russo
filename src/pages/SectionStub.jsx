import { Link } from 'react-router-dom'
import EditorialBackdrop from '../components/ui/EditorialBackdrop'
import '../components/portfolio/PortfolioSectionPage.css'

export default function SectionStub({ eyebrow, title, lead }) {
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
              {eyebrow}
            </p>
            <h1 className="pf-display">{title}</h1>
          </div>
          <p className="pf-body pf-hub__lead">{lead}</p>
        </header>

        <p className="pf-body" style={{ maxWidth: 640, opacity: 0.72 }}>
          Раздел в работе. Скоро здесь появятся материалы.
        </p>
      </div>
    </div>
  )
}
