// ============================================================
// Drone Intonation on a launch's own intervals
// ============================================================
//
// A launch (a lesson's slug, such as /exercises/thirds-on-a-drone) may hand
// the drill its own intervals in place of the pool. The list sets the run's
// intervals, not its length: two thirds still make a run as long as the
// difficulty asks for, so they come back, but never one twice running. With
// no launch the pool, its shuffle and its cap are as they were.
//
// The draw is random, so the runs are played on many fixed seeds
// (seededRandom), never on Math.random's luck: a failure names its seed and
// replays exactly. The scoring keeps its tests in
// src/tests/exercise-drone-intonation.test.ts, unchanged.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetAllDifficulties, setDifficulty, } from '@/features/practice-intelligence/difficulty-store'
import { clearLaunchOverride, setLaunchOverride, } from '@/features/practice-intelligence/launch-override'
import { seededRandom } from '@/lib/sequence/phrase-bank'
import { EXERCISE_DRONE_INTONATION } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'
import { droneIntervalLabel, droneIntervalNames, plannedRounds, useDroneIntonationController, } from './use-drone-intonation-controller'

/** Lesson 10's two thirds, minor and major, each upward. */
const THIRDS = [3, 4]
/** Drone's own pool, the unison among it. */
const POOL = [0, 3, 4, 5, 7, 12]
const SEEDS = Array.from({ length: 100 }, (_unused, i) => i + 1)
const LEVELS = [1, 5, 10]

/** Every place a run asks for the same interval twice running. */
function repeatsIn(spans: readonly number[]): number[] {
  return spans.flatMap((s, i) => (i > 0 && s === spans[i - 1] ? [i] : []))
}

/** A silent singer's base that records each round as the drill sets it up. */
function recordingBase() {
  const rounds: Array<{ total: number; interval: number; drone: number }> = []
  const base: BaseExerciseController = {
    pitchHistory: () => [],
    _setTargetPitch: ((
      _v: number | null,
    ) => {}) as BaseExerciseController['_setTargetPitch'],
    _getElapsed: () => 0,
    _isRunning: () => true,
    _setRunning: () => {},
    _commitResult: () => {},
    _updateScore: () => {},
    _updateMetrics: (m) => {
      if (typeof m.round === 'number') {
        rounds.push({
          total: m.totalRounds,
          interval: m.intervalSemitones,
          drone: m.droneMidi,
        })
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

/** Play a whole run on a C4 drone, on this seed, and return its rounds. */
async function playRun(seed: number) {
  vi.spyOn(Math, 'random').mockImplementation(seededRandom(seed))
  const { base, rounds } = recordingBase()
  const ctrl = useDroneIntonationController(base, {
    playTone: async () => {},
    stopTone: () => {},
  })
  ctrl.setBase(60)
  await ctrl.startRounds()
  await vi.runAllTimersAsync()
  vi.restoreAllMocks()
  return rounds
}

/** Launch the drill with these settings, then play a whole run. */
async function runLaunched(
  config: { intervals?: number[]; difficulty?: number },
  seed: number,
) {
  setLaunchOverride(EXERCISE_DRONE_INTONATION, {
    type: EXERCISE_DRONE_INTONATION,
    ...config,
  })
  return playRun(seed)
}

describe('plannedRounds', () => {
  it("asks a launch's list for as many rounds as the difficulty does", () => {
    const levels = Array.from({ length: 10 }, (_unused, i) => i + 1)

    const forThirds = levels.map((d) => plannedRounds(d, THIRDS))

    // The pool would stop at its six; two thirds go on to 7 and 8.
    expect(forThirds).toEqual([4, 5, 5, 6, 6, 6, 7, 7, 8, 8])
  })

  it('caps a run on the pool at the pool', () => {
    const levels = Array.from({ length: 10 }, (_unused, i) => i + 1)

    const forPool = levels.map((d) => plannedRounds(d))

    expect(forPool).toEqual([4, 5, 5, 6, 6, 6, 6, 6, 6, 6])
  })
})

describe("Drone's names for its intervals", () => {
  it('names the two thirds as its pool does', () => {
    expect(droneIntervalLabel(3)).toBe('Minor 3rd')
    expect(droneIntervalLabel(4)).toBe('Major 3rd')
  })

  it('has no name for an interval outside its pool', () => {
    expect(droneIntervalLabel(2)).toBeUndefined()
  })

  it('names both thirds for the idle hint, narrowest first', () => {
    expect(droneIntervalNames([4, 3])).toBe('Minor 3rd and Major 3rd')
  })

  it('names every interval of a longer list, not a range through the pool', () => {
    expect(droneIntervalNames([12, 3, 7])).toBe(
      'Minor 3rd, Perfect 5th and Octave',
    )
  })
})

describe('Drone Intonation launched with the two thirds', () => {
  afterEach(() => {
    clearLaunchOverride()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it.each([
    [1, 4],
    [5, 6],
    [10, 8],
  ])(
    'runs at difficulty %i for %i rounds, every one of them announcing that count',
    async (difficulty, expected) => {
      vi.useFakeTimers()

      const rounds = await runLaunched({ intervals: THIRDS, difficulty }, 5)

      expect(rounds).toHaveLength(expected)
      expect(rounds.every((r) => r.total === expected)).toBe(true)
    },
  )

  it('never asks for the same third twice running, over many seeded runs', async () => {
    vi.useFakeTimers()
    const repeats: string[] = []

    for (const difficulty of LEVELS) {
      for (const seed of SEEDS) {
        const rounds = await runLaunched(
          { intervals: THIRDS, difficulty },
          seed,
        )
        if (repeatsIn(rounds.map((r) => r.interval)).length > 0) {
          repeats.push(`difficulty ${difficulty} seed ${seed}`)
        }
      }
    }

    expect(repeats).toEqual([])
  })

  it('asks for both thirds, and nothing else, in every run', async () => {
    vi.useFakeTimers()
    const off: string[] = []

    for (const difficulty of LEVELS) {
      for (const seed of SEEDS) {
        const rounds = await runLaunched(
          { intervals: THIRDS, difficulty },
          seed,
        )
        const asked = [...new Set(rounds.map((r) => r.interval))].sort()
        if (asked.join(',') !== '3,4') {
          off.push(`difficulty ${difficulty} seed ${seed}: ${asked.join(',')}`)
        }
      }
    }

    expect(off).toEqual([])
  })

  it('names each round a minor or a major third, over the drone it set', async () => {
    vi.useFakeTimers()

    const rounds = await runLaunched({ intervals: THIRDS }, 11)

    const named = rounds.map((r) => droneIntervalLabel(r.interval))
    expect(new Set(named)).toEqual(new Set(['Minor 3rd', 'Major 3rd']))
    expect(rounds.every((r) => r.drone === 60)).toBe(true)
  })

  it('keeps of a launch only the intervals Drone names', async () => {
    vi.useFakeTimers()

    // The major second and the major sixth are not Drone's.
    const rounds = await runLaunched({ intervals: [2, 3, 9, 4] }, 3)

    expect(new Set(rounds.map((r) => r.interval))).toEqual(new Set(THIRDS))
    expect(rounds).toHaveLength(6)
  })

  it('keeps the pool when a launch names none of its intervals', async () => {
    vi.useFakeTimers()

    const rounds = await runLaunched({ intervals: [2, 9], difficulty: 10 }, 3)

    // Capped at the pool's six, each of the pool's intervals once.
    expect(rounds.map((r) => r.interval).sort((a, b) => a - b)).toEqual(POOL)
  })
})

describe('Drone Intonation without a launch', () => {
  afterEach(() => {
    resetAllDifficulties()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it.each([
    [1, 4],
    [5, 6],
    [10, 6],
  ])(
    'runs at stored difficulty %i for %i rounds, capped at the pool',
    async (difficulty, expected) => {
      vi.useFakeTimers()
      setDifficulty(EXERCISE_DRONE_INTONATION, difficulty)

      const rounds = await playRun(7)

      expect(rounds).toHaveLength(expected)
      expect(rounds.every((r) => r.total === expected)).toBe(true)
    },
  )

  it('asks for each interval of the pool at most once a run', async () => {
    vi.useFakeTimers()
    const twice: string[] = []

    for (const seed of SEEDS) {
      const spans = (await playRun(seed)).map((r) => r.interval)
      const fromPool = spans.every((s) => POOL.includes(s))
      if (!fromPool || new Set(spans).size !== spans.length) {
        twice.push(`seed ${seed}: ${spans.join(',')}`)
      }
    }

    expect(twice).toEqual([])
  })

  it('can ask for the unison, as the pool always could', async () => {
    vi.useFakeTimers()
    setDifficulty(EXERCISE_DRONE_INTONATION, 1)
    let withUnison = 0

    for (const seed of SEEDS) {
      const spans = (await playRun(seed)).map((r) => r.interval)
      if (spans.includes(0)) withUnison++
    }

    // A four-round run leaves two of the six out, so some runs lack it.
    expect(withUnison).toBeGreaterThan(0)
    expect(withUnison).toBeLessThan(SEEDS.length)
  })
})
