// ============================================================
// Arpeggio Jumper's end screen: what a finished run says, and what it keeps
// ============================================================
//
// A finished run through the real ExerciseShell. The grade is the note
// average, so the result line does not repeat it: it gives the best note as
// praise, how many notes landed, how many were not sung, and the octave the
// run was scored in when that was not the guide's. A run with nothing voiced,
// or stopped before its end, is no result (REQ-GVC-031): no grade, no record,
// no level change.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExerciseResult } from '@/features/exercises/types'

const { recordMock, levelMock, runRef } = vi.hoisted(() => ({
  recordMock: vi.fn(),
  levelMock: vi.fn(),
  runRef: { result: null as ExerciseResult | null },
}))

vi.mock('@/features/exercises/use-base-exercise', () => ({
  useBaseExercise: () => ({
    state: () => ({
      status: runRef.result === null ? 'idle' : 'complete',
      currentScore: runRef.result?.score ?? 0,
      elapsedMs: 0,
      metrics: {},
    }),
    start: vi.fn(async () => true),
    reset: vi.fn(),
    error: () => null,
    result: () => runRef.result,
    pitchHistory: () => [],
    currentPitch: () => null,
    _registerDispose: vi.fn(),
    _setTargetPitch: vi.fn(),
    _setRunning: vi.fn(),
    _updateScore: vi.fn(),
    _updateMetrics: vi.fn(),
    _completeWithResult: vi.fn(),
    _getElapsed: () => 0,
  }),
}))
vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: recordMock,
  exerciseHistory: () => [],
  getExerciseStats: () => ({
    bestScore: 0,
    totalPlays: 0,
    lastScore: 0,
    lastPlayedAt: 0,
    avgScore: 0,
  }),
}))
vi.mock('@/features/practice-intelligence/difficulty-store', () => ({
  getDifficulty: () => 5,
  updateDifficultyFromEma: levelMock,
}))

const { default: ArpeggioJumperExercise } =
  await import('./ArpeggioJumperExercise')

/** A finished run, in the shape the controller's computeResult returns. */
function finishedRun(metrics: Record<string, number>): ExerciseResult {
  return {
    type: 'arpeggio-jumper',
    score: metrics.avgAccuracy,
    metrics: {
      notesCompleted: 4,
      echoMode: 0,
      octaveOffset: 0,
      ...metrics,
    },
    completedAt: 7,
  }
}

function renderEndScreen(result: ExerciseResult): HTMLElement {
  runRef.result = result
  const { container } = render(() => (
    <ArpeggioJumperExercise
      audioEngine={{ playTone: async () => {} } as never}
      practiceEngine={{} as never}
      onBack={() => {}}
    />
  ))
  return container
}

describe('the Arpeggio Jumper end screen', () => {
  beforeEach(() => {
    recordMock.mockClear()
    levelMock.mockClear()
  })

  afterEach(() => {
    cleanup()
    runRef.result = null
  })

  it('gives the best note, the notes landed and the notes not sung', () => {
    // Arrange: three notes exact, one not sung.
    const run = finishedRun({
      avgAccuracy: 75,
      bestNote: 100,
      notesSung: 3,
      notesHit: 3,
      notesTotal: 4,
    })

    // Act
    const view = renderEndScreen(run)

    // Assert
    const card = view.querySelector('.exercise-result-card')
    expect(card?.querySelector('.exercise-result-score')?.textContent).toMatch(
      /^75%/,
    )
    expect(card?.querySelector('.exercise-result-summary')?.textContent).toBe(
      'Best note: 100% · Landed: 3 of 4 · Not sung: 1',
    )
  })

  it('says which octave a run was scored in when it was not the guide tone', () => {
    const run = finishedRun({
      avgAccuracy: 100,
      bestNote: 100,
      notesSung: 4,
      notesHit: 4,
      notesTotal: 4,
      octaveOffset: 1,
    })

    const view = renderEndScreen(run)

    expect(view.querySelector('.exercise-result-summary')?.textContent).toBe(
      'Best note: 100% · Landed: 4 of 4Scored an octave above the guide tone.',
    )
    expect(view.querySelector('.arpeggio-octave-line')?.textContent).toBe(
      'Scored an octave above the guide tone.',
    )
  })

  it('records a heard run and lets it move the level', () => {
    const run = finishedRun({
      avgAccuracy: 88,
      bestNote: 93,
      notesSung: 4,
      notesHit: 3,
      notesTotal: 4,
    })

    renderEndScreen(run)

    expect(recordMock).toHaveBeenCalledTimes(1)
    expect(recordMock).toHaveBeenCalledWith({
      type: 'arpeggio-jumper',
      score: 88,
      metrics: run.metrics,
      completedAt: 7,
    })
    expect(levelMock).toHaveBeenCalledWith('arpeggio-jumper')
  })

  it('shows no grade for a run with nothing voiced, and says why', () => {
    // Arrange: every note's window was silent.
    const run = finishedRun({
      avgAccuracy: 0,
      bestNote: 0,
      notesSung: 0,
      notesHit: 0,
      notesTotal: 4,
    })

    // Act
    const view = renderEndScreen(run)

    // Assert
    expect(view.querySelector('.exercise-result-card')).toBeNull()
    expect(view.querySelector('.arpeggio-not-scored')?.textContent).toBe(
      "We didn't hear any singing, so this run was not scored. Check the microphone, then try again.",
    )
  })

  it('neither records a run with nothing voiced nor lets it move the level', () => {
    const run = finishedRun({
      avgAccuracy: 0,
      bestNote: 0,
      notesSung: 0,
      notesHit: 0,
      notesTotal: 4,
    })

    renderEndScreen(run)

    expect(recordMock).not.toHaveBeenCalled()
    expect(levelMock).not.toHaveBeenCalled()
  })

  it('shows no grade for a run stopped before its end, and says why', () => {
    // Arrange: the root sung exactly, then Stop. Graded on the one note it
    // reached, the run would read 100.
    const run = finishedRun({
      avgAccuracy: 100,
      bestNote: 100,
      notesSung: 1,
      notesHit: 1,
      notesTotal: 1,
      stoppedEarly: 1,
    })

    // Act
    const view = renderEndScreen(run)

    // Assert
    expect(view.querySelector('.exercise-result-card')).toBeNull()
    expect(view.querySelector('.arpeggio-not-scored')?.textContent).toBe(
      'You stopped before the end, so this run was not scored.',
    )
  })

  it('neither records a run stopped before its end nor lets it move the level', () => {
    const run = finishedRun({
      avgAccuracy: 100,
      bestNote: 100,
      notesSung: 1,
      notesHit: 1,
      notesTotal: 1,
      stoppedEarly: 1,
    })

    renderEndScreen(run)

    expect(recordMock).not.toHaveBeenCalled()
    expect(levelMock).not.toHaveBeenCalled()
  })

  it('says nothing about an unheard run before the first run', () => {
    const view = renderEndScreen(null as unknown as ExerciseResult)

    expect(view.querySelector('.arpeggio-not-scored')).toBeNull()
  })
})
