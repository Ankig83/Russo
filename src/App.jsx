import { lazy, Suspense } from 'react'
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom'
import CornerLogo from './components/ui/CornerLogo'
import Home from './pages/Home'
import { cabinetFlags } from './utils/cabinetQuery'

const About = lazy(() => import('./pages/About'))
const Furniture = lazy(() => import('./pages/Furniture'))
const NotFound = lazy(() => import('./pages/NotFound'))

function RouteFallback() {
  return <div className="min-h-dvh w-full bg-[#0b0b0b]" aria-label="Загрузка страницы" />
}

export default function App() {
  const Router = import.meta.env.BASE_URL !== '/' ? HashRouter : BrowserRouter

  return (
    <Router>
      {!cabinetFlags().compare && <CornerLogo />}
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/furniture" element={<Furniture />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  )
}
