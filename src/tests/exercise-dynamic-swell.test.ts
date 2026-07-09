import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDynamicSwellController } from '@/features/exercises/dynamic-swell/use-dynamic-swell-controller'
import { EXERCISE_DYNAMIC_SWELL } from '@/features/exercises/types'
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

// MIDI -> Hz, matching the controller's internal conversion.
function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

describe('useDynamicSwellController', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('computeResult returns zero with the expected metric keys for no rounds', () => {
    const base = createMockBase()
    const audioEngine = { playTone: async () => {} }
    const ctrl = useDynamicSwellController(base, audioEngine)
    const result = ctrl.computeResult()

    expect(result.type).toBe(EXERCISE_DYNAMIC_SWELL)
    expect(result.score).toBe(0)
    expect(result.metrics.roundsCompleted).toBe(0)
    expect(result.metrics.avgAccuracy).toBe(0)
    expect(result.metrics.bestRound).toBe(0)
  })

  it('setBase initializes target notes and announces the first round', () => {
    const metricsCalls: Array<Record<string, number>> = []
    const targetCalls: Array<number | null> = []
    const base = createMockBase({
      _updateMetrics: (m) => metricsCalls.push(m),
      _setTargetPitch: (v) => {
        targetCalls.push(v)
      },
    })
    const audioEngine = { playTone: async () => {} }
    const ctrl = useDynamicSwellController(base, audioEngine)

    ctrl.setBase(60) // C4

    // Fresh setup => nothing scored yet.
    expect(ctrl.computeResult().metrics.roundsCompleted).toBe(0)

    ctrl.startRounds()

    // First round metrics announced.
    const roundMeta = metricsCalls.find((m) => m.totalRounds !== undefined)
    expect(roundMeta).toBeDefined()
    // INTERVALS = [0, 2, 4, 7] => four shuffled rounds.
    expect(roundMeta?.totalRounds).toBe(4)
    expect(roundMeta?.round).toBe(0)

    // First target pitch is one of the four interval notes above the base.
    const expectedFreqs = [0, 2, 4, 7].map((i) => midiToFreq(60 + i))
    expect(targetCalls.length).toBeGreaterThan(0)
    const got = targetCalls[0]
    expect(expectedFreqs.some((f) => Math.abs(f - (got ?? -1)) < 1e-6)).toBe(
      true,
    )
  })

  it('empty-input floor still emits the loudness metrics as 0 (stable shape)', () => {
    // The no-rounds floor returns the SAME metric keys as the populated path,
    // with the loudness metrics zeroed, so consumers can rely on a stable shape.
    const base = createMockBase()
    const audioEngine = { playTone: async () => {} }
    const ctrl = useDynamicSwellController(base, audioEngine)

    const empty = ctrl.computeResult()
    expect(empty.metrics.dynamicRangeDb).toBe(0)
    expect(empty.metrics.avgDb).toBe(0)
    expect(empty.metrics.peakDb).toBe(0)
  })

  it('good performance over the full hold loop yields a meaningful score', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    let history: Array<{
      freq: number
      time: number
      cents: number
      clarity: number
    }> = []
    const base = createMockBase({
      pitchHistory: () => history,
      // The controller measures the hold window against its exercise-relative
      // clock (_getElapsed), the same epoch as each sample's `.time`. Under fake
      // timers performance.now() is the relative clock, so mirror it here.
      _getElapsed: () => performance.now(),
    })
    // During each hold phase the singer sustains the target in tune. We append
    // samples whose `time` (seconds) tracks the fake clock so the hold-window
    // filter (which compares p.time * 1000 to _getElapsed()) keeps them.
    const audioEngine = {
      playTone: async (freq: number) => {
        const nowMs = performance.now()
        for (let i = 0; i < 16; i++) {
          const tMs = nowMs + i * 100
          history = [
            ...history,
            {
              freq,
              time: tMs / 1000,
              cents: 0,
              clarity: 50 + (i % 8) * 6,
            },
          ]
        }
      },
    }
    const ctrl = useDynamicSwellController(base, audioEngine)

    ctrl.setBase(60)
    ctrl.startRounds()
    await vi.runAllTimersAsync()

    const result = ctrl.computeResult()
    expect(result.metrics.roundsCompleted).toBeGreaterThan(0)
    // Full metric key set is present once rounds were scored.
    expect(result.metrics.dynamicRangeDb).not.toBeUndefined()
    expect(result.metrics.avgDb).not.toBeUndefined()
    expect(result.metrics.peakDb).not.toBeUndefined()
    expect(result.metrics.avgAccuracy).toBeGreaterThan(40)
    expect(result.score).toBeGreaterThan(40)
  })

  it('stopRounds halts running and commits a result', () => {
    const committed: unknown[] = []
    const running: boolean[] = []
    const base = createMockBase({
      _completeWithResult: (r) => committed.push(r),
      _setRunning: (v) => running.push(v),
    })
    const audioEngine = { playTone: async () => {} }
    const ctrl = useDynamicSwellController(base, audioEngine)

    ctrl.setBase(60)
    ctrl.stopRounds()

    expect(running).toContain(false)
    expect(committed.length).toBe(1)
  })
})
