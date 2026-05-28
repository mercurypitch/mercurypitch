import { describe, expect, it } from 'vitest'
import { EXERCISE_VIBRATO } from '@/features/exercises/types'
import type { BaseExerciseController } from '@/features/exercises/use-base-exercise'
import { useVibratoController } from '@/features/exercises/vibrato/use-vibrato-controller'

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

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

describe('useVibratoController', () => {
  it('returns zero score for empty pitch history', () => {
    const base = createMockBase({ pitchHistory: () => [] })
    const ctrl = useVibratoController(base)
    const result = ctrl.computeResult()
    expect(result.type).toBe(EXERCISE_VIBRATO)
    expect(result.score).toBe(0)
  })

  it('returns low score for very short history (less than 10 samples)', () => {
    const base = createMockBase({
      pitchHistory: () => [
        { freq: 440, time: 0, cents: 0 },
        { freq: 440, time: 0.1, cents: 0 },
        { freq: 440, time: 0.2, cents: 0 },
      ],
    })
    const ctrl = useVibratoController(base)
    const result = ctrl.computeResult()

    // Less than 10 samples → direct return with score 0
    expect(result.score).toBe(0)
  })

  it('detects vibrato in pitch oscillations', () => {
    // Generate a pitch history with 5 Hz vibrato at A4, ±30 cents depth
    const history: Array<{ freq: number; time: number; cents: number }> = []
    const sampleRate = 100 // samples per second
    const duration = 2 // seconds
    const baseMidi = 69 // A4
    const vibratoRate = 5 // Hz
    const vibratoDepth = 30 // cents

    for (let i = 0; i < sampleRate * duration; i++) {
      const time = i / sampleRate
      const cents = Math.sin(2 * Math.PI * vibratoRate * time) * vibratoDepth
      const midi = baseMidi + cents / 100
      const freq = midiToFreq(midi)
      history.push({ freq, time, cents })
    }

    const base = createMockBase({ pitchHistory: () => history })
    const ctrl = useVibratoController(base)
    const result = ctrl.computeResult()

    // Should detect vibrato and give a score
    expect(result.type).toBe(EXERCISE_VIBRATO)
    // The rate and depth should be close to what we generated
    expect(result.metrics.rateHz).toBeGreaterThan(0)
    expect(result.metrics.depthCents).toBeGreaterThan(0)
  })

  it('gives high score for ideal vibrato (4-7 Hz, 10-50 cents)', () => {
    const history: Array<{ freq: number; time: number; cents: number }> = []
    const sampleRate = 100
    const duration = 2
    const baseMidi = 69
    const vibratoRate = 5.5 // ideal range: 4-7
    const vibratoDepth = 30 // ideal range: 10-50

    for (let i = 0; i < sampleRate * duration; i++) {
      const time = i / sampleRate
      const cents = Math.sin(2 * Math.PI * vibratoRate * time) * vibratoDepth
      const midi = baseMidi + cents / 100
      const freq = midiToFreq(midi)
      history.push({ freq, time, cents })
    }

    const base = createMockBase({ pitchHistory: () => history })
    const ctrl = useVibratoController(base)
    const result = ctrl.computeResult()

    // Ideal vibrato should score high
    expect(result.score).toBeGreaterThan(60)
    expect(result.metrics.classification).toBeGreaterThan(0)
  })

  it('gives low score for no vibrato (steady pitch)', () => {
    const history: Array<{ freq: number; time: number; cents: number }> = []
    for (let i = 0; i < 200; i++) {
      history.push({ freq: 440, time: i * 0.01, cents: 0 })
    }

    const base = createMockBase({ pitchHistory: () => history })
    const ctrl = useVibratoController(base)
    const result = ctrl.computeResult()

    // No vibrato should score 10 (the "not detected" score)
    expect(result.score).toBe(10)
    expect(result.metrics.classification).toBe(0)
  })

  it('stopAndCompute commits the result', () => {
    const committed: unknown[] = []
    const history: Array<{ freq: number; time: number; cents: number }> = []

    for (let i = 0; i < 200; i++) {
      const time = i * 0.01
      const cents = Math.sin(2 * Math.PI * 5 * time) * 30
      const midi = 69 + cents / 100
      history.push({ freq: midiToFreq(midi), time, cents })
    }

    const base = createMockBase({
      pitchHistory: () => history,
      _completeWithResult: (r) => committed.push(r),
    })
    const ctrl = useVibratoController(base)
    const result = ctrl.stopAndCompute()

    expect(committed.length).toBe(1)
    expect(result.type).toBe(EXERCISE_VIBRATO)
  })
})
