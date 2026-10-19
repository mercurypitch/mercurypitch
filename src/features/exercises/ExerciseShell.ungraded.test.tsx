// ============================================================
// ExerciseShell, ungraded: a finished warm-up shows no score
// ============================================================
//
// The house rules never score a lip trill or a hum (Find Your Pitch,
// TEACHING-PLAYBOOK), and Lesson 7 links the Guided Warmup only once its end
// shows no letter grade, no percentage, no "New best!" and no change since
// last time. The same run through the shell without `ungraded` shows all
// four, from the same history and the same score, so every absence asserted
// below is one the graded path fails.

import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearExerciseHistory, flushExerciseHistoryWrites, recordExerciseResult, } from '@/stores/exercise-history-store'
import { ExerciseShell } from './ExerciseShell'
import type { ExerciseStatus } from './types'
import { EXERCISE_WARMUP } from './types'
import type { ExerciseVoiceCaptureController, ExerciseVoiceCaptureState, } from './use-base-exercise'

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

/** A replay controller that is only ever in one state. */
function captureIn(
  state: ExerciseVoiceCaptureState,
): ExerciseVoiceCaptureController {
  return {
    state: () => state,
    take: () => null,
    awaitOutcome: async () => ({ state: 'discarded', take: null }),
    discard: () => {},
  }
}

/**
 * One warm-up run through the shell, idle to active to complete, scoring 88
 * against an earlier best of 70. Returns the header's text while the run was
 * active, then the finished screen.
 */
async function finishRun(options: {
  ungraded: boolean
  voiceCapture?: ExerciseVoiceCaptureController
}) {
  const [status, setStatus] = createSignal<ExerciseStatus>('idle')
  const view = render(() => (
    <ExerciseShell
      type={EXERCISE_WARMUP}
      title="Guided Warmup"
      status={status}
      currentScore={() => 88}
      resultScore={() => (status() === 'complete' ? 88 : null)}
      ungraded={
        options.ungraded ? { resultTitle: () => 'Warmup complete' } : undefined
      }
      voiceCapture={options.voiceCapture}
      onBack={() => {}}
      onStart={() => {}}
      activeContent={<div>active</div>}
      onStop={() => {}}
      resultSummary={<>Steps: 9/9</>}
      onTryAgain={() => {}}
      onChangeTarget={() => {}}
    />
  ))
  setStatus('active')
  await tick()
  const activeHeader =
    view.container.querySelector('.exercise-header-right')?.textContent ?? ''
  setStatus('complete')
  await tick()
  const card = view.container.querySelector<HTMLElement>(
    '.exercise-result-card',
  )
  if (card === null) throw new Error('the run left no result card')
  return { ...view, activeHeader, card }
}

describe('a finished run in the shell', () => {
  beforeEach(() => {
    clearExerciseHistory()
    recordExerciseResult({
      type: EXERCISE_WARMUP,
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

  it('grades a scored drill: a letter, a percentage and "New best!"', async () => {
    const { card, activeHeader, container } = await finishRun({
      ungraded: false,
    })

    expect(card.querySelector('.exercise-result-grade')?.textContent).toBe('A')
    expect(card.classList.contains('grade-a')).toBe(true)
    expect(card.querySelector('.exercise-result-score')?.textContent).toBe(
      '88%New best!',
    )
    expect(activeHeader).toContain('Lv 5')
    expect(activeHeader).toContain('88%')
    expect(
      container.querySelector('.exercise-score-history')?.textContent,
    ).toContain('Best 70%')
  })

  it('ends an ungraded drill with its title and summary and no score at all', async () => {
    const { card, activeHeader, container } = await finishRun({
      ungraded: true,
    })

    expect(card.querySelector('.exercise-result-title')?.textContent).toBe(
      'Warmup complete',
    )
    expect(card.querySelector('.exercise-result-summary')?.textContent).toBe(
      'Steps: 9/9',
    )
    // No letter grade, no percentage, no best and no change since last time.
    expect(card.querySelector('.exercise-result-grade')).toBeNull()
    expect([...card.classList].filter((c) => c.startsWith('grade-'))).toEqual(
      [],
    )
    expect(card.querySelector('.exercise-result-score')).toBeNull()
    expect(card.textContent).not.toMatch(/%|New best|vs last/)
    // Nor a running score, a level, or the recent-scores strip around it.
    expect(activeHeader).not.toMatch(/%|Lv/)
    expect(container.querySelector('.exercise-level-chip')).toBeNull()
    expect(container.querySelector('.exercise-score-history')).toBeNull()
  })

  it.each([
    ['unsupported', 'This browser cannot record a replay.'],
    ['error', 'No replay was captured.'],
    ['idle', 'Replay discarded.'],
  ] as const)(
    'says only "%s" replay news after an ungraded run, never a score',
    async (state, note) => {
      const { card } = await finishRun({
        ungraded: true,
        voiceCapture: captureIn(state),
      })

      expect(
        card.querySelector('.exercise-result-voice-copy [role="status"]')
          ?.textContent,
      ).toBe(note)
    },
  )

  it.each([
    [
      'unsupported',
      'This browser can score the run but cannot record a replay.',
    ],
    ['error', 'No replay was captured. Your score is unchanged.'],
    ['idle', 'Replay discarded. Your score is unchanged.'],
  ] as const)('keeps the graded replay news for "%s"', async (state, note) => {
    const { card } = await finishRun({
      ungraded: false,
      voiceCapture: captureIn(state),
    })

    expect(
      card.querySelector('.exercise-result-voice-copy [role="status"]')
        ?.textContent,
    ).toBe(note)
  })

  it('promises an ungraded run saves, not a score, before it starts', () => {
    const { container } = render(() => (
      <ExerciseShell
        type={EXERCISE_WARMUP}
        title="Guided Warmup"
        status={() => 'idle'}
        currentScore={() => 0}
        resultScore={() => null}
        ungraded={{ resultTitle: () => 'Warmup complete' }}
        voiceCapture={captureIn('idle')}
        onBack={() => {}}
        onStart={() => {}}
        activeContent={<div>active</div>}
        onStop={() => {}}
        resultSummary={<>Steps: 0/9</>}
        onTryAgain={() => {}}
        onChangeTarget={() => {}}
      />
    ))

    expect(container.querySelector('.exercise-capture-note')?.textContent).toBe(
      'Runs save without audio. After the run, choose whether to keep its temporary local replay.',
    )
  })
})
