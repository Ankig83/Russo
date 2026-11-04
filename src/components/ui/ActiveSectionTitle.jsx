import { useEffect, useMemo, useRef, useState } from 'react'
import { sections } from '../../constants/sections'
import { useShkafStore } from '../../store/shkafStore'
import './ActiveSectionTitle.css'

const FADE_MS = 280

function sideFromSectionId(id) {
  if (!id) return 'right'
  return id === 'drawer_2' ? 'right' : 'left'
}

/** Название раздела рядом со шкафом — hover и выдвижение ящика */
export default function ActiveSectionTitle() {
  const hoveredSectionId = useShkafStore((state) => state.hoveredSectionId)
  const animating = useShkafStore((state) => state.animating)
  const activeDrawerId = useShkafStore((state) => state.activeDrawerId)
  // Во время выдвижения ящика — держим его label; при анимации дверей — прячем hover
  const requestedId = activeDrawerId || (animating ? null : hoveredSectionId)
  const labels = useMemo(
    () => new Map(sections.map((section) => [section.id, section.label])),
    [],
  )
  const [displayedId, setDisplayedId] = useState(null)
  const [visible, setVisible] = useState(false)
  const displayedRef = useRef(null)
  const timerRef = useRef(null)
  const frameRef = useRef(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (frameRef.current) cancelAnimationFrame(frameRef.current)

    if (requestedId === displayedRef.current) {
      setVisible(Boolean(requestedId))
      return undefined
    }

    setVisible(false)

    const showRequested = () => {
      displayedRef.current = requestedId
      setDisplayedId(requestedId)
      if (!requestedId) return
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = requestAnimationFrame(() => setVisible(true))
      })
    }

    if (displayedRef.current) {
      timerRef.current = setTimeout(showRequested, FADE_MS)
    } else {
      showRequested()
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [requestedId])

  const side = sideFromSectionId(displayedId)
  const label = displayedId ? labels.get(displayedId) : ''

  return (
    <div className="active-section-title-layer" aria-live="polite" aria-atomic="true">
      <div
        className={[
          'active-section-title',
          `active-section-title--${side}`,
          visible ? 'active-section-title--visible' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className="active-section-title__eyebrow">Раздел</span>
        <span className="active-section-title__label">{label}</span>
      </div>
    </div>
  )
}
