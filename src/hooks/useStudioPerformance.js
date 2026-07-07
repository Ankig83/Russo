import { useMemo } from 'react'
import { STUDIO_PERFORMANCE } from '../constants/studioScene'
import { useIsMobile } from './useMediaQuery'

function tierFromUrl() {
  try {
    const q = new URLSearchParams(window.location.search).get('perf')
    if (q === 'low' || q === 'medium' || q === 'high') return q
  } catch {
    /* ignore */
  }
  return null
}

function detectTier(isMobile) {
  const urlTier = tierFromUrl()
  if (urlTier) return urlTier

  const { forceTier, defaultTier } = STUDIO_PERFORMANCE
  if (forceTier) return forceTier
  if (isMobile) return 'low'

  try {
    const mem = navigator.deviceMemory
    const cores = navigator.hardwareConcurrency
    if ((mem != null && mem <= 4) || (cores != null && cores <= 4)) return 'low'
  } catch {
    /* ignore */
  }

  return defaultTier ?? 'medium'
}

/** Авто-профиль GPU: low / medium / high */
export function useStudioPerformance() {
  const isMobile = useIsMobile()

  return useMemo(() => {
    const tier = detectTier(isMobile)
    return { tier, ...STUDIO_PERFORMANCE.tiers[tier] }
  }, [isMobile])
}
