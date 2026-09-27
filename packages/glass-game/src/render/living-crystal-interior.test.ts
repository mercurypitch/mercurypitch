// Living-crystal shader tests — opaque roots keep deterministic travelling light and bounded controls.

import { describe, expect, it, vi } from 'vitest'
import { createLivingCrystalInteriorAnimation } from './living-crystal-interior'

describe('living-crystal interior animation', () => {
  it('renders as an opaque transmission-visible core in output colour space', () => {
    const effect = createLivingCrystalInteriorAnimation({
      variant: 'pearl-roots',
      seed: 271_828,
    })
    expect(effect.material.transparent).toBe(false)
    expect(effect.material.depthWrite).toBe(true)
    expect(effect.material.depthTest).toBe(true)
    expect(effect.material.toneMapped).toBe(true)
    expect(effect.material.fragmentShader).toContain('<tonemapping_fragment>')
    expect(effect.material.fragmentShader).toContain('<colorspace_fragment>')
    expect(effect.material.fragmentShader).toContain('<fog_fragment>')
    expect(effect.material.vertexShader).toContain('vec4 mvPosition')
    expect(effect.material.fog).toBe(true)
    expect(effect.material.uniforms).toMatchObject({
      fogColor: { value: expect.anything() },
      fogNear: { value: expect.any(Number) },
      fogFar: { value: expect.any(Number) },
    })
    effect.dispose()
  })

  it('loads a new variant default palette unless that switch provides overrides', () => {
    const effect = createLivingCrystalInteriorAnimation({
      variant: 'pearl-roots',
      seed: 7,
      intensity: 2.2,
      palette: { primary: 0x123456 },
    })
    effect.configure({ variant: 'living-amber' })
    expect(effect.snapshot().settings).toMatchObject({
      variant: 'living-amber',
      intensity: 1.72,
      palette: { primary: 0xffbf4d },
    })
    effect.configure({
      variant: 'pearl-roots',
      intensity: 2.4,
      palette: { accent: 0xabcdef },
    })
    expect(effect.snapshot().settings).toMatchObject({
      variant: 'pearl-roots',
      intensity: 2.4,
      palette: { primary: 0xffe4b5, accent: 0xabcdef },
    })
    effect.dispose()
  })

  it('pauses, resumes and resets the deterministic clock', () => {
    const effect = createLivingCrystalInteriorAnimation({
      variant: 'living-amber',
      seed: 9049,
      speed: 0.5,
    })
    effect.update({ deltaSeconds: 0.4 })
    effect.update({ deltaSeconds: 8, paused: true })
    expect(effect.snapshot()).toMatchObject({
      elapsedSeconds: 0.25,
      paused: true,
    })
    effect.update({ deltaSeconds: 0.2, paused: false })
    expect(effect.snapshot().elapsedSeconds).toBeCloseTo(0.45)
    effect.reset()
    expect(effect.snapshot()).toMatchObject({
      elapsedSeconds: 0,
      paused: false,
    })
    effect.dispose()
  })

  it('holds a reduced-motion frame and reconfigures palette without replacing material', () => {
    const effect = createLivingCrystalInteriorAnimation({
      variant: 'pearl-roots',
      seed: 4,
      reducedMotion: true,
    })
    const material = effect.material
    effect.update({ deltaSeconds: 0.25 })
    expect(effect.snapshot().elapsedSeconds).toBe(0)
    effect.configure({
      reducedMotion: false,
      intensity: 2.4,
      palette: { primary: 0x123456 },
    })
    effect.update({ deltaSeconds: 0.1 })
    expect(effect.material).toBe(material)
    expect(effect.snapshot()).toMatchObject({
      elapsedSeconds: 0.1,
      settings: { intensity: 2.4, palette: { primary: 0x123456 } },
    })
    effect.dispose()
  })

  it('disposes its owned shader exactly once', () => {
    const effect = createLivingCrystalInteriorAnimation({
      variant: 'pearl-roots',
      seed: 1,
    })
    const disposed = vi.fn()
    effect.material.addEventListener('dispose', disposed)
    effect.dispose()
    effect.dispose()
    expect(disposed).toHaveBeenCalledOnce()
    expect(() => effect.update({ deltaSeconds: 0.1 })).toThrow(/disposed/)
  })
})
