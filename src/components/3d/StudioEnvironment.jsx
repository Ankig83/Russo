import { Environment } from '@react-three/drei'
import { STUDIO, getStudioEnvIntensity } from '../../constants/studioScene'

/** IBL — background={false}, cyclorama остаётся от StudioBackdrop */
export default function StudioEnvironment() {
  const { url, preset } = STUDIO.env
  const intensity = getStudioEnvIntensity()

  if (preset) {
    return <Environment preset={preset} environmentIntensity={intensity} background={false} />
  }

  return <Environment files={url} environmentIntensity={intensity} background={false} />
}
