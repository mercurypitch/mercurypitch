// ============================================================
// RoutineRibbon — does the exercise know it is part of a routine?
// ============================================================
//
// The ribbon derives its state from the routine rather than being handed
// launch context, so the thing worth testing is that it agrees with
// auto-advance: it appears exactly when finishing this drill would tick a
// segment off, and it names the right one.
//
// Segments are ticked here by calling `autoAdvanceRoutineSegment` — the same
// call `recordExerciseResult` makes — rather than by writing localStorage.
// The routine lives in a persisted signal that reads storage once at module
// load, so a test that seeds storage afterwards seeds nothing.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import type { ExerciseType } from '@/features/exercises/types'
import { EXERCISE_LONG_NOTE, EXERCISE_SCALE_RUNNER, EXERCISE_WARMUP, } from '@/features/exercises/types'
import { RoutineRibbon } from '@/features/routines/RoutineRibbon'
import type { RoutineTemplate } from '@/features/routines/types'
import { autoAdvanceRoutineSegment, loadSharedRoutine, segmentRunsExercise, } from '@/features/routines/use-daily-routine'

const WARMUP_SEGMENT = {
  type: 'warmup' as const,
  durationSec: 60,
  config: { pattern: 'sirens' },
}
const LONG_NOTE_SEGMENT = {
  type: 'exercise' as const,
  durationSec: 150,
  config: { exercise: EXERCISE_LONG_NOTE },
}
const SCALE_SEGMENT = {
  type: 'exercise' as const,
  durationSec: 150,
  config: { exercise: EXERCISE_SCALE_RUNNER },
}

/** The shape of a generated daily session: warm-up, two drills, a challenge. */
const TEMPLATE: RoutineTemplate = {
  id: 'test-routine',
  name: "Today's Session",
  description: 'four segments',
  segments: [
    WARMUP_SEGMENT,
    LONG_NOTE_SEGMENT,
    SCALE_SEGMENT,
    { type: 'challenge-prep', durationSec: 60, config: {} },
  ],
}

/** A finished warm-up — a partial one deliberately does not tick over. */
const FULL_WARMUP = { stepsCompleted: 5, totalSteps: 5 }

/** Load `template` as today's routine and tick off the given runs in order. */
function seedRoutine(
  template: RoutineTemplate,
  ...runs: [ExerciseType, Record<string, number>?][]
): void {
  loadSharedRoutine(template)
  for (const [type, metrics] of runs) autoAdvanceRoutineSegment(type, metrics)
}

afterEach(cleanup)

describe('segmentRunsExercise', () => {
  it('matches an exercise segment by its exercise', () => {
    expect(segmentRunsExercise(LONG_NOTE_SEGMENT, EXERCISE_LONG_NOTE)).toBe(
      true,
    )
    expect(segmentRunsExercise(LONG_NOTE_SEGMENT, EXERCISE_SCALE_RUNNER)).toBe(
      false,
    )
  })

  it('matches warm-up and cool-down segments by the guided warmup', () => {
    // Both are run by the same exercise with a different pattern, which is
    // why the ribbon labels them by pattern rather than by exercise.
    expect(segmentRunsExercise(WARMUP_SEGMENT, EXERCISE_WARMUP)).toBe(true)
    expect(segmentRunsExercise(WARMUP_SEGMENT, EXERCISE_LONG_NOTE)).toBe(false)
  })

  it('never matches a challenge-prep segment', () => {
    const prep = TEMPLATE.segments[3]!
    expect(segmentRunsExercise(prep, EXERCISE_LONG_NOTE)).toBe(false)
    expect(segmentRunsExercise(prep, EXERCISE_WARMUP)).toBe(false)
  })
})

describe('RoutineRibbon', () => {
  it('stays away when the drill is not part of today’s routine', () => {
    // Warm-up is the current segment; this is Scale Runner, two places down
    // the list. Finishing it now ticks nothing off, so claiming a step
    // would be a lie.
    seedRoutine(TEMPLATE)
    const { queryByText } = render(() => (
      <RoutineRibbon type={EXERCISE_SCALE_RUNNER} />
    ))
    expect(queryByText(/of 4/)).toBeNull()
  })

  it('shows the position and names every segment when it does belong', () => {
    seedRoutine(TEMPLATE, [EXERCISE_WARMUP, FULL_WARMUP])
    const { getByText } = render(() => (
      <RoutineRibbon type={EXERCISE_LONG_NOTE} />
    ))
    // Segment two of four, with the warm-up already behind it.
    expect(getByText(/2\s*of 4/)).toBeTruthy()
    // Warm-ups are named by pattern, not by exercise: four rows all reading
    // "Warm-up" is the bug segment-labels exists to prevent.
    expect(getByText('Sirens')).toBeTruthy()
    expect(getByText('Long Note')).toBeTruthy()
    expect(getByText('Scale Runner')).toBeTruthy()
    expect(getByText('Challenge')).toBeTruthy()
  })

  it('appears for a drill opened outside the routine that still counts', () => {
    // The singer picked Long Note from the exercise list rather than from
    // the session card, and it happens to be the current segment.
    // Auto-advance WILL tick it off, so the ribbon must say so — this is
    // the case a launch-context flag would miss.
    seedRoutine(TEMPLATE, [EXERCISE_WARMUP, FULL_WARMUP])
    const { getByText } = render(() => (
      <RoutineRibbon type={EXERCISE_LONG_NOTE} />
    ))
    expect(getByText(/2\s*of 4/)).toBeTruthy()
  })

  it('offers the next segment once this one is ticked off', () => {
    seedRoutine(TEMPLATE, [EXERCISE_WARMUP, FULL_WARMUP])
    const { getByText, queryByText } = render(() => (
      <RoutineRibbon type={EXERCISE_LONG_NOTE} />
    ))
    expect(queryByText(/^Next:/)).toBeNull()

    // Finishing the run is what advances the routine; the ribbon follows.
    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)

    expect(getByText(/Next:\s*Scale Runner/)).toBeTruthy()
    // And it stays on screen rather than vanishing at the useful moment.
    expect(getByText(/3\s*of 4/)).toBeTruthy()
  })

  it('says the session is done when nothing is left to launch', () => {
    const shortRoutine: RoutineTemplate = {
      ...TEMPLATE,
      id: 'short-routine',
      segments: [WARMUP_SEGMENT, LONG_NOTE_SEGMENT],
    }
    seedRoutine(shortRoutine, [EXERCISE_WARMUP, FULL_WARMUP])
    const { getByText } = render(() => (
      <RoutineRibbon type={EXERCISE_LONG_NOTE} />
    ))

    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)

    expect(getByText(/session is complete/)).toBeTruthy()
  })
})
