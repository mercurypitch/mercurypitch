// ============================================================
// Launch Override tests — one-shot launch parameters stay scoped
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import type { GuidedPracticeLaunchConfig } from '@/features/exercises/types'
import { EXERCISE_DRONE_INTONATION, EXERCISE_INTERVAL_TRAINER, EXERCISE_LONG_NOTE, EXERCISE_PITCH_HOLD, } from '@/features/exercises/types'
import { clearLaunchOverride, launchGuidedPractice, launchIntervals, setLaunchOverride, } from './launch-override'

const GUIDED_PRACTICE: GuidedPracticeLaunchConfig = {
  assessmentRunId: 'run-1',
  exercise: {
    exerciseId: EXERCISE_PITCH_HOLD,
    exerciseVersion: '1.0.0',
    configuration: {
      configurationId: 'pitch-hold.guided-pitch-centre',
      configurationVersion: '1.0.0',
    },
  },
  dose: {
    durationMilliseconds: 5_000,
    repetitions: 3,
    sets: 1,
    comfortableRangeMidiCents: null,
    demand: 'same',
  },
  stopRuleId: 'guided.stop-on-discomfort-v1',
  targetMidiCents: 6_000,
  toleranceCents: 35,
}

afterEach(clearLaunchOverride)

describe('guided practice launch override', () => {
  it('carries the reviewed contract only to its target exercise', () => {
    setLaunchOverride(EXERCISE_PITCH_HOLD, {
      type: EXERCISE_PITCH_HOLD,
      targetNote: 'C4',
      guidedPractice: GUIDED_PRACTICE,
    })

    expect(launchGuidedPractice(EXERCISE_PITCH_HOLD)).toBe(GUIDED_PRACTICE)
    expect(launchGuidedPractice(EXERCISE_LONG_NOTE)).toBeUndefined()
  })

  it('clears the prescription with the rest of the one-shot launch', () => {
    setLaunchOverride(EXERCISE_PITCH_HOLD, {
      type: EXERCISE_PITCH_HOLD,
      guidedPractice: GUIDED_PRACTICE,
    })

    clearLaunchOverride()

    expect(launchGuidedPractice(EXERCISE_PITCH_HOLD)).toBeUndefined()
  })
})

describe('intervals launch override', () => {
  it('carries the intervals only to the exercise they were launched for', () => {
    setLaunchOverride(EXERCISE_INTERVAL_TRAINER, {
      type: EXERCISE_INTERVAL_TRAINER,
      intervals: [3, 4, 7, 5, 12],
    })

    const forTrainer = launchIntervals(EXERCISE_INTERVAL_TRAINER)
    const forOther = launchIntervals(EXERCISE_DRONE_INTONATION)

    expect(forTrainer).toEqual([3, 4, 7, 5, 12])
    expect(forOther).toBeUndefined()
  })

  it('clears the intervals with the rest of the one-shot launch', () => {
    setLaunchOverride(EXERCISE_INTERVAL_TRAINER, {
      type: EXERCISE_INTERVAL_TRAINER,
      intervals: [5, 7],
    })

    clearLaunchOverride()

    expect(launchIntervals(EXERCISE_INTERVAL_TRAINER)).toBeUndefined()
  })

  it('keeps only whole upward semitones up to an octave, each once, in the order given', () => {
    setLaunchOverride(EXERCISE_INTERVAL_TRAINER, {
      type: EXERCISE_INTERVAL_TRAINER,
      intervals: [7, 0, -5, 2.5, 13, 5, 7, 12],
    })

    const intervals = launchIntervals(EXERCISE_INTERVAL_TRAINER)

    expect(intervals).toEqual([7, 5, 12])
  })

  it('leaves the exercise its own pool when nothing asked for is usable', () => {
    setLaunchOverride(EXERCISE_INTERVAL_TRAINER, {
      type: EXERCISE_INTERVAL_TRAINER,
      intervals: [0, 24],
    })

    const intervals = launchIntervals(EXERCISE_INTERVAL_TRAINER)

    expect(intervals).toBeUndefined()
  })

  it('reads no intervals from a launch that brought none', () => {
    setLaunchOverride(EXERCISE_INTERVAL_TRAINER, {
      type: EXERCISE_INTERVAL_TRAINER,
      difficulty: 7,
    })

    const intervals = launchIntervals(EXERCISE_INTERVAL_TRAINER)

    expect(intervals).toBeUndefined()
  })
})
