import { useEffect, useState } from 'react'

/** Хук для медиа-запросов (мобильная адаптация) */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )

  useEffect(() => {
    const media = window.matchMedia(query)
    const handler = (event) => setMatches(event.matches)

    setMatches(media.matches)
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [query])

  return matches
}

/** Экран считается мобильным при ширине < 768px */
export function useIsMobile() {
  return useMediaQuery('(max-width: 767px)')
}
