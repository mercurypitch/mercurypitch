import { describe, expect, it, vi } from 'vitest'
import { useSightSingingController } from '@/features/exercises/sight-singing/use-sight-singing-controller'
import { EXERCISE_SIGHT_SINGING } from '@/features/exercises/types'
import type { BaseExerciseController } from '@/features/exercises/use-base-exercise'
import type { ScaleDegree } from '@/types'

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

function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

// C major scale degrees. Only `midi` (its pitch class) and `name` matter to the
// controller — it dedupes by pitch class, so a single octave is enough.
const C_MAJOR_PCS = [60, 62, 64, 65, 67, 69, 71] // C D E F G A B
const C_MAJOR_PITCH_CLASSES = new Set(C_MAJOR_PCS.map((m) => m % 12))
const C_MAJOR: ScaleDegree[] = C_MAJOR_PCS.map((midi, i) => ({
  midi,
  name: ['C', 'D', 'E', 'F', 'G', 'A', 'B'][i]!,
  octave: 4,
  freq: midiToFreq(midi),
  semitone: midi - 60,
}))

describe('useSightSingingController', () => {
  it('computes a zero result with the real metric keys when nothing scored', () => {
    // computeResult() is internal; it is surfaced via _completeWithResult when
    // the run is stopped. With no notes scored the result must be zeroed out.
    let completed: unknown = undefined
    const base = createMockBase({
      _completeWithResult: (r) => {
        completed = r
      },
    })
    const ctrl = useSightSingingController(base)
    ctrl.stopAndCompute()

    expect(completed).toBeDefined()
    const result = completed as {
      type: string
      score: number
      metrics: {
        notesScored: number
        notesAttempted: number
        avgAccuracy: number
        bestNote: number
      }
    }
    expect(result.type).toBe(EXERCISE_SIGHT_SINGING)
    expect(result.score).toBe(0)
    // Exact metric keys exposed by computeResult.
    expect(result.metrics.notesScored).toBe(0)
    expect(result.metrics.notesAttempted).toBe(0)
    expect(result.metrics.avgAccuracy).toBe(0)
    expect(result.metrics.bestNote).toBe(0)
  })

  it('setScale generates a non-empty sequence with every note inside the range', () => {
    const base = createMockBase()
    const ctrl = useSightSingingController(base)

    const rangeMin = 57 // A3
    const rangeMax = 72 // C5
    ctrl.setScale(C_MAJOR, rangeMin, rangeMax)

    const seq = ctrl.getSequence()
    expect(seq.length).toBeGreaterThan(0)
    // Regression lock for the "C5 too high" bug: nothing above the ceiling.
    for (const note of seq) {
      expect(note.midi).toBeGreaterThanOrEqual(rangeMin)
      expect(note.midi).toBeLessThanOrEqual(rangeMax)
    }
  })

  it('setScale uses only pitch classes from the requested scale', () => {
    const base = createMockBase()
    const ctrl = useSightSingingController(base)

    ctrl.setScale(C_MAJOR, 57, 72)
    const seq = ctrl.getSequence()
    expect(seq.length).toBeGreaterThan(0)
    for (const note of seq) {
      const pc = ((note.midi % 12) + 12) % 12
      expect(C_MAJOR_PITCH_CLASSES.has(pc)).toBe(true)
    }
  })

  it('returns an empty sequence when no scale pitch class fits the range', () => {
    const base = createMockBase()
    const ctrl = useSightSingingController(base)

    // C major has no note in the half-open semitone gap [61, 61] (C#4).
    ctrl.setScale(C_MAJOR, 61, 61)
    expect(ctrl.getSequence()).toEqual([])
  })

  it('drives notes to completion on an in-tune sung pitch: score rises and the run completes', () => {
    vi.useFakeTimers()

    // Elapsed mirrors the faked performance clock so scoreAndAdvance's
    // time window (start..end, in ms) is non-empty.
    const elapsed = () => performance.now()

    // The singer is always perfectly on the current target note.
    let getSeq: () => ReturnType<typeof ctrl.getSequence> = () => []
    let getIdx: () => number = () => 0
    const targetFreq = () => {
      const seq = getSeq()
      const idx = getIdx()
      if (idx < 0 || idx >= seq.length) return 0
      return midiToFreq(seq[idx]!.midi)
    }

    const scoreCalls: number[] = []
    let completed: unknown = undefined

    const base = createMockBase({
      _getElapsed: elapsed,
      currentPitch: () => {
        const freq = targetFreq()
        return freq > 0 ? { freq, clarity: 1, noteName: '' } : null
      },
      // One in-window, in-tune sample for the current note. `time` is in
      // seconds and lands inside [noteStart, now] because it tracks elapsed.
      pitchHistory: () => {
        const freq = targetFreq()
        if (freq <= 0) return []
        return [
          {
            freq,
            time: Math.max(0, performance.now() / 1000 - 0.001),
            cents: 0,
          },
          { freq, time: performance.now() / 1000, cents: 0 },
        ]
      },
      _updateScore: (s) => scoreCalls.push(s),
      _completeWithResult: (r) => {
        completed = r
      },
    })

    const ctrl = useSightSingingController(base)
    getSeq = ctrl.getSequence
    getIdx = ctrl.getCurrentIndex

    ctrl.setScale(C_MAJOR, 57, 72)
    const total = ctrl.getSequence().length
    expect(total).toBeGreaterThan(0)

    ctrl.startRounds()

    // HOLD_TO_PASS_MS is 450ms; poll runs every 80ms. Advancing well past
    // total * 450ms (plus poll slack) clears every note via the hold path.
    vi.advanceTimersByTime(total * 600 + 1000)

    vi.useRealTimers()

    // Score was pushed and ended positive (matched path floors each note at 70).
    expect(scoreCalls.length).toBeGreaterThan(0)
    const finalScore = scoreCalls[scoreCalls.length - 1]!
    expect(finalScore).toBeGreaterThan(0)
    expect(finalScore).toBeLessThanOrEqual(100)

    // Reaching the end auto-completes the run with a result.
    expect(completed).toBeDefined()
    const result = completed as {
      type: string
      score: number
      metrics: { notesScored: number; notesAttempted: number }
    }
    expect(result.type).toBe(EXERCISE_SIGHT_SINGING)
    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.metrics.notesScored).toBe(total)
    expect(result.metrics.notesAttempted).toBe(total)
  })
})
