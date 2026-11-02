import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDroneIntonationController } from '@/features/exercises/drone-intonation/use-drone-intonation-controller'
import { exerciseScoringVersion } from '@/features/exercises/exercise-comparability'
import { pitchStabilityCents } from '@/features/exercises/exercise-scoring-utils'
import type { ExerciseResult } from '@/features/exercises/types'
import { EXERCISE_DRONE_INTONATION } from '@/features/exercises/types'
import type { BaseExerciseController } from '@/features/exercises/use-base-exercise'
import { computeEma } from '@/features/practice-intelligence/adaptive-difficulty'
import { updateDifficultyFromEma } from '@/features/practice-intelligence/difficulty-store'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { applyPersistedValue } from '@/lib/storage'

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

/**
 * Hold every round's target `centsSharp` off and dead steady, over a C4
 * drone, and return the result. The singer follows whatever note the drill
 * asks for, with the detector's realistic clarity (0 to 1). Runs on fake
 * timers.
 */
async function holdRounds(centsSharp: number): Promise<ExerciseResult> {
  let targetMidi = 60
  const base = createMockBase({
    _setTargetPitch: ((v: number | null) => {
      if (typeof v === 'number' && v > 0) {
        targetMidi = Math.round(12 * Math.log2(v / 440) + 69)
      }
      return v
    }) as BaseExerciseController['_setTargetPitch'],
    pitchHistory: () => {
      const freq = midiToFrequency(targetMidi) * 2 ** (centsSharp / 1200)
      const samples = []
      for (let i = 0; i < 80; i++) {
        samples.push({
          freq,
          time: 100 + i * 0.05,
          cents: centsSharp,
          clarity: 0.9,
        })
      }
      return samples
    },
  })
  const ctrl = useDroneIntonationController(base, audioEngineMock)
  ctrl.setBase(60)
  await ctrl.startRounds()
  // Well past all six rounds (each its match window and a gap).
  await vi.advanceTimersByTimeAsync(80000)
  return ctrl.computeResult()
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

  it('grades six rounds held on pitch at 100', async () => {
    vi.useFakeTimers()
    try {
      // Act
      const result = await holdRounds(0)

      // Assert: every round dead on and dead steady.
      expect(result.metrics.roundsCompleted).toBe(6)
      expect(result.metrics.avgAccuracy).toBe(100)
      expect(result.metrics.bestRound).toBe(100)
      expect(result.metrics.stabilityCents).toBe(0)
      // Version 1's weights summed to 0.8, so this run graded 80.
      expect(result.score).toBe(100)
    } finally {
      vi.useRealTimers()
    }
  })

  it('grades six rounds 20 cents sharp at 79, with no richness in it', async () => {
    vi.useFakeTimers()
    try {
      // Each round scores 100 - 1.5 x 20 = 70 and stability scores 100, so
      // the grade is 0.5 x 70 + 0.1875 x 70 + 0.3125 x 100 = 79.375, so 79.
      // The richness term reads 0.9 clarity as 1: back in the grade at its
      // old 0.2, it would make 79.575, so 80.

      // Act
      const result = await holdRounds(20)

      // Assert
      expect(result.metrics.avgAccuracy).toBe(70)
      expect(result.metrics.richnessScore).toBe(1)
      expect(result.score).toBe(79)
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

describe('Drone Intonation runs graded the old way are set aside', () => {
  const HISTORY_KEY = 'mercurypitch_exercise_history'
  /** Twelve runs graded the old way, every one held at its cap of 80. */
  const oldRuns = Array.from({ length: 12 }, (_, i) => ({
    type: EXERCISE_DRONE_INTONATION,
    score: 80,
    metrics: {},
    completedAt: 1000 - i,
  }))
  const resetLevels = () => {
    applyPersistedValue('mercurypitch_exercise_difficulty', JSON.stringify({}))
    applyPersistedValue(
      'mercurypitch_exercise_difficulty_adjusted_at',
      JSON.stringify({}),
    )
  }

  beforeEach(() => {
    vi.useFakeTimers()
    resetLevels()
    applyPersistedValue(HISTORY_KEY, JSON.stringify(oldRuns))
  })
  afterEach(() => {
    vi.useRealTimers()
    resetLevels()
    applyPersistedValue(HISTORY_KEY, JSON.stringify([]))
  })

  it('steps the level up after five flawless runs', async () => {
    // Arrange: five flawless runs, stamped with the drill's scoring.
    const runs = []
    for (let i = 0; i < 5; i++) {
      const result = await holdRounds(0)
      runs.unshift({
        type: result.type,
        score: result.score,
        metrics: result.metrics,
        completedAt: 2000 + i,
        scoringVersion: exerciseScoringVersion(result.type),
      })
    }
    applyPersistedValue(HISTORY_KEY, JSON.stringify([...runs, ...oldRuns]))

    // Act
    const level = updateDifficultyFromEma(EXERCISE_DRONE_INTONATION)

    // Assert: version 1 held every run under the step-up line of 90, and
    // its runs no longer pull the average down.
    expect(runs.map((r) => r.score)).toEqual([100, 100, 100, 100, 100])
    expect(computeEma(EXERCISE_DRONE_INTONATION)).toBe(100)
    expect(level).toBe(6)
  })
})
