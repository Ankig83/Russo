import { useEffect, useState } from 'react'
import { subscribeRussoDebug } from '../../utils/russoLog'

/** Компактный HUD диагностики на главной (телефон без консоли) */
export default function DebugHud() {
  const [state, setState] = useState(null)

  useEffect(() => subscribeRussoDebug(setState), [])

  if (!state?.hudEnabled) return null

  const status = state.ready
    ? 'READY'
    : state.overlayWaitingMinMs
      ? 'WAIT LOGO'
      : state.assetsActive
        ? `LOAD ${state.assetsProgress}%`
        : !state.shkafReady
          ? 'SHKAF…'
          : !state.overlayDone
            ? 'OVERLAY…'
            : '…'

  const statusColor = state.ready ? '#3d9a5f' : '#c88030'
  const hit = state.lastHit

  return (
    <div
      className="pointer-events-none fixed z-[60] font-mono text-[10px] leading-snug text-white/90"
      style={{
        left: 'max(8px, var(--safe-left))',
        bottom: 'max(8px, calc(0.5rem + var(--safe-bottom)))',
        maxWidth: 'min(92vw, 340px)',
        background: 'rgba(0,0,0,0.72)',
        border: '1px solid rgba(200,160,60,0.35)',
        borderRadius: 6,
        padding: '6px 8px',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div style={{ color: statusColor, fontWeight: 700, letterSpacing: '0.08em' }}>
        {status}
        {state.ready ? ' · можно кликать' : ''}
      </div>
      <div className="mt-0.5 text-white/55">
        doors:{state.doorsOpen ? 'open' : 'closed'} · anim:{state.animating ? '1' : '0'}
        {state.activeDrawerId ? ` · ${state.activeDrawerId}` : ''}
      </div>
      {hit && (
        <div className="mt-1 border-t border-white/10 pt-1 text-white/70">
          <div>
            last: <span className="text-[#e4b040]">{hit.outcome}</span>
            {hit.dragPx != null ? ` · drag ${hit.dragPx}px` : ''}
          </div>
          {hit.object && <div>hit: {hit.object}</div>}
          {hit.materials?.length > 0 && <div>mat: {hit.materials.join(', ')}</div>}
          {hit.sectionId && (
            <div>
              → {hit.sectionId}
              {hit.route ? ` ${hit.route}` : ''}
            </div>
          )}
          {hit.reason && <div className="text-red-300/90">{hit.reason}</div>}
        </div>
      )}
      <div className="mt-1 text-white/35">консоль: фильтр «РУССО» · скрыть HUD: ?debug=0</div>
    </div>
  )
}
