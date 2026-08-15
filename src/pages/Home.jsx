import { lazy, Suspense, useEffect } from 'react'
import Header from '../components/ui/Header'
import LoadingOverlay from '../components/ui/LoadingOverlay'
import DebugHud from '../components/ui/DebugHud'
import ActiveSectionTitle from '../components/ui/ActiveSectionTitle'
import { useShkafStore } from '../store/shkafStore'
import { russoLog, russoPatch } from '../utils/russoLog'

/** Canvas/R3F — отдельный чанк; UI shell монтируется сразу */
const Scene = lazy(() => import('../components/3d/Scene'))

/** Главная страница с интерактивным 3D-шкафом */
export default function Home() {
  const reset = useShkafStore((s) => s.reset)

  // Сброс состояния шкафа при возврате на главную
  useEffect(() => {
    reset()
    russoPatch({
      doorsOpen: false,
      animating: false,
      activeDrawerId: null,
      lastEvent: 'home reset',
    })
    russoLog('info', 'home', 'сброс состояния шкафа (возврат на главную)')
  }, [reset])

  return (
    <div className="relative h-dvh min-h-screen w-screen overflow-hidden">
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      <ActiveSectionTitle />
      <Header />
      <LoadingOverlay />
      <DebugHud />
    </div>
  )
}
