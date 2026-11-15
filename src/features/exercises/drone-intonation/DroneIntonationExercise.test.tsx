// ============================================================
// Drone Intonation's setup promises the run it then plays
// ============================================================
//
// The setup screen says how many rounds the run will be, and a launch with
// its own intervals (a lesson's slug) changes that count and what the run
// drills. It used to say six whatever the difficulty, so the screen is read
// here through the real ExerciseShell, then Start is pressed and the real
// controller's run is held to the promise. The Tuning picker is read the
// same way: remembered, opened on Pure by a launch, and said by the run.
// Only the base exercise, which owns the microphone, is a stand-in: an
// honest one, whose state moves as the controller drives it.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetAllDifficulties, setDifficulty, } from '@/features/practice-intelligence/difficulty-store'
import { clearLaunchOverride, setLaunchOverride, } from '@/features/practice-intelligence/launch-override'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { EXERCISE_DRONE_INTONATION } from '../types'
import DroneIntonationExercise from './DroneIntonationExercise'

// jsdom has no WebGL, so Merc is his still here whatever the gate says; the
// stub only spares the log the probe's "not implemented" notice.
vi.mock('@/lib/merc/gpu-gate', () => ({
  canRunLiveMerc: () => false,
  waitForLiveMerc: () => () => undefined,
}))

const { baseRef } = vi.hoisted(() => ({
  baseRef: {
    metrics: [] as Array<Record<string, number>>,
    disposers: [] as Array<() => void>,
  },
}))

vi.mock('@/features/exercises/use-base-exercise', async () => {
  const { createSignal } = await import('solid-js')
  return {
    useBaseExercise: () => {
      const [state, setState] = createSignal({
        status: 'idle' as string,
        currentScore: 0,
        elapsedMs: 0,
        metrics: {} as Record<string, number>,
      })
      return {
        state,
        start: async () => {
          setState((s) => ({ ...s, status: 'active' }))
          return true
        },
        // What unmount does: the controller's dispose stops its round chain.
        reset: () => {
          for (const fn of baseRef.disposers.splice(0)) fn()
          setState((s) => ({ ...s, status: 'idle', metrics: {} }))
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
        _updateMetrics: (m: Record<string, number>) => {
          baseRef.metrics.push(m)
          setState((s) => ({ ...s, metrics: { ...s.metrics, ...m } }))
        },
        _completeWithResult: () => {},
      }
    },
  }
})

/** Render the drill's setup screen. */
function renderDrill() {
  const playTone = vi.fn(async (_hz: number, _ms?: number) => {})
  const view = render(() => (
    <DroneIntonationExercise
      audioEngine={{ playTone, stopTone: () => {} } as never}
      practiceEngine={{} as never}
      onBack={() => {}}
    />
  ))
  const hint = () => view.container.querySelector('.idle-hint')?.textContent
  const pressed = () =>
    Array.from(
      screen.getByRole('group', { name: 'Tuning' }).querySelectorAll('button'),
    )
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
      .map((b) => b.textContent)
  const pick = (chip: string) =>
    fireEvent.click(
      Array.from(
        screen
          .getByRole('group', { name: 'Tuning' })
          .querySelectorAll('button'),
      ).find((b) => b.textContent === chip)!,
    )
  return { ...view, playTone, hint, pressed, pick }
}

/** Render the drill's setup screen and return its idle hint's words. */
function renderIdleHint(): string | null | undefined {
  return renderDrill().hint()
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
  beforeEach(() => {
    // A started run draws its pitch trail; jsdom has no 2D canvas.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  })

  afterEach(() => {
    cleanup()
    clearLaunchOverride()
    resetAllDifficulties()
    baseRef.metrics = []
    vi.restoreAllMocks()
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
        `${expected} rounds · Minor 3rd and Major 3rd · Piano tuning · Drone: E3`,
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
      expect(hint).toBe(`${expected} rounds · Piano tuning · Drone: E3`)
      expect(totalRounds).toBe(expected)
    },
  )
})

describe("Drone Intonation's tuning", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
    clearLaunchOverride()
    resetAllDifficulties()
    baseRef.metrics = []
    localStorage.clear()
  })

  it("opens on the piano's notes, and says so", () => {
    const drill = renderDrill()

    expect(drill.pressed()).toEqual(['Piano'])
    expect(drill.hint()).toBe('6 rounds · Piano tuning · Drone: E3')
    expect(drill.container.textContent).toContain(
      'Each target is an equal-tempered note, in the same tuning as the rest of the app.',
    )
  })

  it('remembers Pure for the next visit, and its brief says what it scores', () => {
    renderDrill().pick('Pure')
    cleanup()

    const again = renderDrill()

    expect(again.pressed()).toEqual(['Pure'])
    expect(again.hint()).toBe('6 rounds · Pure tuning · Drone: E3')
    expect(again.container.textContent).toContain(
      'Each target is the pure interval over the drone',
    )
  })

  it("opens Lesson 24's launch on Pure, keeping the singer's own Piano", () => {
    setLaunchOverride(EXERCISE_DRONE_INTONATION, {
      type: EXERCISE_DRONE_INTONATION,
      intervals: [7, 4, 12],
      tuning: 'pure',
    })

    const drill = renderDrill()

    expect(drill.pressed()).toEqual(['Pure'])
    expect(drill.hint()).toBe(
      '6 rounds · Major 3rd, Perfect 5th and Octave · Pure tuning · Drone: E3',
    )
    cleanup()
    clearLaunchOverride()
    expect(renderDrill().pressed()).toEqual(['Piano'])
  })

  it("opens Lesson 10's launch on Piano, keeping the singer's own Pure", () => {
    renderDrill().pick('Pure')
    cleanup()
    setLaunchOverride(EXERCISE_DRONE_INTONATION, {
      type: EXERCISE_DRONE_INTONATION,
      intervals: [3, 4],
      tuning: 'piano',
    })

    const drill = renderDrill()

    expect(drill.pressed()).toEqual(['Piano'])
    expect(drill.hint()).toBe(
      '6 rounds · Minor 3rd and Major 3rd · Piano tuning · Drone: E3',
    )
    cleanup()
    clearLaunchOverride()
    expect(renderDrill().pressed()).toEqual(['Pure'])
  })

  it('plays a pure fifth over the drone as its example in Pure, and says so', async () => {
    vi.useFakeTimers()
    const drill = renderDrill()
    drill.pick('Pure')

    fireEvent.click(screen.getByRole('button', { name: 'Hear it first' }))
    expect(
      drill.container.querySelector('.exercise-stage-demo-line')?.textContent,
    ).toBe('Listen: the drone, E3, then B3 above it, a pure Perfect 5th.')
    await vi.advanceTimersByTimeAsync(3000)

    const [drone, fifth] = drill.playTone.mock.calls.map(([hz]) => hz)
    expect(drone).toBeCloseTo(midiToFrequency(52), 9)
    expect(fifth / drone).toBeCloseTo(3 / 2, 9)
  })

  it('asks each round for a pure interval, and shows where it sits from the piano', async () => {
    // Every round a major third, so the words are known. The live view
    // draws a pitch trail; jsdom has no 2D canvas.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    setLaunchOverride(EXERCISE_DRONE_INTONATION, {
      type: EXERCISE_DRONE_INTONATION,
      intervals: [4],
      tuning: 'pure',
    })
    const drill = renderDrill()

    fireEvent.click(screen.getByRole('button', { name: 'Start' }))

    await vi.waitFor(() => {
      expect(
        drill.container
          .querySelector('.exercise-active-phase')
          ?.textContent?.trim(),
      ).toBe('Sing a pure Major 3rd above E3')
    })
    // The note's name, and under it where the pure third sits from it.
    const label = drill.container.querySelector('.mirror-melody-target-label')!
    expect(label.firstChild?.textContent).toBe('G#3')
    expect(within(label as HTMLElement).getByText('14 cents low')).toBeTruthy()
  })
})
