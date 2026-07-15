import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePitchHoldController } from '@/features/exercises/pitch-hold/use-pitch-hold-controller'
import { EXERCISE_PITCH_HOLD } from '@/features/exercises/types'
import type { BaseExerciseController } from '@/features/exercises/use-base-exercise'

function createMockBase(
  overrides: Partial<BaseExerciseController> = {},
): BaseExerciseController {
  const elapsed = 0
  const mock: BaseExerciseController = {
    pitchHistory: () => [],
    _setTargetPitch: () => {},
    _getElapsed: () => elapsed,
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

describe('usePitchHoldController', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('computeResult returns zero when no frames collected', () => {
    const base = createMockBase({ _getElapsed: () => 0 })
    const ctrl = usePitchHoldController(base)
    const result = ctrl.computeResult()
    expect(result.score).toBe(0)
    expect(result.metrics.zonePct).toBe(0)
    expect(result.metrics.survivedSec).toBe(0)
  })

  it('startLoop begins tracking frames', () => {
    const metricsCalls: Array<Record<string, number>> = []
    const base = createMockBase({
      // Fresh in-tune sample at t=1.0s (matches _getElapsed → counts as voiced).
      pitchHistory: () => [{ freq: 440, time: 1.0, cents: 0, clarity: 0.8 }],
      _getElapsed: () => 1000,
      _isRunning: () => true,
      _updateMetrics: (m) => metricsCalls.push(m),
    })
    const ctrl = usePitchHoldController(base)
    ctrl.setTarget(69) // A4

    ctrl.startLoop()

    // Advance past one score update (10Hz = every 100ms)
    vi.advanceTimersByTime(100)

    // stop the loop
    ctrl.stopAndCompute()

    expect(metricsCalls.length).toBeGreaterThan(0)
  })

  it('scores higher when pitch stays in zone', () => {
    const committed: unknown[] = []
    const base = createMockBase({
      pitchHistory: () => [{ freq: 440, time: 5.0, cents: 0, clarity: 0.8 }],
      _getElapsed: () => 5000,
      _isRunning: () => true,
      _completeWithResult: (r) => committed.push(r),
    })
    const ctrl = usePitchHoldController(base)
    ctrl.setTarget(69) // A4

    ctrl.startLoop()
    // Advance through enough timer ticks to collect >= 10 frames (10Hz = every 100ms, need at least 1000ms)
    vi.advanceTimersByTime(1200)
    const result = ctrl.stopAndCompute()

    // Pitch is exactly on target, all frames should be in zone
    expect(result.metrics.zonePct).toBe(100)
    expect(committed.length).toBe(1)
  })

  it('scores lower when pitch is far from target', () => {
    const committed: unknown[] = []
    // G#4 = ~415 Hz → ~100 cents below A4
    const base = createMockBase({
      pitchHistory: () => [{ freq: 415, time: 5.0, cents: 0, clarity: 0.8 }],
      _getElapsed: () => 5000,
      _isRunning: () => true,
      _commitResult: (r) => committed.push(r),
    })
    const ctrl = usePitchHoldController(base)
    ctrl.setTarget(69) // A4

    ctrl.startLoop()
    vi.advanceTimersByTime(1200)
    const result = ctrl.stopAndCompute()

    // G#4 is ~100 cents off A4, initial zone is ±50 → should be outside zone
    expect(result.metrics.zonePct).toBeLessThan(100)
  })

  it('stopAndCompute includes duration metrics', () => {
    const base = createMockBase({
      pitchHistory: () => [{ freq: 440, time: 15.0, cents: 0, clarity: 0.8 }],
      _getElapsed: () => 15000,
      _isRunning: () => true,
    })
    const ctrl = usePitchHoldController(base)
    ctrl.setTarget(69)
    ctrl.startLoop()
    vi.advanceTimersByTime(1200)
    const result = ctrl.stopAndCompute()

    expect(result.metrics.durationSec).toBe(15)
    expect(result.metrics.survivedSec).toBe(15)
    expect(result.type).toBe(EXERCISE_PITCH_HOLD)
  })

  it('penalizes going silent after briefly holding the note', () => {
    // One in-tune sample at t=0.1s, then nothing — the singer hit the note and
    // went quiet. base.currentPitch() would read stale (the old bug held
    // zonePct at 100); the freshness check must dilute it once the sample goes
    // older than VOICE_GAP_SEC as the clock advances.
    const history = [{ freq: 440, time: 0.1, cents: 0, clarity: 0.8 }]
    const base = createMockBase({
      pitchHistory: () => history,
      _getElapsed: () => performance.now(), // advances with the fake clock
    })
    const ctrl = usePitchHoldController(base)
    ctrl.setTarget(69) // A4, on the sample's pitch

    ctrl.startLoop()
    vi.advanceTimersByTime(3000) // ~30 ticks; only the first couple are fresh
    const result = ctrl.stopAndCompute()

    // The overwhelming majority of frames were silence, so far below 100.
    expect(result.metrics.zonePct).toBeLessThan(30)
  })
})
