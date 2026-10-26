import { CABINET_LOOK } from '../constants/cabinetStudio'

function search() {
  if (typeof window === 'undefined') return new URLSearchParams()
  return new URLSearchParams(window.location.search)
}

/** ?realtime=1 включает area/spot/directional. ?ao=0 выключает N8AO. ?tone=agx|aces|neutral. ?compare=1 — кадр Cycles. */
export function cabinetFlags() {
  const q = search()
  const tone = q.get('tone')
  const toneOk = tone === 'agx' || tone === 'aces' || tone === 'neutral'
  return {
    realtime: q.has('realtime') ? q.get('realtime') === '1' : CABINET_LOOK.realtime,
    ao: q.get('ao') !== '0',
    tone: toneOk ? tone : CABINET_LOOK.tone.mode,
    compare: q.get('compare') === '1',
  }
}
