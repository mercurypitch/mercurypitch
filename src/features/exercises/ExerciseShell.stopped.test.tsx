// ============================================================
// ExerciseShell, stopped: a run stopped before its end is not graded
// ============================================================
//
// A round-based drill grades the rounds a run reached, so a run stopped
// after one good round scores like a flawless whole one. Its card used to
// say so: an S, 100%, "New best!". It now says the run was not scored and
// keeps what was sung, the drill's summary. The same run through the shell
// without the mark shows the grade, the percentage and the best, from the
// same history and the same score, so every absence below is one the
// unmarked path fails.

import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearExerciseHistory, flushExerciseHistoryWrites, recordExerciseResult, } from '@/stores/exercise-history-store'
import { ExerciseShell } from './ExerciseShell'
import { STOPPED_EARLY_LINE } from './feedback'
import type { ExerciseStatus } from './types'
import { EXERCISE_DRONE_INTONATION } from './types'
import type { ExerciseVoiceCaptureController } from './use-base-exercise'

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

const discarded: ExerciseVoiceCaptureController = {
  state: () => 'idle',
  take: () => null,
  awaitOutcome: async () => ({ state: 'discarded', take: null }),
  discard: () => {},
}

/** One Drone Intonation run through the shell, scoring 100 against an
 *  earlier best of 70, stopped after its first round or not. */
async function finishRun(stoppedEarly: boolean) {
  const [status, setStatus] = createSignal<ExerciseStatus>('idle')
  const view = render(() => (
    <ExerciseShell
      type={EXERCISE_DRONE_INTONATION}
      title="Drone Intonation"
      status={status}
      currentScore={() => 100}
      resultScore={() => (status() === 'complete' ? 100 : null)}
      resultStoppedEarly={() => stoppedEarly}
      voiceCapture={discarded}
      onBack={() => {}}
      onStart={() => {}}
      activeContent={<div>active</div>}
      onStop={() => {}}
      resultSummary={<>Avg Accuracy: 100% · Rounds: 1</>}
      onTryAgain={() => {}}
      onChangeTarget={() => {}}
    />
  ))
  setStatus('active')
  await tick()
  setStatus('complete')
  await tick()
  const card = view.container.querySelector<HTMLElement>(
    '.exercise-result-card',
  )
  if (card === null) throw new Error('the run left no result card')
  return { ...view, card }
}

describe('a finished Drone Intonation run in the shell', () => {
  beforeEach(() => {
    clearExerciseHistory()
    recordExerciseResult({
      type: EXERCISE_DRONE_INTONATION,
      score: 70,
      metrics: {},
      completedAt: 1,
    })
  })

  afterEach(async () => {
    cleanup()
    await flushExerciseHistoryWrites()
    clearExerciseHistory()
  })

  it('grades a whole run: a letter, a percentage and "New best!"', async () => {
    const { card } = await finishRun(false)

    expect(card.querySelector('.exercise-result-grade')?.textContent).toBe('S')
    expect(card.classList.contains('grade-s')).toBe(true)
    expect(card.querySelector('.exercise-result-score')?.textContent).toBe(
      '100%New best!',
    )
  })

  it('says a stopped run was not scored, and keeps what was sung', async () => {
    const { card } = await finishRun(true)

    expect(card.querySelector('.exercise-result-title')?.textContent).toBe(
      STOPPED_EARLY_LINE,
    )
    expect(card.querySelector('.exercise-result-summary')?.textContent).toBe(
      'Avg Accuracy: 100% · Rounds: 1',
    )
    // No letter, no score line, no best and no change since last time.
    expect(card.querySelector('.exercise-result-grade')).toBeNull()
    expect([...card.classList].filter((c) => c.startsWith('grade-'))).toEqual(
      [],
    )
    expect(card.querySelector('.exercise-result-score')).toBeNull()
    expect(card.textContent).not.toMatch(/New best|vs last/)
    // Nor does its replay line promise a score it does not have.
    expect(
      card.querySelector('.exercise-result-voice-copy [role="status"]')
        ?.textContent,
    ).toBe('Replay discarded.')
  })
})
