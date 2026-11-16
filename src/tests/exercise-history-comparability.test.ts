// ============================================================
// Plain drill runs carry a comparability key (CLAUDE-JOURNEY-007)
// ============================================================
//
// The Progress page only threads history rows whose session records share a
// persisted comparabilityKey — an explicit key is the proof that scoring
// semantics match. Challenge and weekly attempts always wrote one; the plain
// exercise path never did, so repeating the same drill never created a
// Skill Thread and every plain row read "cannot be compared like for like".

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHORD_SETS, chordMask, } from '@/features/exercises/chord-stacker/chord-stacker-chords'
import { exerciseComparabilityKey, exerciseRunRecord, } from '@/features/exercises/exercise-comparability'
import { EXERCISE_ARPEGGIO_JUMPER, EXERCISE_CHORD_STACKER, EXERCISE_DRONE_INTONATION, EXERCISE_INTERVAL_TRAINER, EXERCISE_LONG_NOTE, EXERCISE_PITCH_HOLD, EXERCISE_SCALE_RUNNER, EXERCISE_SIREN, } from '@/features/exercises/types'
import { applyPersistedValue } from '@/lib/storage'

const saveSessionRecord = vi.fn(async (..._args: unknown[]) => null)

vi.mock('@/db/services/session-service', () => ({
  saveSessionRecord: (...args: unknown[]) => saveSessionRecord(...args),
}))
vi.mock('@/db/services/badge-grant-engine', () => ({
  checkAndGrantBadges: async () => {},
}))
vi.mock('@/db/services/user-service', () => ({
  getUserId: () => 'user-1',
}))
vi.mock('@/features/challenges/challenge-attempt', () => ({
  recordChallengeAttempt: async () => false,
}))
vi.mock('@/features/challenges/weekly-attempt', () => ({
  recordWeeklyAttempt: async () => false,
}))
vi.mock('@/features/routines/use-daily-routine', () => ({
  autoAdvanceRoutineSegment: () => {},
}))
vi.mock('@/stores/usage-store', () => ({
  recordCompletion: () => {},
}))

describe('exerciseComparabilityKey', () => {
  it('keys a drill by its type and scoring version', () => {
    expect(exerciseComparabilityKey(EXERCISE_LONG_NOTE)).toBe(
      'voice:exercise:long-note:v1',
    )
    expect(exerciseComparabilityKey(EXERCISE_PITCH_HOLD)).toBe(
      'voice:exercise:pitch-hold:v1',
    )
  })

  it('starts a fresh ruler for a drill whose scoring was redesigned', () => {
    // The interval trainer's old whole-window average scored a correct
    // performance ~0; scores across that redesign share no ruler.
    expect(exerciseComparabilityKey(EXERCISE_INTERVAL_TRAINER)).toBe(
      'voice:exercise:interval-trainer:v2',
    )
    // The Siren's 30 % part scored jumps until it scored the glide itself.
    expect(exerciseComparabilityKey(EXERCISE_SIREN)).toBe(
      'voice:exercise:siren:v2',
    )
    // Arpeggio Jumper's grade became the mean of its note scores: version
    // 1 could not pass 75, version 2 grades a flawless run 100.
    expect(exerciseComparabilityKey(EXERCISE_ARPEGGIO_JUMPER)).toBe(
      'voice:exercise:arpeggio-jumper:v2',
    )
    // Scale Runner's and Drone Intonation's weights summed to 0.8 once
    // richness left them: version 1 could not pass 80, version 2 grades a
    // flawless run 100.
    expect(exerciseComparabilityKey(EXERCISE_SCALE_RUNNER)).toBe(
      'voice:exercise:scale-runner:v2',
    )
    expect(exerciseComparabilityKey(EXERCISE_DRONE_INTONATION)).toBe(
      'voice:exercise:drone-intonation:v2',
    )
  })
})

describe('recordExerciseResult persists the key', () => {
  beforeEach(() => {
    saveSessionRecord.mockClear()
    localStorage.clear()
  })

  it('stamps the plain-exercise session record as comparable', async () => {
    const { recordExerciseResult } =
      await import('@/stores/exercise-history-store')
    recordExerciseResult({
      type: EXERCISE_LONG_NOTE,
      score: 82,
      metrics: { durationMs: 30_000 },
      completedAt: 1_755_000_000_000,
    })
    await vi.waitFor(() => expect(saveSessionRecord).toHaveBeenCalledOnce())
    const payload = saveSessionRecord.mock.calls[0]![0] as {
      source: string
      sourceRef: string
      comparabilityKey?: string
    }
    expect(payload.source).toBe('exercise')
    expect(payload.sourceRef).toBe(EXERCISE_LONG_NOTE)
    // Without this, no repeat of a drill ever forms a Skill Thread and the
    // row is stamped "cannot be compared like for like".
    expect(payload.comparabilityKey).toBe('voice:exercise:long-note:v1')
  })
})

describe('local bests compare only runs scored the same way', () => {
  // The result screen's best and last, the menu card and the score chip
  // read local history, which recorded no scoring version until October
  // 2026: a Siren run scored the new way was held against the old ones.
  const seed = (entries: object[]) =>
    applyPersistedValue(
      'mercurypitch_exercise_history',
      JSON.stringify(entries),
    )

  beforeEach(() => {
    localStorage.clear()
    seed([])
  })

  it("stores a recorded run with its drill's current version", async () => {
    const {
      exerciseHistory,
      flushExerciseHistoryWrites,
      recordExerciseResult,
    } = await import('@/stores/exercise-history-store')
    recordExerciseResult({
      type: EXERCISE_SIREN,
      score: 70,
      metrics: {},
      completedAt: 2,
    })
    recordExerciseResult({
      type: EXERCISE_LONG_NOTE,
      score: 82,
      metrics: {},
      completedAt: 3,
    })
    recordExerciseResult({
      type: EXERCISE_ARPEGGIO_JUMPER,
      score: 100,
      metrics: {},
      completedAt: 4,
    })
    recordExerciseResult({
      type: EXERCISE_SCALE_RUNNER,
      score: 100,
      metrics: {},
      completedAt: 5,
    })
    recordExerciseResult({
      type: EXERCISE_DRONE_INTONATION,
      score: 100,
      metrics: {},
      completedAt: 6,
    })
    await flushExerciseHistoryWrites()
    expect(exerciseHistory().map((e) => [e.type, e.scoringVersion])).toEqual([
      [EXERCISE_DRONE_INTONATION, 2],
      [EXERCISE_SCALE_RUNNER, 2],
      [EXERCISE_ARPEGGIO_JUMPER, 2],
      [EXERCISE_LONG_NOTE, 1],
      [EXERCISE_SIREN, 2],
    ])
  })

  it('leaves unstamped Siren runs out of the stats, and counts a stamped one', async () => {
    const { getExerciseStats } = await import('@/stores/exercise-history-store')
    // Scored before the Siren's glide part was rescored, and never stamped.
    const old = [
      { type: EXERCISE_SIREN, score: 90, metrics: {}, completedAt: 2 },
      { type: EXERCISE_SIREN, score: 80, metrics: {}, completedAt: 1 },
    ]
    seed(old)
    expect(getExerciseStats(EXERCISE_SIREN).totalPlays).toBe(0)

    seed([
      {
        type: EXERCISE_SIREN,
        score: 60,
        metrics: {},
        completedAt: 3,
        scoringVersion: 2,
      },
      ...old,
    ])
    expect(getExerciseStats(EXERCISE_SIREN)).toEqual({
      bestScore: 60,
      totalPlays: 1,
      lastScore: 60,
      lastPlayedAt: 3,
      avgScore: 60,
    })
  })

  it('still counts unstamped interval-trainer runs', async () => {
    const { getExerciseStats } = await import('@/stores/exercise-history-store')
    // They mix its two scorings and have always counted as its second.
    seed([
      {
        type: EXERCISE_INTERVAL_TRAINER,
        score: 75,
        metrics: {},
        completedAt: 1,
      },
    ])
    expect(getExerciseStats(EXERCISE_INTERVAL_TRAINER)).toMatchObject({
      bestScore: 75,
      totalPlays: 1,
    })
  })

  it('counts an unstamped run of a drill still on version 1', async () => {
    const { getExerciseStats } = await import('@/stores/exercise-history-store')
    seed([{ type: EXERCISE_LONG_NOTE, score: 82, metrics: {}, completedAt: 1 }])
    expect(getExerciseStats(EXERCISE_LONG_NOTE)).toMatchObject({
      bestScore: 82,
      totalPlays: 1,
    })
  })
})

describe("a drill's forms are records of their own", () => {
  // Chord Stacker's triads are not its sevenths: a run's form goes on the
  // end of its key, so Progress threads each apart, and the result card's
  // best reads the runs of the form chosen. The five sevenths in root
  // position keep the key every run before the forms was recorded under.
  const seed = (entries: object[]) =>
    applyPersistedValue(
      'mercurypitch_exercise_history',
      JSON.stringify(entries),
    )
  const sevenths = chordMask(CHORD_SETS.sevenths)
  const triads = chordMask(CHORD_SETS.triads)

  beforeEach(() => {
    saveSessionRecord.mockClear()
    localStorage.clear()
    seed([])
  })

  it('keys a form after the version, and the first form as it always was', () => {
    expect(exerciseComparabilityKey(EXERCISE_CHORD_STACKER, 'triads')).toBe(
      'voice:exercise:chord-stacker:v1:triads',
    )
    expect(exerciseComparabilityKey(EXERCISE_CHORD_STACKER, '')).toBe(
      'voice:exercise:chord-stacker:v1',
    )
  })

  it('reads a run recorded before the forms as the first form', () => {
    expect(
      exerciseRunRecord(EXERCISE_CHORD_STACKER, { avgAccuracy: 80 }),
    ).toEqual({
      key: '',
      words: '',
    })
    expect(
      exerciseRunRecord(EXERCISE_CHORD_STACKER, {
        chordMask: sevenths,
        inversions: 0,
      }).key,
    ).toBe('')
  })

  it("persists a triad run under its form's key, named for it", async () => {
    const { recordExerciseResult } =
      await import('@/stores/exercise-history-store')
    recordExerciseResult({
      type: EXERCISE_CHORD_STACKER,
      score: 88,
      metrics: { chordMask: triads, inversions: 1 },
      completedAt: 7,
    })
    await vi.waitFor(() => expect(saveSessionRecord).toHaveBeenCalledOnce())
    const payload = saveSessionRecord.mock.calls[0]![0] as {
      melodyName: string
      comparabilityKey?: string
    }

    expect(payload.comparabilityKey).toBe(
      'voice:exercise:chord-stacker:v1:triads-inversions',
    )
    expect(payload.melodyName).toBe(
      'Exercise: Chord Stacker · Triads, with inversions',
    )
  })

  it("holds a form's best to that form's runs, and the menu's to all of them", async () => {
    const { getExerciseStats } = await import('@/stores/exercise-history-store')
    seed([
      {
        type: EXERCISE_CHORD_STACKER,
        score: 95,
        metrics: { chordMask: triads, inversions: 0 },
        completedAt: 3,
        scoringVersion: 1,
      },
      {
        type: EXERCISE_CHORD_STACKER,
        score: 70,
        metrics: { chordMask: sevenths, inversions: 0 },
        completedAt: 2,
        scoringVersion: 1,
      },
      // Recorded before the forms: the sevenths, in root position.
      { type: EXERCISE_CHORD_STACKER, score: 60, metrics: {}, completedAt: 1 },
    ])

    expect(getExerciseStats(EXERCISE_CHORD_STACKER, '')).toMatchObject({
      bestScore: 70,
      lastScore: 70,
      totalPlays: 2,
    })
    expect(getExerciseStats(EXERCISE_CHORD_STACKER, 'triads')).toMatchObject({
      bestScore: 95,
      totalPlays: 1,
    })
    expect(getExerciseStats(EXERCISE_CHORD_STACKER)).toMatchObject({
      bestScore: 95,
      totalPlays: 3,
    })
  })
})

describe("Drone Intonation's two tunings are records of their own", () => {
  // A pure major third is 13.69 cents under the piano's: one note held
  // true scores 100 in one tuning and 79 in the other.
  beforeEach(() => {
    saveSessionRecord.mockClear()
    localStorage.clear()
  })

  it('reads a pure run as its own form, and a piano run as the first', () => {
    expect(
      exerciseRunRecord(EXERCISE_DRONE_INTONATION, { pureTuning: 1 }),
    ).toEqual({ key: 'pure', words: 'Pure tuning' })
    expect(
      exerciseRunRecord(EXERCISE_DRONE_INTONATION, { pureTuning: 0 }).key,
    ).toBe('')
    expect(exerciseRunRecord(EXERCISE_DRONE_INTONATION, {}).key).toBe('')
  })

  it('persists a pure run under its own key, named for its tuning', async () => {
    const { recordExerciseResult } =
      await import('@/stores/exercise-history-store')
    recordExerciseResult({
      type: EXERCISE_DRONE_INTONATION,
      score: 91,
      metrics: { pureTuning: 1 },
      completedAt: 8,
    })
    await vi.waitFor(() => expect(saveSessionRecord).toHaveBeenCalledOnce())
    const payload = saveSessionRecord.mock.calls[0]![0] as {
      melodyName: string
      comparabilityKey?: string
    }

    expect(payload.comparabilityKey).toBe(
      'voice:exercise:drone-intonation:v2:pure',
    )
    expect(payload.melodyName).toBe('Exercise: Drone Intonation · Pure tuning')
  })
})
