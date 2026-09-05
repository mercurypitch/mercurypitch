import { afterEach, describe, expect, it, vi } from 'vitest'
import { useStaccatoPrecisionController } from '@/features/exercises/staccato-precision/use-staccato-precision-controller'
import { EXERCISE_STACCATO } from '@/features/exercises/types'
import type { BaseExerciseController } from '@/features/exercises/use-base-exercise'

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

// A4 = MIDI 69 = 440 Hz. Build a trailing window of perfect-pitch samples.
function perfectSamples(
  freq: number,
  count: number,
  startTime = 0,
): Array<{ freq: number; time: number; cents: number }> {
  return Array.from({ length: count }, (_, i) => ({
    freq,
    time: startTime + i * 0.05,
    cents: 0,
  }))
}

describe('useStaccatoPrecisionController', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('computeResult returns zero with the expected metric keys for no rounds', () => {
    const base = createMockBase()
    const audioEngine = { playTone: async () => {} }
    const ctrl = useStaccatoPrecisionController(base, audioEngine)
    const result = ctrl.computeResult()

    expect(result.type).toBe(EXERCISE_STACCATO)
    expect(result.score).toBe(0)
    expect(result.metrics.roundsCompleted).toBe(0)
    expect(result.metrics.avgAccuracy).toBe(0)
    expect(result.metrics.bestRound).toBe(0)
    expect(result.metrics.attackPrecision).toBe(0)
  })

  it('setBase initializes target notes and resets rounds', () => {
    const metricsCalls: Array<Record<string, number>> = []
    const base = createMockBase({
      _updateMetrics: (m) => metricsCalls.push(m),
    })
    const audioEngine = { playTone: async () => {} }
    const ctrl = useStaccatoPrecisionController(base, audioEngine)

    ctrl.setBase(69) // A4 center

    // Fresh setup => no rounds scored yet.
    const result = ctrl.computeResult()
    expect(result.score).toBe(0)
    expect(result.metrics.roundsCompleted).toBe(0)

    // startRounds() should announce the first round via _updateMetrics.
    ctrl.startRounds()
    expect(metricsCalls.length).toBeGreaterThan(0)
    const first = metricsCalls[0]
    expect(first.round).toBe(0)
    expect(first.totalRounds).toBeGreaterThan(0)
    // currentMidi should be at or above the center note (intervals are >= 0).
    expect(first.currentMidi).toBeGreaterThanOrEqual(69)
  })

  it('good performance over the full round loop yields a meaningful score', async () => {
    vi.useFakeTimers()
    let history: Array<{ freq: number; time: number; cents: number }> = []
    let batchClock = 0
    const base = createMockBase({
      pitchHistory: () => history,
    })
    // Whenever a tone is requested, simulate the singer landing perfectly on it
    // by appending in-tune samples. Each batch starts 10s after the previous so
    // the trailing match window (<= 1.5s) only ever captures the current round.
    const audioEngine = {
      playTone: async (freq: number) => {
        batchClock += 10
        history = [...history, ...perfectSamples(freq, 12, batchClock)]
      },
    }
    const ctrl = useStaccatoPrecisionController(base, audioEngine)

    ctrl.setBase(69)
    ctrl.startRounds()
    await vi.runAllTimersAsync()

    const result = ctrl.computeResult()
    expect(result.metrics.roundsCompleted).toBeGreaterThan(0)
    expect(result.score).toBeGreaterThan(40)
    // Perfect pitch => avg accuracy should be at/near the ceiling.
    expect(result.metrics.avgAccuracy).toBeGreaterThan(40)
  })

  it('stopRounds halts running and commits a result', () => {
    const committed: unknown[] = []
    const running: boolean[] = []
    const base = createMockBase({
      _completeWithResult: (r) => committed.push(r),
      _setRunning: (v) => running.push(v),
    })
    const audioEngine = { playTone: async () => {} }
    const ctrl = useStaccatoPrecisionController(base, audioEngine)

    ctrl.setBase(69)
    ctrl.stopRounds()

    expect(running).toContain(false)
    expect(committed.length).toBe(1)
  })
})
