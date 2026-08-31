// ============================================================
// Launch Override tests — one-shot guided prescriptions stay scoped
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import type { GuidedPracticeLaunchConfig } from '@/features/exercises/types'
import { EXERCISE_LONG_NOTE, EXERCISE_PITCH_HOLD, } from '@/features/exercises/types'
import { clearLaunchOverride, launchGuidedPractice, setLaunchOverride, } from './launch-override'

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
