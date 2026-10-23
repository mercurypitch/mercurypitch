// Glass material contracts — studio glass stays out of the transmission pass, patches a reviewed shader once and survives a clone.
import type { WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three'
import { DataTexture, ShaderLib } from 'three'
import { describe, expect, it } from 'vitest'
import type { GlassOptics } from './glass-material'
import { assertGlassShaderChunks, GlassMaterial, patchStudioGlassShader, } from './glass-material'

const AMBER: GlassOptics = {
  technique: 'studio',
  transmission: 0.95,
  ior: 1.52,
  attenuationColor: '#f2a93b',
  attenuationDistance: 0.02,
  thickness: 0.02,
  glowColor: '#f2a93b',
  glow: 0.3,
  backLight: 0.6,
}

function compile(material: GlassMaterial): WebGLProgramParametersWithUniforms {
  const shader = {
    vertexShader: ShaderLib.physical.vertexShader,
    fragmentShader: ShaderLib.physical.fragmentShader,
    uniforms: {},
  } as WebGLProgramParametersWithUniforms
  material.onBeforeCompile(shader, {} as WebGLRenderer)
  return shader
}

describe('GlassMaterial', () => {
  it('keeps studio glass out of the transmission pass', () => {
    const material = new GlassMaterial(AMBER)
    // Three chooses the physical shader by type; a custom type gets no program.
    expect(material.type).toBe('MeshPhysicalMaterial')
    expect(material.transmission).toBe(0)
    expect(material.defines).toMatchObject({
      GLASS_STUDIO: '',
      GLASS_BACK_LIGHT: '',
    })
    expect(material.glassUniforms.glassTransmission.value).toBe(0.95)
  })

  it('uses Three transmission for screen glass', () => {
    const material = new GlassMaterial({ ...AMBER, technique: 'screen' })
    expect(material.transmission).toBe(0.95)
    expect(material.thickness).toBe(0.02)
    expect(material.defines).not.toHaveProperty('GLASS_STUDIO')
    const shader = compile(material)
    expect(shader.fragmentShader).toContain('#include <transmission_fragment>')
  })

  it('keys programs by technique, thickness channel and back light', () => {
    const plain = new GlassMaterial({ ...AMBER, backLight: 0 })
    const back = new GlassMaterial(AMBER)
    const mapped = new GlassMaterial(AMBER).setThicknessMap(
      new DataTexture(),
      1,
    )
    const screen = new GlassMaterial({ ...AMBER, technique: 'screen' })
    const keys = [plain, back, mapped, screen].map((m) =>
      m.customProgramCacheKey(),
    )
    expect(new Set(keys).size).toBe(4)
    expect(mapped.defines).toMatchObject({
      GLASS_THICKNESS_MAP: '',
      GLASS_THICKNESS_UV: 1,
    })
  })

  it('patches the installed physical shader once', () => {
    const material = new GlassMaterial(AMBER).setThicknessMap(
      new DataTexture(),
      1,
    )
    const shader = compile(material)
    expect(shader.fragmentShader).not.toContain(
      '#include <transmission_fragment>',
    )
    expect(shader.fragmentShader).toContain(
      'textureCubeUV( envMap, envMapRotation * glassRay',
    )
    expect(
      shader.fragmentShader.split('uniform float glassTransmission;'),
    ).toHaveLength(2)
    expect(shader.vertexShader).toContain(
      'vGlassThicknessUv = ( glassThicknessMapTransform * vec3( uv1, 1.0 ) ).xy;',
    )
    expect(shader.uniforms.glassTransmission).toBe(
      material.glassUniforms.glassTransmission,
    )
    expect(() => assertGlassShaderChunks()).not.toThrow()
  })

  it('refuses a shader without the reviewed markers', () => {
    const material = new GlassMaterial(AMBER)
    const shader = {
      vertexShader: ShaderLib.physical.vertexShader,
      fragmentShader: ShaderLib.physical.fragmentShader.replace(
        '#include <transmission_fragment>',
        '',
      ),
      uniforms: {},
    } as WebGLProgramParametersWithUniforms
    expect(() =>
      patchStudioGlassShader(shader, material.glassUniforms),
    ).toThrow(/reviewed Three shader/)
  })

  it('clones with its own copy of the optics', () => {
    const material = new GlassMaterial(AMBER).setThicknessMap(
      new DataTexture(),
      1,
    )
    const copy = material.clone()
    expect(copy).toBeInstanceOf(GlassMaterial)
    expect(copy.technique).toBe('studio')
    expect(copy.transmission).toBe(0)
    expect(copy.thicknessUvChannel).toBe(1)
    expect(copy.customProgramCacheKey()).toBe(material.customProgramCacheKey())
    expect(
      copy.glassUniforms.glassAttenuationColor.value.equals(
        material.glassUniforms.glassAttenuationColor.value,
      ),
    ).toBe(true)
    expect(copy.glassUniforms.glassAttenuationColor).not.toBe(
      material.glassUniforms.glassAttenuationColor,
    )
    copy.glassUniforms.glassGlow.value = 2
    expect(material.glassUniforms.glassGlow.value).toBe(0.3)
  })
})
