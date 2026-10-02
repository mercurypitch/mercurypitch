// ============================================================
// Song runner tempo tests — exact piecewise endpoints and inverse conversion.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { CompiledRunnerCourse } from './contracts'
import { SINGING_CURRENT_CURRENT, SINGING_CURRENT_LEARNING, } from './first-course'
import { compileRunnerTempoSegments, runnerBeatToSeconds, runnerForwardSpeedAtSeconds, runnerSecondsToBeat, } from './tempo'

const pacingVariants: readonly {
  name: string
  course: CompiledRunnerCourse
  speeds: readonly [number, number, number]
}[] = [
  {
    name: 'current',
    course: SINGING_CURRENT_CURRENT,
    speeds: [1.92, 2.16, 2.32],
  },
  {
    name: 'learning',
    course: SINGING_CURRENT_LEARNING,
    speeds: [1.68, 1.92, 2.08],
  },
]

describe('song runner tempo', () => {
  it('rejects a finite positive BPM whose segment duration overflows', () => {
    expect(() =>
      compileRunnerTempoSegments([{ atBeat: 0, bpm: Number.MIN_VALUE }], 4),
    ).toThrow('Runner tempo point 0 must produce a finite positive duration.')
  })

  it('rejects accumulated course seconds that overflow across finite segments', () => {
    expect(() =>
      compileRunnerTempoSegments(
        [
          { atBeat: 0, bpm: 2e-306 },
          { atBeat: 4, bpm: 2e-306 },
        ],
        8,
      ),
    ).toThrow('Runner tempo point 1 must produce a finite positive duration.')
  })

  it.each(pacingVariants)(
    'keeps the $name pace continuous and invertible across every tempo boundary',
    ({ course }) => {
      for (const beat of [0, 8, 63.999, 64, 80, 96, 120, 160]) {
        const seconds = runnerBeatToSeconds(course.tempoSegments, beat)
        expect(runnerSecondsToBeat(course.tempoSegments, seconds)).toBeCloseTo(
          beat,
          10,
        )
      }
    },
  )

  it.each(pacingVariants)(
    'derives the $name forward speed from the active tempo segment',
    ({ course, speeds }) => {
      expect(
        runnerForwardSpeedAtSeconds(
          course.tempoSegments,
          1,
          course.metersPerBeat,
        ),
      ).toBeCloseTo(speeds[0], 12)
      expect(
        runnerForwardSpeedAtSeconds(
          course.tempoSegments,
          50,
          course.metersPerBeat,
        ),
      ).toBeCloseTo(speeds[1], 12)
      expect(
        runnerForwardSpeedAtSeconds(
          course.tempoSegments,
          70,
          course.metersPerBeat,
        ),
      ).toBeCloseTo(speeds[2], 12)
    },
  )
})
