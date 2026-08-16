// ============================================================
// ExerciseShell between runs of a multi-rep routine segment
// ============================================================
//
// A segment that asks for three runs parks the singer on the result screen
// after each one. The shell has to say the truth there: the button starts
// the NEXT PRESCRIBED RUN (not "Try Again", which reads as optional), and
// the result card stays compact — no contour canvas, no pop-in — because
// mid-rep the singer needs pace, not analysis. The full celebratory card
// returns after the segment's last run, and everywhere outside routines.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExerciseShell } from '@/features/exercises/ExerciseShell'
import { publishRunTrace } from '@/features/exercises/last-run-trace'
import type { ExerciseStatus } from '@/features/exercises/types'
import { EXERCISE_LONG_NOTE, EXERCISE_SCALE_RUNNER, } from '@/features/exercises/types'
import type { RoutineTemplate } from '@/features/routines/types'
import { autoAdvanceRoutineSegment, loadSharedRoutine, } from '@/features/routines/use-daily-routine'

const REPS_TEMPLATE: RoutineTemplate = {
  id: 'shell-reps-routine',
  name: "Today's Session",
  description: 'a drill worth repeating',
  segments: [
    {
      type: 'exercise',
      durationSec: 150,
      config: { exercise: EXERCISE_LONG_NOTE },
      reps: 3,
    },
    {
      type: 'exercise',
      durationSec: 150,
      config: { exercise: EXERCISE_SCALE_RUNNER },
    },
  ],
}

const tick = () => new Promise((r) => setTimeout(r, 0))

/**
 * Mount the shell and walk it through one finished run. The trace is
 * published before the active→complete transition, which is when the shell
 * snapshots it for the result card — the same order the real drills use.
 */
async function renderFinishedRun(
  onTryAgain: () => void = () => {},
): Promise<ReturnType<typeof render>> {
  const [status, setStatus] = createSignal<ExerciseStatus>('idle')
  const rendered = render(() => (
    <ExerciseShell
      type={EXERCISE_LONG_NOTE}
      title="Long Note"
      status={status}
      currentScore={() => 0}
      resultScore={() => 72}
      onBack={() => {}}
      onStart={() => {}}
      activeContent={<div>active</div>}
      onStop={() => {}}
      resultSummary={<>summary</>}
      onTryAgain={onTryAgain}
      onChangeTarget={() => {}}
    />
  ))
  setStatus('active')
  await tick()
  publishRunTrace({
    type: EXERCISE_LONG_NOTE,
    completedAt: 1,
    durationMs: 3000,
    samples: [{ t: 0, f: 220 }],
    targets: [{ t: 0, f: 220 }],
  })
  setStatus('complete')
  await tick()
  return rendered
}

describe('ExerciseShell between-run result screen', () => {
  beforeEach(() => {
    // A template no other test loads; each test banks its own runs.
    loadSharedRoutine(REPS_TEMPLATE)
  })
  afterEach(cleanup)

  it('offers the next prescribed run instead of Try Again', async () => {
    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    const onTryAgain = vi.fn()
    const { container, getByTestId } = await renderFinishedRun(onTryAgain)

    // The ribbon offers the same run in its own row, so target the shell's
    // primary button rather than matching text globally.
    expect(container.querySelector('.exercise-idle-start')?.textContent).toBe(
      'Start run 2 of 3',
    )
    const card = container.querySelector('.exercise-result-card')
    expect(card?.classList.contains('mid-reps')).toBe(true)
    // The contour is analysis; mid-rep the card carries only the score.
    expect(card?.querySelector('canvas')).toBeNull()

    // The ribbon's own offer restarts the drill through the shell's
    // Try Again handler — one restart path, two doors.
    fireEvent.click(getByTestId('routine-run-again'))
    expect(onTryAgain).toHaveBeenCalledOnce()
  })

  it('returns the full card and Try Again after the last run', async () => {
    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    const { container } = await renderFinishedRun()

    expect(container.querySelector('.exercise-idle-start')?.textContent).toBe(
      'Try Again',
    )
    const card = container.querySelector('.exercise-result-card')
    expect(card?.classList.contains('mid-reps')).toBe(false)
    expect(card?.querySelector('canvas')).toBeTruthy()
  })

  it('keeps Try Again while no run has banked', async () => {
    // Banking happens when the real drill records its result; a result
    // screen reached without one (this mock never calls autoAdvance) must
    // not claim a rep count the routine has not registered.
    const { container } = await renderFinishedRun()
    expect(container.querySelector('.exercise-idle-start')?.textContent).toBe(
      'Try Again',
    )
  })
})
