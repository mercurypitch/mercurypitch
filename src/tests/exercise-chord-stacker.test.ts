import { describe, expect, it, vi } from 'vitest'
import { useChordStackerController } from '@/features/exercises/chord-stacker/use-chord-stacker-controller'
import { EXERCISE_CHORD_STACKER } from '@/features/exercises/types'
import type { BaseExerciseController } from '@/features/exercises/use-base-exercise'
import { midiToFrequency } from '@/lib/frequency-to-note'

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

function freqToMidiApprox(freq: number): number {
  return Math.round(12 * Math.log2(freq / 440) + 69)
}

const audioEngineMock = { playTone: async () => {} }

describe('useChordStackerController', () => {
  it('computeResult returns zero floor with real metric keys for empty history', () => {
    const base = createMockBase()
    const ctrl = useChordStackerController(base, audioEngineMock)
    const result = ctrl.computeResult()

    expect(result.type).toBe(EXERCISE_CHORD_STACKER)
    expect(result.score).toBe(0)
    expect(result.metrics.roundsCompleted).toBe(0)
    expect(result.metrics.avgAccuracy).toBe(0)
    expect(result.metrics.bestRound).toBe(0)
    // Per-chord-type breakdown keys.
    expect(result.metrics.maj7Avg).toBe(0)
    expect(result.metrics.min7Avg).toBe(0)
    expect(result.metrics.dom7Avg).toBe(0)
    expect(result.metrics.dim7Avg).toBe(0)
    expect(result.metrics.maj6Avg).toBe(0)
  })

  it('setBase + startRounds arpeggiates a four-note chord rooted on the base note', async () => {
    vi.useFakeTimers()
    try {
      const metrics: Array<Record<string, number>> = []
      const targets: number[] = []
      const base = createMockBase({
        _setTargetPitch: ((v: number | null) => {
          if (typeof v === 'number' && v > 0) targets.push(freqToMidiApprox(v))
          return v
        }) as BaseExerciseController['_setTargetPitch'],
        _updateMetrics: (m) => metrics.push({ ...m }),
      })
      const ctrl = useChordStackerController(base, audioEngineMock)

      ctrl.setBase(60) // C4 root
      ctrl.startRounds()
      // Advance through the arpeggiated playback into the first matching note.
      await vi.advanceTimersByTimeAsync(5000)

      const first = metrics[0] ?? {}
      // All five chord types are used; every chord is a 4-note seventh/sixth.
      expect(first.totalRounds).toBe(5)
      expect(first.chordLength).toBe(4)
      expect(first.phase).toBe(1) // listening to the arpeggio
      // The first matched note is the chord root (degree 0 == baseMidi).
      expect(targets.length).toBeGreaterThan(0)
      expect(targets[0]).toBe(60)
    } finally {
      vi.useRealTimers()
    }
  })

  it('scores high when the singer matches every stacked note', async () => {
    vi.useFakeTimers()
    try {
      // Sing whatever note the controller currently targets.
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
      const ctrl = useChordStackerController(base, audioEngineMock)

      ctrl.setBase(60)
      ctrl.startRounds()
      // Drive through all five chords (each: playback + per-note matching).
      await vi.advanceTimersByTimeAsync(120000)

      const result = ctrl.computeResult()
      expect(result.metrics.roundsCompleted).toBe(5)
      expect(result.metrics.avgAccuracy).toBe(100)
      expect(result.metrics.bestRound).toBe(100)
      // score = avgAccuracy*0.7 + bestRound*0.3 -> 100 for a perfect run.
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
    const ctrl = useChordStackerController(base, audioEngineMock)

    ctrl.setBase(60)
    ctrl.stopRounds()

    expect(completed.length).toBe(1)
  })

  it('a stale playChordNotes() continuation does not resume after base.reset() fires mid-flight', async () => {
    // reset()/_setRunning(false) (not just stopRounds()) must be able to
    // cancel an in-flight playTone() await, or the chord-arpeggio loop
    // keeps playing/scheduling notes on an already-torn-down exercise.
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
    const ctrl = useChordStackerController(base, audioEngine)

    ctrl.setBase(60)
    ctrl.startRounds() // fires playTone() for the first chord note

    metricsCalls.length = 0 // clear the round-start metrics

    // Simulate base.reset() running while playTone() is still in flight.
    disposer?.()

    resolvePlayTone?.()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    // The continuation should have bailed out instead of continuing to
    // play/schedule the rest of the chord.
    expect(metricsCalls.length).toBe(0)
  })

  it('startRounds ignores a second call while already active', () => {
    const metricsCalls: Array<Record<string, number>> = []
    const base = createMockBase({
      _updateMetrics: (m) => metricsCalls.push(m),
    })
    const ctrl = useChordStackerController(base, audioEngineMock)

    ctrl.setBase(60)
    ctrl.startRounds()
    ctrl.startRounds() // double-invoke, e.g. a double-clicked Start button

    const roundAnnouncements = metricsCalls.filter(
      (m) => m.totalRounds !== undefined,
    )
    expect(roundAnnouncements.length).toBe(1)
  })
})
