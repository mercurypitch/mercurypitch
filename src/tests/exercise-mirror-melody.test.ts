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

    // setMelody arms the target pitch with the base note's FREQUENCY -
    // this pin used to demand the raw MIDI number, which is the bug.
    expect(targetCalls.length).toBe(1)
    expect(targetCalls[0]).toBe(440) // A4 in Hz
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

describe('the grade carries no richness', () => {
  it('grades four exact notes and one 4 cents off at 73, not 74', async () => {
    vi.useFakeTimers()
    try {
      // Arrange: notes 100, 100, 100, 100 and 94 (4 cents off), with the
      // detector's realistic clarity (0 to 1). Average 99, best 100,
      // consistency 95: 0.35 x 99 + 0.15 x 100 + 0.25 x 95 = 73.4. The
      // richness term read 0.9 clarity as 1 and added 0.25: 73.65, so 74.
      let targetFreq = 0
      let notesDone = 0
      let sampleClock = 100
      const base = createMockBase({
        _setTargetPitch: ((v: number | null) => {
          if (v != null && v > 0) targetFreq = v
          return v
        }) as BaseExerciseController['_setTargetPitch'],
        _updateMetrics: (m) => {
          if (typeof m.notesCompleted === 'number') notesDone = m.notesCompleted
        },
        pitchHistory: () => {
          const cents = notesDone === 4 ? 4 : 0
          const samples = []
          for (let i = 0; i < 30; i++) {
            sampleClock += 0.01
            samples.push({
              freq: targetFreq * 2 ** (cents / 1200),
              time: sampleClock,
              cents,
              clarity: 0.9,
            })
          }
          return samples
        },
      })
      const ctrl = useMirrorMelodyController(base, { playTone: async () => {} })
      ctrl.setMelody(60, { min: 36, max: 84 })

      // Act
      ctrl.startSequence()
      await vi.advanceTimersByTimeAsync(60000)
      const result = ctrl.computeResult()

      // Assert
      expect(result.metrics.notesCompleted).toBe(5)
      expect(result.metrics.avgAccuracy).toBe(99)
      expect(result.metrics.consistency).toBe(95)
      expect(result.metrics.richnessScore).toBe(1)
      expect(result.score).toBe(73)
    } finally {
      vi.useRealTimers()
    }
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

describe('the trace speaks Hz', () => {
  it('setMelody arms the first target in Hz, never as a raw MIDI number', () => {
    const seen: Array<number | null> = []
    const base = createMockBase({
      _setTargetPitch: (v) => {
        seen.push(v)
      },
    })
    const ctrl = useMirrorMelodyController(base, {
      playTone: async () => {},
    })
    ctrl.setMelody(69, { min: 36, max: 84 }) // A4
    expect(seen).toEqual([440])
  })
})
