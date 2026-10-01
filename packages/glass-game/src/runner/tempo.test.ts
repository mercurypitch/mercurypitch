// ============================================================
// Song runner tempo tests — exact piecewise endpoints and inverse conversion.
// ============================================================

import { describe, expect, it } from 'vitest'
import { SINGING_CURRENT } from './first-course'
import { runnerBeatToSeconds, runnerForwardSpeedAtSeconds, runnerSecondsToBeat, } from './tempo'

describe('song runner tempo', () => {
  it('is continuous and invertible across every tempo boundary', () => {
    for (const beat of [0, 8, 63.999, 64, 80, 96, 120, 160]) {
      const seconds = runnerBeatToSeconds(SINGING_CURRENT.tempoSegments, beat)
      expect(
        runnerSecondsToBeat(SINGING_CURRENT.tempoSegments, seconds),
      ).toBeCloseTo(beat, 10)
    }
  })

  it('derives forward speed from the active tempo segment', () => {
    expect(
      runnerForwardSpeedAtSeconds(
        SINGING_CURRENT.tempoSegments,
        1,
        SINGING_CURRENT.metersPerBeat,
      ),
    ).toBeCloseTo(1.92, 12)
    expect(
      runnerForwardSpeedAtSeconds(
        SINGING_CURRENT.tempoSegments,
        50,
        SINGING_CURRENT.metersPerBeat,
      ),
    ).toBeCloseTo(2.16, 12)
    expect(
      runnerForwardSpeedAtSeconds(
        SINGING_CURRENT.tempoSegments,
        70,
        SINGING_CURRENT.metersPerBeat,
      ),
    ).toBeCloseTo(2.32, 12)
  })
})
