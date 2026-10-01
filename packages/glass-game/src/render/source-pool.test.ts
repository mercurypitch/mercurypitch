// Source pool tests — lock the shared Journey silhouette, fog variant, clock and ownership.

import type { BufferAttribute } from 'three'
import { DoubleSide, NormalBlending } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createSourcePoolSurface, SOURCE_POOL_TRIANGLES_PER_INSTANCE, } from './source-pool'

describe('source pool surface', () => {
  it('preserves the forty-triangle pond and extended downstream mouth', () => {
    const surface = createSourcePoolSurface()
    const positions = surface.geometry.getAttribute(
      'position',
    ) as BufferAttribute
    const ys = Array.from({ length: positions.count }, (_, index) =>
      positions.getY(index),
    )

    expect(surface.geometry.index?.count).toBe(
      SOURCE_POOL_TRIANGLES_PER_INSTANCE * 3,
    )
    expect(Math.min(...ys)).toBeCloseTo(-1.9)
    expect(Math.max(...ys)).toBeCloseTo(1)
    expect(surface.geometry.boundingSphere).not.toBeNull()
    surface.dispose()
  })

  it('keeps Journey unfogged while compiling one opt-in backdrop-fog variant', () => {
    const journey = createSourcePoolSurface()
    const runner = createSourcePoolSurface({ fog: true })

    expect(journey.material.fog).toBe(false)
    expect(runner.material.fog).toBe(true)
    expect(runner.material.vertexShader).toBe(journey.material.vertexShader)
    expect(runner.material.fragmentShader).toBe(journey.material.fragmentShader)
    expect(runner.material.vertexShader).toContain('#include <fog_pars_vertex>')
    expect(runner.material.fragmentShader).toContain('#include <fog_fragment>')
    expect(runner.material.uniforms).toMatchObject({
      fogColor: { value: expect.anything() },
      fogDensity: { value: 0.00025 },
      fogNear: { value: 1 },
      fogFar: { value: 2000 },
    })
    expect(runner.material).toMatchObject({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: NormalBlending,
      toneMapped: true,
      forceSinglePass: true,
    })

    journey.dispose()
    runner.dispose()
  })

  it('copies a caller-owned clock and becomes static for reduced motion', () => {
    const surface = createSourcePoolSurface()
    const geometry = surface.geometry
    const material = surface.material

    surface.setPresentation(4.25, false)
    expect(material.uniforms.uTime.value).toBe(4.25)
    expect(material.uniforms.uMotion.value).toBe(1)
    surface.setPresentation(4.25, true)
    expect(material.uniforms.uTime.value).toBe(4.25)
    expect(material.uniforms.uMotion.value).toBe(0)
    surface.setPresentation(Number.NaN, false)
    expect(material.uniforms.uTime.value).toBe(0)
    expect(material.uniforms.uMotion.value).toBe(1)
    expect(surface.geometry).toBe(geometry)
    expect(surface.material).toBe(material)

    surface.dispose()
  })

  it('disposes its resources once and ignores late presentation updates', () => {
    const surface = createSourcePoolSurface({ fog: true })
    const geometryDisposal = vi.fn()
    const materialDisposal = vi.fn()
    surface.geometry.addEventListener('dispose', geometryDisposal)
    surface.material.addEventListener('dispose', materialDisposal)
    surface.setPresentation(2, true)

    surface.dispose()
    surface.dispose()
    surface.setPresentation(8, false)

    expect(geometryDisposal).toHaveBeenCalledOnce()
    expect(materialDisposal).toHaveBeenCalledOnce()
    expect(surface.material.uniforms.uTime.value).toBe(2)
    expect(surface.material.uniforms.uMotion.value).toBe(0)
  })
})
