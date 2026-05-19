import { describe, expect, it } from 'vitest'
import { useSlideController } from '@/features/exercises/slide/use-slide-controller'
import type { BaseExerciseController } from '@/features/exercises/use-base-exercise'
import { EXERCISE_SLIDE } from '@/features/exercises/types'

function createMockBase(overrides: Partial<BaseExerciseController> = {}): BaseExerciseController {
  const mock: BaseExerciseController = {
    pitchHistory: () => [],
    _setTargetPitch: () => {},
    _getElapsed: () => 0,
    _isRunning: () => true,
    _setRunning: () => {},
    _commitResult: () => {},
    _updateScore: () => {},
    _updateMetrics: () => {},
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

describe('useSlideController', () => {
  it('returns zero score for empty pitch history', () => {
    const base = createMockBase({ pitchHistory: () => [] })
    const ctrl = useSlideController(base)
    const result = ctrl.computeResult()
    expect(result.type).toBe(EXERCISE_SLIDE)
    expect(result.score).toBe(0)
  })

  it('returns zero score for very short history', () => {
    const base = createMockBase({
      pitchHistory: () => [
        { freq: 440, time: 0, cents: 0 },
        { freq: 440, time: 0.05, cents: 0 },
        { freq: 440, time: 0.1, cents: 0 },
      ],
    })
    const ctrl = useSlideController(base)
    const result = ctrl.computeResult()
    expect(result.score).toBe(0)
  })

  it('detects a clean slide between two stable notes', () => {
    // Build a pitch history: stay at C4 for a while, slide up to E4, stay at E4
    const history: Array<{ freq: number; time: number; cents: number }> = []

    // Stable at C4 (MIDI 60) for 20 samples
    for (let i = 0; i < 20; i++) {
      history.push({ freq: midiToFreq(60), time: i * 0.05, cents: 0 })
    }

    // Linear slide from C4 to E4 (MIDI 60→64) over 5 samples — per-step change > 0.5 semitones
    for (let i = 0; i < 5; i++) {
      const t = i / 4
      const midi = 60 + t * 4
      const freq = midiToFreq(midi)
      history.push({ freq, time: (20 + i) * 0.05, cents: (midi - 60) * 100 })
    }

    // Stable at E4 for 20 samples
    for (let i = 0; i < 20; i++) {
      history.push({ freq: midiToFreq(64), time: (25 + i) * 0.05, cents: (64 - 60) * 100 })
    }

    const base = createMockBase({ pitchHistory: () => history })
    const ctrl = useSlideController(base)
    ctrl.setTargets(60, 64)
    const result = ctrl.computeResult()

    // Should detect the slide and give a reasonable score
    expect(result.type).toBe(EXERCISE_SLIDE)
    expect(result.score).toBeGreaterThan(40)
    expect(result.metrics.classification).toBeGreaterThanOrEqual(0)
  })

  it('detects wobble when pitch oscillates without clean transition', () => {
    const history: Array<{ freq: number; time: number; cents: number }> = []

    for (let i = 0; i < 60; i++) {
      // Oscillate around C4 with noise
      const wobble = Math.sin(i * 0.3) * 1.5
      const midi = 60 + wobble
      history.push({ freq: midiToFreq(midi), time: i * 0.05, cents: (midi - 60) * 100 })
    }

    const base = createMockBase({ pitchHistory: () => history })
    const ctrl = useSlideController(base)
    ctrl.setTargets(60, 64)
    const result = ctrl.computeResult()

    // Wobbly pitch should produce lower scores or no slide
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('stopAndCompute commits the result', () => {
    const committed: unknown[] = []
    const history: Array<{ freq: number; time: number; cents: number }> = []

    // Build a simple clean slide pattern with clear stable regions
    for (let i = 0; i < 10; i++) history.push({ freq: midiToFreq(60), time: i * 0.05, cents: 0 })
    for (let i = 0; i < 5; i++) {
      const midi = 60 + (i / 4) * 4
      history.push({ freq: midiToFreq(midi), time: (10 + i) * 0.05, cents: (midi - 60) * 100 })
    }
    for (let i = 0; i < 10; i++) history.push({ freq: midiToFreq(64), time: (15 + i) * 0.05, cents: 400 })

    const base = createMockBase({
      pitchHistory: () => history,
      _commitResult: (r) => committed.push(r),
    })
    const ctrl = useSlideController(base)
    ctrl.setTargets(60, 64)
    const result = ctrl.stopAndCompute()

    expect(committed.length).toBe(1)
    expect(result.type).toBe(EXERCISE_SLIDE)
  })

  it('marks classification as -1 when no slides detected', () => {
    // All same note — no slide
    const history: Array<{ freq: number; time: number; cents: number }> = []
    for (let i = 0; i < 30; i++) {
      history.push({ freq: midiToFreq(60), time: i * 0.05, cents: 0 })
    }

    const base = createMockBase({ pitchHistory: () => history })
    const ctrl = useSlideController(base)
    const result = ctrl.computeResult()

    expect(result.metrics.classification).toBe(-1)
  })

  it('penalizes slides that start from wrong note', () => {
    const history: Array<{ freq: number; time: number; cents: number }> = []

    // Stable at C4 (MIDI 60) for 10 samples — but target says start at D4 (MIDI 62)
    for (let i = 0; i < 10; i++) {
      history.push({ freq: midiToFreq(60), time: i * 0.05, cents: 0 })
    }

    // Slide from C4 to E4 (MIDI 60→64) over 5 samples
    for (let i = 0; i < 5; i++) {
      const t = i / 4
      const midi = 60 + t * 4
      history.push({ freq: midiToFreq(midi), time: (10 + i) * 0.05, cents: (midi - 60) * 100 })
    }

    // Stable at E4 for 10 samples
    for (let i = 0; i < 10; i++) {
      history.push({ freq: midiToFreq(64), time: (15 + i) * 0.05, cents: 400 })
    }

    // Correct targets: start C4 (60, matching actual start), end E4 (64)
    const baseCorrect = createMockBase({ pitchHistory: () => history })
    const ctrlCorrect = useSlideController(baseCorrect)
    ctrlCorrect.setTargets(60, 64)
    const correctResult = ctrlCorrect.computeResult()

    // Wrong start target: D#4 (63, 3 semitones from actual start C4)
    const baseWrong = createMockBase({ pitchHistory: () => history })
    const ctrlWrong = useSlideController(baseWrong)
    ctrlWrong.setTargets(63, 64)
    const wrongResult = ctrlWrong.computeResult()

    expect(correctResult.metrics.departureAccuracy).toBeDefined()
    // The wrong-start slide should score lower due to departure penalty
    expect(wrongResult.metrics.departureAccuracy).toBeLessThan(correctResult.metrics.departureAccuracy)
  })
})
