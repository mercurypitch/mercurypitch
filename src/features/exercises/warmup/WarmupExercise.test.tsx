// ============================================================
// The Guided Warmup's end screen: no grade, no score, no level
// ============================================================
//
// A finished warm-up through the real ExerciseShell. The run scores 91 and
// the history holds a best of 95 (a graded drill would show "A", "91%" and
// "-4 vs last"), and the stored level is 7: none of it may reach the screen.
// The run is still recorded, because the history is what ticks off Today's
// Session's warm-up and credits practice time; it no longer moves the level.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExerciseResult } from '@/features/exercises/types'

const { recordMock, levelMock, runRef } = vi.hoisted(() => ({
  recordMock: vi.fn(),
  levelMock: vi.fn(),
  runRef: { result: null as ExerciseResult | null },
}))

vi.mock('@/features/zen/useZenPitchSession', () => ({
  useZenPitchSession: () => ({
    status: () => 'idle',
    elapsedSec: () => 0,
    loopsCompleted: () => 0,
    targets: () => [],
    activePoints: () => [],
    viewport: () => ({ minMidi: 48, maxMidi: 72 }),
    targetVisibility: () => 'full',
    progressCue: () => 'playhead',
    loopDurationSec: () => 10,
    runs: () => [],
    selectExercise: vi.fn(),
    setRootMidi: vi.fn(),
    start: vi.fn(async () => true),
    finish: vi.fn(),
  }),
}))
vi.mock('@/features/zen/ZenPitchCanvas', () => ({ ZenPitchCanvas: () => null }))
vi.mock('@/features/exercises/use-base-exercise', () => ({
  useBaseExercise: () => ({
    state: () => ({
      status: runRef.result === null ? 'idle' : 'complete',
      currentScore: runRef.result?.score ?? 0,
    }),
    start: vi.fn(async () => true),
    reset: vi.fn(),
    error: () => null,
    result: () => runRef.result,
    _updateScore: vi.fn(),
    _updateMetrics: vi.fn(),
    _completeWithResult: vi.fn(),
  }),
}))
vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: recordMock,
  exerciseHistory: () => [
    { type: 'warmup', score: 95, metrics: {}, completedAt: 1 },
  ],
  getExerciseStats: () => ({
    bestScore: 95,
    totalPlays: 1,
    lastScore: 95,
    lastPlayedAt: 1,
    avgScore: 95,
  }),
}))
vi.mock('@/features/practice-intelligence/difficulty-store', () => ({
  getDifficulty: () => 7,
  updateDifficultyFromEma: levelMock,
}))

const { default: WarmupExercise } = await import('./WarmupExercise')

function finishedWarmup(stepsCompleted: number): ExerciseResult {
  return {
    type: 'warmup',
    score: 91,
    metrics: { stepsCompleted, totalSteps: 9, participation: 91 },
    completedAt: 5,
  }
}

function renderEndScreen(result: ExerciseResult): HTMLElement {
  runRef.result = result
  const { container } = render(() => (
    <WarmupExercise
      audioEngine={{} as never}
      practiceEngine={{} as never}
      subscribeFrames={() => () => {}}
      onBack={() => {}}
    />
  ))
  return container
}

describe('the Guided Warmup end screen', () => {
  beforeEach(() => {
    recordMock.mockClear()
    levelMock.mockClear()
  })

  afterEach(() => {
    cleanup()
    runRef.result = null
  })

  it('names the finished routine and its steps, and shows no score', () => {
    const view = renderEndScreen(finishedWarmup(9))
    const card = view.querySelector('.exercise-result-card')

    expect(card?.querySelector('.exercise-result-title')?.textContent).toBe(
      'Warmup complete',
    )
    expect(card?.querySelector('.exercise-result-summary')?.textContent).toBe(
      'Steps: 9/9',
    )
    expect(card?.querySelector('.exercise-result-grade')).toBeNull()
    expect(card?.textContent).not.toMatch(/%|New best|vs last|Participation/)
    expect(view.querySelector('.exercise-score-history')).toBeNull()
    expect(view.querySelector('.exercise-level-chip')).toBeNull()
    expect(view.querySelector('.exercise-header-right')?.textContent).toBe('')
  })

  it('says a stopped warm-up ended, with the steps it reached', () => {
    const view = renderEndScreen(finishedWarmup(3))
    const card = view.querySelector('.exercise-result-card')

    expect(card?.querySelector('.exercise-result-title')?.textContent).toBe(
      'Warmup ended',
    )
    expect(card?.querySelector('.exercise-result-summary')?.textContent).toBe(
      'Steps: 3/9',
    )
  })

  it('records the run in the history and leaves the level alone', () => {
    renderEndScreen(finishedWarmup(9))

    expect(recordMock).toHaveBeenCalledTimes(1)
    expect(recordMock).toHaveBeenCalledWith({
      type: 'warmup',
      score: 91,
      metrics: { stepsCompleted: 9, totalSteps: 9, participation: 91 },
      completedAt: 5,
    })
    expect(levelMock).not.toHaveBeenCalled()
  })
})
