import { Link } from 'react-router-dom'
import EditorialBackdrop from '../components/ui/EditorialBackdrop'
import '../components/portfolio/PortfolioSectionPage.css'

const SECTIONS = [
  {
    title: 'Мастерская',
    body:
      'Руссо — мебельная компания полного цикла: от эскиза и инженерной проработки до столярки, отделки и монтажа. Работаем с деревом, металлом и сложными составными конструкциями.',
  },
  {
    title: 'Подход',
    body:
      'Каждый объект — авторская или проектная история. Мы не собираем каталог из типовых модулей: проектируем под пространство, свет и сценарий жизни заказчика.',
  },
  {
    title: 'География',
    body:
      'Частные интерьеры, коммерческие пространства и коллекционные изделия. От камерных квартир до общественных объектов — с одной планкой качества исполнения.',
  },
]

export default function About() {
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
              Компания
            </p>
            <h1 className="pf-display">О нас</h1>
          </div>
          <p className="pf-body pf-hub__lead">
            Мебель и интерьерные объекты, где материал, геометрия и свет работают
            как одно целое — без декоративного шума.
          </p>
        </header>

        <div
          style={{
            display: 'grid',
            gap: 'clamp(40px, 6vw, 64px)',
            maxWidth: 720,
          }}
        >
          {SECTIONS.map((block) => (
            <section key={block.title}>
              <h2 className="pf-heading" style={{ marginBottom: 16, fontSize: 'clamp(22px, 3vw, 32px)' }}>
                {block.title}
              </h2>
              <p className="pf-body">{block.body}</p>
            </section>
          ))}
        </div>

        <div
          style={{
            marginTop: 'clamp(56px, 8vw, 96px)',
            paddingTop: 32,
            borderTop: '1px solid var(--pf-rule)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
          }}
        >
          <Link to="/author-collections" className="pf-link pf-link--accent">
            Авторские коллекции →
          </Link>
          <Link to="/commercial-projects" className="pf-link">
            Коммерческие проекты →
          </Link>
          <Link to="/private-spaces" className="pf-link">
            Частные пространства →
          </Link>
        </div>
      </div>
    </div>
  )
}
