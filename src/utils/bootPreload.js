import { useGLTF } from '@react-three/drei'
import { SHKAF_MODEL_PATH, STUDIO_SCENE_PATH } from '../constants/shkafNodes'
import { loadAgedCopperTextures } from './agedCopperTextures'
import { loadDoorShadowBake } from './doorShadowBake'
import { loadLeatherTextures } from './leatherTextures'
import { loadWalnutBake } from './cabinetWoodFinish'

/**
 * Старт до ленивого чанка сцены.
 * Сразу: шкаф, студия, кожа и медь (мелкие, видны снаружи).
 * Чуть позже: орех и тень дверей — крупные, не должны обогнать GLB в очереди.
 * Книги и тени интерьера — после responseEnd у GLB, не после window.load.
 */
export function bootCabinetAssets() {
  useGLTF.preload(SHKAF_MODEL_PATH, true, true)
  useGLTF.preload(STUDIO_SCENE_PATH)
  loadLeatherTextures().catch(() => {})
  loadAgedCopperTextures().catch(() => {})

  const visibleWood = () => {
    loadWalnutBake().catch(() => {})
    loadDoorShadowBake().catch(() => {})
  }
  const interior = () => {
    import('./bookCovers.js').then((mod) => mod.loadBookCoverTextures().catch(() => {}))
    import('./interiorShadowBake.js').then((mod) => mod.loadInteriorShadowBake().catch(() => {}))
  }

  if (typeof window === 'undefined') return
  // 400 мс — предположение, что GLB из <link rel="preload"> уже занял соединение.
  // Пользу подтвердит только Network, это не измеренный оптимум.
  window.setTimeout(visibleWood, 400)
  whenGlbBytesDone(interior)
}

/** window.load этого не гарантирует: GLB запрашивается динамически и может ещё качаться. */
function whenGlbBytesDone(callback) {
  let fired = false
  const go = () => {
    if (fired) return
    fired = true
    callback()
  }
  const done = (entry) => entry.name.includes('shkaf-cabinet.glb') && entry.responseEnd > 0
  if (typeof PerformanceObserver === 'undefined') {
    go()
    return
  }
  if (performance.getEntriesByType('resource').some(done)) {
    go()
    return
  }
  const observer = new PerformanceObserver((list) => {
    if (!list.getEntries().some(done)) return
    observer.disconnect()
    go()
  })
  observer.observe({ type: 'resource', buffered: true })
  window.setTimeout(go, 20000)
}
