// ============================================================
// rhythm-take: the finest grid a pattern sits on sets its tolerance;
// a take is met onset by onset, in order, with nothing extra; the
// rating clears subdivisions at fixed rungs; and the bank is sane.
// ============================================================

import { describe, expect, it } from 'vitest'
import { CHART_BANK, PULSE_BANK } from './banks'
import { anchorTaps, barBeats, clearedSubdivision, finestSubdivision, judgeTake, subdivisionIndex, TOLERANCE_MS, toleranceFor, } from './rhythm-take'

describe('finestSubdivision', () => {
  it('names the grid every onset sits on', () => {
    expect(finestSubdivision([0, 1, 2])).toBe('quarters')
    expect(finestSubdivision([0, 1.5, 2])).toBe('eighths')
    expect(finestSubdivision([0, 1 / 3, 2 / 3, 1])).toBe('triplets')
    expect(finestSubdivision([0, 0.75, 1])).toBe('sixteenths')
    // Eighths and triplets mixed sit on no grid coarser than sixteenths.
    expect(finestSubdivision([0, 0.5, 4 / 3])).toBe('sixteenths')
  })

  it('tightens the tolerance with the grid', () => {
    expect(toleranceFor({ payload: [0, 2] })).toBe(TOLERANCE_MS.quarters)
    expect(toleranceFor({ payload: [0, 0.5] })).toBe(TOLERANCE_MS.eighths)
    expect(TOLERANCE_MS.quarters).toBeGreaterThan(TOLERANCE_MS.eighths)
    expect(TOLERANCE_MS.eighths).toBeGreaterThan(TOLERANCE_MS.triplets)
    expect(TOLERANCE_MS.triplets).toBeGreaterThan(TOLERANCE_MS.sixteenths)
  })
})

describe('judgeTake', () => {
  const onsets = [0, 600, 1200]
  const bar = 2400

  it('passes a take that meets every onset inside the tolerance', () => {
    const verdict = judgeTake([12, 590, 1260], onsets, 100, bar)
    expect(verdict.correct).toBe(true)
    expect(verdict.met).toEqual([true, true, true])
    expect(verdict.deviations).toEqual([12, -10, 60])
    expect(verdict.extras).toEqual([])
  })

  it('misses an onset whose tap lands outside the tolerance', () => {
    const verdict = judgeTake([0, 750, 1200], onsets, 100, bar)
    expect(verdict.correct).toBe(false)
    expect(verdict.met).toEqual([true, false, true])
    expect(verdict.deviations).toEqual([0, null, 0])
    // The stray tap served nothing.
    expect(verdict.extras).toEqual([750])
  })

  it('fails a take with an extra tap even when every onset is met', () => {
    const verdict = judgeTake([0, 300, 600, 1200], onsets, 100, bar)
    expect(verdict.met).toEqual([true, true, true])
    expect(verdict.extras).toEqual([300])
    expect(verdict.correct).toBe(false)
  })

  it('ignores taps before the bar and after it — getting ready is not an extra', () => {
    const verdict = judgeTake([-900, 0, 600, 1200, 2700], onsets, 100, bar)
    expect(verdict.correct).toBe(true)
    expect(verdict.extras).toEqual([])
  })

  it('lets one tap serve one onset only, in order', () => {
    // Two onsets 150 ms apart, one tap between them: the first takes it.
    const verdict = judgeTake([80], [0, 150], 100, bar)
    expect(verdict.met).toEqual([true, false])
    expect(verdict.deviations).toEqual([80, null])
  })

  it('reports nothing met on an empty take', () => {
    const verdict = judgeTake([], onsets, 100, bar)
    expect(verdict.met).toEqual([false, false, false])
    expect(verdict.correct).toBe(false)
  })
})

describe('barBeats', () => {
  it('reads one bar until an onset crosses the barline', () => {
    expect(barBeats([0, 1, 2])).toBe(4)
    expect(barBeats([0.5, 3.75])).toBe(4)
    expect(barBeats([0, 1, 4])).toBe(8)
    expect(barBeats([0, 4.25, 5])).toBe(8)
  })
})

describe('anchorTaps', () => {
  it('re-bases a take so the first tap stands exactly on the first onset', () => {
    expect(anchorTaps([2340, 2940, 3560], 0)).toEqual([0, 600, 1220])
    // A pattern starting off the beat keeps its shape from the anchor.
    expect(anchorTaps([1000, 1600], 300)).toEqual([300, 900])
    expect(anchorTaps([], 0)).toEqual([])
  })

  it('cancels a constant input delay entirely', () => {
    const late = anchorTaps([80, 680, 1275], 0)
    expect(judgeTake(late, [0, 600, 1200], 65, 2400).correct).toBe(true)
  })
})

describe('clearedSubdivision', () => {
  it('climbs the rungs with the rating', () => {
    expect(clearedSubdivision(1000)).toBeNull()
    expect(clearedSubdivision(1140)).toBe('quarters')
    expect(clearedSubdivision(1400)).toBe('eighths')
    expect(clearedSubdivision(1700)).toBe('triplets')
    expect(clearedSubdivision(1900)).toBe('sixteenths')
    expect(subdivisionIndex('quarters')).toBeLessThan(
      subdivisionIndex('sixteenths'),
    )
  })
})

describe('PULSE_BANK', () => {
  it('holds sorted patterns inside their bar span, seeded up the grid', () => {
    const ids = new Set(PULSE_BANK.map((item) => item.itemId))
    expect(ids.size).toBe(PULSE_BANK.length)
    for (const item of PULSE_BANK) {
      expect(item.payload.length).toBeGreaterThanOrEqual(3)
      expect(item.payload.length).toBeLessThanOrEqual(8)
      const span = barBeats(item.payload)
      for (let i = 0; i < item.payload.length; i++) {
        expect(item.payload[i]).toBeGreaterThanOrEqual(0)
        expect(item.payload[i]).toBeLessThan(span)
        if (i > 0) expect(item.payload[i]).toBeGreaterThan(item.payload[i - 1])
      }
    }
    // Finer grids never seed below coarser ones.
    const maxSeed = (tier: string) =>
      Math.max(
        ...PULSE_BANK.filter((i) => finestSubdivision(i.payload) === tier).map(
          (i) => i.seed,
        ),
      )
    const minSeed = (tier: string) =>
      Math.min(
        ...PULSE_BANK.filter((i) => finestSubdivision(i.payload) === tier).map(
          (i) => i.seed,
        ),
      )
    expect(maxSeed('quarters')).toBeLessThan(minSeed('eighths'))
    expect(maxSeed('eighths')).toBeLessThan(minSeed('triplets'))
    expect(maxSeed('triplets')).toBeLessThan(minSeed('sixteenths'))
  })

  it('mirrors into CHART_BANK under its own ids', () => {
    expect(CHART_BANK).toHaveLength(PULSE_BANK.length)
    const ids = new Set(CHART_BANK.map((item) => item.itemId))
    expect(ids.size).toBe(CHART_BANK.length)
    for (const [i, item] of CHART_BANK.entries()) {
      expect(item.itemId.startsWith('c-')).toBe(true)
      expect(ids.has(PULSE_BANK[i].itemId)).toBe(false)
      expect(item.payload).toEqual(PULSE_BANK[i].payload)
      expect(item.seed).toBe(PULSE_BANK[i].seed)
    }
  })
})
