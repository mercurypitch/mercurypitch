import { describe, expect, it } from 'vitest'
import { FULL_BANDS_FROM, labelledRows, LEAST_BAND, LEAST_BANDS_AT, plotBand, STAGE_BAND, } from './pitch-plot-band'

describe('plotBand', () => {
  it('gives the stage its bands at every height: its overlays sit on its canvas', () => {
    for (const h of [60, 117, 336, 511, 900]) {
      expect(plotBand(h, false)).toEqual(STAGE_BAND)
    }
  })

  it('gives a room canvas the stage bands from 336 px up, every phone upright', () => {
    expect(FULL_BANDS_FROM).toBe(336)
    for (const h of [336, 395, 511, 700]) {
      expect(plotBand(h, true)).toEqual(STAGE_BAND)
    }
  })

  it('gives a room canvas the least bands at 168 px and under, every phone on its side', () => {
    expect(LEAST_BANDS_AT).toBe(168)
    for (const h of [117, 120, 165, 168]) {
      expect(plotBand(h, true)).toEqual(LEAST_BAND)
    }
  })

  it('eases from one to the other in step with the height', () => {
    const mid = plotBand((LEAST_BANDS_AT + FULL_BANDS_FROM) / 2, true)
    expect(mid.top).toBeCloseTo((LEAST_BAND.top + STAGE_BAND.top) / 2, 6)
    expect(mid.bottom).toBeCloseTo(
      (LEAST_BAND.bottom + STAGE_BAND.bottom) / 2,
      6,
    )
    expect(mid.short).toBe(true)
  })

  it('keeps the stage bands for a height it cannot read', () => {
    expect(plotBand(Number.NaN, true)).toEqual(STAGE_BAND)
  })
})

describe('labelledRows', () => {
  it('labels every row where the bands held, and every other one past thirty', () => {
    const rows = (n: number) =>
      Array.from({ length: n }, (_, i) => 500 - 14 * i)
    expect(labelledRows(rows(24), STAGE_BAND).every(Boolean)).toBe(true)
    expect(labelledRows(rows(31), STAGE_BAND)).toEqual(
      rows(31).map((_, i) => i % 2 === 0),
    )
  })

  it('on a short room canvas labels the lowest row, then each 12 px clear of the last', () => {
    // Five px apart, lowest first, the order the canvas hands them over in.
    const ys = [100, 95, 90, 85, 80, 75, 70, 65]
    expect(labelledRows(ys, LEAST_BAND)).toEqual([
      true,
      false,
      false,
      true,
      false,
      false,
      true,
      false,
    ])
  })
})
