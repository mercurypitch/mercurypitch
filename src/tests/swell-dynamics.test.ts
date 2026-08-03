// ============================================================
// Dynamic Swell — the loudness the score already measures
// ============================================================
//
// 35% of a swell result is dynamic range in dB, from real RMS. None of
// it was on screen: the only moving indicator was the pitch dot, which
// is about something else, so someone deliberately going soft→loud was
// watching a marker that could be red for an unrelated reason.
//
// The judgement call worth pinning: a PAUSE is not a pianissimo.

import { describe, expect, it } from 'vitest'
import { DB_CEIL, DB_FLOOR, dynamicRangeDb, levelFraction, loudnessProfile, rangeVerdict, rmsToDb, targetFraction, } from '@/features/exercises/dynamic-swell/swell-dynamics'

describe('rmsToDb', () => {
  it('maps silence to the floor rather than -Infinity', () => {
    // log10(0) is -Infinity, which would poison every average downstream.
    expect(rmsToDb(0)).toBe(DB_FLOOR)
    expect(Number.isFinite(rmsToDb(0))).toBe(true)
  })

  it('rises with loudness', () => {
    expect(rmsToDb(0.3)).toBeGreaterThan(rmsToDb(0.03))
  })

  it('treats room noise as silence', () => {
    expect(rmsToDb(0.0001)).toBe(DB_FLOOR)
  })

  it('survives a NaN frame', () => {
    expect(rmsToDb(Number.NaN)).toBe(DB_FLOOR)
  })
})

describe('levelFraction', () => {
  it('spans the meter from floor to ceiling', () => {
    expect(levelFraction(DB_FLOOR)).toBe(0)
    expect(levelFraction(DB_CEIL)).toBe(1)
  })

  it('clamps rather than overflowing the bar', () => {
    expect(levelFraction(-200)).toBe(0)
    expect(levelFraction(20)).toBe(1)
  })

  it('is monotonic in between', () => {
    expect(levelFraction(-20)).toBeGreaterThan(levelFraction(-40))
  })
})

describe('dynamicRangeDb', () => {
  it('measures the distance between softest and loudest', () => {
    const range = dynamicRangeDb([{ rms: 0.01 }, { rms: 0.1 }])
    // A 10x amplitude ratio is 20 dB.
    expect(range).toBeGreaterThan(18)
    expect(range).toBeLessThan(22)
  })

  it('does not count a pause as a pianissimo', () => {
    // THE JUDGEMENT CALL. Silent frames clamped to the floor would hand
    // out a huge "dynamic range" for simply stopping singing.
    const withPause = dynamicRangeDb([{ rms: 0.1 }, { rms: 0 }, { rms: 0.1 }])
    const withoutPause = dynamicRangeDb([{ rms: 0.1 }, { rms: 0.1 }])
    expect(withPause).toBe(withoutPause)
  })

  it('is zero for a steady note', () => {
    expect(dynamicRangeDb([{ rms: 0.05 }, { rms: 0.05 }])).toBe(0)
  })

  it('is zero when there is nothing to compare', () => {
    expect(dynamicRangeDb([])).toBe(0)
    expect(dynamicRangeDb([{ rms: 0.1 }])).toBe(0)
  })

  it('ignores frames with no rms at all', () => {
    expect(dynamicRangeDb([{}, {}])).toBe(0)
  })
})

describe('targetFraction', () => {
  it('asks for nothing outside the sung hold', () => {
    // Phases 0 and 1 are listen/prepare — there is nothing to aim at yet.
    expect(targetFraction(0, 0.5)).toBe(0)
    expect(targetFraction(1, 0.5)).toBe(0)
  })

  it('arches: quiet at both ends, loudest in the middle', () => {
    const start = targetFraction(2, 0)
    const middle = targetFraction(2, 0.5)
    const end = targetFraction(2, 1)
    expect(middle).toBeGreaterThan(start)
    expect(middle).toBeGreaterThan(end)
    expect(start).toBeCloseTo(end, 5)
  })

  it('stays on the meter', () => {
    for (const t of [-1, 0, 0.25, 0.5, 0.75, 1, 2]) {
      const v = targetFraction(2, t)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})

describe('rangeVerdict', () => {
  it('tells a flat run what to change', () => {
    expect(rangeVerdict(0)).toContain('softer')
  })

  it('escalates with range', () => {
    const words = [0, 5, 10, 20].map(rangeVerdict)
    expect(new Set(words).size).toBe(4)
  })
})

describe('loudnessProfile', () => {
  it('never lets a breath count as a swell', () => {
    // THE BUG THIS EXISTS FOR. The scorer used to floor silence at
    // -120 dBFS, so pausing mid-hold measured as a 120 dB range and,
    // tripled and capped, maxed the 35% of the swell score that
    // dynamics are worth. Singing at one steady level with a breath in
    // it is a flat run, and has to score as one.
    const steadyWithBreath = [
      { rms: 0.05 },
      { rms: 0.05 },
      { rms: 0 },
      { rms: 0.05 },
    ]
    expect(loudnessProfile(steadyWithBreath).rangeDb).toBe(0)
    // For contrast: a real swell still measures.
    expect(
      loudnessProfile([{ rms: 0.01 }, { rms: 0.1 }]).rangeDb,
    ).toBeGreaterThan(18)
  })

  it('averages what was sung, not the silence between', () => {
    const withBreath = loudnessProfile([
      { rms: 0.05 },
      { rms: 0 },
      { rms: 0.05 },
    ])
    const without = loudnessProfile([{ rms: 0.05 }, { rms: 0.05 }])
    expect(withBreath.avgDb).toBeCloseTo(without.avgDb, 6)
    expect(withBreath.peakDb).toBeCloseTo(without.peakDb, 6)
  })

  it('reports zeroes for a run with nothing sung in it', () => {
    expect(loudnessProfile([])).toEqual({ rangeDb: 0, avgDb: 0, peakDb: 0 })
    expect(loudnessProfile([{ rms: 0 }, { rms: 0 }])).toEqual({
      rangeDb: 0,
      avgDb: 0,
      peakDb: 0,
    })
  })

  it('gives one sung frame a level but no travel', () => {
    const p = loudnessProfile([{ rms: 0.05 }])
    expect(p.rangeDb).toBe(0)
    expect(p.peakDb).toBeLessThan(0)
    expect(p.peakDb).toBe(p.avgDb)
  })

  it("agrees with dynamicRangeDb, which is the meter's reading", () => {
    const frames = [{ rms: 0.02 }, { rms: 0.2 }, { rms: 0.05 }]
    expect(dynamicRangeDb(frames)).toBe(loudnessProfile(frames).rangeDb)
  })
})
