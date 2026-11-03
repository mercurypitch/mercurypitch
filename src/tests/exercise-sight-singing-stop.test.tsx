// ============================================================
// A Sight-Singing run stopped before its last note
// ============================================================
//
// Sight-Singing scores a run over its whole sequence, an unsung note as 0,
// so a Stop could never pass a bar. Unmarked, though, it was a whole run to
// everything that reads one: it pulled the trends, the best and the weak
// list down, and it spent an armed challenge's attempt on part of a run. An
// ordinary run stopped before its last note is now marked, and its Stop
// reads "Stop". A weekly Legend attempt is not marked: like the Legend
// stage, it scores its early end itself, and its Stop still reads
// "Stop & Score".
//
// Rendered through the real ExerciseShell and the drill's own component.
// Only the base exercise, which owns the microphone, the weekly attempt's
// context and the history's writes are stand-ins.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SightSingingExercise from '@/features/exercises/sight-singing/SightSingingExercise'
import type { ExerciseResult } from '@/features/exercises/types'
import { runStoppedEarly } from '@/features/exercises/types'

const { baseRef, weeklyRef, historyRef } = vi.hoisted(() => ({
  baseRef: {
    results: [] as ExerciseResult[],
    /** The drill is handed its result, as the real base hands it over. */
    handsOverResults: false,
    /** A Legend take's voice outcome arrives, and its save can start. */
    voiceOutcomeArrives: false,
  },
  weeklyRef: {
    attempt: null as null | { exercise: string; challengeId: string },
  },
  historyRef: {
    /** Runs handed to the history. */
    recorded: 0,
    /** Waits on the history's writes, which settle together. */
    waiting: [] as Array<() => void>,
  },
}))

vi.mock('@/lib/domain/weekly-attempt-context', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  activeWeeklyAttempt: () => weeklyRef.attempt,
}))

// A run's save settles only when a test says so (`settleWrites`).
vi.mock('@/stores/exercise-history-store', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  recordExerciseResult: () => {
    historyRef.recorded += 1
  },
  flushExerciseHistoryWrites: () =>
    new Promise<void>((resolve) => {
      historyRef.waiting.push(resolve)
    }),
}))

vi.mock('@/features/exercises/use-base-exercise', async () => {
  const { createSignal } = await import('solid-js')
  return {
    useBaseExercise: () => {
      const [status, setStatus] = createSignal<'idle' | 'active'>('idle')
      const [result, setResult] = createSignal<ExerciseResult | null>(null)
      let startedAt = 0
      return {
        state: () => ({
          status: status(),
          currentScore: 0,
          elapsedMs: 0,
          metrics: {},
        }),
        start: async () => {
          startedAt = performance.now()
          setStatus('active')
          return true
        },
        stop: () => {},
        reset: () => {},
        error: () => null,
        result: () => (baseRef.handsOverResults ? result() : null),
        // A Legend take's save waits on its voice outcome. Until a test lets
        // that arrive, the save never starts, so the attempt stays armed, as
        // it does for the seconds a save takes.
        voiceCapture: baseRef.handsOverResults
          ? {
              awaitOutcome: () =>
                baseRef.voiceOutcomeArrives
                  ? Promise.resolve(undefined)
                  : new Promise<never>(() => {}),
            }
          : undefined,
        // Nothing is sung: every note the run reaches times out at 0.
        currentPitch: () => null,
        frequencyData: () => null,
        targetPitch: () => null,
        pitchHistory: () => [],
        _registerDispose: () => {},
        _setTargetPitch: () => {},
        _getElapsed: () => performance.now() - startedAt,
        _isRunning: () => status() === 'active',
        _setRunning: () => {},
        _updateScore: () => {},
        _updateMetrics: () => {},
        _commitResult: () => {},
        _completeWithResult: (r: ExerciseResult) => {
          baseRef.results.push(r)
          setResult(r)
          setStatus('idle')
        },
        _getDepths: () => ({ completeDepth: 0, resetDepth: 0, startDepth: 0 }),
      }
    },
  }
})

/** Render the drill, press its Start, and return the page. */
async function startRun(): Promise<HTMLElement> {
  const { container } = render(() => (
    <SightSingingExercise
      audioEngine={{ playTone: async () => {}, stopTone: () => {} } as never}
      practiceEngine={{} as never}
      onBack={() => {}}
    />
  ))
  await pressStart(container)
  return container
}

/** Press the idle screen's Start, as for the next run. */
async function pressStart(container: HTMLElement): Promise<void> {
  fireEvent.click(
    container.querySelector<HTMLButtonElement>('.exercise-idle-start')!,
  )
  await vi.advanceTimersByTimeAsync(0)
}

function stopButton(container: HTMLElement): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>('.exercise-btn-stop')!
}

/** End the saves in flight; the history's flush drains them all at once. */
function settleWrites(): void {
  for (const settle of historyRef.waiting.splice(0)) settle()
}

/** The one result the run completed with. */
function onlyResult(): ExerciseResult {
  expect(baseRef.results).toHaveLength(1)
  return baseRef.results[0]!
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
  baseRef.results = []
  baseRef.handsOverResults = false
  baseRef.voiceOutcomeArrives = false
  weeklyRef.attempt = null
  historyRef.recorded = 0
  historyRef.waiting = []
})

describe('a Sight-Singing run', () => {
  it('stopped before its last note is marked, and its Stop says "Stop"', async () => {
    const page = await startRun()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(stopButton(page).getAttribute('aria-label')).toBe('Stop')
    fireEvent.click(stopButton(page))

    const result = onlyResult()
    expect(result.metrics.notesScored).toBe(0)
    expect(runStoppedEarly(result.metrics)).toBe(true)
  })

  it('that reaches its last note is whole, even scoring 0', async () => {
    await startRun()
    // Six notes, each given up on after eight seconds unsung.
    await vi.advanceTimersByTimeAsync(6 * 8_000 + 2_000)

    const result = onlyResult()
    expect(result.metrics.notesScored).toBe(result.metrics.notesAttempted)
    expect(result.score).toBe(0)
    expect(runStoppedEarly(result.metrics)).toBe(false)
  })
})

describe('a weekly Legend attempt in Sight-Singing', () => {
  beforeEach(() => {
    weeklyRef.attempt = { exercise: 'sight-singing', challengeId: 'legend-1' }
  })

  it('scores an early end itself, unmarked, under "Stop & Score"', async () => {
    const page = await startRun()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(stopButton(page).getAttribute('aria-label')).toBe('Stop & Score')
    fireEvent.click(stopButton(page))

    // Unsung notes count 0, so the early end is the attempt's own score.
    const result = onlyResult()
    expect(result.metrics.notesScored).toBe(0)
    expect(result.score).toBe(0)
    expect(runStoppedEarly(result.metrics)).toBe(false)
  })

  it('is one run: the next run on the screen is practice, marked, under "Stop"', async () => {
    const page = await startRun()
    await vi.advanceTimersByTimeAsync(1_000)
    fireEvent.click(stopButton(page))
    expect(runStoppedEarly(onlyResult().metrics)).toBe(false)

    // The take spent the attempt (weekly-attempt.ts clears it), and the
    // singer goes again from the same screen.
    weeklyRef.attempt = null
    baseRef.results = []
    await pressStart(page)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(stopButton(page).getAttribute('aria-label')).toBe('Stop')
    fireEvent.click(stopButton(page))
    expect(runStoppedEarly(onlyResult().metrics)).toBe(true)
  })

  it('is spent as its run ends, though its save has not yet cleared it', async () => {
    baseRef.handsOverResults = true
    const page = await startRun()
    await vi.advanceTimersByTimeAsync(1_000)
    fireEvent.click(stopButton(page))
    expect(runStoppedEarly(onlyResult().metrics)).toBe(false)

    // Its save is still in flight, so the attempt is still armed, and the
    // singer starts again at once.
    baseRef.results = []
    await pressStart(page)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(stopButton(page).getAttribute('aria-label')).toBe('Stop')
    fireEvent.click(stopButton(page))
    expect(runStoppedEarly(onlyResult().metrics)).toBe(true)
  })

  it('is the attempt again when its save fails and leaves it armed', async () => {
    baseRef.handsOverResults = true
    baseRef.voiceOutcomeArrives = true
    const page = await startRun()
    await vi.advanceTimersByTimeAsync(1_000)
    fireEvent.click(stopButton(page))
    expect(runStoppedEarly(onlyResult().metrics)).toBe(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(historyRef.recorded).toBe(1)

    // Its save is in flight, so a run started now is a practice round.
    baseRef.results = []
    await pressStart(page)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(stopButton(page).getAttribute('aria-label')).toBe('Stop')
    fireEvent.click(stopButton(page))
    expect(runStoppedEarly(onlyResult().metrics)).toBe(true)

    // The save fails: weekly-attempt.ts leaves the attempt armed and asks
    // the singer to try the line again, which they do from the same screen.
    settleWrites()
    await vi.advanceTimersByTimeAsync(0)
    baseRef.results = []
    await pressStart(page)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(stopButton(page).getAttribute('aria-label')).toBe('Stop & Score')
    fireEvent.click(stopButton(page))
    expect(runStoppedEarly(onlyResult().metrics)).toBe(false)
  })

  it('stays spent until its own save settles, not when a practice round saves', async () => {
    baseRef.handsOverResults = true
    const page = await startRun()
    await vi.advanceTimersByTimeAsync(1_000)
    fireEvent.click(stopButton(page))
    expect(runStoppedEarly(onlyResult().metrics)).toBe(false)

    // The take's voice outcome is still on its way when the singer starts a
    // practice round, whose own outcome arrives and whose save settles.
    baseRef.voiceOutcomeArrives = true
    baseRef.results = []
    await pressStart(page)
    await vi.advanceTimersByTimeAsync(1_000)
    fireEvent.click(stopButton(page))
    expect(runStoppedEarly(onlyResult().metrics)).toBe(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(historyRef.recorded).toBe(1)
    settleWrites()
    await vi.advanceTimersByTimeAsync(0)

    // The take's own save has not even started, so it is still spent.
    baseRef.results = []
    await pressStart(page)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(stopButton(page).getAttribute('aria-label')).toBe('Stop')
  })
})
