import { describe, expect, it, vi } from 'vitest'
import { useDroneIntonationController } from '@/features/exercises/drone-intonation/use-drone-intonation-controller'
import { pitchStabilityCents } from '@/features/exercises/exercise-scoring-utils'
import { EXERCISE_DRONE_INTONATION } from '@/features/exercises/types'
import type { BaseExerciseController } from '@/features/exercises/use-base-exercise'
import { midiToFrequency } from '@/lib/frequency-to-note'

describe('pitchStabilityCents (per-note steadiness)', () => {
  it('is ~0 for a rock-steady note', () => {
    expect(pitchStabilityCents([440, 440, 440, 440])).toBeCloseTo(0, 5)
  })

  it('grows with wobble (cents std-dev around the mean)', () => {
    // G#4, A4, A#4, A4 → ±~1 semitone wobble → ~70 cents std-dev.
    expect(pitchStabilityCents([415.3, 440, 466.16, 440])).toBeGreaterThan(50)
  })

  it('returns 0 for fewer than two voiced samples', () => {
    expect(pitchStabilityCents([])).toBe(0)
    expect(pitchStabilityCents([440])).toBe(0)
    expect(pitchStabilityCents([0, 0])).toBe(0)
  })
})

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

// Convert a frequency back to the nearest MIDI integer (inverse of the
// controller's midiToFreq) so we can assert on what the controller targeted.
function freqToMidiApprox(freq: number): number {
  return Math.round(12 * Math.log2(freq / 440) + 69)
}

// The intervals the controller can pick above the drone (see INTERVALS).
const VALID_INTERVALS = new Set([0, 3, 4, 5, 7, 12])

const audioEngineMock = {
  playTone: async () => {},
  stopTone: () => {},
}

describe('useDroneIntonationController', () => {
  it('computeResult returns zero floor with real metric keys for empty history', () => {
    const base = createMockBase()
    const ctrl = useDroneIntonationController(base, audioEngineMock)
    const result = ctrl.computeResult()

    expect(result.type).toBe(EXERCISE_DRONE_INTONATION)
    expect(result.score).toBe(0)
    expect(result.metrics.roundsCompleted).toBe(0)
    expect(result.metrics.avgAccuracy).toBe(0)
    expect(result.metrics.bestRound).toBe(0)
    expect(result.metrics.stabilityCents).toBe(0)
    expect(result.metrics.richnessScore).toBe(0)
  })

  it('setBase + startRounds targets a valid interval above the drone note', async () => {
    vi.useFakeTimers()
    try {
      const targets: number[] = []
      const metrics: Array<Record<string, number>> = []
      const base = createMockBase({
        _setTargetPitch: ((v: number | null) => {
          if (typeof v === 'number' && v > 0) targets.push(freqToMidiApprox(v))
          return v
        }) as BaseExerciseController['_setTargetPitch'],
        _updateMetrics: (m) => metrics.push({ ...m }),
      })
      const ctrl = useDroneIntonationController(base, audioEngineMock)

      ctrl.setBase(60) // C4 drone
      await ctrl.startRounds()
      // Let only the first round set up (it sets target then waits the
      // match window before evaluating).
      await vi.advanceTimersByTimeAsync(10)

      const first = metrics[0] ?? {}
      // Drone note and round count are deterministic at difficulty 5.
      expect(first.droneMidi).toBe(60)
      expect(first.totalRounds).toBe(6)
      // The matched target is drone + a valid interval (interval is random).
      expect(targets.length).toBeGreaterThan(0)
      const interval = targets[0] - 60
      expect(VALID_INTERVALS.has(interval)).toBe(true)
      expect(first.currentMidi).toBe(targets[0])
    } finally {
      vi.useRealTimers()
    }
  })

  it('scores high when the singer holds the target across every round', async () => {
    vi.useFakeTimers()
    try {
      // Track the current target MIDI the controller asks for, then feed back
      // a pitch history that sings exactly that note.
      let targetMidi = 60
      const base = createMockBase({
        _setTargetPitch: ((v: number | null) => {
          if (typeof v === 'number' && v > 0) {
            targetMidi = Math.round(12 * Math.log2(v / 440) + 69)
          }
          return v
        }) as BaseExerciseController['_setTargetPitch'],
        pitchHistory: () => {
          const freq = midiToFrequency(targetMidi)
          const samples = []
          for (let i = 0; i < 80; i++) {
            samples.push({ freq, time: 100 + i * 0.05, cents: 0 })
          }
          return samples
        },
      })
      const ctrl = useDroneIntonationController(base, audioEngineMock)

      ctrl.setBase(60)
      await ctrl.startRounds()
      // Advance well past all six rounds (each ~ match window + gaps).
      await vi.advanceTimersByTimeAsync(80000)

      const result = ctrl.computeResult()
      expect(result.metrics.roundsCompleted).toBe(6)
      expect(result.metrics.avgAccuracy).toBe(100)
      expect(result.metrics.bestRound).toBe(100)
      // Perfect accuracy/stability but no clarity samples (richness 0), so the
      // weighted score caps at 80 here. Comfortably above the 40 threshold.
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
    const ctrl = useDroneIntonationController(base, audioEngineMock)

    ctrl.setBase(60)
    ctrl.stopRounds()

    expect(completed.length).toBe(1)
  })
})
