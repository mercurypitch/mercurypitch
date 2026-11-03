// ============================================================
// Pitch Pursuit's idle hint promises the run it then plays
// ============================================================
//
// The level scales a run from 8 notes to 17 and its hit window from about
// 66 cents to 30, but the setup screen said "12 notes · Hit within ±50
// cents" at every level. A run now ends after its planned notes, so the
// screen is read here through the real ExerciseShell at the levels either
// side of the default. The run's own count is held to the same plan in
// src/tests/exercise-pitch-pursuit.test.ts.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetAllDifficulties, setDifficulty, } from '@/features/practice-intelligence/difficulty-store'
import { clearLaunchOverride, setLaunchOverride, } from '@/features/practice-intelligence/launch-override'
import { EXERCISE_PITCH_PURSUIT } from '../types'
import PitchPursuitExercise from './PitchPursuitExercise'

const { baseRef } = vi.hoisted(() => ({
  baseRef: {
    status: 'idle' as 'idle' | 'active',
    metrics: {} as Record<string, number>,
  },
}))

vi.mock('@/features/exercises/use-base-exercise', () => ({
  useBaseExercise: () => ({
    state: () => ({
      status: baseRef.status,
      currentScore: 0,
      elapsedMs: 0,
      metrics: baseRef.metrics,
    }),
    start: async () => true,
    reset: () => {},
    error: () => null,
    result: () => null,
    currentPitch: () => null,
    pitchHistory: () => [],
    _registerDispose: () => {},
    _setTargetPitch: () => {},
    _getElapsed: () => 0,
    _isRunning: () => false,
    _setRunning: () => {},
    _updateScore: () => {},
    _updateMetrics: () => {},
    _completeWithResult: () => {},
  }),
}))

function renderDrill(): HTMLElement {
  return render(() => (
    <PitchPursuitExercise
      audioEngine={{ playTone: async () => {}, stopTone: () => {} } as never}
      practiceEngine={{} as never}
      onBack={() => {}}
    />
  )).container
}

/** Render the drill's setup screen and return its idle hint's words. */
function renderIdleHint(): string | null | undefined {
  return renderDrill().querySelector('.idle-hint')?.textContent
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  clearLaunchOverride()
  resetAllDifficulties()
  baseRef.status = 'idle'
  baseRef.metrics = {}
})

describe('the Pitch Pursuit idle hint', () => {
  it('promises 12 notes within 50 cents at the default level', () => {
    expect(renderIdleHint()).toBe('12 notes · Hit within ±50 cents')
  })

  it.each([
    [1, 8, 66],
    [10, 17, 30],
  ])(
    'promises at stored difficulty %i the %i notes and %i-cent window a run plays',
    (difficulty, notes, cents) => {
      setDifficulty(EXERCISE_PITCH_PURSUIT, difficulty)

      expect(renderIdleHint()).toBe(
        `${notes} notes · Hit within ±${cents} cents`,
      )
    },
  )

  it('follows a drill launch that asks for its own level', () => {
    setLaunchOverride(EXERCISE_PITCH_PURSUIT, {
      type: EXERCISE_PITCH_PURSUIT,
      difficulty: 10,
    })

    expect(renderIdleHint()).toBe('17 notes · Hit within ±30 cents')
  })
})

describe('the Pitch Pursuit note counter', () => {
  it("counts to the notes the run plans, not to the default level's 12", () => {
    // The live view draws a pitch trail; jsdom has no 2D canvas.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    baseRef.status = 'active'
    baseRef.metrics = { totalNotes: 3, plannedNotes: 17 }
    renderDrill()

    // The counter is the line that reads "<sung> / <planned> notes".
    const counter = screen.getByText(/^\d+ \/ \d+ notes$/)
    expect(counter.textContent).toBe('3 / 17 notes')
  })
})
