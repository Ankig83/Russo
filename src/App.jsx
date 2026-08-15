import { lazy, Suspense } from 'react'
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom'
import CornerLogo from './components/ui/CornerLogo'
import Home from './pages/Home'

const About = lazy(() => import('./pages/About'))
const PrivateSpaces = lazy(() => import('./pages/PrivateSpaces'))
const CommercialProjects = lazy(() => import('./pages/CommercialProjects'))
const AuthorCollections = lazy(() => import('./pages/AuthorCollections'))
const NotFound = lazy(() => import('./pages/NotFound'))
const ProjectCarouselPage = lazy(
  () => import('./components/portfolio/ProjectCarouselPage'),
)

function RouteFallback() {
  return <div className="min-h-dvh w-full bg-[#0b0b0b]" aria-label="Загрузка страницы" />
}

/** Корневой роутер приложения */
export default function App() {
  const Router = import.meta.env.BASE_URL !== '/' ? HashRouter : BrowserRouter

  return (
    <Router>
      <CornerLogo />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/private-spaces" element={<PrivateSpaces />} />
          <Route path="/private-spaces/:slug" element={<ProjectCarouselPage category="private" />} />
          <Route path="/commercial-projects" element={<CommercialProjects />} />
          <Route path="/commercial-projects/:slug" element={<ProjectCarouselPage category="commercial" />} />
          <Route path="/author-collections" element={<AuthorCollections />} />
          <Route path="/author-collections/:slug" element={<ProjectCarouselPage category="author" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  )
}
