import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exerciseScoringVersion } from '@/features/exercises/exercise-comparability'
import { useScaleRunnerController } from '@/features/exercises/scale-runner/use-scale-runner-controller'
import type { ExerciseResult } from '@/features/exercises/types'
import { EXERCISE_SCALE_RUNNER } from '@/features/exercises/types'
import type { BaseExerciseController } from '@/features/exercises/use-base-exercise'
import { computeEma } from '@/features/practice-intelligence/adaptive-difficulty'
import { updateDifficultyFromEma } from '@/features/practice-intelligence/difficulty-store'
import { applyPersistedValue } from '@/lib/storage'

function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / 440) + 69
}

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

const audioEngine = { playTone: async () => {} }

/**
 * Sing a whole C major scale up, every note `centsSharp` off its target,
 * and return the result. Each read of the pitch history is a dense window
 * of samples on the note the drill is asking for, on a large, increasing
 * clock, since scoreNoteAccuracy selects the trailing `windowMs` of samples
 * by their `time`. The samples carry the detector's realistic clarity (0 to
 * 1). Runs on fake timers.
 */
async function singScale(centsSharp: number): Promise<ExerciseResult> {
  const sharp = 2 ** (centsSharp / 1200)
  let currentTargetFreq = 0
  let sampleClock = 100 // seconds; large + monotonic
  const base = createMockBase({
    _setTargetPitch: ((v: number | null) => {
      if (v != null && v > 0) currentTargetFreq = v
      return v
    }) as BaseExerciseController['_setTargetPitch'],
    pitchHistory: () => {
      const samples = []
      for (let i = 0; i < 30 && currentTargetFreq > 0; i++) {
        sampleClock += 0.01
        samples.push({
          freq: currentTargetFreq * sharp,
          time: sampleClock,
          cents: centsSharp,
          clarity: 0.9,
        })
      }
      return samples
    },
  })
  const ctrl = useScaleRunnerController(base, audioEngine)
  ctrl.setScale(60, 'major', 'up')
  ctrl.startScale()
  // Drive the play -> match -> evaluate chain to the end: well past the
  // longest per-note budget, a few seconds even at the easiest level.
  await vi.advanceTimersByTimeAsync(60000)
  return ctrl.computeResult()
}

describe('useScaleRunnerController', () => {
  it('computeResult returns zero and real metric keys for empty history', () => {
    const base = createMockBase()
    const ctrl = useScaleRunnerController(base, audioEngine)
    const result = ctrl.computeResult()

    expect(result.type).toBe(EXERCISE_SCALE_RUNNER)
    expect(result.score).toBe(0)
    expect(result.metrics.notesCompleted).toBe(0)
    expect(result.metrics.avgAccuracy).toBe(0)
    expect(result.metrics.bestNote).toBe(0)
    expect(result.metrics.evennessStdDev).toBe(0)
    expect(result.metrics.richnessScore).toBe(0)
  })

  it('startScale sets the target pitch to the first scale note', () => {
    const targetCalls: Array<number | null> = []
    const base = createMockBase({
      _setTargetPitch: ((v: number | null) => {
        targetCalls.push(v)
        return v
      }) as BaseExerciseController['_setTargetPitch'],
    })
    const ctrl = useScaleRunnerController(base, audioEngine)
    ctrl.setScale(60, 'major', 'up') // C4 major ascending
    ctrl.startScale()

    // First note of a C4 major scale is the root, C4 (midi 60).
    expect(targetCalls.length).toBeGreaterThan(0)
    const firstTarget = targetCalls[0]
    expect(firstTarget).not.toBeNull()
    expect(Math.round(freqToMidi(firstTarget as number))).toBe(60)
  })

  it('stopScale commits a result and stops running', () => {
    const committed: unknown[] = []
    let runningSet: boolean | undefined
    const base = createMockBase({
      _completeWithResult: (r) => committed.push(r),
      _setRunning: (v) => {
        runningSet = v
      },
    })
    const ctrl = useScaleRunnerController(base, audioEngine)
    ctrl.setScale(60, 'major', 'up')
    ctrl.stopScale()

    expect(committed.length).toBe(1)
    expect(runningSet).toBe(false)
  })

  describe('the grade (fake timers)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('grades a scale sung on pitch, every note, at 100', async () => {
      // Act
      const result = await singScale(0)

      // Assert: C major up is eight notes, each dead on, so the run is even.
      expect(result.metrics.notesCompleted).toBe(8)
      expect(result.metrics.avgAccuracy).toBe(100)
      expect(result.metrics.bestNote).toBe(100)
      expect(result.metrics.evennessStdDev).toBe(0)
      // Version 1's weights summed to 0.8, so this run graded 80.
      expect(result.score).toBe(100)
    })

    it('grades a scale 20 cents sharp at 79, with no richness in it', async () => {
      // Each note scores 100 - 1.5 x 20 = 70 and the notes are even, so the
      // grade is 0.5 x 70 + 0.1875 x 70 + 0.3125 x 100 = 79.375, so 79. The
      // richness term reads 0.9 clarity as 1: back in the grade at its old
      // 0.2, it would make 79.575, so 80.

      // Act
      const result = await singScale(20)

      // Assert
      expect(result.metrics.avgAccuracy).toBe(70)
      expect(result.metrics.richnessScore).toBe(1)
      expect(result.score).toBe(79)
    })
  })
})

describe('Scale Runner runs graded the old way are set aside', () => {
  const HISTORY_KEY = 'mercurypitch_exercise_history'
  /** Twelve runs graded the old way, every one held at its cap of 80. */
  const oldRuns = Array.from({ length: 12 }, (_, i) => ({
    type: EXERCISE_SCALE_RUNNER,
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
      const result = await singScale(0)
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
    const level = updateDifficultyFromEma(EXERCISE_SCALE_RUNNER)

    // Assert: version 1 held every run under the step-up line of 90, and
    // its runs no longer pull the average down.
    expect(runs.map((r) => r.score)).toEqual([100, 100, 100, 100, 100])
    expect(computeEma(EXERCISE_SCALE_RUNNER)).toBe(100)
    expect(level).toBe(6)
  })
})
