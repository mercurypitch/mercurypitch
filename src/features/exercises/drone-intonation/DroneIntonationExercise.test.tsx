// ============================================================
// Drone Intonation's idle hint promises the run it then plays
// ============================================================
//
// The setup screen says how many rounds the run will be, and a launch with
// its own intervals (a lesson's slug) changes that count and what the run
// drills. It used to say six whatever the difficulty, so the screen is read
// here through the real ExerciseShell, then Start is pressed and the real
// controller's run is held to the promise. Only the base exercise, which
// owns the microphone, is a stand-in.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetAllDifficulties, setDifficulty, } from '@/features/practice-intelligence/difficulty-store'
import { clearLaunchOverride, setLaunchOverride, } from '@/features/practice-intelligence/launch-override'
import { EXERCISE_DRONE_INTONATION } from '../types'
import DroneIntonationExercise from './DroneIntonationExercise'

const { baseRef } = vi.hoisted(() => ({
  baseRef: {
    metrics: [] as Array<Record<string, number>>,
    disposers: [] as Array<() => void>,
  },
}))

vi.mock('@/features/exercises/use-base-exercise', () => ({
  useBaseExercise: () => ({
    state: () => ({
      status: 'idle',
      currentScore: 0,
      elapsedMs: 0,
      metrics: {},
    }),
    start: async () => true,
    // What unmount does: the controller's dispose stops its round chain.
    reset: () => {
      for (const fn of baseRef.disposers.splice(0)) fn()
    },
    error: () => null,
    result: () => null,
    currentPitch: () => null,
    pitchHistory: () => [],
    _registerDispose: (fn: () => void) => baseRef.disposers.push(fn),
    _setTargetPitch: () => {},
    _getElapsed: () => 0,
    _setRunning: () => {},
    _updateScore: () => {},
    _updateMetrics: (m: Record<string, number>) => baseRef.metrics.push(m),
    _completeWithResult: () => {},
  }),
}))

/** Render the drill's setup screen and return its idle hint's words. */
function renderIdleHint(): string | null | undefined {
  const { container } = render(() => (
    <DroneIntonationExercise
      audioEngine={{ playTone: async () => {}, stopTone: () => {} } as never}
      practiceEngine={{} as never}
      onBack={() => {}}
    />
  ))
  return container.querySelector('.idle-hint')?.textContent
}

/** Press Start and return the round count the run announces. */
async function startRun(): Promise<number | undefined> {
  fireEvent.click(screen.getByRole('button', { name: 'Start' }))
  await vi.waitFor(() => {
    expect(baseRef.metrics.some((m) => 'totalRounds' in m)).toBe(true)
  })
  return baseRef.metrics.find((m) => 'totalRounds' in m)?.totalRounds
}

describe('the Drone Intonation idle hint', () => {
  afterEach(() => {
    cleanup()
    clearLaunchOverride()
    resetAllDifficulties()
    baseRef.metrics = []
  })

  it.each([
    [1, 4],
    [10, 8],
  ])(
    'promises at difficulty %i the %i rounds a launch of the two thirds plays, and names them',
    async (difficulty, expected) => {
      setLaunchOverride(EXERCISE_DRONE_INTONATION, {
        type: EXERCISE_DRONE_INTONATION,
        intervals: [3, 4],
        difficulty,
      })
      const hint = renderIdleHint()

      const totalRounds = await startRun()

      expect(hint).toBe(
        `${expected} rounds · Minor 3rd and Major 3rd · Drone: E3`,
      )
      expect(totalRounds).toBe(expected)
    },
  )

  it.each([
    [1, 4],
    [10, 6],
  ])(
    'promises at stored difficulty %i the %i rounds a run on the pool plays',
    async (difficulty, expected) => {
      setDifficulty(EXERCISE_DRONE_INTONATION, difficulty)
      const hint = renderIdleHint()

      const totalRounds = await startRun()

      // The pool's six caps difficulty 10's eight.
      expect(hint).toBe(`${expected} rounds · Drone: E3`)
      expect(totalRounds).toBe(expected)
    },
  )
})
