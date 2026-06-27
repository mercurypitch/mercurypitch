import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScaleRunnerController } from '@/features/exercises/scale-runner/use-scale-runner-controller'
import { EXERCISE_SCALE_RUNNER } from '@/features/exercises/types'
import type { BaseExerciseController } from '@/features/exercises/use-base-exercise'

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

const audioEngine = { playTone: async () => {} }

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

  describe('good performance (fake timers)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('scores high when every note is sung accurately', async () => {
      // Track the current target frequency the controller asks for, then feed
      // back a trailing window of on-target samples for whatever note is
      // currently being evaluated. scoreNoteAccuracy selects the trailing
      // `windowMs` of samples by their `time` field, so we anchor the window
      // to a large, increasing clock.
      let currentTargetFreq = 0
      let sampleClock = 100 // seconds; large + monotonic

      const base = createMockBase({
        _setTargetPitch: ((v: number | null) => {
          if (v != null && v > 0) currentTargetFreq = v
          return v
        }) as BaseExerciseController['_setTargetPitch'],
        pitchHistory: () => {
          // Emit a dense window of perfectly on-pitch samples for the active
          // target. Include clarity so the richness term contributes.
          const samples: Array<{
            freq: number
            time: number
            cents: number
            clarity: number
          }> = []
          if (currentTargetFreq > 0) {
            for (let i = 0; i < 30; i++) {
              sampleClock += 0.01
              samples.push({
                freq: currentTargetFreq,
                time: sampleClock,
                cents: 0,
                clarity: 0.95,
              })
            }
          }
          return samples
        },
      })

      const ctrl = useScaleRunnerController(base, audioEngine)
      ctrl.setScale(60, 'major', 'up')
      ctrl.startScale()

      // Drive the full play -> match -> evaluate chain to completion. Each
      // note cycles through several setTimeouts plus a playTone microtask;
      // advancing well past the longest possible per-note budget (a few
      // seconds even at the easiest difficulty) flushes them all.
      await vi.advanceTimersByTimeAsync(60000)

      const result = ctrl.computeResult()
      expect(result.metrics.notesCompleted).toBeGreaterThan(0)
      expect(result.metrics.avgAccuracy).toBeGreaterThan(90)
      expect(result.score).toBeGreaterThan(40)
      expect(result.score).toBeLessThanOrEqual(100)
    })
  })
})
