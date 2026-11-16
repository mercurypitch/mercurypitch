// ============================================================
// Chord Stacker — the demo plays each note of the chord in full
// ============================================================
//
// playTone settles when the tone is scheduled, not when it ends, and the
// next playTone releases the one before it. The demo waited only the gap
// after each tone, 300 ms after a 600 ms note, so every note but the last
// was cut to half, and the last still sounded into the singing. The
// controller runs on fake timers here, and each tone and phase is logged
// at the moment it starts. The scoring keeps its tests in
// src/tests/exercise-chord-stacker.test.ts.
//
// The same timers measure a whole run, which a daily routine budgets for
// (TYPICAL_RUN_SEC in segment-reps.ts).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { typicalRunSec } from '@/features/routines/segment-reps'
import { midiToFrequency } from '@/lib/frequency-to-note'
import type { ExerciseResult } from '../types'
import { EXERCISE_CHORD_STACKER } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'
import type { ChordStackerChord } from './chord-stacker-chords'
import { CHORD_SETS, CHORD_STACKER_CHORDS, chordMask, chordNotes, } from './chord-stacker-chords'
import { useChordStackerController } from './use-chord-stacker-controller'

/** The demo's lengths at difficulty 5, where every one is its baseline. */
const TONE_MS = 600
const GAP_MS = 300
const BEFORE_SINGING_MS = 400

function createMockBase(
  overrides: Partial<BaseExerciseController> = {},
): BaseExerciseController {
  return {
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
}

/** Start a run on C4, logging when each tone and each phase begins. */
function startRun() {
  const t0 = Date.now()
  const tones: Array<{ at: number; ms: number | undefined }> = []
  const singing: number[] = []
  const base = createMockBase({
    _updateMetrics: (m) => {
      if (m.phase === 2) singing.push(Date.now() - t0)
    },
  })
  const ctrl = useChordStackerController(base, {
    playTone: async (_freq, ms) => {
      tones.push({ at: Date.now() - t0, ms })
    },
  })
  ctrl.setBase(60)
  ctrl.startRounds()
  return { ctrl, tones, singing }
}

describe('Chord Stacker plays its chord one whole note at a time', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts the next note only after the tone length and the gap', async () => {
    // Arrange
    const { tones } = startRun()

    // Act: up to a moment before the second note is due
    await vi.advanceTimersByTimeAsync(TONE_MS + GAP_MS - 1)

    // Assert
    expect(tones).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(tones).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(2 * (TONE_MS + GAP_MS))
    expect(tones).toEqual(
      [0, 1, 2, 3].map((i) => ({ at: i * (TONE_MS + GAP_MS), ms: TONE_MS })),
    )
  })

  it('lets the last note end before the singing starts', async () => {
    // Arrange
    const { tones, singing } = startRun()

    // Act
    await vi.advanceTimersByTimeAsync(4 * TONE_MS + 3 * GAP_MS + 1000)

    // Assert
    expect(tones).toHaveLength(4)
    expect(singing[0] - tones[3].at).toBe(TONE_MS + BEFORE_SINGING_MS)
  })

  it('lets Stop cancel the wait for a tone to end', async () => {
    // Arrange: a third of the way through the first tone
    const { ctrl, tones, singing } = startRun()
    await vi.advanceTimersByTimeAsync(TONE_MS / 3)

    // Act
    ctrl.stopRounds()

    // Assert: the wait was the controller's own timer, so nothing is left
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(tones).toHaveLength(1)
    expect(singing).toEqual([])
  })
})

describe('a run on the chords the setup chose', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  /** Run a whole run on C4 with every note sung on its target, and log
   *  each round as announced and the notes it asked for. */
  async function singRun(choice: {
    chords: readonly ChordStackerChord[]
    inversions: boolean
  }) {
    const announced: Array<Record<string, number>> = []
    const asked: number[][] = []
    let target = 0
    let result: ExerciseResult | null = null
    const base = createMockBase({
      _updateMetrics: (m) => {
        if (m.chordIndex !== undefined) {
          announced.push({ ...m })
          asked.push([])
        }
      },
      _setTargetPitch: ((hz: number | null) => {
        if (typeof hz === 'number' && hz > 0) {
          target = Math.round(12 * Math.log2(hz / 440) + 69)
          asked[asked.length - 1].push(target)
        }
      }) as BaseExerciseController['_setTargetPitch'],
      pitchHistory: () =>
        Array.from({ length: 60 }, (_, i) => ({
          freq: midiToFrequency(target),
          time: 100 + i * 0.05,
          cents: 0,
        })),
      _completeWithResult: (r) => {
        result = r
      },
    })
    const ctrl = useChordStackerController(base, { playTone: async () => {} })
    ctrl.setBase(60, choice)
    ctrl.startRounds()
    await vi.advanceTimersByTimeAsync(200_000)
    return { announced, asked, result: result as ExerciseResult | null }
  }

  it('asks for each round its chord turned over as announced, bottom note first', async () => {
    // Act
    const { announced, asked } = await singRun({
      chords: CHORD_SETS.triads,
      inversions: true,
    })

    // Assert
    expect(announced).toHaveLength(5)
    announced.forEach((round, i) => {
      const chord = CHORD_STACKER_CHORDS[round.chordIndex]
      expect(CHORD_SETS.triads).toContain(chord)
      expect(round.rootMidi).toBe(60)
      expect(round.chordLength).toBe(3)
      expect(asked[i]).toEqual(chordNotes(60, chord, round.chordPosition))
    })
  })

  it('names no position while the run plays root position only', async () => {
    const { announced, asked } = await singRun({
      chords: CHORD_SETS.triads,
      inversions: false,
    })

    expect(announced.map((r) => r.chordPosition)).toEqual([-1, -1, -1, -1, -1])
    announced.forEach((round, i) => {
      expect(asked[i]).toEqual(
        chordNotes(60, CHORD_STACKER_CHORDS[round.chordIndex]),
      )
    })
  })

  it('writes what it dealt into the result, and each chord its own average', async () => {
    const { result } = await singRun({ chords: ['dom7'], inversions: true })

    expect(result?.score).toBe(100)
    expect(result?.metrics.chordMask).toBe(chordMask(['dom7']))
    expect(result?.metrics.inversions).toBe(1)
    expect(result?.metrics.dom7Avg).toBe(100)
    expect(result?.metrics.majorAvg).toBe(0)
  })
})

describe('a whole Chord Stacker run, as a routine budgets for it', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // A routine that budgeted 45 s for a run asked for three in a segment of
  // two and a half minutes, and they took four.
  it('takes 81.5 s at the default level, and a routine budgets that much', async () => {
    // Arrange
    let completedAtMs: number | null = null
    const t0 = Date.now()
    const base = createMockBase({
      _completeWithResult: () => {
        completedAtMs = Date.now() - t0
      },
    })
    const ctrl = useChordStackerController(base, { playTone: async () => {} })
    ctrl.setBase(60)

    // Act
    ctrl.startRounds()
    await vi.advanceTimersByTimeAsync(200_000)

    // Assert: five chords, each 4 x 600 ms played with 3 x 300 ms between,
    // 400 ms, 4 x (2500 ms sung + 500 ms), and 600 ms before the next.
    expect(completedAtMs).toBe(81_500)
    const runSec = 81.5
    expect(typicalRunSec(EXERCISE_CHORD_STACKER)).toBeGreaterThanOrEqual(runSec)
    // In line with it, too: no more than one of the table's 15 s steps over.
    expect(typicalRunSec(EXERCISE_CHORD_STACKER)).toBeLessThan(runSec + 15)
  })
})
