// ============================================================
// Ear Lab calibration — pooling, interleaving, and the claim the
// whole Calibration Day ritual rests on: that pooled tracks are
// measurably more precise than one long one.
// ============================================================

import { describe, expect, it } from 'vitest'
import { CALIBRATION_TRACKS, calibrationReading, createCalibrationTracks, isCalibrationComplete, nextTrackIndex, poolThresholds, recordCalibrationTrial, } from './calibration'
import type { ThresholdEstimate } from './staircase'
import { createStaircase, DEFAULT_STAIRCASE, recordTrial, thresholdOf, } from './staircase'
import { rng } from './test-rng'

function listener(threshold: number, random: () => number) {
  const alpha = threshold / 0.8115
  return (level: number): boolean =>
    random() < 0.5 + 0.5 * (1 - Math.exp(-((level / alpha) ** 3)))
}

function estimate(value: number, provisional = false): ThresholdEstimate {
  return { value, spread: 0, reversalsUsed: 6, provisional }
}

describe('poolThresholds', () => {
  it('reads nothing when no track produced an estimate', () => {
    expect(poolThresholds([null, null], 'geometric')).toBeNull()
    expect(poolThresholds([], 'geometric')).toBeNull()
  })

  it('ignores tracks that never turned around', () => {
    const pooled = poolThresholds(
      [estimate(10), null, estimate(10)],
      'geometric',
    )
    expect(pooled?.tracks).toBe(2)
    expect(pooled?.value).toBeCloseTo(10, 6)
  })

  it('pools ratio-scaled tracks geometrically', () => {
    const pooled = poolThresholds([estimate(8), estimate(18)], 'geometric')
    expect(pooled?.value).toBeCloseTo(Math.sqrt(8 * 18), 6)
    // A stray high track would drag an arithmetic mean to 13.
    expect(pooled?.value).toBeLessThan(13)
  })

  it('pools count-scaled tracks arithmetically', () => {
    const pooled = poolThresholds([estimate(6), estimate(8)], 'linear')
    expect(pooled?.value).toBeCloseTo(7, 6)
  })

  it('reports a tighter error bar as tracks agree', () => {
    const agree = poolThresholds([estimate(10), estimate(10.2)], 'geometric')
    const disagree = poolThresholds([estimate(6), estimate(17)], 'geometric')
    expect(agree?.standardError ?? 1).toBeLessThan(0.5)
    expect(disagree?.standardError ?? 0).toBeGreaterThan(2)
  })

  it('carries provisional forward from any short track', () => {
    expect(
      poolThresholds([estimate(10), estimate(10, true)], 'geometric')
        ?.provisional,
    ).toBe(true)
    expect(
      poolThresholds([estimate(10), estimate(11)], 'geometric')?.provisional,
    ).toBe(false)
  })
})

describe('interleaved tracks', () => {
  it('opens the configured number of tracks on one drill', () => {
    const tracks = createCalibrationTracks('hairline', DEFAULT_STAIRCASE)
    expect(tracks).toHaveLength(CALIBRATION_TRACKS)
    expect(tracks.every((t) => t.drillId === 'hairline')).toBe(true)
    expect(isCalibrationComplete(tracks)).toBe(false)
  })

  it('advances only the track the trial belongs to', () => {
    const tracks = recordCalibrationTrial(
      createCalibrationTracks('hairline', DEFAULT_STAIRCASE),
      1,
      true,
    )
    expect(tracks[0].state.trials).toBe(0)
    expect(tracks[1].state.trials).toBe(1)
    expect(tracks[2].state.trials).toBe(0)
  })

  it('only ever picks a track that is still running', () => {
    const random = rng(5)
    let tracks = createCalibrationTracks('hairline', DEFAULT_STAIRCASE)
    for (let i = 0; i < 400; i++) {
      const index = nextTrackIndex(tracks, random)
      if (index === null) break
      expect(tracks[index].state.done).toBe(false)
      tracks = recordCalibrationTrial(tracks, index, i % 3 !== 2)
    }
    expect(isCalibrationComplete(tracks)).toBe(true)
    expect(nextTrackIndex(tracks, random)).toBeNull()
  })

  it('does not hand out the next track in a guessable order', () => {
    // A round-robin is as predictable as a single track; the pick
    // has to be random for the interleave to be worth anything.
    const random = rng(9)
    const tracks = createCalibrationTracks('hairline', DEFAULT_STAIRCASE)
    const picks = Array.from({ length: 60 }, () =>
      nextTrackIndex(tracks, random),
    )
    const repeats = picks.filter((p, i) => i > 0 && p === picks[i - 1]).length
    expect(repeats).toBeGreaterThan(5)
  })
})

describe('a full calibration run', () => {
  /** Drill a simulated ear through interleaved tracks and pool. */
  function calibrate(
    trueThreshold: number,
    seed: number,
  ): { value: number; trials: number } {
    const random = rng(seed)
    const hears = listener(trueThreshold, rng(seed * 31 + 7))
    let tracks = createCalibrationTracks('hairline', DEFAULT_STAIRCASE)
    let trials = 0
    for (;;) {
      const index = nextTrackIndex(tracks, random)
      if (index === null) break
      tracks = recordCalibrationTrial(
        tracks,
        index,
        hears(tracks[index].state.level),
      )
      trials++
    }
    return {
      value: calibrationReading(tracks, 'geometric')?.value ?? 0,
      trials,
    }
  }

  /** Spread of the middle 80% of readings, as ± percent of median. */
  function precision(values: number[]): { median: number; pct: number } {
    const sorted = [...values].sort((a, b) => a - b)
    const at = (q: number) => sorted[Math.floor(sorted.length * q)]
    const median = at(0.5)
    return { median, pct: ((at(0.9) - at(0.1)) / 2 / median) * 100 }
  }

  it('stays unbiased on a 10-cent ear', () => {
    const runs = Array.from({ length: 150 }, (_, i) => calibrate(10, i + 1))
    const { median } = precision(runs.map((r) => r.value))
    expect(median).toBeGreaterThan(9)
    expect(median).toBeLessThan(11)
  })

  it('beats a single track of the same length', () => {
    // The finding that shaped Calibration Day: lengthening one track
    // barely helps, pooling independent ones does.
    const pooled = precision(
      Array.from({ length: 150 }, (_, i) => calibrate(10, i + 1).value),
    )

    const singleLong = precision(
      Array.from({ length: 150 }, (_, i) => {
        const hears = listener(10, rng((i + 1) * 31 + 7))
        let s = createStaircase({
          ...DEFAULT_STAIRCASE,
          reversalsToStop: 20,
          reversalsToAverage: 18,
          maxTrials: 200,
        })
        while (!s.done) s = recordTrial(s, hears(s.level))
        return thresholdOf(s)?.value ?? 0
      }),
    )

    expect(pooled.pct).toBeLessThan(singleLong.pct)
    // And it has to be tight enough that a real gain is visible
    // rather than buried in measurement noise.
    expect(pooled.pct).toBeLessThan(20)
  })

  it('fits inside a short session', () => {
    const runs = Array.from({ length: 60 }, (_, i) => calibrate(10, i + 1))
    const meanTrials = runs.reduce((a, r) => a + r.trials, 0) / runs.length
    // ~90 trials at ~1.5s each is about two minutes for one drill.
    expect(meanTrials).toBeLessThan(110)
  })

  it('resolves a real improvement between two calibrations', () => {
    // A user who went from 20¢ to 12¢ must read as improved, not as
    // noise — this is the product promise in one assertion.
    const before = precision(
      Array.from({ length: 120 }, (_, i) => calibrate(20, i + 1).value),
    )
    const after = precision(
      Array.from({ length: 120 }, (_, i) => calibrate(12, i + 500).value),
    )
    expect(after.median).toBeLessThan(before.median)
    const gap = (before.median - after.median) / before.median
    expect(gap).toBeGreaterThan(0.25)
  })
})
