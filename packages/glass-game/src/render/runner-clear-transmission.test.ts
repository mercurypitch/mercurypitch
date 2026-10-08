// Runner glass integration — the installed Three shader keeps optical mips and backdrop fog on owned shells.
import type { WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three'
import { BoxGeometry, Mesh, MeshPhysicalMaterial, ShaderChunk, ShaderLib, Texture, } from 'three'
import { expect, it, vi } from 'vitest'
import { installBackdropFog } from './backdrop-fog'
import { useRunnerClearTransmission } from './runner-clear-transmission'

it.each(['before', 'after'])(
  'composes with backdrop fog installed %s sampling',
  (order) => {
    const material = new MeshPhysicalMaterial({
      transmission: 1,
      roughness: 0.068,
      thickness: 0.18,
    })
    const previousCompile = vi.fn(
      (shader: WebGLProgramParametersWithUniforms) => {
        shader.fragmentShader = `// existing finish\n${shader.fragmentShader}`
      },
    )
    material.onBeforeCompile = previousCompile
    material.customProgramCacheKey = () => 'existing-finish'
    const mesh = new Mesh(new BoxGeometry(), material)
    const sky = new Texture()
    const renderer = {
      getRenderTarget: () => null,
      getDrawingBufferSize: (size: {
        set: (x: number, y: number) => unknown
      }) => size.set(487, 1055),
    } as unknown as WebGLRenderer
    const sharedChunk = ShaderChunk.transmission_pars_fragment

    if (order === 'before') installBackdropFog(mesh, sky)
    useRunnerClearTransmission(material)
    const once = material.customProgramCacheKey()
    useRunnerClearTransmission(material)
    expect(material.customProgramCacheKey()).toBe(once)
    if (order === 'after') installBackdropFog(mesh, sky)

    const shader = {
      vertexShader: ShaderLib.physical.vertexShader,
      fragmentShader: ShaderLib.physical.fragmentShader,
      uniforms: {},
    } as WebGLProgramParametersWithUniforms
    material.onBeforeCompile(shader, renderer)
    expect(previousCompile).toHaveBeenCalledOnce()
    expect(shader.fragmentShader).toContain('// existing finish')
    expect(shader.fragmentShader).toContain(
      'return textureLod( transmissionSamplerMap, fragCoord.xy, lod );',
    )
    expect(shader.fragmentShader).not.toContain(
      'return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );',
    )
    expect(shader.fragmentShader).toContain(
      'log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior )',
    )
    expect(shader.fragmentShader).toContain('volumeAttenuation(')
    expect(shader.fragmentShader).toContain('backdropFogMap')
    expect(shader.vertexShader).toContain(
      'vFogDepth = length( mvPosition.xyz )',
    )
    expect(shader.uniforms.backdropFogMap?.value).toBe(sky)
    expect(material.customProgramCacheKey()).toContain('existing-finish')
    expect(material.customProgramCacheKey()).toContain('backdrop-fog-v1')
    expect(material.customProgramCacheKey()).toContain(
      'runner-clear-transmission-v1',
    )
    expect(ShaderChunk.transmission_pars_fragment).toBe(sharedChunk)
    expect(material.roughness).toBe(0.068)
    expect(material.thickness).toBe(0.18)
    material.dispose()
    mesh.geometry.dispose()
    sky.dispose()
  },
)

it('leaves opaque hardware and donor glass untouched while separate clones opt in', () => {
  const donor = new MeshPhysicalMaterial({ transmission: 1 })
  const hardware = new MeshPhysicalMaterial({ metalness: 1 })
  const original = donor.onBeforeCompile
  const hardwareCompile = hardware.onBeforeCompile
  useRunnerClearTransmission(hardware)
  expect(hardware.onBeforeCompile).toBe(hardwareCompile)
  const owned = donor.clone()
  useRunnerClearTransmission(owned)
  expect(owned.onBeforeCompile).not.toBe(original)
  expect(donor.onBeforeCompile).toBe(original)
  // Three does not clone onBeforeCompile: a new lease must install its own hook.
  const second = owned.clone()
  useRunnerClearTransmission(second)
  expect(second.customProgramCacheKey()).toContain(
    'runner-clear-transmission-v1',
  )
  for (const material of [donor, hardware, owned, second]) material.dispose()
})
