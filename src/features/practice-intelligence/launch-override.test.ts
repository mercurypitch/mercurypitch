// ============================================================
// Launch Override tests — one-shot launch parameters stay scoped
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import type { GuidedPracticeLaunchConfig } from '@/features/exercises/types'
import { EXERCISE_ARPEGGIO_JUMPER, EXERCISE_CHORD_STACKER, EXERCISE_DRONE_INTONATION, EXERCISE_INTERVAL_TRAINER, EXERCISE_LONG_NOTE, EXERCISE_PITCH_HOLD, EXERCISE_SCALE_RUNNER, EXERCISE_SIGHT_SINGING, } from '@/features/exercises/types'
import { clearLaunchOverride, launchChords, launchGuidedPractice, launchIntervals, launchInversions, launchKey, launchScale, launchTuning, setLaunchOverride, } from './launch-override'

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

describe('scale launch override', () => {
  it('carries the scale only to the exercise it was launched for', () => {
    setLaunchOverride(EXERCISE_SCALE_RUNNER, {
      type: EXERCISE_SCALE_RUNNER,
      scale: 'harmonic-minor',
    })

    const forRunner = launchScale(EXERCISE_SCALE_RUNNER)
    const forOther = launchScale(EXERCISE_INTERVAL_TRAINER)

    expect(forRunner).toBe('harmonic-minor')
    expect(forOther).toBeUndefined()
  })

  it('clears the scale with the rest of the one-shot launch', () => {
    setLaunchOverride(EXERCISE_SCALE_RUNNER, {
      type: EXERCISE_SCALE_RUNNER,
      scale: 'harmonic-minor',
    })

    clearLaunchOverride()

    expect(launchScale(EXERCISE_SCALE_RUNNER)).toBeUndefined()
  })

  it('reads no scale from a launch that brought none', () => {
    setLaunchOverride(EXERCISE_SCALE_RUNNER, {
      type: EXERCISE_SCALE_RUNNER,
      difficulty: 8,
    })

    expect(launchScale(EXERCISE_SCALE_RUNNER)).toBeUndefined()
  })
})

describe('chords and inversions launch override', () => {
  it('carries the chords and the inversions only to the exercise they were launched for', () => {
    setLaunchOverride(EXERCISE_CHORD_STACKER, {
      type: EXERCISE_CHORD_STACKER,
      chords: ['major', 'minor'],
      inversions: false,
    })

    expect(launchChords(EXERCISE_CHORD_STACKER)).toEqual(['major', 'minor'])
    expect(launchInversions(EXERCISE_CHORD_STACKER)).toBe(false)
    expect(launchChords(EXERCISE_ARPEGGIO_JUMPER)).toBeUndefined()
    expect(launchInversions(EXERCISE_ARPEGGIO_JUMPER)).toBeUndefined()
  })

  it('keeps each chord once, in the order given, and none from an empty list', () => {
    setLaunchOverride(EXERCISE_CHORD_STACKER, {
      type: EXERCISE_CHORD_STACKER,
      chords: ['dom7', 'major', 'dom7'],
    })
    expect(launchChords(EXERCISE_CHORD_STACKER)).toEqual(['dom7', 'major'])

    setLaunchOverride(EXERCISE_CHORD_STACKER, {
      type: EXERCISE_CHORD_STACKER,
      chords: [],
    })
    expect(launchChords(EXERCISE_CHORD_STACKER)).toBeUndefined()
  })

  it("leaves the singer's own inversions to a launch that did not say", () => {
    setLaunchOverride(EXERCISE_CHORD_STACKER, {
      type: EXERCISE_CHORD_STACKER,
      chords: ['dom7'],
    })

    expect(launchInversions(EXERCISE_CHORD_STACKER)).toBeUndefined()
  })

  it('clears both with the rest of the one-shot launch', () => {
    setLaunchOverride(EXERCISE_CHORD_STACKER, {
      type: EXERCISE_CHORD_STACKER,
      chords: ['dom7'],
      inversions: true,
    })

    clearLaunchOverride()

    expect(launchChords(EXERCISE_CHORD_STACKER)).toBeUndefined()
    expect(launchInversions(EXERCISE_CHORD_STACKER)).toBeUndefined()
  })
})

describe('tuning launch override', () => {
  it('carries the tuning only to the exercise it was launched for', () => {
    setLaunchOverride(EXERCISE_DRONE_INTONATION, {
      type: EXERCISE_DRONE_INTONATION,
      tuning: 'pure',
    })

    expect(launchTuning(EXERCISE_DRONE_INTONATION)).toBe('pure')
    expect(launchTuning(EXERCISE_INTERVAL_TRAINER)).toBeUndefined()
  })

  it('clears the tuning with the rest of the one-shot launch', () => {
    setLaunchOverride(EXERCISE_DRONE_INTONATION, {
      type: EXERCISE_DRONE_INTONATION,
      tuning: 'pure',
    })

    clearLaunchOverride()

    expect(launchTuning(EXERCISE_DRONE_INTONATION)).toBeUndefined()
  })
})

describe('key launch override', () => {
  it('carries the key only to the exercise it was launched for, beside its scale', () => {
    setLaunchOverride(EXERCISE_SIGHT_SINGING, {
      type: EXERCISE_SIGHT_SINGING,
      key: 'A',
      scale: 'harmonic-minor',
    })

    expect(launchKey(EXERCISE_SIGHT_SINGING)).toBe('A')
    expect(launchScale(EXERCISE_SIGHT_SINGING)).toBe('harmonic-minor')
    expect(launchKey(EXERCISE_SCALE_RUNNER)).toBeUndefined()
  })

  it('clears the key with the rest of the one-shot launch', () => {
    setLaunchOverride(EXERCISE_SIGHT_SINGING, {
      type: EXERCISE_SIGHT_SINGING,
      key: 'G',
    })

    clearLaunchOverride()

    expect(launchKey(EXERCISE_SIGHT_SINGING)).toBeUndefined()
  })
})
