// Backdrop fog regression — distant geometry resolves into the rendered sky in every physical target.

import type { Vector2,WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three'
import { BufferGeometry, Mesh, MeshBasicMaterial, Object3D, Scene, Texture } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { installBackdropFog, transformBackdropFogFragmentShader, } from './backdrop-fog'

const fragmentShader = `
#include <fog_pars_fragment>
void main() {
  gl_FragColor = vec4(1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`

const vertexShader = `
void main() {
  vec4 mvPosition = vec4(0.0);
  #include <fog_vertex>
  gl_Position = mvPosition;
}
`

function shader() {
  return {
    vertexShader,
    fragmentShader,
    uniforms: {},
  } as unknown as WebGLProgramParametersWithUniforms
}

function renderer(
  target?: { width: number; height: number },
  mipmapLevel = 0,
): WebGLRenderer {
  return {
    getRenderTarget: () => target ?? null,
    getActiveMipmapLevel: () => mipmapLevel,
    getDrawingBufferSize: (size: Vector2) => size.set(2160, 1350),
  } as unknown as WebGLRenderer
}

describe('Cloudway backdrop fog', () => {
  it('replaces the late fog chunk with the fitted sRGB backdrop after output conversion', () => {
    const transformed = transformBackdropFogFragmentShader(fragmentShader)

    expect(transformed).toContain('uniform sampler2D backdropFogMap;')
    expect(transformed).toContain('gl_FragCoord.xy / backdropFogResolution')
    expect(transformed).toContain(
      'backdropFogUvTransform * vec3( backdropFogUv, 1.0 )',
    )
    expect(transformed).toContain('linearToOutputTexel( backdropFogLinear )')
    expect(transformed).not.toContain('#include <fog_fragment>')
    expect(transformed.indexOf('#include <colorspace_fragment>')).toBeLessThan(
      transformed.indexOf('vec4 backdropFogLinear'),
    )
    expect(transformed).not.toContain('toneMapping( backdropFog')
  })

  it('preserves existing hooks and tracks main, planar and cube target pixels', () => {
    const texture = new Texture({ width: 2048, height: 1024 })
    texture.repeat.set(0.75, 1)
    texture.offset.set(0.125, 0)
    texture.updateMatrix()
    const material = new MeshBasicMaterial({ fog: true })
    const previousCompile = vi.fn(
      (parameters: WebGLProgramParametersWithUniforms) => {
        parameters.fragmentShader = `// previous hook\n${parameters.fragmentShader}`
        parameters.vertexShader = `// previous vertex hook\n${parameters.vertexShader}`
      },
    )
    const previousRender = vi.fn()
    const previousCacheKey = vi.fn(() => 'existing-variant')
    material.onBeforeCompile = previousCompile
    material.onBeforeRender = previousRender
    material.customProgramCacheKey = previousCacheKey
    const first = new Mesh(new BufferGeometry(), material)
    const second = new Mesh(new BufferGeometry(), [material])
    const root = new Object3D()
    root.add(first, second)

    expect(installBackdropFog(root, texture)).toBe(1)
    expect(material.customProgramCacheKey()).toBe(
      'existing-variant|backdrop-fog-v1',
    )
    expect(previousCacheKey).toHaveBeenCalledOnce()

    const compiled = shader()
    const mainRenderer = renderer()
    material.onBeforeCompile(compiled, mainRenderer)
    expect(previousCompile).toHaveBeenCalledOnce()
    expect(compiled.fragmentShader).toContain('// previous hook')
    expect(compiled.fragmentShader).toContain('backdropFogMap')
    expect(compiled.vertexShader).toContain('// previous vertex hook')
    expect(compiled.vertexShader).toContain(
      'vFogDepth = length( mvPosition.xyz )',
    )
    expect(compiled.vertexShader).not.toContain('#include <fog_vertex>')
    expect(compiled.uniforms.backdropFogMap?.value).toBe(texture)
    expect(compiled.uniforms.backdropFogUvTransform?.value).toBe(texture.matrix)
    expect(
      (compiled.uniforms.backdropFogResolution?.value as Vector2).toArray(),
    ).toEqual([2160, 1350])

    const renderTarget = renderer({ width: 1024, height: 512 })
    material.onBeforeRender(
      renderTarget,
      new Scene(),
      {} as never,
      new BufferGeometry(),
      first,
      {} as never,
    )
    expect(previousRender).toHaveBeenCalledOnce()
    expect(
      (compiled.uniforms.backdropFogResolution?.value as Vector2).toArray(),
    ).toEqual([1024, 512])

    material.onBeforeRender(
      renderer({ width: 256, height: 256 }, 1),
      new Scene(),
      {} as never,
      new BufferGeometry(),
      first,
      {} as never,
    )
    expect(
      (compiled.uniforms.backdropFogResolution?.value as Vector2).toArray(),
    ).toEqual([128, 128])

    const replacement = new Texture({ width: 1024, height: 1024 })
    replacement.repeat.set(1, 0.75)
    replacement.offset.set(0, 0.125)
    replacement.updateMatrix()
    expect(installBackdropFog(root, replacement)).toBe(0)
    expect(compiled.uniforms.backdropFogMap?.value).toBe(replacement)
    expect(compiled.uniforms.backdropFogUvTransform?.value).toBe(
      replacement.matrix,
    )

    material.dispose()
    texture.dispose()
    replacement.dispose()
  })

  it('leaves shaders without the standard fog chunks untouched', () => {
    const source = 'void main() { gl_FragColor = vec4(1.0); }'
    expect(transformBackdropFogFragmentShader(source)).toBe(source)
  })
})
