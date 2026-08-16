import { describe, expect, it, vi } from 'vitest'
import { generatePhrase, useCallResponseController, } from '@/features/exercises/call-response/use-call-response-controller'
import { EXERCISE_CALL_RESPONSE } from '@/features/exercises/types'
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

const audioEngineMock = { playTone: async () => {} }

/** A wide stand-in for the singer's comfortable range. */
const RANGE = { min: 36, max: 84 }

describe('useCallResponseController', () => {
  it('computeResult returns zero floor with real metric keys for empty history', () => {
    const base = createMockBase()
    const ctrl = useCallResponseController(base, audioEngineMock)
    const result = ctrl.computeResult()

    expect(result.type).toBe(EXERCISE_CALL_RESPONSE)
    expect(result.score).toBe(0)
    expect(result.metrics.roundsCompleted).toBe(0)
    expect(result.metrics.avgAccuracy).toBe(0)
    expect(result.metrics.bestRound).toBe(0)
  })

  it('setBase + startRounds opens with the key note in the listening phase', async () => {
    vi.useFakeTimers()
    try {
      const metrics: Array<Record<string, number>> = []
      const base = createMockBase({
        _updateMetrics: (m) => metrics.push({ ...m }),
      })
      const ctrl = useCallResponseController(base, audioEngineMock)

      ctrl.setBase(60, RANGE) // C4 key
      ctrl.startRounds()
      // Flush the initial metric burst before any note plays out.
      await vi.advanceTimersByTimeAsync(1)

      const first = metrics[0] ?? {}
      // The first phrase note is always the key (baseMidi); rounds are
      // deterministic at difficulty 5 even though phrase length is random.
      expect(first.currentMidi).toBe(60)
      expect(first.totalRounds).toBe(5)
      expect(first.phase).toBe(1) // listening
    } finally {
      vi.useRealTimers()
    }
  })

  it('scores high when the singer reproduces every phrase note (relative-clock window)', async () => {
    vi.useFakeTimers()
    try {
      // Make the absolute clock (performance.now) large and DISTINCT from the
      // exercise-relative clock. This is the regression lock for the epoch bug:
      // a controller filtering samples by performance.now() instead of
      // base._getElapsed() would select zero samples here and score 0.
      vi.advanceTimersByTime(500_000)
      const startPerf = performance.now()

      // Capture every note the call phrase announces via currentMidi, then feed
      // back a pitch history (on the relative clock) covering all of them.
      const announced: number[] = []
      const base = createMockBase({
        _getElapsed: () => performance.now() - startPerf,
        _updateMetrics: (m) => {
          if (typeof m.currentMidi === 'number') announced.push(m.currentMidi)
        },
        pitchHistory: () => {
          const nowMs = performance.now() - startPerf
          const samples: Array<{ freq: number; time: number; cents: number }> =
            []
          for (const midi of new Set(announced)) {
            const freq = midiToFrequency(midi)
            for (let i = 0; i < 10; i++) {
              samples.push({ freq, time: (nowMs - i * 20) / 1000, cents: 0 })
            }
          }
          return samples
        },
      })
      const ctrl = useCallResponseController(base, audioEngineMock)

      ctrl.setBase(60, RANGE)
      ctrl.startRounds()
      await vi.advanceTimersByTimeAsync(120000)

      const result = ctrl.computeResult()
      expect(result.metrics.roundsCompleted).toBe(5)
      expect(result.metrics.avgAccuracy).toBe(100)
      expect(result.metrics.bestRound).toBe(100)
      // avgAccuracy*0.5 + bestRound*0.25 + richness*0.25; richness is 0 without
      // clarity samples, so a perfect run caps at 75 here.
      expect(result.score).toBeGreaterThan(70)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stopRounds completes with a result', () => {
    const completed: unknown[] = []
    const base = createMockBase({
      _completeWithResult: (r) => completed.push(r),
    })
    const ctrl = useCallResponseController(base, audioEngineMock)

    ctrl.setBase(60, RANGE)
    ctrl.stopRounds()

    expect(completed.length).toBe(1)
  })
})

// ============================================================
// The walk stays inside the singer's range
// ============================================================
//
// The owner's repro: a routine handed a baritone G4 as the base, and the
// walk's blind coin-flip marched the phrase into the fifth octave ("goes
// to X5 notes"). The walk now tries both directions and keeps only the
// ones inside the range.

describe('generatePhrase stays in range', () => {
  it('never leaves the range, even from a base pinned near the ceiling', () => {
    // Tight range, base two semitones under the top: under the old blind
    // direction pick, ~half of all first steps overshoot immediately.
    const range = { min: 60, max: 72 }
    for (let run = 0; run < 300; run++) {
      for (const note of generatePhrase(70, 4, range)) {
        expect(note.midi).toBeGreaterThanOrEqual(range.min)
        expect(note.midi).toBeLessThanOrEqual(range.max)
      }
    }
  })

  it('stays put when neither direction fits', () => {
    // A one-note range plus a forced non-zero step: both candidates are
    // out, so the walk holds the base rather than leaving the range.
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99) // step 7
    try {
      const phrase = generatePhrase(60, 3, { min: 60, max: 60 })
      expect(phrase.map((n) => n.midi)).toEqual([60, 60, 60])
    } finally {
      spy.mockRestore()
    }
  })
})

describe('an authored phrase is sung as written', () => {
  it('uses the launched notes for every round instead of a walk', async () => {
    vi.useFakeTimers()
    try {
      const metrics: Array<Record<string, number>> = []
      const base = createMockBase({
        _updateMetrics: (m) => metrics.push({ ...m }),
      })
      const ctrl = useCallResponseController(base, audioEngineMock)

      const authored = [64, 62, 60, 62, 64, 64, 64] // Mary Had a Little Lamb
      ctrl.setBase(60, RANGE, authored)

      // Before anything plays, the round's full phrase is the authored one.
      expect(ctrl.getUpcomingMidi()).toEqual(authored)

      ctrl.startRounds()
      await vi.advanceTimersByTimeAsync(1)
      const first = metrics[0] ?? {}
      expect(first.currentMidi).toBe(64) // the phrase's first note, not the key
      expect(first.phraseLength).toBe(authored.length)
    } finally {
      vi.useRealTimers()
    }
  })

  it('falls back to the walk when the launch carries fewer than two notes', () => {
    const ctrl = useCallResponseController(createMockBase(), audioEngineMock)
    ctrl.setBase(60, RANGE, [64])
    // A walk always opens on the base note.
    expect(ctrl.getUpcomingMidi()[0]).toBe(60)
  })
})
