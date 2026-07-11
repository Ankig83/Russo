import { BrowserRouter, Routes, Route } from 'react-router-dom'
import CornerLogo from './components/ui/CornerLogo'
import Home from './pages/Home'
import Catalog from './pages/Catalog'
import Portfolio from './pages/Portfolio'
import Exclusive from './pages/Exclusive'
import Sketches from './pages/Sketches'
import Cart from './pages/Cart'
import Profile from './pages/Profile'
import Login from './pages/Login'
import About from './pages/About'
import Contacts from './pages/Contacts'
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
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/exclusive" element={<Exclusive />} />
        <Route path="/sketches" element={<Sketches />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/about" element={<About />} />
        <Route path="/contacts" element={<Contacts />} />
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
