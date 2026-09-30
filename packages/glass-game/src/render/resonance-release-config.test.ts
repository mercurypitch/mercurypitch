// Resonance Release pure contracts — accepted tuning and explicit lifecycle states stay bounded.

import { describe, expect, it } from 'vitest'
import { createResonanceAccentLayout, normalizeResonancePresentationConfig, RESONANCE_QUALITY_CONFIG, resonanceAccentBudget, resonanceResponseFactors, } from './resonance-release-config'

describe('Resonance Release configuration', () => {
  it('keeps the accepted trial seed, palette, quality and cohesion', () => {
    const settings = normalizeResonancePresentationConfig()

    expect(settings).toMatchObject({
      seed: 20_260_929,
      quality: 'balanced',
      intensity: 1,
      cohesion: 0.8824,
      reducedMotion: false,
    })
    expect(settings.palette).toMatchObject({
      heart: 0xb47583,
      heartGlow: 0xffcab1,
      spray: 0xd78da8,
    })
  })

  it.each(['balanced', 'high'] as const)(
    'holds the %s release accent budget',
    (quality) => {
      const settings = normalizeResonancePresentationConfig({ quality })
      const layout = createResonanceAccentLayout(settings)
      const budget = resonanceAccentBudget(layout, quality)

      expect(budget.renderedTriangles).toBeLessThanOrEqual(
        RESONANCE_QUALITY_CONFIG[quality].maximumAccentTriangles,
      )
      expect(layout.droplets).toHaveLength(
        RESONANCE_QUALITY_CONFIG[quality].dropletCount,
      )
      expect(layout.dust).toHaveLength(
        RESONANCE_QUALITY_CONFIG[quality].dustCount,
      )
    },
  )

  it('distinguishes a held completion from an explicit restored state at zero flight progress', () => {
    const settings = normalizeResonancePresentationConfig()
    const completed = resonanceResponseFactors(settings, 'completed', 0, 0)
    const restored = resonanceResponseFactors(settings, 'restored', 0, 0)

    expect(completed.rewardProgress).toBe(1)
    expect(restored.rewardProgress).toBe(0)
    expect(completed.releaseStrength).toBe(0)
    expect(restored.releaseStrength).toBe(0)
  })

  it('derives fracture and tremor strength only from authoritative charge progress', () => {
    const settings = normalizeResonancePresentationConfig()
    const low = resonanceResponseFactors(settings, 'charging', 0.3, 0)
    const high = resonanceResponseFactors(settings, 'charging', 0.9, 0)
    const idle = resonanceResponseFactors(settings, 'idle', 0.9, 0)

    expect(low.tremorStrength).toBe(0)
    expect(high.tremorStrength).toBeGreaterThan(0)
    expect(high.crackOpacity).toBeGreaterThan(low.crackOpacity)
    expect(idle).toMatchObject({
      crackOpacity: 0,
      tremorStrength: 0,
      rewardProgress: 0,
    })
  })

  it('rejects ambiguous or unbounded crack tuning', () => {
    expect(() =>
      normalizeResonancePresentationConfig({
        crackStages: [
          { threshold: 0.5, paths: 1, segmentsPerPath: 4, opacity: 1 },
          { threshold: 0.4, paths: 1, segmentsPerPath: 4, opacity: 1 },
        ],
      }),
    ).toThrow(/strictly increasing/)
    expect(() =>
      normalizeResonancePresentationConfig({ intensity: Number.NaN }),
    ).toThrow(/intensity must be finite/)
  })
})
