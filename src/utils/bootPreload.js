import { useGLTF } from '@react-three/drei'
import { SHKAF_INTERIOR_PATH, SHKAF_MODEL_PATH, STUDIO_SCENE_PATH } from '../constants/shkafNodes'
import { loadAgedCopperTextures } from './agedCopperTextures'
import { loadDoorShadowBake } from './doorShadowBake'
import { loadLeatherTextures } from './leatherTextures'
import { loadWalnutBake } from './cabinetWoodFinish'

/**
 * Старт до ленивого чанка сцены.
 * Сразу: шкаф, студия (без неё Suspense не откроет кадр), кожа и медь.
 * Орех — 15 МБ PNG того же шпона 2048, который уже лежит в GLB как WebP.
 * Тень дверей, книги и тени интерьера идут вместе с ним.
 * Их старт после байтов GLB: иначе они делят канал с файлом шкафа на всё скачивание.
 */
export function bootCabinetAssets() {
  useGLTF.preload(SHKAF_MODEL_PATH, true, true)
  useGLTF.preload(STUDIO_SCENE_PATH)
  loadLeatherTextures().catch(() => {})
  loadAgedCopperTextures().catch(() => {})

  const afterCabinetFile = () => {
    useGLTF.preload(SHKAF_INTERIOR_PATH, true, true)
    loadWalnutBake().catch(() => {})
    loadDoorShadowBake().catch(() => {})
    import('./bookCovers.js').then((mod) => mod.loadBookCoverTextures().catch(() => {}))
    import('./interiorShadowBake.js').then((mod) => mod.loadInteriorShadowBake().catch(() => {}))
  }

  if (typeof window === 'undefined') return
  whenGlbBytesDone(afterCabinetFile)
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
  // Запас, если PerformanceObserver не увидит запрос. Раньше 20 с
  // открывали орех посреди долгого скачивания GLB.
  window.setTimeout(go, 120000)
}
