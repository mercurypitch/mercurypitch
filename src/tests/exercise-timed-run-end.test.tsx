// ============================================================
// A timed drill's timer ends a whole run, and its Stop says so
// ============================================================
//
// Long Note, Pitch Hold and Vibrato give the shell an onElapse that ends
// the run as the timer's, and keep their Stop for a run cut short. The
// controller tests call stopAndCompute directly, so nothing there sees the
// component's wiring: a drill that dropped its onElapse, or marked the run
// its timer ends, would leave them all green. The wiring and the Stop's
// name are read here through the real ExerciseShell and each drill's own
// component. Only the base exercise, which owns the microphone, is a
// stand-in.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import type { Component } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LongNoteExercise from '@/features/exercises/long-note/LongNoteExercise'
import PitchHoldExercise from '@/features/exercises/pitch-hold/PitchHoldExercise'
import { resetTimerPreference, setTimerMode, } from '@/features/exercises/timer-preference'
import type { ExerciseResult } from '@/features/exercises/types'
import { runStoppedEarly } from '@/features/exercises/types'
import VibratoExercise from '@/features/exercises/vibrato/VibratoExercise'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PracticeEngine } from '@/lib/practice-engine'

const { baseRef } = vi.hoisted(() => ({
  baseRef: {
    results: [] as ExerciseResult[],
    startedAt: 0,
    history: [] as Array<{
      freq: number
      time: number
      cents: number
      clarity: number
    }>,
  },
}))

vi.mock('@/features/exercises/use-base-exercise', async () => {
  const { createSignal } = await import('solid-js')
  return {
    useBaseExercise: () => {
      const [status, setStatus] = createSignal<'idle' | 'active'>('idle')
      return {
        state: () => ({
          status: status(),
          currentScore: 0,
          elapsedMs: 0,
          metrics: {},
        }),
        // The run's clock starts as it turns active, as the real one does.
        start: async () => {
          baseRef.startedAt = performance.now()
          setStatus('active')
          return true
        },
        stop: () => {},
        reset: () => {},
        error: () => null,
        result: () => null,
        currentPitch: () => null,
        frequencyData: () => null,
        targetPitch: () => null,
        pitchHistory: () => baseRef.history,
        _registerDispose: () => {},
        _setTargetPitch: () => {},
        _getElapsed: () => performance.now() - baseRef.startedAt,
        _isRunning: () => status() === 'active',
        _setRunning: () => {},
        _updateScore: () => {},
        _updateMetrics: () => {},
        _commitResult: () => {},
        _completeWithResult: (r: ExerciseResult) => baseRef.results.push(r),
        _getDepths: () => ({ completeDepth: 0, resetDepth: 0, startDepth: 0 }),
      }
    },
  }
})

type Drill = Component<{
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
}>

const DRILLS: Array<[string, Drill]> = [
  ['Long Note', LongNoteExercise],
  ['Pitch Hold', PitchHoldExercise],
  ['Vibrato', VibratoExercise],
]

/** Render a drill, press its Start, and return the page. */
async function startDrill(Drill: Drill): Promise<HTMLElement> {
  const { container } = render(() => (
    <Drill
      audioEngine={{ playTone: async () => {}, stopTone: () => {} } as never}
      practiceEngine={{} as never}
      onBack={() => {}}
    />
  ))
  fireEvent.click(
    container.querySelector<HTMLButtonElement>('.exercise-idle-start')!,
  )
  await vi.advanceTimersByTimeAsync(0)
  return container
}

function stopButton(container: HTMLElement): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>('.exercise-btn-stop')!
}

function countdown(container: HTMLElement): string | null | undefined {
  return container.querySelector('.exercise-timer-countdown')?.textContent
}

/** A4 held in tune for `seconds`, as the engine records it. */
function singFor(seconds: number): void {
  baseRef.history = Array.from({ length: seconds * 20 + 1 }, (_, i) => ({
    freq: 440,
    time: i * 0.05,
    cents: 0,
    clarity: 0.9,
  }))
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
      'Date',
    ],
  })
  // The live view draws a pitch trail; jsdom has no 2D canvas.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  resetTimerPreference()
  baseRef.results = []
  baseRef.history = []
})

describe.each(DRILLS)('%s with a ten-second timer', (_name, Drill) => {
  beforeEach(() => {
    setTimerMode(10)
  })

  it('scores the run its timer ends as a whole run', async () => {
    await startDrill(Drill)

    await vi.advanceTimersByTimeAsync(10_200)

    expect(baseRef.results).toHaveLength(1)
    expect(runStoppedEarly(baseRef.results[0]!.metrics)).toBe(false)
  })

  it('names its Stop "Stop", and marks a run stopped two seconds in', async () => {
    const page = await startDrill(Drill)
    await vi.advanceTimersByTimeAsync(2_000)

    expect(stopButton(page).getAttribute('aria-label')).toBe('Stop')
    fireEvent.click(stopButton(page))

    expect(baseRef.results).toHaveLength(1)
    expect(runStoppedEarly(baseRef.results[0]!.metrics)).toBe(true)
  })

  // The countdown is all the singer sees of the run's length. Its last
  // number is "1s", so a Stop while it shows is the run's end, and a Stop
  // while it still reads "2s" is not.
  it.each([
    [9_100, '1s', false],
    [8_900, '2s', true],
  ])(
    'agrees with its countdown: %i ms in it reads %s, and a Stop there is marked: %s',
    async (atMs, reads, marked) => {
      const page = await startDrill(Drill)
      await vi.advanceTimersByTimeAsync(atMs)

      expect(countdown(page)).toBe(reads)
      fireEvent.click(stopButton(page))

      expect(baseRef.results).toHaveLength(1)
      expect(runStoppedEarly(baseRef.results[0]!.metrics)).toBe(marked)
    },
  )
})

describe.each(DRILLS)('%s on Manual', (_name, Drill) => {
  beforeEach(() => {
    setTimerMode('manual')
  })

  it('names its Stop "Stop & Score", and scores the run it ends', async () => {
    singFor(6)
    const page = await startDrill(Drill)
    await vi.advanceTimersByTimeAsync(6_000)

    expect(stopButton(page).getAttribute('aria-label')).toBe('Stop & Score')
    fireEvent.click(stopButton(page))

    expect(baseRef.results).toHaveLength(1)
    expect(runStoppedEarly(baseRef.results[0]!.metrics)).toBe(false)
  })

  it('leaves a run that sang two seconds unscored', async () => {
    singFor(2)
    const page = await startDrill(Drill)
    await vi.advanceTimersByTimeAsync(2_000)
    fireEvent.click(stopButton(page))

    expect(baseRef.results).toHaveLength(1)
    expect(runStoppedEarly(baseRef.results[0]!.metrics)).toBe(true)
    expect(baseRef.results[0]!.metrics.tooShort).toBe(1)
  })
})

describe.each(DRILLS)(
  '%s when a sync changes the timer mid-run',
  (_name, Drill) => {
    // The timer is chosen between runs; only a settings sync changes it
    // during one. The run keeps the length it started with.
    beforeEach(() => {
      setTimerMode(10)
    })

    it('keeps counting down the length it started with', async () => {
      const page = await startDrill(Drill)
      await vi.advanceTimersByTimeAsync(3_000)

      setTimerMode(30)
      await vi.advanceTimersByTimeAsync(100)
      expect(countdown(page)).toBe('7s')
      expect(stopButton(page).getAttribute('aria-label')).toBe('Stop')

      await vi.advanceTimersByTimeAsync(7_100)
      expect(baseRef.results).toHaveLength(1)
      expect(runStoppedEarly(baseRef.results[0]!.metrics)).toBe(false)
    })

    it('judges a Stop against that length too', async () => {
      const page = await startDrill(Drill)
      await vi.advanceTimersByTimeAsync(3_000)
      setTimerMode(30)
      await vi.advanceTimersByTimeAsync(6_100)

      // Against the thirty seconds the sync chose, this Stop is twenty short
      // and marked. Against the ten the run started with, it is in the
      // countdown's last second.
      expect(countdown(page)).toBe('1s')
      fireEvent.click(stopButton(page))

      expect(baseRef.results).toHaveLength(1)
      expect(runStoppedEarly(baseRef.results[0]!.metrics)).toBe(false)
    })
  },
)
