import { afterEach, describe, expect, it, vi } from 'vitest'
import { useIntervalTrainerController } from '@/features/exercises/interval-trainer/use-interval-trainer-controller'
import { EXERCISE_INTERVAL_TRAINER } from '@/features/exercises/types'
import type { BaseExerciseController } from '@/features/exercises/use-base-exercise'

// MIDI -> Hz, matching the controller's internal conversion.
function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

function createMockBase(
  overrides: Partial<BaseExerciseController> = {},
): BaseExerciseController {
  const mock: BaseExerciseController = {
    pitchHistory: () => [],
    _setTargetPitch: ((
      _v: number | null,
    ) => {}) as BaseExerciseController['_setTargetPitch'],
    _getElapsed: () => 0,
    _isRunning: () => true,
    _setRunning: () => {},
    _commitResult: () => {},
    _updateScore: () => {},
    _updateMetrics: () => {},
    _completeWithResult: () => {},
    _registerDispose: () => {},
    _getDepths: () => ({ completeDepth: 0, resetDepth: 0, startDepth: 0 }),
    state: () => ({
      status: 'active',
      currentScore: 0,
      elapsedMs: 0,
      metrics: {},
    }),
    start: async () => true,
    stop: () => {},
    reset: () => {},
    result: () => null,
    currentPitch: () => null,
    frequencyData: () => null,
    targetPitch: () => null,
    error: () => null,
    ...overrides,
  }
  return mock
}

const audioEngine = { playTone: async () => {} }

describe('useIntervalTrainerController', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('computeResult returns zero and real metric keys for empty history', () => {
    const base = createMockBase()
    const ctrl = useIntervalTrainerController(base, audioEngine)
    const result = ctrl.computeResult()

    expect(result.type).toBe(EXERCISE_INTERVAL_TRAINER)
    expect(result.score).toBe(0)
    expect(result.metrics.roundsCompleted).toBe(0)
    expect(result.metrics.avgAccuracy).toBe(0)
    expect(result.metrics.bestRound).toBe(0)
    expect(result.metrics.smallIntervalAvg).toBe(0)
    expect(result.metrics.mediumIntervalAvg).toBe(0)
    expect(result.metrics.largeIntervalAvg).toBe(0)
  })

  it('setBase resets target pitch to zero (listening sentinel)', () => {
    const targetCalls: Array<number | null> = []
    const base = createMockBase({
      _setTargetPitch: ((v: number | null) => {
        targetCalls.push(v)
        return v
      }) as BaseExerciseController['_setTargetPitch'],
    })
    const ctrl = useIntervalTrainerController(base, audioEngine)
    ctrl.setBase(60) // C4

    // setBase clears the target to 0 until the first round plays a tone.
    expect(targetCalls).toContain(0)
  })

  it('stopRounds commits a result and stops running', () => {
    const committed: unknown[] = []
    let runningSet: boolean | undefined
    const base = createMockBase({
      _completeWithResult: (r) => committed.push(r),
      _setRunning: (v) => {
        runningSet = v
      },
    })
    const ctrl = useIntervalTrainerController(base, audioEngine)
    ctrl.setBase(60)
    ctrl.stopRounds()

    expect(committed.length).toBe(1)
    expect(runningSet).toBe(false)
  })

  it('scores a driven happy path within 0-100 (match window uses the relative clock)', async () => {
    // Regression lock for the epoch bug: evaluateRound() filters samples by
    // p.time*1000 against the exercise-relative clock (_getElapsed). When that
    // was mixed with absolute performance.now(), the window selected ZERO
    // samples and every round scored 0. Driving the loop with in-tune samples
    // must now produce a non-zero accuracy.
    vi.useFakeTimers()
    vi.setSystemTime(0)

    let lastMidi = 60
    const base = createMockBase({
      // Under fake timers performance.now() is the relative clock; mirror it.
      _getElapsed: () => performance.now(),
      _updateMetrics: (m) => {
        if (typeof m.currentMidi === 'number') lastMidi = m.currentMidi
      },
      // The singer sustains the note currently being matched, in tune, with
      // timestamps ending at "now" so they land inside the match window.
      pitchHistory: () => {
        const nowMs = performance.now()
        const f = midiToFreq(lastMidi)
        return Array.from({ length: 16 }, (_unused, i) => ({
          freq: f,
          time: (nowMs - i * 60) / 1000,
          cents: 0,
          clarity: 80,
        }))
      },
    })
    const ctrl = useIntervalTrainerController(base, audioEngine)

    ctrl.setBase(60)
    ctrl.startRounds()
    await vi.runAllTimersAsync()

    const result = ctrl.computeResult()
    expect(result.metrics.roundsCompleted).toBeGreaterThan(0)
    expect(result.metrics.avgAccuracy).toBeGreaterThan(0)
    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('dispose cancels an in-flight round chain (Back / unmount mid-run)', async () => {
    // Navigating away runs base.reset(), which fires the registered dispose
    // callbacks. The dispose must also flip the controller's cancellation
    // flag: clearing the pending timer alone can't stop a playTone().then()
    // continuation that is in flight — the exercise used to keep playing its
    // whole note sequence after the component was gone.
    vi.useFakeTimers()
    const disposers: Array<() => void> = []
    const playTone = vi.fn().mockResolvedValue(undefined)
    const base = createMockBase({
      _registerDispose: (fn: () => void) => {
        disposers.push(fn)
      },
    })
    const ctrl = useIntervalTrainerController(base, { playTone })

    ctrl.setBase(60)
    ctrl.startRounds()
    // Let the chain get going (first notes + gap timers).
    await vi.advanceTimersByTimeAsync(3000)
    const callsBefore = playTone.mock.calls.length
    expect(callsBefore).toBeGreaterThan(0)

    // What unmount/reset does.
    for (const fn of disposers) fn()

    // Nothing further may play, no matter how long the clock runs.
    await vi.advanceTimersByTimeAsync(120_000)
    expect(playTone.mock.calls.length).toBe(callsBefore)
  })
})
