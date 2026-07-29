// ============================================================
// Ear Lab staircase — the 2-down-1-up rule and, most importantly,
// that a run actually lands on a listener's true threshold.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { StaircaseState } from './staircase'
import { createStaircase, DEFAULT_STAIRCASE, recordTrial, thresholdOf, } from './staircase'

/** Deterministic PRNG (mulberry32) so the simulations below cannot
 *  flake in CI. */
function rng(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A simulated listener whose 70.7% point sits exactly at
 *  `threshold`. Weibull psychometric function over a 2-alternative
 *  task, so chance is 0.5. The 0.8115 factor is where P hits 0.707
 *  for beta = 3. */
function listener(threshold: number, random: () => number) {
  const alpha = threshold / 0.8115
  return (level: number): boolean => {
    const p = 0.5 + 0.5 * (1 - Math.exp(-((level / alpha) ** 3)))
    return random() < p
  }
}

function feed(
  state: StaircaseState,
  responses: readonly boolean[],
): StaircaseState {
  return responses.reduce((s, correct) => recordTrial(s, correct), state)
}

describe('recordTrial — the 2-down-1-up rule', () => {
  it('holds the level after a single correct answer', () => {
    const s = recordTrial(createStaircase(), true)
    expect(s.level).toBe(50)
    expect(s.runOfCorrect).toBe(1)
    expect(s.trials).toBe(1)
  })

  it('descends only on the second consecutive correct answer', () => {
    const s = feed(createStaircase(), [true, true])
    expect(s.level).toBe(25) // 50 / coarseStep 2
    expect(s.runOfCorrect).toBe(0)
    expect(s.lastMove).toBe('harder')
  })

  it('ascends on a single miss and resets the run', () => {
    const s = feed(createStaircase(), [true, false])
    expect(s.level).toBe(100) // 50 * coarseStep 2
    expect(s.runOfCorrect).toBe(0)
    expect(s.lastMove).toBe('easier')
  })

  it('books a reversal at the level that was just tested', () => {
    // down to 25, then a miss turns the track around at 25.
    const s = feed(createStaircase(), [true, true, false])
    expect(s.reversals).toEqual([25])
    expect(s.level).toBe(50)
  })

  it('switches to the fine step once the track has settled', () => {
    // Two reversals reached, so the third move uses fineStep 1.26.
    const s = feed(createStaircase(), [true, true, false, true, true])
    expect(s.reversals).toHaveLength(2)
    expect(s.level).toBeCloseTo(50 / 1.26, 5)
  })

  it('clamps to the configured floor and ceiling', () => {
    const tight = createStaircase({
      ...DEFAULT_STAIRCASE,
      start: 10,
      min: 8,
      max: 12,
    })
    expect(feed(tight, [true, true]).level).toBe(8)
    expect(feed(tight, [false]).level).toBe(12)
  })

  it('stops at the reversal target and ignores further trials', () => {
    let s = createStaircase()
    // Alternating pairs turn the track around on nearly every move.
    for (let i = 0; i < 200 && !s.done; i++) {
      s = recordTrial(s, i % 3 !== 2)
    }
    expect(s.done).toBe(true)
    expect(s.reversals.length).toBeGreaterThanOrEqual(
      DEFAULT_STAIRCASE.reversalsToStop,
    )

    const frozen = recordTrial(s, true)
    expect(frozen).toBe(s)
  })

  it('gives up after maxTrials even if the track never turns', () => {
    const s = feed(
      createStaircase({ ...DEFAULT_STAIRCASE, maxTrials: 10 }),
      Array.from({ length: 20 }, () => true),
    )
    expect(s.trials).toBe(10)
    expect(s.done).toBe(true)
  })
})

describe('thresholdOf', () => {
  it('reports nothing before the track has turned around twice', () => {
    expect(thresholdOf(createStaircase())).toBeNull()
    expect(thresholdOf(feed(createStaircase(), [true, true, false]))).toBeNull()
  })

  it('averages an even number of trailing reversals', () => {
    // Five reversals available, six wanted → uses the last four, so
    // up- and down-turnarounds cancel instead of biasing the mean.
    const state: StaircaseState = {
      ...createStaircase(),
      reversals: [100, 8, 16, 8, 16],
    }
    const estimate = thresholdOf(state)
    expect(estimate?.reversalsUsed).toBe(4)
    // Geometric mean of 8, 16, 8, 16 — and the stray 100 is excluded.
    expect(estimate?.value).toBeCloseTo(Math.sqrt(8 * 16), 5)
    expect(estimate?.provisional).toBe(true)
  })

  it('marks a full-length run as settled', () => {
    const state: StaircaseState = {
      ...createStaircase(),
      reversals: [12, 10, 11, 9, 10, 10],
    }
    expect(thresholdOf(state)?.provisional).toBe(false)
  })

  it('widens the spread when the reversals disagree', () => {
    const steady = thresholdOf({
      ...createStaircase(),
      reversals: [10, 10, 10, 10],
    })
    const noisy = thresholdOf({
      ...createStaircase(),
      reversals: [4, 25, 5, 20],
    })
    expect(steady?.spread).toBeCloseTo(0, 5)
    expect(noisy?.spread ?? 0).toBeGreaterThan(5)
  })

  it('averages linearly for count-scaled drills', () => {
    const span = createStaircase({
      ...DEFAULT_STAIRCASE,
      stepMode: 'linear',
      harderIs: 'higher',
    })
    const estimate = thresholdOf({ ...span, reversals: [6, 8, 7, 7] })
    expect(estimate?.value).toBeCloseTo(7, 5)
  })
})

describe('ascending tracks (memory span)', () => {
  const spanConfig = {
    ...DEFAULT_STAIRCASE,
    start: 3,
    min: 2,
    max: 16,
    harderIs: 'higher' as const,
    stepMode: 'linear' as const,
    coarseStep: 1,
    fineStep: 1,
    narrowAfterReversals: 0,
  }

  it('gets harder by lengthening the melody', () => {
    expect(feed(createStaircase(spanConfig), [true, true]).level).toBe(4)
  })

  it('gets easier by shortening it', () => {
    expect(feed(createStaircase(spanConfig), [false]).level).toBe(2)
  })
})

describe('convergence', () => {
  /** Run one full track against a simulated listener. */
  function runTrack(trueThreshold: number, seed: number): number | null {
    const hears = listener(trueThreshold, rng(seed))
    let s = createStaircase()
    while (!s.done) s = recordTrial(s, hears(s.level))
    return thresholdOf(s)?.value ?? null
  }

  it('lands on a listener with a 10-cent threshold', () => {
    const estimates = Array.from({ length: 200 }, (_, i) => runTrack(10, i + 1))
    const values = estimates.filter((v): v is number => v !== null)
    expect(values).toHaveLength(200)

    const sorted = [...values].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    // Within 15% of truth — a real staircase is noisy, but it must
    // not be biased, and this is the claim the product rests on.
    expect(median).toBeGreaterThan(8.5)
    expect(median).toBeLessThan(11.5)
  })

  it('tracks a sharper ear down to its own threshold', () => {
    const values = Array.from(
      { length: 200 },
      (_, i) => runTrack(3, i + 1) ?? 0,
    ).sort((a, b) => a - b)
    const median = values[Math.floor(values.length / 2)]
    expect(median).toBeGreaterThan(2.4)
    expect(median).toBeLessThan(3.6)
  })

  it('separates a sharp ear from a blunt one', () => {
    const median = (t: number) => {
      const v = Array.from({ length: 120 }, (_, i) => runTrack(t, i + 1) ?? 0)
      return v.sort((a, b) => a - b)[Math.floor(v.length / 2)]
    }
    // The whole promise of Ruler A: improvement shows up as a
    // reading that falls, with no ceiling to bump into.
    expect(median(30)).toBeGreaterThan(median(10) * 2)
    expect(median(10)).toBeGreaterThan(median(3) * 2)
  })

  it('reaches a reading in a session that fits in a coffee break', () => {
    const hears = listener(10, rng(42))
    let s = createStaircase()
    while (!s.done) s = recordTrial(s, hears(s.level))
    // ~30 trials at a couple of seconds each is a 1–2 minute drill.
    expect(s.trials).toBeLessThan(45)
    expect(thresholdOf(s)?.provisional).toBe(false)
  })
})
