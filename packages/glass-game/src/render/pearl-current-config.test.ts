// Pearl Current pure contracts — accepted defaults stay connected, contained and budgeted.

import { describe, expect, it } from 'vitest'
import { createPearlCurrentLayout, normalizePearlCurrentConfig, PEARL_CURRENT_BOUNDS, PEARL_CURRENT_DEFAULT_CONFIG, PEARL_CURRENT_MAX_RADIUS_SCALE, PEARL_CURRENT_QUALITY_CONFIG, pearlCurrentRenderBudget, pearlCurrentResponseFactors, } from './pearl-current-config'

describe('Pearl Current configuration', () => {
  it('keeps the accepted Pearl trial as the portable default', () => {
    const settings = normalizePearlCurrentConfig()

    expect(settings).toMatchObject({
      seed: 20_260_929,
      quality: 'balanced',
      speed: 0.65,
      intensity: 1,
      fullness: 0.9824,
      reducedMotion: false,
      palette: PEARL_CURRENT_DEFAULT_CONFIG.palette,
    })
  })

  it('joins every branch to its parent and keeps the full response envelope inside the platform volume', () => {
    const settings = normalizePearlCurrentConfig({ fullness: 1.1 })
    const layout = createPearlCurrentLayout(settings)
    const byId = new Map(layout.streams.map((stream) => [stream.id, stream]))

    for (const stream of layout.streams) {
      if (stream.parentId !== undefined) {
        const parent = byId.get(stream.parentId)!
        expect(stream.points[0]).toEqual(parent.points.at(-1))
        expect(stream.startProgress).toBeCloseTo(parent.endProgress, 10)
      }
      for (const point of stream.points) {
        const margin = stream.radius * PEARL_CURRENT_MAX_RADIUS_SCALE
        expect(point[0] - margin).toBeGreaterThanOrEqual(
          PEARL_CURRENT_BOUNDS.minimum[0],
        )
        expect(point[0] + margin).toBeLessThanOrEqual(
          PEARL_CURRENT_BOUNDS.maximum[0],
        )
        expect(point[1] - margin).toBeGreaterThanOrEqual(
          PEARL_CURRENT_BOUNDS.minimum[1],
        )
        expect(point[1] + margin).toBeLessThanOrEqual(
          PEARL_CURRENT_BOUNDS.maximum[1],
        )
        expect(point[2] - margin).toBeGreaterThanOrEqual(
          PEARL_CURRENT_BOUNDS.minimum[2],
        )
        expect(point[2] + margin).toBeLessThanOrEqual(
          PEARL_CURRENT_BOUNDS.maximum[2],
        )
      }
    }
  })

  it.each(['balanced', 'high'] as const)(
    'holds the %s geometry and bead budget',
    (quality) => {
      const layout = createPearlCurrentLayout(
        normalizePearlCurrentConfig({ quality }),
      )
      const budget = pearlCurrentRenderBudget(layout, quality)
      const limit = PEARL_CURRENT_QUALITY_CONFIG[quality]

      expect(budget.renderedTriangles).toBeLessThanOrEqual(
        limit.maximumRenderedTriangles,
      )
      expect(budget.beads).toBeLessThanOrEqual(limit.maximumBeads)
      expect(layout.droplets).toHaveLength(limit.movingBeads)
    },
  )

  it('places response bands from authoritative normalized progress', () => {
    const early = pearlCurrentResponseFactors('charge', 0.2, 1)
    const late = pearlCurrentResponseFactors('charge', 0.8, 1)
    const releaseEnd = pearlCurrentResponseFactors('release', 1, 1)

    expect(early.chargeProgress).toBeLessThan(late.chargeProgress)
    expect(early.releaseProgress).toBe(0)
    expect(late.chargeStrength).toBeGreaterThan(early.chargeStrength)
    expect(releaseEnd).toMatchObject({
      chargeStrength: 0,
      releaseProgress: 1,
      releaseStrength: 0,
    })
  })

  it('rejects non-finite controls before constructing GPU resources', () => {
    expect(() => normalizePearlCurrentConfig({ speed: Number.NaN })).toThrow(
      /speed must be finite/,
    )
    expect(() =>
      normalizePearlCurrentConfig({ palette: { gold: -1 } }),
    ).toThrow(/gold must be a 24-bit RGB integer/)
  })
})
