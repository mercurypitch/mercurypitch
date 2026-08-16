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

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExerciseType } from '@/features/exercises/types'
import { EXERCISE_LONG_NOTE, EXERCISE_SCALE_RUNNER, EXERCISE_WARMUP, } from '@/features/exercises/types'
import { AUTO_CONTINUE_SECONDS, resetAutoContinueDismissals, } from '@/features/routines/auto-continue'
import { RoutineRibbon } from '@/features/routines/RoutineRibbon'
import type { RoutineTemplate } from '@/features/routines/types'
import { autoAdvanceRoutineSegment, loadSharedRoutine, routinePrefs, segmentRunsExercise, setRoutinePrefs, } from '@/features/routines/use-daily-routine'
import { pendingDrill, setPendingDrill } from '@/stores/ui-store'

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

// ============================================================
// Auto-continue
// ============================================================
//
// A routine is a sequence, and making the singer click through it is what ends
// sessions early. What these pin down is the other half: every way it can be
// stopped, because an auto-advance that cannot be stopped is worse than none.

describe('RoutineRibbon auto-continue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetAutoContinueDismissals()
    setRoutinePrefs({ length: 'standard', focus: 'auto', autoContinue: true })
    setPendingDrill(null)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Put the routine one segment in, so rendering Long Note attaches the
  // ribbon; `finishSegment` then ticks it off, which is what starts the
  // countdown. Split rather than wrapped in a helper so the `isRunning`
  // accessor can go straight into JSX, where Solid can track it.
  const seedAtLongNote = (): void => {
    seedRoutine(TEMPLATE, [EXERCISE_WARMUP, FULL_WARMUP])
  }
  const finishSegment = (): void => {
    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
  }

  const runOutTheClock = (): void => {
    vi.advanceTimersByTime(AUTO_CONTINUE_SECONDS * 1000)
  }

  it('counts down and launches the next segment on its own', () => {
    seedAtLongNote()
    const { getByTestId } = render(() => (
      <RoutineRibbon type={EXERCISE_LONG_NOTE} />
    ))
    finishSegment()

    // The count is on the button itself, so it cannot drift from the target.
    expect(getByTestId('routine-next').textContent).toContain(
      String(AUTO_CONTINUE_SECONDS),
    )
    vi.advanceTimersByTime(1000)
    expect(getByTestId('routine-next').textContent).toContain(
      String(AUTO_CONTINUE_SECONDS - 1),
    )

    runOutTheClock()
    expect(pendingDrill()?.exercise).toBe(EXERCISE_SCALE_RUNNER)
  })

  it('stops for good when they say to stay', () => {
    seedAtLongNote()
    const { getByTestId } = render(() => (
      <RoutineRibbon type={EXERCISE_LONG_NOTE} />
    ))
    finishSegment()

    fireEvent.click(getByTestId('routine-stay'))
    runOutTheClock()

    expect(pendingDrill()).toBeNull()
    // And the offer is still there to take by hand.
    expect(getByTestId('routine-next')).toBeTruthy()
  })

  // The countdown lives on the result screen, where Try Again lives too.
  // Being pulled into the next drill four seconds into a re-run is the
  // failure this whole feature has to avoid.
  it('gives way to a new run of the same drill', () => {
    const [running, setRunning] = createSignal(false)
    seedAtLongNote()
    const { queryByTestId } = render(() => (
      <RoutineRibbon type={EXERCISE_LONG_NOTE} isRunning={running} />
    ))
    finishSegment()

    setRunning(true)
    runOutTheClock()

    expect(pendingDrill()).toBeNull()
    expect(queryByTestId('routine-stay')).toBeNull()
  })

  it('does not count down for a drill outside the routine', () => {
    // Scale Runner is two segments away, so the ribbon does not attach —
    // and must not quietly launch the routine's next segment either.
    seedRoutine(TEMPLATE)
    render(() => <RoutineRibbon type={EXERCISE_SCALE_RUNNER} />)

    runOutTheClock()

    expect(pendingDrill()).toBeNull()
  })

  it('does not count down when the preference is off', () => {
    setRoutinePrefs((p) => ({ ...p, autoContinue: false }))
    seedAtLongNote()
    const { getByTestId, queryByTestId } = render(() => (
      <RoutineRibbon type={EXERCISE_LONG_NOTE} />
    ))
    finishSegment()

    runOutTheClock()

    expect(pendingDrill()).toBeNull()
    expect(queryByTestId('routine-stay')).toBeNull()
    // The manual offer stays — turning off the countdown is not turning off
    // the routine.
    expect(getByTestId('routine-next')).toBeTruthy()
  })

  it('offers to stop asking after the second cancel, and means it', () => {
    const [running, setRunning] = createSignal(false)
    seedAtLongNote()
    const { getByTestId, queryByTestId } = render(() => (
      <RoutineRibbon type={EXERCISE_LONG_NOTE} isRunning={running} />
    ))
    finishSegment()

    // First cancel by re-running the drill — that route counts too, since
    // re-running is the whole reason someone would want this off.
    setRunning(true)
    expect(queryByTestId('routine-autocontinue-off')).toBeNull()

    // Finishing the re-run starts it again; this time they use the button.
    setRunning(false)
    fireEvent.click(getByTestId('routine-stay'))

    fireEvent.click(getByTestId('routine-autocontinue-off'))
    expect(routinePrefs().autoContinue).toBe(false)

    runOutTheClock()
    expect(pendingDrill()).toBeNull()
  })
})

// A segment that asks for five runs looks broken on the first four unless the
// ribbon says which run they are on: a good run ends, nothing ticks off, and
// no "Next" appears. These are the tests that the ribbon and auto-advance
// still tell the same story now that a segment can take more than one run.
describe('RoutineRibbon reps', () => {
  const REPS_TEMPLATE: RoutineTemplate = {
    id: 'reps-routine',
    name: "Today's Session",
    description: 'a drill worth practising',
    segments: [
      { ...LONG_NOTE_SEGMENT, reps: 3 },
      { ...SCALE_SEGMENT, reps: 2 },
    ],
  }

  it('says nothing about runs when the segment asks for one', () => {
    seedRoutine(TEMPLATE, [EXERCISE_WARMUP, FULL_WARMUP])
    const { queryByTestId } = render(() => (
      <RoutineRibbon type={EXERCISE_LONG_NOTE} />
    ))
    expect(queryByTestId('routine-ribbon-reps')).toBeNull()
  })

  it('counts the runs of a segment that asks for several', () => {
    seedRoutine(REPS_TEMPLATE)
    const { getByTestId } = render(() => (
      <RoutineRibbon type={EXERCISE_LONG_NOTE} />
    ))
    expect(getByTestId('routine-ribbon-reps').textContent).toMatch(
      /Run\s*1\s*of 3/,
    )

    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    expect(getByTestId('routine-ribbon-reps').textContent).toMatch(
      /Run\s*2\s*of 3/,
    )
  })

  // The countdown launching the next segment after run one would skip the
  // rest of the reps — the exact thing the segment is holding open for.
  it('does not offer the next segment while runs remain', () => {
    seedRoutine(REPS_TEMPLATE)
    const { queryByText, queryByTestId } = render(() => (
      <RoutineRibbon type={EXERCISE_LONG_NOTE} />
    ))

    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    expect(queryByText(/^Next:/)).toBeNull()
    expect(queryByTestId('routine-next')).toBeNull()

    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    expect(queryByTestId('routine-next')).toBeTruthy()
    expect(queryByTestId('routine-ribbon-reps')).toBeNull()
  })
})

// ============================================================
// Between-run countdown
// ============================================================
//
// The gap the segment-level countdown left open: a run banks, runs remain,
// and the singer sits on a result screen whose only offer is a button. The
// ribbon now counts the next RUN in with the same clock, the same Stay here,
// and the same preference — pinned here so the two countdowns cannot drift.

describe('RoutineRibbon between-run countdown', () => {
  const REPS_TEMPLATE: RoutineTemplate = {
    id: 'reps-routine',
    name: "Today's Session",
    description: 'a drill worth practising',
    segments: [{ ...LONG_NOTE_SEGMENT, reps: 3 }, SCALE_SEGMENT],
  }

  beforeEach(() => {
    vi.useFakeTimers()
    resetAutoContinueDismissals()
    setRoutinePrefs({ length: 'standard', focus: 'auto', autoContinue: true })
    setPendingDrill(null)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const runOutTheClock = (): void => {
    vi.advanceTimersByTime(AUTO_CONTINUE_SECONDS * 1000)
  }

  /** Render mid-segment: run one banked, the drill's result screen showing. */
  const renderBetweenRuns = (
    onRunAgain: () => void,
    complete: () => boolean = () => true,
  ): ReturnType<typeof render> => {
    seedRoutine(REPS_TEMPLATE)
    const rendered = render(() => (
      <RoutineRibbon
        type={EXERCISE_LONG_NOTE}
        isComplete={complete}
        onRunAgain={onRunAgain}
      />
    ))
    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    return rendered
  }

  it('counts down to the next run, not the next segment', () => {
    const onRunAgain = vi.fn()
    const { getByTestId } = renderBetweenRuns(onRunAgain)

    const button = getByTestId('routine-run-again')
    expect(button.textContent).toContain('Start run 2 of 3')
    expect(button.textContent).toContain(String(AUTO_CONTINUE_SECONDS))

    runOutTheClock()

    expect(onRunAgain).toHaveBeenCalledOnce()
    // The routine itself must not have been advanced past the reps.
    expect(pendingDrill()).toBeNull()
  })

  it('waits for the result screen before counting', () => {
    // A run banks a beat before the drill's status flips to complete;
    // counting over a still-live stage would race the restart.
    const onRunAgain = vi.fn()
    const [complete, setComplete] = createSignal(false)
    const { queryByTestId, getByTestId } = renderBetweenRuns(
      onRunAgain,
      complete,
    )

    expect(queryByTestId('routine-run-again')).toBeNull()
    runOutTheClock()
    expect(onRunAgain).not.toHaveBeenCalled()

    setComplete(true)
    expect(getByTestId('routine-run-again')).toBeTruthy()
    runOutTheClock()
    expect(onRunAgain).toHaveBeenCalledOnce()
  })

  it('can be stopped, and still started by hand', () => {
    const onRunAgain = vi.fn()
    const { getByTestId } = renderBetweenRuns(onRunAgain)

    fireEvent.click(getByTestId('routine-stay'))
    runOutTheClock()
    expect(onRunAgain).not.toHaveBeenCalled()

    fireEvent.click(getByTestId('routine-run-again'))
    expect(onRunAgain).toHaveBeenCalledOnce()
  })

  it('respects the auto-continue preference', () => {
    setRoutinePrefs((p) => ({ ...p, autoContinue: false }))
    const onRunAgain = vi.fn()
    const { getByTestId, queryByTestId } = renderBetweenRuns(onRunAgain)

    runOutTheClock()

    expect(onRunAgain).not.toHaveBeenCalled()
    expect(queryByTestId('routine-stay')).toBeNull()
    // The manual offer stays — the preference turns off the clock, not the
    // routine.
    expect(getByTestId('routine-run-again')).toBeTruthy()
  })

  it('hands over to the segment countdown after the last run', () => {
    const onRunAgain = vi.fn()
    const { getByTestId, queryByTestId } = renderBetweenRuns(onRunAgain)

    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)

    expect(queryByTestId('routine-run-again')).toBeNull()
    expect(getByTestId('routine-next').textContent).toContain('Scale Runner')

    runOutTheClock()
    expect(onRunAgain).not.toHaveBeenCalled()
    expect(pendingDrill()?.exercise).toBe(EXERCISE_SCALE_RUNNER)
  })

  it('offers nothing without a restart to fire', () => {
    // A shell that never wired onRunAgain gets no dangling countdown.
    seedRoutine(REPS_TEMPLATE)
    const { queryByTestId } = render(() => (
      <RoutineRibbon type={EXERCISE_LONG_NOTE} isComplete={() => true} />
    ))
    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)

    expect(queryByTestId('routine-run-again')).toBeNull()
    runOutTheClock()
    expect(pendingDrill()).toBeNull()
  })

  it('offers to stop asking after the second cancel here too', () => {
    // The dismissal counter is shared with the segment countdown on
    // purpose: "stop pushing me" means the clock, not one of its two
    // destinations.
    const onRunAgain = vi.fn()
    const [complete, setComplete] = createSignal(true)
    const { getByTestId, queryByTestId } = renderBetweenRuns(
      onRunAgain,
      complete,
    )

    fireEvent.click(getByTestId('routine-stay'))
    expect(queryByTestId('routine-autocontinue-off')).toBeNull()

    // Leaving and returning to the result restarts the clock; this time
    // the second cancel earns the offer, and taking it sticks.
    setComplete(false)
    setComplete(true)
    fireEvent.click(getByTestId('routine-stay'))
    fireEvent.click(getByTestId('routine-autocontinue-off'))
    expect(routinePrefs().autoContinue).toBe(false)

    runOutTheClock()
    expect(onRunAgain).not.toHaveBeenCalled()
  })

  it('does not count before the first run has banked', () => {
    // Arriving at the drill is not consent to start it: the countdown only
    // ever bridges FROM a result. Before run one there is nothing to bridge.
    const onRunAgain = vi.fn()
    seedRoutine(REPS_TEMPLATE)
    const { queryByTestId } = render(() => (
      <RoutineRibbon
        type={EXERCISE_LONG_NOTE}
        isComplete={() => false}
        onRunAgain={onRunAgain}
      />
    ))

    expect(queryByTestId('routine-run-again')).toBeNull()
    runOutTheClock()
    expect(onRunAgain).not.toHaveBeenCalled()
  })
})
