import { lazy, Suspense } from 'react'
import { BrowserRouter, HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import CornerLogo from './components/ui/CornerLogo'
import Home from './pages/Home'
import { cabinetFlags } from './utils/cabinetQuery'

const Scene = lazy(() => import('./components/3d/Scene'))

/** Сцена остаётся смонтированной: возврат «На главную» не пересоздаёт WebGL и не качает GLB заново. */
function CabinetStage() {
  const home = useLocation().pathname === '/'
  return (
    <div
      aria-hidden={home ? undefined : true}
      inert={home ? undefined : true}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        visibility: home ? 'visible' : 'hidden',
        pointerEvents: home ? 'auto' : 'none',
      }}
    >
      <Suspense fallback={null}>
        <Scene active={home} />
      </Suspense>
    </div>
  )
}

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
      <CabinetStage />
      {!cabinetFlags().compare && <CornerLogo />}
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/portfolio" element={<Furniture />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  )
}
