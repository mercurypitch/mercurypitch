import { describe, expect, it } from 'vitest'
import { useLongNoteController } from '@/features/exercises/long-note/use-long-note-controller'
import type { BaseExerciseController } from '@/features/exercises/use-base-exercise'
import { EXERCISE_LONG_NOTE } from '@/features/exercises/types'

function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / 440) + 69
}

function makePitchHistory(
  baseFreq: number,
  numSamples: number,
  jitterCents = 0,
): Array<{ freq: number; time: number; cents: number }> {
  const samples: Array<{ freq: number; time: number; cents: number }> = []
  for (let i = 0; i < numSamples; i++) {
    const jitterSemitones = (Math.random() - 0.5) * 2 * (jitterCents / 100)
    const freq = baseFreq * Math.pow(2, jitterSemitones / 12)
    const midi = freqToMidi(freq)
    const targetMidi = freqToMidi(baseFreq)
    samples.push({
      freq,
      time: i * 0.05,
      cents: (midi - targetMidi) * 100,
    })
  }
  return samples
}

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

describe('useLongNoteController', () => {
  it('returns zero score for empty pitch history', () => {
    const base = createMockBase({ pitchHistory: () => [] })
    const ctrl = useLongNoteController(base)
    const result = ctrl.computeResult()
    expect(result.type).toBe(EXERCISE_LONG_NOTE)
    expect(result.score).toBe(0)
  })

  it('returns zero score for single-sample history', () => {
    const base = createMockBase({
      pitchHistory: () => [{ freq: 440, time: 0, cents: 0 }],
    })
    const ctrl = useLongNoteController(base)
    const result = ctrl.computeResult()
    expect(result.score).toBe(0)
  })

  it('gives high score for perfectly stable pitch at A4', () => {
    const samples = makePitchHistory(440, 100, 1) // 100 samples, tiny jitter
    const base = createMockBase({
      pitchHistory: () => samples,
      _getElapsed: () => 5000,
    })
    const ctrl = useLongNoteController(base)
    ctrl.setTarget(freqToMidi(440))
    const result = ctrl.computeResult()
    expect(result.score).toBeGreaterThan(80)
    expect(result.metrics.durationSec).toBe(5)
    expect(result.metrics.pitchStabilityCents).toBeLessThan(10)
    expect(result.metrics.steadyZonePct).toBeGreaterThan(80)
  })

  it('gives low score for unstable pitch with large drift', () => {
    const samples = makePitchHistory(440, 100, 60) // large jitter
    const base = createMockBase({
      pitchHistory: () => samples,
      _getElapsed: () => 5000,
    })
    const ctrl = useLongNoteController(base)
    ctrl.setTarget(freqToMidi(440))
    const result = ctrl.computeResult()
    expect(result.metrics.pitchStabilityCents).toBeGreaterThan(15)
    expect(result.score).toBeLessThan(70)
  })

  it('calculates max drift correctly', () => {
    // Steady at 440 for most samples, with one sharp outlier
    const samples: Array<{ freq: number; time: number; cents: number }> = []
    for (let i = 0; i < 50; i++) {
      samples.push({ freq: 440, time: i * 0.05, cents: 0 })
    }
    // One wild outlier: 50 cents sharp
    const sharpFreq = 440 * Math.pow(2, 0.5 / 12)
    samples.push({ freq: sharpFreq, time: 2.55, cents: 50 })
    for (let i = 51; i < 100; i++) {
      samples.push({ freq: 440, time: i * 0.05, cents: 0 })
    }

    const base = createMockBase({
      pitchHistory: () => samples,
      _getElapsed: () => 5000,
    })
    const ctrl = useLongNoteController(base)
    ctrl.setTarget(freqToMidi(440))
    const result = ctrl.computeResult()
    expect(result.metrics.maxDriftCents).toBeGreaterThanOrEqual(45)
  })

  it('stopAndCompute commits result and sets complete', () => {
    const committed: unknown[] = []
    const base = createMockBase({
      pitchHistory: () => makePitchHistory(440, 50, 5),
      _getElapsed: () => 3000,
      _completeWithResult: (r) => committed.push(r),
    })
    const ctrl = useLongNoteController(base)
    ctrl.setTarget(freqToMidi(440))
    const result = ctrl.stopAndCompute()
    expect(result.type).toBe(EXERCISE_LONG_NOTE)
    expect(committed.length).toBe(1)
  })

  it('duration score grows with longer hold times', () => {
    const short = makePitchHistory(440, 40, 5)
    const long = makePitchHistory(440, 100, 5)

    const baseShort = createMockBase({
      pitchHistory: () => short,
      _getElapsed: () => 2000,
    })
    const ctrlShort = useLongNoteController(baseShort)
    ctrlShort.setTarget(freqToMidi(440))

    const baseLong = createMockBase({
      pitchHistory: () => long,
      _getElapsed: () => 5000,
    })
    const ctrlLong = useLongNoteController(baseLong)
    ctrlLong.setTarget(freqToMidi(440))

    // Same stability, longer duration should score higher
    const resultShort = ctrlShort.computeResult()
    const resultLong = ctrlLong.computeResult()
    expect(resultLong.score).toBeGreaterThan(resultShort.score)
  })
})
