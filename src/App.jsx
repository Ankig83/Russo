import { BrowserRouter, Routes, Route } from 'react-router-dom'
import CornerLogo from './components/ui/CornerLogo'
import Home from './pages/Home'
import About from './pages/About'
import PrivateSpaces from './pages/PrivateSpaces'
import CommercialProjects from './pages/CommercialProjects'
import AuthorCollections from './pages/AuthorCollections'
import ProjectCarouselPage from './components/portfolio/ProjectCarouselPage'
import NotFound from './pages/NotFound'

/** Корневой роутер приложения */
export default function App() {
  return (
    <BrowserRouter>
      <CornerLogo />
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
    </BrowserRouter>
  )
}
