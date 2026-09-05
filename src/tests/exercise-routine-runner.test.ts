import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRoutineRunnerController } from '@/features/exercises/routine-runner/use-routine-runner-controller'
import { EXERCISE_ROUTINE_RUNNER } from '@/features/exercises/types'
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

// MIDI -> Hz, matching the controller's internal conversion.
function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

describe('useRoutineRunnerController', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('computeResult returns zero with the expected metric keys for no notes', () => {
    const base = createMockBase()
    const audioEngine = { playTone: async () => {} }
    const ctrl = useRoutineRunnerController(base, audioEngine)
    const result = ctrl.computeResult()

    expect(result.type).toBe(EXERCISE_ROUTINE_RUNNER)
    expect(result.score).toBe(0)
    expect(result.metrics.phasesCompleted).toBe(0)
    expect(result.metrics.totalNotes).toBe(0)
    expect(result.metrics.avgAccuracy).toBe(0)
    expect(result.metrics.bestNote).toBe(0)
    expect(result.metrics.fatigueScore).toBe(0)
    expect(result.metrics.richnessScore).toBe(0)
    expect(result.metrics.hnrTrend).toBe(0)
    expect(result.metrics.richnessTrend).toBe(0)
  })

  it('exposes a fixed multi-phase routine plan', () => {
    const base = createMockBase()
    const audioEngine = { playTone: async () => {} }
    const ctrl = useRoutineRunnerController(base, audioEngine)

    expect(ctrl.PHASES.length).toBe(5)
    expect(ctrl.PHASES.every((p) => p.notes.length > 0)).toBe(true)
  })

  it('setBase initializes the routine and announces the first phase', () => {
    const metricsCalls: Array<Record<string, number>> = []
    const targetCalls: Array<number | null> = []
    const base = createMockBase({
      _updateMetrics: (m) => metricsCalls.push(m),
      _setTargetPitch: (v) => {
        targetCalls.push(v)
      },
    })
    const audioEngine = { playTone: async () => {} }
    const ctrl = useRoutineRunnerController(base, audioEngine)

    ctrl.setBase(60) // C4

    // Fresh setup => nothing scored yet.
    expect(ctrl.computeResult().metrics.totalNotes).toBe(0)

    ctrl.startRoutine()

    // First phase metrics announced.
    const phaseMeta = metricsCalls.find((m) => m.totalPhases !== undefined)
    expect(phaseMeta).toBeDefined()
    expect(phaseMeta?.totalPhases).toBe(5)
    expect(phaseMeta?.phaseIndex).toBe(0)

    // First note's target pitch should be the base note (interval 0 => C4).
    expect(targetCalls.length).toBeGreaterThan(0)
    expect(targetCalls[0]).toBeCloseTo(midiToFreq(60), 5)
  })

  it('good performance over the full routine yields a meaningful score', async () => {
    vi.useFakeTimers()
    let history: Array<{
      freq: number
      time: number
      cents: number
      clarity: number
    }> = []
    let batchClock = 0
    const base = createMockBase({
      pitchHistory: () => history,
    })
    // Each played reference tone is answered with in-tune, high-clarity samples.
    // Each batch starts 10s after the previous so the trailing match window
    // (<= 2s) only ever captures the current note's samples.
    const audioEngine = {
      playTone: async (freq: number) => {
        batchClock += 10
        for (let i = 0; i < 10; i++) {
          history = [
            ...history,
            { freq, time: batchClock + i * 0.05, cents: 0, clarity: 90 },
          ]
        }
      },
    }
    const ctrl = useRoutineRunnerController(base, audioEngine)

    ctrl.setBase(60)
    ctrl.startRoutine()
    await vi.runAllTimersAsync()

    const result = ctrl.computeResult()
    expect(result.metrics.totalNotes).toBeGreaterThan(0)
    expect(result.metrics.avgAccuracy).toBeGreaterThan(40)
    expect(result.score).toBeGreaterThan(40)
  })

  it('stopRoutine halts running and commits a result', () => {
    const committed: unknown[] = []
    const running: boolean[] = []
    const base = createMockBase({
      _completeWithResult: (r) => committed.push(r),
      _setRunning: (v) => running.push(v),
    })
    const audioEngine = { playTone: async () => {} }
    const ctrl = useRoutineRunnerController(base, audioEngine)

    ctrl.setBase(60)
    ctrl.stopRoutine()

    expect(running).toContain(false)
    expect(committed.length).toBe(1)
  })

  it('a stale playTone().then() does not re-arm a timer after base.reset() fires mid-flight', async () => {
    // reset()/_setRunning(false) (not just stopRoutine()) must be able to
    // cancel an in-flight playTone().then() continuation, or it silently
    // schedules a new timer on an already-torn-down exercise.
    let disposer: (() => void) | undefined
    let resolvePlayTone: (() => void) | undefined
    const metricsCalls: Array<Record<string, number>> = []
    const base = createMockBase({
      _registerDispose: (fn) => {
        disposer = fn
      },
      _updateMetrics: (m) => metricsCalls.push(m),
    })
    const audioEngine = {
      playTone: () =>
        new Promise<void>((resolve) => {
          resolvePlayTone = resolve
        }),
    }
    const ctrl = useRoutineRunnerController(base, audioEngine)

    ctrl.setBase(60)
    ctrl.startRoutine() // fires playTone() for the first note, awaiting resolution

    metricsCalls.length = 0 // clear the initial phase-start metrics

    // Simulate base.reset() running while playTone() is still in flight.
    disposer?.()

    // Now the tone "finishes" — its .then() continuation runs after reset.
    resolvePlayTone?.()
    await Promise.resolve()
    await Promise.resolve()

    // The continuation should have bailed out via _cancelled instead of
    // scheduling startMatching()'s metrics update.
    expect(metricsCalls.some((m) => m.phase === 2)).toBe(false)
  })

  it('startRoutine ignores a second call while already active', () => {
    const metricsCalls: Array<Record<string, number>> = []
    const base = createMockBase({
      _updateMetrics: (m) => metricsCalls.push(m),
    })
    const audioEngine = { playTone: async () => {} }
    const ctrl = useRoutineRunnerController(base, audioEngine)

    ctrl.setBase(60)
    ctrl.startRoutine()
    ctrl.startRoutine() // double-invoke, e.g. a double-clicked Start button

    const phaseAnnouncements = metricsCalls.filter(
      (m) => m.totalPhases !== undefined,
    )
    expect(phaseAnnouncements.length).toBe(1)
  })
})
