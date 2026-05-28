import { describe, expect, it } from 'vitest'
import { useMirrorMelodyController } from '@/features/exercises/mirror-melody/use-mirror-melody-controller'
import { EXERCISE_MIRROR_MELODY } from '@/features/exercises/types'
import type { BaseExerciseController } from '@/features/exercises/use-base-exercise'

function createMockBase(
  overrides: Partial<BaseExerciseController> = {},
): BaseExerciseController {
  const mock: BaseExerciseController = {
    pitchHistory: () => [],
    _setTargetPitch: () => {},
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
    const targetCalls: number[] = []
    const metricsCalls: Array<Record<string, number>> = []
    const base = createMockBase({
      _setTargetPitch: (midi) => targetCalls.push(midi),
      _updateMetrics: (m) => metricsCalls.push(m),
    })
    const audioEngine = { playTone: async () => {} }

    const ctrl = useMirrorMelodyController(base, audioEngine)
    ctrl.setMelody(69) // A4

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
    ctrl.setMelody(69)
    ctrl.stopSequence()

    expect(committed.length).toBe(1)
  })
})
