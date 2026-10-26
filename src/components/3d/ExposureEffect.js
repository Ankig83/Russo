import { Uniform } from 'three'
import { Effect } from 'postprocessing'
import { wrapEffect } from '@react-three/postprocessing'

const fragment = /* glsl */ `
uniform float exposure;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(inputColor.rgb * exposure, inputColor.a);
}
`

class ExposureEffect extends Effect {
  constructor({ exposure = 1 } = {}) {
    super('ExposureEffect', fragment, {
      uniforms: new Map([['exposure', new Uniform(exposure)]]),
    })
  }
}

/** Линейный множитель до ToneMapping. gl.toneMappingExposure на этот пасс не влияет. */
export const Exposure = wrapEffect(ExposureEffect)
