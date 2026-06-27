import { describe, expect, it, vi } from 'vitest'
import { useCallResponseController } from '@/features/exercises/call-response/use-call-response-controller'
import { EXERCISE_CALL_RESPONSE } from '@/features/exercises/types'
import type { BaseExerciseController } from '@/features/exercises/use-base-exercise'
import { midiToFrequency } from '@/lib/frequency-to-note'

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
    start: async () => {},
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

const audioEngineMock = { playTone: async () => {} }

describe('useCallResponseController', () => {
  it('computeResult returns zero floor with real metric keys for empty history', () => {
    const base = createMockBase()
    const ctrl = useCallResponseController(base, audioEngineMock)
    const result = ctrl.computeResult()

    expect(result.type).toBe(EXERCISE_CALL_RESPONSE)
    expect(result.score).toBe(0)
    expect(result.metrics.roundsCompleted).toBe(0)
    expect(result.metrics.avgAccuracy).toBe(0)
    expect(result.metrics.bestRound).toBe(0)
  })

  it('setBase + startRounds opens with the key note in the listening phase', async () => {
    vi.useFakeTimers()
    try {
      const metrics: Array<Record<string, number>> = []
      const base = createMockBase({
        _updateMetrics: (m) => metrics.push({ ...m }),
      })
      const ctrl = useCallResponseController(base, audioEngineMock)

      ctrl.setBase(60) // C4 key
      ctrl.startRounds()
      // Flush the initial metric burst before any note plays out.
      await vi.advanceTimersByTimeAsync(1)

      const first = metrics[0] ?? {}
      // The first phrase note is always the key (baseMidi); rounds are
      // deterministic at difficulty 5 even though phrase length is random.
      expect(first.currentMidi).toBe(60)
      expect(first.totalRounds).toBe(5)
      expect(first.phase).toBe(1) // listening
    } finally {
      vi.useRealTimers()
    }
  })

  it('scores high when the singer reproduces every phrase note', async () => {
    vi.useFakeTimers()
    try {
      // Capture every note the call phrase announces via currentMidi, then
      // feed back a pitch history covering all of them in the response window.
      const announced: number[] = []
      const base = createMockBase({
        _updateMetrics: (m) => {
          if (typeof m.currentMidi === 'number') announced.push(m.currentMidi)
        },
        pitchHistory: () => {
          const nowSec = performance.now() / 1000
          const samples: Array<{ freq: number; time: number; cents: number }> =
            []
          let t = nowSec - 2
          for (const midi of new Set(announced)) {
            const freq = midiToFrequency(midi)
            for (let i = 0; i < 10; i++) {
              samples.push({ freq, time: t, cents: 0 })
              t += 0.02
            }
          }
          return samples
        },
      })
      const ctrl = useCallResponseController(base, audioEngineMock)

      ctrl.setBase(60)
      ctrl.startRounds()
      await vi.advanceTimersByTimeAsync(120000)

      const result = ctrl.computeResult()
      expect(result.metrics.roundsCompleted).toBe(5)
      expect(result.metrics.avgAccuracy).toBe(100)
      expect(result.metrics.bestRound).toBe(100)
      // avgAccuracy*0.5 + bestRound*0.25 + richness*0.25; richness is 0 with no
      // clarity samples, so score caps at 75 here. Well above the threshold.
      expect(result.score).toBeGreaterThan(40)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stopRounds completes with a result', () => {
    const completed: unknown[] = []
    const base = createMockBase({
      _completeWithResult: (r) => completed.push(r),
    })
    const ctrl = useCallResponseController(base, audioEngineMock)

    ctrl.setBase(60)
    ctrl.stopRounds()

    expect(completed.length).toBe(1)
  })
})
