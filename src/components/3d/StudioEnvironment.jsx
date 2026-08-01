import { Environment } from '@react-three/drei'
import {
  HERO,
  STUDIO,
  USE_HERO_LOOK,
  getStudioEnvIntensity,
} from '../../constants/studioScene'

/** IBL — background={false}, cyclorama / void остаются своими */
export default function StudioEnvironment() {
  const intensity = getStudioEnvIntensity()
  const heroEnv = USE_HERO_LOOK ? HERO.env : null
  const url = heroEnv?.url ?? STUDIO.env.url
  const preset = heroEnv?.preset ?? STUDIO.env.preset

  if (preset) {
    return <Environment preset={preset} environmentIntensity={intensity} background={false} />
  }

  return <Environment files={url} environmentIntensity={intensity} background={false} />
}
