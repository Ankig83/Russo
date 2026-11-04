import { useEffect } from 'react'
import { button, folder, useControls } from 'leva'
import { CABINET_TUNE } from '../../constants/cabinetStudio'
import { cabinetFlags } from '../../utils/cabinetQuery'
import { tuneSnapshot, useCabinetTune } from '../../utils/cabinetTune'

const ENV_MAX = 2
const LIGHTMAP_MAX = 8

function slider(value, min, max, step, onChange) {
  return { value, min, max, step, onChange }
}

async function copyConfig() {
  const json = JSON.stringify(tuneSnapshot(), null, 2)
  try {
    await navigator.clipboard.writeText(json)
    console.log('[tune] Copy config\n', json)
  } catch (err) {
    console.log('[tune] Copy config — буфер недоступен, JSON ниже\n', json, err)
  }
}

/** Панель только при ?tune=1. Бегунки пишут в стор, Shkaf применяет их после материалов. */
export default function CabinetTune() {
  const patch = useCabinetTune((s) => s.patch)
  const d = CABINET_TUNE
  const flags = cabinetFlags()

  useEffect(() => {
    window.__patchCabinetTune = patch
    return () => {
      delete window.__patchCabinetTune
    }
  }, [patch])

  useControls({
    Кадр: folder({
      exposure: slider(d.exposure, 0.2, 1.2, 0.01, (value) => patch({ exposure: value })),
      environmentIntensity: slider(d.environmentIntensity, 0, ENV_MAX, 0.01, (value) =>
        patch({ environmentIntensity: value }),
      ),
    }),
    envMapIntensity: folder({
      metal_inside: slider(d.envMapIntensity.metal_inside, 0, ENV_MAX, 0.01, (value) =>
        patch({ envMapIntensity: { metal_inside: value } }),
      ),
      copper_corpus: slider(d.envMapIntensity.copper_corpus, 0, ENV_MAX, 0.01, (value) =>
        patch({ envMapIntensity: { copper_corpus: value } }),
      ),
      base: slider(d.envMapIntensity.base, 0, ENV_MAX, 0.01, (value) =>
        patch({ envMapIntensity: { base: value } }),
      ),
      medallion: slider(d.envMapIntensity.medallion, 0, ENV_MAX, 0.01, (value) =>
        patch({ envMapIntensity: { medallion: value } }),
      ),
      wood_lit: slider(d.envMapIntensity.wood_lit, 0, ENV_MAX, 0.01, (value) =>
        patch({ envMapIntensity: { wood_lit: value } }),
      ),
      leather_lit: slider(d.envMapIntensity.leather_lit, 0, ENV_MAX, 0.01, (value) =>
        patch({ envMapIntensity: { leather_lit: value } }),
      ),
    }),
    lightMapIntensity: folder({
      wood: slider(d.lightMapIntensity.wood, 0, LIGHTMAP_MAX, 0.01, (value) =>
        patch({ lightMapIntensity: { wood: value } }),
      ),
      leather: slider(d.lightMapIntensity.leather, 0, LIGHTMAP_MAX, 0.01, (value) =>
        patch({ lightMapIntensity: { leather: value } }),
      ),
      back_wall: slider(d.lightMapIntensity.back_wall, 0, LIGHTMAP_MAX, 0.01, (value) =>
        patch({ lightMapIntensity: { back_wall: value } }),
      ),
      corpus: slider(d.lightMapIntensity.corpus, 0, LIGHTMAP_MAX, 0.01, (value) =>
        patch({ lightMapIntensity: { corpus: value } }),
      ),
      details: slider(d.lightMapIntensity.details, 0, LIGHTMAP_MAX, 0.01, (value) =>
        patch({ lightMapIntensity: { details: value } }),
      ),
    }),
    roughnessAdd: folder({
      rough_copper: slider(d.roughnessAdd.copper_corpus, 0, 1, 0.01, (value) =>
        patch({ roughnessAdd: { copper_corpus: value } }),
      ),
      rough_base: slider(d.roughnessAdd.base, 0, 1, 0.01, (value) =>
        patch({ roughnessAdd: { base: value } }),
      ),
    }),
    Лампы: folder(
      {
        ambient: slider(d.lamps.ambient, 0, 1, 0.01, (value) => patch({ lamps: { ambient: value } })),
        key: slider(d.lamps.key, 0, 40, 0.1, (value) => patch({ lamps: { key: value } })),
        fill: slider(d.lamps.fill, 0, 20, 0.05, (value) => patch({ lamps: { fill: value } })),
        rimLeft: slider(d.lamps.rimLeft, 0, 10, 0.05, (value) => patch({ lamps: { rimLeft: value } })),
        rimRight: slider(d.lamps.rimRight, 0, 10, 0.05, (value) => patch({ lamps: { rimRight: value } })),
        interior: slider(d.lamps.interior, 0, 10, 0.05, (value) => patch({ lamps: { interior: value } })),
        interiorSpot: slider(d.lamps.interiorSpot, 0, 40, 0.1, (value) =>
          patch({ lamps: { interiorSpot: value } }),
        ),
        shadow: slider(d.lamps.shadow, 0, 10, 0.05, (value) => patch({ lamps: { shadow: value } })),
        backdropSpot: slider(d.lamps.backdropSpot, 0, 8, 0.05, (value) =>
          patch({ lamps: { backdropSpot: value } }),
        ),
        floorPool: slider(d.lamps.floorPool, 0, 8, 0.05, (value) => patch({ lamps: { floorPool: value } })),
      },
      { collapsed: true },
    ),
    Пост: folder({
      aoIntensity: slider(d.aoIntensity, 0, 3, 0.01, (value) => patch({ aoIntensity: value })),
      bloomIntensity: slider(d.bloomIntensity, 0, 1, 0.01, (value) => patch({ bloomIntensity: value })),
      bloomThreshold: slider(d.bloomThreshold, 0, 1, 0.01, (value) => patch({ bloomThreshold: value })),
    }),
    Переключатели: folder({
      lightmaps: { value: d.lightmaps, onChange: (value) => patch({ lightmaps: value }) },
      realtime: { value: flags.realtime, onChange: (value) => patch({ realtime: value }) },
      ao: { value: flags.ao, onChange: (value) => patch({ ao: value }) },
    }),
    'Copy config': button(() => {
      copyConfig()
    }),
  })

  return null
}
