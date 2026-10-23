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
import { exerciseComparabilityKey } from '@/features/exercises/exercise-comparability'
import { EXERCISE_INTERVAL_TRAINER, EXERCISE_LONG_NOTE, EXERCISE_PITCH_HOLD, EXERCISE_SIREN, } from '@/features/exercises/types'
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
    await flushExerciseHistoryWrites()
    expect(exerciseHistory().map((e) => [e.type, e.scoringVersion])).toEqual([
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
