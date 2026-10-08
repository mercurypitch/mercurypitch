// Polished runner glass — retain roughness mips without an extra blur over the bounded refraction buffer.
import type { Material } from 'three'
import { MeshPhysicalMaterial, ShaderChunk } from 'three'

const installed = new WeakSet<Material>()
const originalSample =
  'return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );'

/** Only owned smooth floor/obstacle shells opt in; authored frosted walls do not. */
export function useRunnerClearTransmission(material: Material): void {
  if (
    !(material instanceof MeshPhysicalMaterial) ||
    material.transmission <= 0 ||
    installed.has(material)
  )
    return

  const source = ShaderChunk.transmission_pars_fragment
  if (source.split(originalSample).length !== 2)
    throw new Error('Runner glass sampling requires a reviewed Three shader.')
  const chunk = source.replace(
    originalSample,
    'return textureLod( transmissionSamplerMap, fragCoord.xy, lod );',
  )
  const previousCompile = material.onBeforeCompile
  // Three's default key reads onBeforeCompile, so capture it before wrapping.
  const previousKey = material.customProgramCacheKey()
  material.onBeforeCompile = function (shader, renderer) {
    previousCompile.call(this, shader, renderer)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <transmission_pars_fragment>',
      chunk,
    )
  }
  material.customProgramCacheKey = () =>
    `${previousKey}|runner-clear-transmission-v1`
  material.needsUpdate = true
  installed.add(material)
}
