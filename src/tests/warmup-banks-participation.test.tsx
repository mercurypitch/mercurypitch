// ============================================================
// WarmupExercise banks participation, end to end
// (CLAUDE-JOURNEY-015 — the component side)
// ============================================================
//
// warmup-participation.test.ts pins the pure seam; this drives the
// component: a full pattern walked step by step through the session's
// loop-limit callback, with each finished run carrying a LOW accuracy
// total and a HIGH coverage. The live score, the final result and the
// recorded history entry must all speak coverage — the "you sang along"
// number the card promises — never the graded total.

import { render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ZenPitchRun } from '@/features/zen/types'

type SessionOpts = { onLoopLimitReached: () => void }
const captured: { opts: SessionOpts | null } = { opts: null }

const runsRef: { runs: Array<Partial<ZenPitchRun>> } = { runs: [] }

vi.mock('@/features/zen/useZenPitchSession', () => ({
  useZenPitchSession: (opts: SessionOpts) => {
    captured.opts = opts
    return {
      status: () => 'running',
      elapsedSec: () => 0,
      loopsCompleted: () => 0,
      targets: () => [],
      activePoints: () => [],
      viewport: () => ({ minMidi: 48, maxMidi: 72 }),
      targetVisibility: () => 'full',
      progressCue: () => 'playhead',
      loopDurationSec: () => 10,
      runs: () => runsRef.runs,
      selectExercise: vi.fn(),
      setRootMidi: vi.fn(),
      start: vi.fn(async () => true),
      finish: vi.fn(),
    }
  },
}))

vi.mock('@/features/zen/ZenPitchCanvas', () => ({
  ZenPitchCanvas: () => null,
}))

vi.mock('@/features/exercises/ExerciseShell', () => ({
  ExerciseShell: () => null,
}))

const updateScore = vi.fn()
const completeWithResult = vi.fn()
vi.mock('@/features/exercises/use-base-exercise', () => ({
  useBaseExercise: () => ({
    state: () => ({ status: 'idle', currentScore: 0 }),
    start: vi.fn(async () => true),
    reset: vi.fn(),
    error: () => null,
    result: () => null,
    _updateScore: updateScore,
    _updateMetrics: vi.fn(),
    _completeWithResult: completeWithResult,
  }),
}))

vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: vi.fn(),
}))
vi.mock('@/features/practice-intelligence/difficulty-store', () => ({
  updateDifficultyFromEma: vi.fn(),
}))

const { default: WarmupExercise } =
  await import('@/features/exercises/warmup/WarmupExercise')
const { warmupPatternExercises } =
  await import('@/features/exercises/warmup/warmup-exercises')

function runWithScore(total: number, coverage: number): Partial<ZenPitchRun> {
  return {
    score: {
      total,
      coverage,
      pitch: total,
      steadiness: total,
      averageCents: 80,
    },
  }
}

describe('WarmupExercise banking', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    captured.opts = null
    runsRef.runs = []
    updateScore.mockClear()
    completeWithResult.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('banks coverage per step and completes on the participation average', () => {
    const { unmount } = render(() => (
      <WarmupExercise
        audioEngine={
          {
            playMetronomeClick: vi.fn(),
            playTone: vi.fn(async () => undefined),
            playChord: vi.fn().mockResolvedValue(undefined),
          } as never
        }
        practiceEngine={{} as never}
        subscribeFrames={() => () => {}}
        onBack={() => {}}
        autoStart
      />
    ))
    // autoStart's handleStart awaits base.start(); let the microtask land.
    return Promise.resolve().then(async () => {
      await Promise.resolve()
      expect(captured.opts).not.toBeNull()

      const stepCount = warmupPatternExercises('full').length
      // Wandering pitch, full participation: total stays low, coverage high.
      const coverages: number[] = []
      for (let i = 0; i < stepCount; i++) {
        // The breathing-style case mid-walk: no score object, banks nothing.
        if (i === 1) {
          runsRef.runs = [{ score: undefined }]
        } else {
          const coverage = 90 + i
          coverages.push(coverage)
          runsRef.runs = [runWithScore(40, coverage)]
        }
        captured.opts!.onLoopLimitReached()
        // The between-step gap timer must elapse before the next step arms.
        vi.runAllTimers()
      }

      const expected = Math.round(
        coverages.reduce((sum, value) => sum + value, 0) / coverages.length,
      )
      // The live score after the first bank is the first coverage — never 40.
      expect(updateScore).toHaveBeenCalled()
      expect(updateScore.mock.calls[0]![0]).toBe(coverages[0])
      expect(updateScore).not.toHaveBeenCalledWith(40)

      expect(completeWithResult).toHaveBeenCalledTimes(1)
      const result = completeWithResult.mock.calls[0]![0] as {
        score: number
        metrics: { participation: number; stepsCompleted: number }
      }
      expect(result.score).toBe(expected)
      expect(result.metrics.participation).toBe(expected)
      expect(result.metrics.stepsCompleted).toBe(stepCount)
      unmount()
    })
  })
})
