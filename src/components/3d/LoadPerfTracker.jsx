import { useEffect, useRef } from 'react'
import { useProgress } from '@react-three/drei'
import { perf } from '../../utils/perf'

/** Отслеживает загрузку ассетов (GLB, HDR) через drei useProgress */
export default function LoadPerfTracker() {
  const { active, loaded, total } = useProgress()
  const tracking = useRef(false)
  const finished = useRef(false)

  useEffect(() => {
    if (finished.current) return

    if (active) {
      if (!tracking.current) {
        tracking.current = true
        perf.start('assets:load')
      }
      return
    }

    const finish = (cached) => {
      if (finished.current) return
      finished.current = true
      if (tracking.current) perf.end('assets:load')
      else perf.mark(cached ? 'assets:cached' : 'assets:ready')
      perf.milestone('assets')
      console.log(`РУССО:perf assets: ${loaded}/${total}`)
    }

    if (tracking.current) {
      finish(false)
      return
    }

    const cachedTimer = setTimeout(() => finish(true), 150)
    return () => clearTimeout(cachedTimer)
  }, [active, loaded, total])

  return null
}
