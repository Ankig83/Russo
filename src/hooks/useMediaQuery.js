import { useCallback, useSyncExternalStore } from 'react'

/** Хук для медиа-запросов (мобильная адаптация) */
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onStoreChange) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onStoreChange)
      return () => media.removeEventListener('change', onStoreChange)
    },
    [query],
  )

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query],
  )

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

/** Экран считается мобильным при ширине < 768px */
export function useIsMobile() {
  return useMediaQuery('(max-width: 767px)')
}
