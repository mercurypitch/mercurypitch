// ============================================================
// Interval Trainer on a launch's own intervals
// ============================================================
//
// A launch (a lesson's slug, such as /exercises/leap-ladder) may hand the
// trainer its own intervals in place of the pool. The list sets the run's
// intervals, not its length: two intervals still make a run as long as the
// difficulty asks for, so they repeat, but never one twice running, and a
// run at least as long as the list plays every one of them.
//
// The draw is random, so the runs here are played on fixed seeds
// (seededRandom), never on Math.random's luck: a failure names its seed and
// replays exactly. The draw itself, which Drone Intonation shares, keeps its
// tests beside it in ../interval-rounds.test.ts. The runs without a launch
// keep their tests in src/tests/exercise-interval-trainer.test.ts, unchanged.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearLaunchOverride, setLaunchOverride, } from '@/features/practice-intelligence/launch-override'
import { seededRandom } from '@/lib/sequence/phrase-bank'
import { EXERCISE_INTERVAL_TRAINER } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'
import { intervalRangeLabel, plannedRounds, useIntervalTrainerController, } from './use-interval-trainer-controller'

/** Lesson 9's leaps: minor and major thirds, the fifth, the fourth, the octave. */
const LEAP_LADDER = [3, 4, 7, 5, 12]
/** Lesson 6's proposed fourths and fifths. */
const FOURTH_AND_FIFTH = [5, 7]

/** Every place a draw deals the same interval twice running. */
function repeatsIn(drawn: readonly number[]): number[] {
  return drawn.flatMap((s, i) => (i > 0 && s === drawn[i - 1] ? [i] : []))
}

describe('plannedRounds with a launch list', () => {
  it('asks for as many rounds as the difficulty does, however short the list', () => {
    const levels = Array.from({ length: 10 }, (_unused, i) => i + 1)
    const twelve = Array.from({ length: 12 }, (_unused, i) => i + 1)

    const forTwo = levels.map((d) => plannedRounds(d, FOURTH_AND_FIFTH))
    const forTwelve = levels.map((d) => plannedRounds(d, twelve))

    // The pool caps a run at its six; a list may repeat, so 9 and 10 go on.
    expect(forTwo).toEqual([4, 5, 5, 6, 6, 6, 7, 7, 8, 8])
    expect(forTwelve).toEqual(forTwo)
  })

  it('keeps the pool and its cap for an empty list', () => {
    const rounds = plannedRounds(10, [])

    expect(rounds).toBe(6)
  })
})

describe('intervalRangeLabel', () => {
  it('names a list from its narrowest interval to its widest', () => {
    expect(intervalRangeLabel(LEAP_LADDER)).toBe('Minor 3rd through Octave')
  })

  it('names both intervals of a two-interval list', () => {
    expect(intervalRangeLabel([7, 5])).toBe('Perfect 4th and Perfect 5th')
  })

  it('names the one interval of a one-interval list', () => {
    expect(intervalRangeLabel([12])).toBe('Octave')
  })
})

// ── The controller, launched with a list ─────────────────────────────

/** A silent singer's base that records each round as the trainer plays it. */
function recordingBase() {
  const rounds: Array<{ total: number; note1: number; note2: number }> = []
  const base: BaseExerciseController = {
    pitchHistory: () => [],
    _setTargetPitch: ((
      _v: number | null,
    ) => {}) as BaseExerciseController['_setTargetPitch'],
    _getElapsed: () => performance.now(),
    _isRunning: () => true,
    _setRunning: () => {},
    _commitResult: () => {},
    _updateScore: () => {},
    _updateMetrics: (m) => {
      if (typeof m.round === 'number') {
        rounds.push({
          total: m.totalRounds,
          note1: m.currentMidi,
          note2: Number.NaN,
        })
      } else if (m.noteIndex === 1 && typeof m.currentMidi === 'number') {
        const current = rounds.at(-1)
        if (current !== undefined) current.note2 = m.currentMidi
      }
    },
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
  }
  return { base, rounds }
}

/** Launch the trainer with these settings and play a whole run from C4. */
async function runLaunched(
  config: { intervals?: number[]; difficulty?: number },
  seed: number,
) {
  setLaunchOverride(EXERCISE_INTERVAL_TRAINER, {
    type: EXERCISE_INTERVAL_TRAINER,
    ...config,
  })
  vi.spyOn(Math, 'random').mockImplementation(seededRandom(seed))
  const { base, rounds } = recordingBase()
  const ctrl = useIntervalTrainerController(base, { playTone: async () => {} })
  ctrl.setBase(60)
  ctrl.startRounds()
  await vi.runAllTimersAsync()
  return rounds
}

describe('the trainer launched with intervals', () => {
  afterEach(() => {
    clearLaunchOverride()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('plays the launched intervals in place of the pool, each at least once', async () => {
    vi.useFakeTimers()

    const rounds = await runLaunched({ intervals: LEAP_LADDER }, 11)

    // Six rounds at the default level; the minor third is not in the pool.
    expect(rounds).toHaveLength(6)
    expect(rounds.every((r) => r.note1 === 60)).toBe(true)
    expect(new Set(rounds.map((r) => r.note2 - r.note1))).toEqual(
      new Set(LEAP_LADDER),
    )
  })

  it.each([
    [1, 4],
    [5, 6],
    [10, 8],
  ])(
    'runs two intervals at difficulty %i for %i rounds, never one twice running',
    async (difficulty, expected) => {
      vi.useFakeTimers()

      const rounds = await runLaunched(
        { intervals: FOURTH_AND_FIFTH, difficulty },
        5,
      )

      const spans = rounds.map((r) => r.note2 - r.note1)
      expect(spans).toHaveLength(expected)
      expect(rounds.every((r) => r.total === expected)).toBe(true)
      expect(new Set(spans)).toEqual(new Set(FOURTH_AND_FIFTH))
      expect(repeatsIn(spans)).toEqual([])
    },
  )

  // plannedRounds is what the idle hint shows (IntervalTrainerExercise.tsx).
  it.each(Array.from({ length: 10 }, (_unused, i) => i + 1))(
    'plays at difficulty %i the round count the idle hint promises',
    async (difficulty) => {
      vi.useFakeTimers()
      const promised = plannedRounds(difficulty, LEAP_LADDER)

      const rounds = await runLaunched(
        { intervals: LEAP_LADDER, difficulty },
        difficulty,
      )

      expect(rounds).toHaveLength(promised)
      expect(rounds.every((r) => r.total === promised)).toBe(true)
    },
  )
})
