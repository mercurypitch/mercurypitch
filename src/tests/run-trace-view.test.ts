// Reading a finished run back: what the result card claims about it has to be
// true, because "you were 90 cents flat four seconds in" is the one thing on
// that card a singer can actually act on.

import { describe, expect, it } from 'vitest'
import type { RunTrace, TracePoint } from '@/features/exercises/last-run-trace'
import { centsBetween, targetAt, traceBounds, worstMoment, } from '@/features/exercises/run-trace-view'

const C4 = 261.63
const E4 = 329.63

function trace(over: Partial<RunTrace> = {}): RunTrace {
  return {
    type: 'long-note',
    completedAt: 0,
    durationMs: 10_000,
    samples: [],
    targets: [],
    ...over,
  }
}

const at = (t: number, f: number): TracePoint => ({ t, f })

describe('targetAt', () => {
  const targets = [at(0, C4), at(4, E4)]

  // The timeline records one point per CHANGE, so a target holds until the
  // next. Interpolating would invent a glide the drill never asked for.
  it('holds a target until the next one', () => {
    expect(targetAt(targets, 0)).toBe(C4)
    expect(targetAt(targets, 3.9)).toBe(C4)
    expect(targetAt(targets, 4)).toBe(E4)
    expect(targetAt(targets, 99)).toBe(E4)
  })

  it('is null before the first target', () => {
    expect(targetAt([at(2, C4)], 1)).toBeNull()
    expect(targetAt([], 1)).toBeNull()
  })
})

describe('worstMoment', () => {
  it('finds the biggest deviation, not the last one', () => {
    const bad = worstMoment(
      trace({
        targets: [at(0, C4)],
        samples: [at(0, C4), at(1, C4 * 2 ** (50 / 1200)), at(2, C4 * 1.01)],
      }),
    )

    expect(bad?.t).toBe(1)
    expect(Math.round(bad!.cents)).toBe(50)
  })

  it('reports flat as negative cents', () => {
    const bad = worstMoment(
      trace({
        targets: [at(0, C4)],
        samples: [at(1, C4 * 2 ** (-90 / 1200))],
      }),
    )

    expect(Math.round(bad!.cents)).toBe(-90)
    expect(bad?.target).toBe(C4)
  })

  // A gap in detection is not a wrong note. Scoring silence as an enormous
  // deviation would make every run's worst moment the moment they breathed.
  it('ignores samples with no detected pitch', () => {
    const bad = worstMoment(
      trace({
        targets: [at(0, C4)],
        samples: [at(0.5, 0), at(1, Number.NaN), at(2, C4 * 1.01)],
      }),
    )

    expect(bad?.t).toBe(2)
  })

  it('is null when the drill had no targets to compare against', () => {
    expect(worstMoment(trace({ samples: [at(1, C4)] }))).toBeNull()
  })

  it('is null when nothing was sung', () => {
    expect(worstMoment(trace({ targets: [at(0, C4)] }))).toBeNull()
  })

  // A target set before the singer's first note is not something they missed.
  it('skips samples that precede the first target', () => {
    expect(
      worstMoment(trace({ targets: [at(5, C4)], samples: [at(1, C4 * 4)] })),
    ).toBeNull()
  })
})

describe('traceBounds', () => {
  it('frames the targets too, so a missed octave still shows the miss', () => {
    const box = traceBounds(
      trace({ samples: [at(1, C4)], targets: [at(0, C4 * 2)] }),
    )!

    expect(2 ** box.logMin).toBeLessThan(C4)
    expect(2 ** box.logMax).toBeGreaterThan(C4 * 2)
  })

  it('never frames tighter than half an octave', () => {
    const box = traceBounds(trace({ samples: [at(0, C4), at(1, C4)] }))!
    expect(box.logMax - box.logMin).toBeGreaterThanOrEqual(0.5)
  })

  // The axis is the run's recorded length, not the last sung note: a run that
  // ended in silence still lasted as long as it lasted.
  it('takes the x axis from the recorded duration', () => {
    const box = traceBounds(
      trace({ durationMs: 8000, samples: [at(0.5, C4)] }),
    )!
    expect(box.duration).toBe(8)
  })

  it('is null when nothing usable was recorded', () => {
    expect(traceBounds(trace())).toBeNull()
    expect(traceBounds(trace({ samples: [at(0, 0)] }))).toBeNull()
  })
})

describe('centsBetween', () => {
  it('is zero on the note and 1200 an octave up', () => {
    expect(centsBetween(C4, C4)).toBe(0)
    expect(Math.round(centsBetween(C4 * 2, C4))).toBe(1200)
  })
})
