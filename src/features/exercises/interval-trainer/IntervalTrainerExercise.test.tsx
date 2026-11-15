// ============================================================
// Interval Trainer's idle hint promises the run it then plays
// ============================================================
//
// The setup screen says how many rounds the run will be and which intervals
// it draws from. A launch with its own intervals (a lesson's slug) changes
// both, so the screen is read here through the real ExerciseShell, then
// Start is pressed and the real controller's run is held to the promise.
// Only the base exercise, which owns the microphone, is a stand-in.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearLaunchOverride, setLaunchOverride, } from '@/features/practice-intelligence/launch-override'
import { EXERCISE_INTERVAL_TRAINER } from '../types'
import IntervalTrainerExercise from './IntervalTrainerExercise'

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

/** Render the trainer's setup screen and return its idle hint's words. */
function renderIdleHint(): string | null | undefined {
  const { container } = render(() => (
    <IntervalTrainerExercise
      audioEngine={{ playTone: async () => {} } as never}
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

describe('the Interval Trainer idle hint', () => {
  afterEach(() => {
    cleanup()
    clearLaunchOverride()
    baseRef.metrics = []
  })

  it('promises the rounds and names the intervals of a launch with its own list', async () => {
    setLaunchOverride(EXERCISE_INTERVAL_TRAINER, {
      type: EXERCISE_INTERVAL_TRAINER,
      intervals: [3, 4, 7, 5, 12],
      difficulty: 10,
    })
    const hint = renderIdleHint()

    const totalRounds = await startRun()

    // Eight: the pool would stop at six, and the list at five.
    expect(hint).toBe('8 rounds · Minor 3rd through Octave')
    expect(totalRounds).toBe(8)
  })

  it('keeps the pool and its words without a launch', async () => {
    const hint = renderIdleHint()

    const totalRounds = await startRun()

    expect(hint).toBe('6 rounds · Major 2nd through Octave')
    expect(totalRounds).toBe(6)
  })
})

describe('Hear it first, on the Interval Trainer', () => {
  afterEach(() => {
    cleanup()
    clearLaunchOverride()
    baseRef.metrics = []
    vi.useRealTimers()
  })

  it("plays one pair from the starting note and names it on Merc's line", () => {
    vi.useFakeTimers()
    const tones: number[] = []
    const { container } = render(() => (
      <IntervalTrainerExercise
        audioEngine={
          {
            playTone: async (freq: number) => {
              tones.push(freq)
            },
            stopTone: () => {},
          } as never
        }
        practiceEngine={{} as never}
        onBack={() => {}}
      />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Hear it first' }))
    // The first note at once, the second after it.
    expect(tones).toHaveLength(1)
    const line = container.querySelector('.exercise-stage-demo-line')
    expect(line?.textContent).toMatch(
      /^Listen: [A-G]#?\d, then [A-G]#?\d\. That is a Perfect 5th\.$/,
    )

    vi.advanceTimersByTime(1100)
    expect(tones).toHaveLength(2)
    // A fifth: seven semitones up, a ratio of 2^(7/12).
    expect(tones[1] / tones[0]).toBeCloseTo(2 ** (7 / 12), 5)
  })
})
