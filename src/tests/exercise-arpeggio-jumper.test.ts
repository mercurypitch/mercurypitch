import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useArpeggioJumperController } from '@/features/exercises/arpeggio-jumper/use-arpeggio-jumper-controller'
import { EXERCISE_ARPEGGIO_JUMPER } from '@/features/exercises/types'
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

describe('useArpeggioJumperController', () => {
  it('computeResult returns zero and real metric keys for empty history', () => {
    const base = createMockBase()
    const ctrl = useArpeggioJumperController(base, audioEngine)
    const result = ctrl.computeResult()

    expect(result.type).toBe(EXERCISE_ARPEGGIO_JUMPER)
    expect(result.score).toBe(0)
    expect(result.metrics.notesCompleted).toBe(0)
    expect(result.metrics.avgAccuracy).toBe(0)
    expect(result.metrics.bestNote).toBe(0)
    // Empty-history branch emits the same key set as the populated branch
    // (richnessScore zeroed) so the metric shape is stable across both.
    expect(result.metrics.richnessScore).toBe(0)
  })

  it('startArpeggio targets the root and stays within a major triad+octave', () => {
    const targetMidis: number[] = []
    const base = createMockBase({
      _setTargetPitch: ((v: number | null) => {
        if (v != null && v > 0) targetMidis.push(Math.round(freqToMidi(v)))
        return v
      }) as BaseExerciseController['_setTargetPitch'],
    })
    const ctrl = useArpeggioJumperController(base, audioEngine)
    ctrl.setArpeggio(60, 'major', 'up') // C4 major: 60, 64, 67, 72
    ctrl.startArpeggio()

    // startArpeggio plays only the first note synchronously (root = 60).
    expect(targetMidis.length).toBeGreaterThan(0)
    expect(targetMidis[0]).toBe(60)
    // Every emitted target must be a major-triad-plus-octave tone of C4.
    const expected = new Set([60, 64, 67, 72])
    for (const m of targetMidis) {
      expect(expected.has(m)).toBe(true)
    }
  })

  it('stopArpeggio commits a result and stops running', () => {
    const committed: unknown[] = []
    let runningSet: boolean | undefined
    const base = createMockBase({
      _completeWithResult: (r) => committed.push(r),
      _setRunning: (v) => {
        runningSet = v
      },
    })
    const ctrl = useArpeggioJumperController(base, audioEngine)
    ctrl.setArpeggio(60, 'major', 'up')
    ctrl.stopArpeggio()

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

    it('scores high when every chord tone is sung accurately', async () => {
      // Mirror back perfectly on-pitch samples for whichever note the
      // controller is currently targeting. scoreNoteAccuracy selects the
      // trailing window by sample `time`, so anchor it to a large clock.
      let currentTargetFreq = 0
      let sampleClock = 100 // seconds; large + monotonic

      const base = createMockBase({
        _setTargetPitch: ((v: number | null) => {
          if (v != null && v > 0) currentTargetFreq = v
          return v
        }) as BaseExerciseController['_setTargetPitch'],
        pitchHistory: () => {
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

      const ctrl = useArpeggioJumperController(base, audioEngine)
      ctrl.setArpeggio(60, 'major', 'up')
      ctrl.startArpeggio()

      // Flush the play -> match -> evaluate chain for all 4 chord tones.
      await vi.advanceTimersByTimeAsync(60000)

      const result = ctrl.computeResult()
      expect(result.metrics.notesCompleted).toBeGreaterThan(0)
      expect(result.metrics.avgAccuracy).toBeGreaterThan(90)
      expect(result.score).toBeGreaterThan(40)
      expect(result.score).toBeLessThanOrEqual(100)
    })
  })
})
