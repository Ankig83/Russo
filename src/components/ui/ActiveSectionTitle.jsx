import { useEffect, useMemo, useRef, useState } from 'react'
import { sections } from '../../constants/sections'
import { useShkafStore } from '../../store/shkafStore'
import './ActiveSectionTitle.css'

const FADE_MS = 300

/** Единственная задача компонента — показать название активного раздела. */
export default function ActiveSectionTitle() {
  const hoveredSectionId = useShkafStore((state) => state.hoveredSectionId)
  const animating = useShkafStore((state) => state.animating)
  const activeDrawerId = useShkafStore((state) => state.activeDrawerId)
  const requestedId = animating || activeDrawerId ? null : hoveredSectionId
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

  return (
    <div className="active-section-title-layer" aria-live="polite" aria-atomic="true">
      <span
        className={`active-section-title${visible ? ' active-section-title--visible' : ''}`}
      >
        {displayedId ? labels.get(displayedId) : ''}
      </span>
    </div>
  )
}
