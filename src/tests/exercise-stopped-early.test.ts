// ============================================================
// A run stopped before its end is practice, not a result
// ============================================================
//
// The round-based drills grade the rounds a run reached. Stopped after one
// round held in tune, Drone Intonation graded 100, the same as all six: the
// 85-point Subwoofer Sound challenge completed, the run counted for Perfect
// Run and Immaculate, and five such runs stepped the level up. Each stopped
// run below is held against the same run sung to its end, so every bar the
// stopped run leaves alone is one the whole run is shown to move.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionRecord } from '@/db/entities'
import type * as BadgeGrantEngine from '@/db/services/badge-grant-engine'
import type { GrantContext } from '@/db/services/grant-context'
import type { RunTrace } from '@/features/exercises/last-run-trace'
import type { ExerciseResult } from '@/features/exercises/types'
import type { BaseExerciseController } from '@/features/exercises/use-base-exercise'

const mocks = vi.hoisted(() => ({
  ownerId: 'singer-1',
  saveSessionRecord: vi.fn(async (record: object) => ({
    ...record,
    id: 'session-1',
  })),
  creditPracticeTime: vi.fn(async () => undefined),
  loadChallengeProgress: vi.fn(async () => []),
  saveChallengeProgress: vi.fn(async (progress: object) => ({
    ...progress,
    id: 'progress-1',
  })),
  checkAndGrantBadges: vi.fn(async () => undefined),
  grantBadgeByRef: vi.fn(async () => undefined),
  lastRunTrace: vi.fn<() => RunTrace | null>(() => null),
}))

vi.mock('@/db/services/user-service', () => ({
  getUserId: () => mocks.ownerId,
}))
vi.mock('@/db/services/session-service', () => ({
  saveSessionRecord: mocks.saveSessionRecord,
  creditPracticeTime: mocks.creditPracticeTime,
}))
vi.mock('@/db/services/challenges-service', () => ({
  loadChallengeProgress: mocks.loadChallengeProgress,
  saveChallengeProgress: mocks.saveChallengeProgress,
}))
vi.mock('@/db/services/badge-grant-engine', () => ({
  checkAndGrantBadges: mocks.checkAndGrantBadges,
  grantBadgeByRef: mocks.grantBadgeByRef,
}))
vi.mock('@/features/exercises/last-run-trace', () => ({
  lastRunTrace: mocks.lastRunTrace,
}))
vi.mock('@/features/challenges/challenge-trace', () => ({
  saveChallengeTrace: vi.fn(),
}))
vi.mock('@/features/challenges/challenge-result-store', () => ({
  presentChallengeResult: vi.fn(),
  whileFinalizing: async (work: () => Promise<void>) => work(),
}))
vi.mock('@/features/routines/use-daily-routine', () => ({
  autoAdvanceRoutineSegment: vi.fn(),
}))
vi.mock('@/stores/notifications-store', () => ({
  showNotification: vi.fn(),
}))
vi.mock('@/stores/usage-store', () => ({ recordCompletion: vi.fn() }))
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))

import { activeChallengeAttempt, beginChallengeAttempt, clearChallengeAttempt, } from '@/features/challenges/challenge-attempt'
import { activeWeeklyAttempt, beginWeeklyAttempt, clearWeeklyAttempt, } from '@/features/challenges/weekly-attempt'
import { useCallResponseController } from '@/features/exercises/call-response/use-call-response-controller'
import { useChordStackerController } from '@/features/exercises/chord-stacker/use-chord-stacker-controller'
import { useDroneIntonationController } from '@/features/exercises/drone-intonation/use-drone-intonation-controller'
import { useDynamicSwellController } from '@/features/exercises/dynamic-swell/use-dynamic-swell-controller'
import { exerciseScoringVersion } from '@/features/exercises/exercise-comparability'
import { useIntervalTrainerController } from '@/features/exercises/interval-trainer/use-interval-trainer-controller'
import { useLongNoteController } from '@/features/exercises/long-note/use-long-note-controller'
import { useMirrorMelodyController } from '@/features/exercises/mirror-melody/use-mirror-melody-controller'
import { usePitchHoldController } from '@/features/exercises/pitch-hold/use-pitch-hold-controller'
import { usePitchPursuitController } from '@/features/exercises/pitch-pursuit/use-pitch-pursuit-controller'
import { useRoutineRunnerController } from '@/features/exercises/routine-runner/use-routine-runner-controller'
import { useScaleRunnerController } from '@/features/exercises/scale-runner/use-scale-runner-controller'
import { useSirenController } from '@/features/exercises/siren/use-siren-controller'
import { useStaccatoPrecisionController } from '@/features/exercises/staccato-precision/use-staccato-precision-controller'
import type { RunEnd } from '@/features/exercises/timer-preference'
import { resetTimerPreference, setTimerMode, } from '@/features/exercises/timer-preference'
import { EXERCISE_DRONE_INTONATION, EXERCISE_LONG_NOTE, EXERCISE_SIREN, runStoppedEarly, } from '@/features/exercises/types'
import { useVibratoController } from '@/features/exercises/vibrato/use-vibrato-controller'
import { computeEma } from '@/features/practice-intelligence/adaptive-difficulty'
import { getDifficulty, updateDifficultyFromEma, } from '@/features/practice-intelligence/difficulty-store'
import { computePerExerciseStats } from '@/features/practice-intelligence/trends-computer'
import { findWeakExercises } from '@/features/practice-intelligence/weakness-analyzer'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { applyPersistedValue } from '@/lib/storage'
import { clearExerciseHistory, exerciseHistory, flushExerciseHistoryWrites, getExerciseStats, recordExerciseResult, } from '@/stores/exercise-history-store'

const { computeStats } = await vi.importActual<typeof BadgeGrantEngine>(
  '@/db/services/badge-grant-engine',
)

const SUBWOOFER_SOUND = {
  challengeId: 'subwoofer-sound',
  title: 'Subwoofer Sound',
  category: 'low-notes',
  exercise: EXERCISE_DRONE_INTONATION,
  targetScore: 85,
} as const

/** How long each recorded run was, as the base exercise's trace says. */
const RUN_MS = 5_200

function mockBase(
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

const quiet = { playTone: async () => {}, stopTone: () => {} }

/**
 * Drone Intonation over C4 with every round held dead on the note asked
 * for, stopped once `rounds` rounds are graded, or sung to its end. Runs on
 * fake timers.
 */
async function droneRun(rounds: number | 'all'): Promise<ExerciseResult> {
  let targetMidi = 60
  let result: ExerciseResult | null = null
  const ctrl = useDroneIntonationController(
    mockBase({
      _setTargetPitch: ((v: number | null) => {
        if (typeof v === 'number' && v > 0) {
          targetMidi = Math.round(12 * Math.log2(v / 440) + 69)
        }
        return v
      }) as BaseExerciseController['_setTargetPitch'],
      pitchHistory: () =>
        Array.from({ length: 80 }, (_, i) => ({
          freq: midiToFrequency(targetMidi),
          time: 100 + i * 0.05,
          cents: 0,
          clarity: 0.9,
        })),
      _completeWithResult: (r) => {
        result = r
      },
    }),
    quiet,
  )
  ctrl.setBase(60)
  await ctrl.startRounds()
  if (rounds === 'all') {
    await vi.advanceTimersByTimeAsync(80_000)
  } else {
    while (ctrl.computeResult().metrics.roundsCompleted < rounds) {
      await vi.advanceTimersByTimeAsync(100)
    }
    ctrl.stopRounds()
  }
  if (result === null) throw new Error('the run never finished')
  return result
}

/** Record a finished run the way every drill component does, and settle. */
async function record(result: ExerciseResult): Promise<void> {
  mocks.lastRunTrace.mockReturnValue({
    type: result.type,
    completedAt: result.completedAt,
    durationMs: RUN_MS,
    samples: [],
    targets: [],
  })
  recordExerciseResult({
    type: result.type,
    score: result.score,
    metrics: result.metrics,
    completedAt: result.completedAt,
  })
  await flushExerciseHistoryWrites()
}

/** The goals' stats over every session record the runs wrote. */
function goalStats() {
  const records = mocks.saveSessionRecord.mock.calls.map(
    ([written]) =>
      ({ endedAt: '2026-11-03T12:00:00.000Z', ...written }) as SessionRecord,
  )
  const ctx: GrantContext = {
    badges: [],
    userBadges: [],
    achievements: [],
    userAchievements: [],
    records,
    challengeDefs: [],
    challengeProgress: [],
    activityRows: [],
    currentStreak: 0,
    voiceprintCount: 0,
    followingCount: 0,
    sharesPosted: 0,
  }
  return computeStats(ctx, 0)
}

const resetLevels = (): void => {
  applyPersistedValue('mercurypitch_exercise_difficulty', JSON.stringify({}))
  applyPersistedValue(
    'mercurypitch_exercise_difficulty_adjusted_at',
    JSON.stringify({}),
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  mocks.ownerId = 'singer-1'
  localStorage.clear()
  clearExerciseHistory()
  resetLevels()
  clearChallengeAttempt()
  clearWeeklyAttempt()
})

afterEach(async () => {
  vi.useRealTimers()
  await flushExerciseHistoryWrites()
  clearExerciseHistory()
  resetLevels()
})

describe('a Drone Intonation run stopped after one round', () => {
  it('grades the round it reached and carries the mark, where a whole run carries none', async () => {
    const stopped = await droneRun(1)
    const whole = await droneRun('all')
    // Stop in the pause after the last round is graded: a whole run.
    const stoppedAtTheEnd = await droneRun(6)

    expect(stopped.metrics.roundsCompleted).toBe(1)
    expect(stopped.score).toBe(100)
    expect(stopped.metrics.stoppedEarly).toBe(1)
    expect(whole.score).toBe(100)
    expect(whole.metrics).not.toHaveProperty('stoppedEarly')
    expect(stoppedAtTheEnd.metrics.roundsCompleted).toBe(6)
    expect(stoppedAtTheEnd.metrics).not.toHaveProperty('stoppedEarly')
  })

  it('completes no challenge and earns no goal, where the whole run does both', async () => {
    beginChallengeAttempt(SUBWOOFER_SOUND)

    await record(await droneRun(1))

    // No attempt, no record for the grant pass to read, no reward.
    expect(mocks.saveChallengeProgress).not.toHaveBeenCalled()
    expect(mocks.saveSessionRecord).not.toHaveBeenCalled()
    expect(mocks.grantBadgeByRef).not.toHaveBeenCalled()
    expect(mocks.checkAndGrantBadges).not.toHaveBeenCalled()
    expect(goalStats()).toMatchObject({
      hasPerfectSession: false,
      immaculateRuns: 0,
      totalSessions: 0,
    })
    // The challenge stays armed for a whole run...
    expect(activeChallengeAttempt()?.challengeId).toBe('subwoofer-sound')
    // ...the time it took still counts toward the day and the streak...
    expect(mocks.creditPracticeTime).toHaveBeenCalledWith(RUN_MS, 'singer-1')
    // ...and the history keeps what was sung.
    expect(runStoppedEarly(exerciseHistory()[0]?.metrics)).toBe(true)

    await record(await droneRun('all'))

    expect(mocks.saveChallengeProgress).toHaveBeenCalledWith(
      expect.objectContaining({ completed: true, bestScore: 100 }),
      'singer-1',
    )
    expect(mocks.saveSessionRecord).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'challenge', score: 100 }),
      'singer-1',
    )
    expect(mocks.checkAndGrantBadges).toHaveBeenCalledWith('singer-1')
    expect(goalStats()).toMatchObject({
      hasPerfectSession: true,
      immaculateRuns: 1,
      totalSessions: 1,
    })
    expect(mocks.creditPracticeTime).toHaveBeenCalledTimes(1)
  })

  it('is no Legend attempt, where the whole run is one', async () => {
    beginWeeklyAttempt({
      challengeId: 'weekly-1',
      title: 'Low and steady',
      exercise: EXERCISE_DRONE_INTONATION,
      targetScore: 85,
    })

    await record(await droneRun(1))

    expect(mocks.saveSessionRecord).not.toHaveBeenCalled()
    expect(activeWeeklyAttempt()?.challengeId).toBe('weekly-1')

    await record(await droneRun('all'))

    expect(mocks.saveSessionRecord).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'weekly', score: 100 }),
      'singer-1',
    )
  })

  it('still tells a challenge armed for another drill that the singer moved on', async () => {
    beginChallengeAttempt({ ...SUBWOOFER_SOUND, exercise: EXERCISE_SIREN })
    const stopped = await droneRun(1)

    await record(stopped)

    expect(runStoppedEarly(stopped.metrics)).toBe(true)
    expect(activeChallengeAttempt()).toBeNull()
  })

  it('moves no level five times over, where five whole runs step it up', async () => {
    const stoppedLevels: Array<number | null> = []
    for (let i = 0; i < 5; i++) {
      await record(await droneRun(1))
      stoppedLevels.push(updateDifficultyFromEma(EXERCISE_DRONE_INTONATION))
    }

    expect(stoppedLevels).toEqual([null, null, null, null, null])
    expect(getDifficulty(EXERCISE_DRONE_INTONATION)).toBe(5)
    expect(computeEma(EXERCISE_DRONE_INTONATION)).toBeNull()
    expect(getExerciseStats(EXERCISE_DRONE_INTONATION)).toMatchObject({
      bestScore: 0,
      totalPlays: 0,
    })

    const wholeLevels: Array<number | null> = []
    for (let i = 0; i < 5; i++) {
      await record(await droneRun('all'))
      wholeLevels.push(updateDifficultyFromEma(EXERCISE_DRONE_INTONATION))
    }

    expect(wholeLevels).toEqual([null, null, null, null, 6])
    expect(getExerciseStats(EXERCISE_DRONE_INTONATION)).toMatchObject({
      bestScore: 100,
      totalPlays: 5,
    })
  })
})

describe('a run recorded before the mark', () => {
  it('still counts toward the best, the level, the weak list and the trends', () => {
    // One run from before the mark existed, beside a stopped one that
    // graded higher on the round it reached. Only the first is a run.
    applyPersistedValue(
      'mercurypitch_exercise_history',
      JSON.stringify([
        {
          type: EXERCISE_DRONE_INTONATION,
          score: 100,
          metrics: { roundsCompleted: 1, stoppedEarly: 1 },
          completedAt: 2,
          scoringVersion: exerciseScoringVersion(EXERCISE_DRONE_INTONATION),
        },
        {
          type: EXERCISE_DRONE_INTONATION,
          score: 40,
          metrics: { roundsCompleted: 6 },
          completedAt: 1,
          scoringVersion: exerciseScoringVersion(EXERCISE_DRONE_INTONATION),
        },
      ]),
    )

    expect(getExerciseStats(EXERCISE_DRONE_INTONATION)).toEqual({
      bestScore: 40,
      totalPlays: 1,
      lastScore: 40,
      lastPlayedAt: 1,
      avgScore: 40,
    })
    expect(computeEma(EXERCISE_DRONE_INTONATION)).toBe(40)
    expect(findWeakExercises()).toEqual([
      expect.objectContaining({
        type: EXERCISE_DRONE_INTONATION,
        recentAvg: 40,
        totalPlays: 1,
      }),
    ])
    expect(computePerExerciseStats()).toEqual([
      expect.objectContaining({
        type: EXERCISE_DRONE_INTONATION,
        bestScore: 40,
        totalPlays: 1,
      }),
    ])
  })
})

describe('every drill that grades the rounds it reached', () => {
  // Stopped before a single round is graded: the shortest stop there is,
  // and one each drill used to record as a low run. Arpeggio Jumper, which
  // marked its stopped runs first, has its own tests.
  const drills: Array<[string, (base: BaseExerciseController) => () => void]> =
    [
      [
        'Scale Runner',
        (base) => {
          const c = useScaleRunnerController(base, quiet)
          c.setScale(60, 'major', 'up')
          return c.stopScale
        },
      ],
      [
        'Drone Intonation',
        (base) => {
          const c = useDroneIntonationController(base, quiet)
          c.setBase(60)
          return c.stopRounds
        },
      ],
      [
        'Siren',
        (base) => {
          const c = useSirenController(base, quiet)
          c.setBase(60, 48, 72)
          return c.stopRounds
        },
      ],
      [
        'Chord Stacker',
        (base) => {
          const c = useChordStackerController(base, quiet)
          c.setBase(60)
          return c.stopRounds
        },
      ],
      [
        'Interval Trainer',
        (base) => {
          const c = useIntervalTrainerController(base, quiet)
          c.setBase(60)
          return c.stopRounds
        },
      ],
      [
        'Call & Response',
        (base) => {
          const c = useCallResponseController(base, quiet)
          c.setBase(60, { min: 48, max: 72 })
          return c.stopRounds
        },
      ],
      [
        'Dynamic Swell',
        (base) => {
          const c = useDynamicSwellController(base, quiet)
          c.setBase(60)
          return c.stopRounds
        },
      ],
      [
        'Mirror Melody',
        (base) => {
          const c = useMirrorMelodyController(base, quiet)
          c.setMelody(60, { min: 48, max: 72 })
          return c.stopSequence
        },
      ],
      [
        'Staccato Precision',
        (base) => {
          const c = useStaccatoPrecisionController(base, quiet)
          c.setBase(60)
          return c.stopRounds
        },
      ],
      [
        'Routine Runner',
        (base) => {
          const c = useRoutineRunnerController(base, quiet)
          c.setBase(60)
          return c.stopRoutine
        },
      ],
      ['Pitch Pursuit', (base) => usePitchPursuitController(base).stopGame],
    ]

  it.each(drills)('%s marks a run stopped before its end', (_name, setUp) => {
    const results: ExerciseResult[] = []
    const stop = setUp(
      mockBase({ _completeWithResult: (r) => results.push(r) }),
    )

    stop()

    expect(results).toHaveLength(1)
    expect(runStoppedEarly(results[0]!.metrics)).toBe(true)
  })
})

describe('a timed drill stopped before its timer runs out', () => {
  // Long Note, Pitch Hold and Vibrato end on their timer, ten seconds by
  // default. A Stop before it ended the run short of the length the singer
  // chose and was graded as a whole run: one second of Long Note held in
  // tune scored 86, and Vibrato grades only its last four seconds. On
  // Manual there is no length to fall short of, and the Stop is the end.
  const ROCK_SOLID = {
    challengeId: 'rock-solid',
    title: 'Rock Solid',
    category: 'basics',
    exercise: EXERCISE_LONG_NOTE,
    targetScore: 70,
  } as const

  const timed: Array<
    [string, (base: BaseExerciseController) => (end?: RunEnd) => ExerciseResult]
  > = [
    [
      'Long Note',
      (base) => {
        const c = useLongNoteController(base)
        c.setTarget(69)
        return c.stopAndCompute
      },
    ],
    [
      'Pitch Hold',
      (base) => {
        const c = usePitchHoldController(base)
        c.setTarget(69)
        return c.stopAndCompute
      },
    ],
    ['Vibrato', (base) => useVibratoController(base).stopAndCompute],
  ]

  /** A4 held dead in tune for `seconds`, as the engine records it. */
  const inTuneFor = (seconds: number): BaseExerciseController =>
    mockBase({
      pitchHistory: () =>
        Array.from({ length: seconds * 20 + 1 }, (_, i) => ({
          freq: 440,
          time: i * 0.05,
          cents: 0,
          clarity: 0.9,
        })),
      _getElapsed: () => seconds * 1000,
    })

  afterEach(() => {
    resetTimerPreference()
  })

  it.each(timed)(
    '%s marks a Stop while its timer runs, and neither its timer nor Manual',
    (_name, setUp) => {
      setTimerMode(10)
      const stopped = setUp(mockBase())()
      const timedOut = setUp(mockBase())('timer')
      setTimerMode('manual')
      const manual = setUp(mockBase())()

      expect(runStoppedEarly(stopped.metrics)).toBe(true)
      expect(runStoppedEarly(timedOut.metrics)).toBe(false)
      expect(runStoppedEarly(manual.metrics)).toBe(false)
    },
  )

  it('completes no basics challenge with one second of Long Note, where the run to its timer does', async () => {
    setTimerMode(10)
    beginChallengeAttempt(ROCK_SOLID)
    const short = useLongNoteController(inTuneFor(1))
    short.setTarget(69)
    const stopped = short.stopAndCompute()

    await record(stopped)

    // It graded past the bar on the second it reached, and passed nothing.
    expect(stopped.score).toBeGreaterThanOrEqual(ROCK_SOLID.targetScore)
    expect(mocks.saveChallengeProgress).not.toHaveBeenCalled()
    expect(mocks.saveSessionRecord).not.toHaveBeenCalled()
    expect(activeChallengeAttempt()?.challengeId).toBe('rock-solid')

    const whole = useLongNoteController(inTuneFor(10))
    whole.setTarget(69)
    await record(whole.stopAndCompute('timer'))

    expect(mocks.saveChallengeProgress).toHaveBeenCalledWith(
      expect.objectContaining({ completed: true, bestScore: 100 }),
      'singer-1',
    )
  })

  it('leaves a guided Pitch Hold unmarked: its Stop is the stop rule, and it records nothing', () => {
    setTimerMode(10)
    const guided = usePitchHoldController(mockBase(), {
      fixedZoneCents: 35,
      fixedTargetDurationSeconds: 5,
    })
    guided.setTarget(69)

    expect(runStoppedEarly(guided.stopAndCompute().metrics)).toBe(false)
  })
})
