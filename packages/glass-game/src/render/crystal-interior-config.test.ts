import { describe, expect, it } from 'vitest'
import { crystalInteriorBounds, crystalInteriorRetractionMapping, normalizeCrystalInteriorSettings, } from './crystal-interior-config'

describe('crystal interior configuration', () => {
  it('normalizes an explicit platform-local envelope without changing its centre', () => {
    const settings = normalizeCrystalInteriorSettings({
      preset: 'resonance-veins',
      seed: 42,
      envelope: {
        width: 2.4,
        height: 0.32,
        depth: 0.9,
        center: [0.1, -0.18, -0.05],
        inset: 0.04,
      },
      intensity: 8,
      speed: -2,
      quality: 'mobile',
    })

    expect(settings.envelope.center).toEqual([0.1, -0.18, -0.05])
    expect(settings.intensity).toBe(4)
    expect(settings.speed).toBe(0)
    expect(settings.quality).toBe('mobile')
    const bounds = crystalInteriorBounds(settings)
    expect(bounds.minimum[0]).toBeCloseTo(-1.06)
    expect(bounds.minimum[1]).toBeCloseTo(-0.3)
    expect(bounds.minimum[2]).toBeCloseTo(-0.46)
    expect(bounds.maximum[0]).toBeCloseTo(1.26)
    expect(bounds.maximum[1]).toBeCloseTo(-0.06)
    expect(bounds.maximum[2]).toBeCloseTo(0.36)
  })

  it('rejects an inset that consumes the audition volume', () => {
    expect(() =>
      normalizeCrystalInteriorSettings({
        preset: 'frost-roots',
        seed: 1,
        envelope: { width: 1, height: 0.2, depth: 0.6, inset: 0.1 },
      }),
    ).toThrow('must leave a positive volume')
  })

  it('maps centered scroll retraction to a bounded scale and soft final fade', () => {
    expect(crystalInteriorRetractionMapping(1)).toEqual({
      visibleFraction: 1,
      scale: 1,
      visibility: 1,
      visible: true,
    })
    expect(crystalInteriorRetractionMapping(0)).toEqual({
      visibleFraction: 0,
      scale: 0.015,
      visibility: 0,
      visible: false,
    })
    expect(crystalInteriorRetractionMapping(0.05)).toMatchObject({
      visibleFraction: 0.05,
      scale: 0.05,
      visible: true,
    })
  })
})
