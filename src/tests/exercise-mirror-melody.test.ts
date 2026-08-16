import { describe, expect, it, vi } from 'vitest'
import { useMirrorMelodyController } from '@/features/exercises/mirror-melody/use-mirror-melody-controller'
import { EXERCISE_MIRROR_MELODY } from '@/features/exercises/types'
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

describe('useMirrorMelodyController', () => {
  it('computeResult returns zero for no notes completed', () => {
    const base = createMockBase()
    const audioEngine = { playTone: async () => {} }
    const ctrl = useMirrorMelodyController(base, audioEngine)
    const result = ctrl.computeResult()

    expect(result.type).toBe(EXERCISE_MIRROR_MELODY)
    expect(result.score).toBe(0)
    expect(result.metrics.notesCompleted).toBe(0)
    expect(result.metrics.avgAccuracy).toBe(0)
    expect(result.metrics.bestNote).toBe(0)
  })

  it('setMelody initializes melody state', () => {
    const targetCalls: Array<number | null> = []
    const metricsCalls: Array<Record<string, number>> = []
    const base = createMockBase({
      _setTargetPitch: (midi) => {
        targetCalls.push(midi)
      },
      _updateMetrics: (m) => metricsCalls.push(m),
    })
    const audioEngine = { playTone: async () => {} }

    const ctrl = useMirrorMelodyController(base, audioEngine)
    ctrl.setMelody(69, { min: 36, max: 84 }) // A4

    // setMelody sets target pitch to baseMidi freq
    expect(targetCalls.length).toBe(1)
    expect(targetCalls[0]).toBe(69) // MIDI number for A4
  })

  it('stopSequence commits result and stops', () => {
    const committed: unknown[] = []
    const base = createMockBase({
      _completeWithResult: (r) => committed.push(r),
    })
    const audioEngine = { playTone: async () => {} }

    const ctrl = useMirrorMelodyController(base, audioEngine)
    ctrl.setMelody(69, { min: 36, max: 84 })
    ctrl.stopSequence()

    expect(committed.length).toBe(1)
  })
})

describe("the melody respects the singer's range", () => {
  it('clamps every generated note to the given range, not the old C2-C6 constant', () => {
    // Force the biggest upward step (+9) every time: from A4 the old
    // constant (84) would allow 78, 84, ... — the new clamp holds the
    // singer's actual ceiling.
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    try {
      const metrics: Array<Record<string, number>> = []
      const base = createMockBase({
        _updateMetrics: (m) => metrics.push({ ...m }),
      })
      const ctrl = useMirrorMelodyController(base, { playTone: async () => {} })
      ctrl.setMelody(69, { min: 48, max: 71 })
      void metrics
      // The upcoming list is the whole melody after the first note.
      const upcoming = ctrl.getUpcomingMidi()
      expect(upcoming.length).toBeGreaterThan(0)
      for (const midi of upcoming) {
        expect(midi).toBeLessThanOrEqual(71)
        expect(midi).toBeGreaterThanOrEqual(48)
      }
    } finally {
      spy.mockRestore()
    }
  })
})
