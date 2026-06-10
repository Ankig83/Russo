import { useEffect } from 'react'
import Scene from '../components/3d/Scene'
import Header from '../components/ui/Header'
import { useShkafStore } from '../store/shkafStore'

/** Главная страница с интерактивным 3D-шкафом */
export default function Home() {
  const reset = useShkafStore((s) => s.reset)

  // Сброс состояния шкафа при возврате на главную
  useEffect(() => {
    reset()
  }, [reset])

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Scene />
      <Header />
    </div>
  )
}
