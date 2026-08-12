// ============================================================
// Exercise → sessionRecords routing
// ============================================================
//
// A finished exercise must post exactly ONE sessionRecord, tagged with the
// right source, so it ranks on the leaderboard without double-counting a run
// that was really a challenge or weekly attempt.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunTrace } from '@/features/exercises/last-run-trace'

const mocks = vi.hoisted(() => ({
  saveSessionRecord: vi.fn<() => Promise<{ id: string } | null>>(async () => ({
    id: 'session-1',
  })),
  recordChallengeAttempt: vi.fn(async () => false),
  recordWeeklyAttempt: vi.fn(async () => false),
  autoAdvanceRoutineSegment: vi.fn(),
  trackEvent: vi.fn(),
  recordActivity: vi.fn(),
  recordCompletion: vi.fn(),
  lastRunTrace: vi.fn<() => RunTrace | null>(() => null),
  checkAndGrantBadges: vi.fn(async () => undefined),
  currentUserId: 'singer-1',
}))

vi.mock('@/db/services/session-service', () => ({
  saveSessionRecord: mocks.saveSessionRecord,
}))
vi.mock('@/db/services/user-service', () => ({
  getUserId: () => mocks.currentUserId,
}))
vi.mock('@/db/services/badge-grant-engine', () => ({
  checkAndGrantBadges: mocks.checkAndGrantBadges,
}))
vi.mock('@/features/challenges/challenge-attempt', () => ({
  recordChallengeAttempt: mocks.recordChallengeAttempt,
}))
vi.mock('@/features/challenges/weekly-attempt', () => ({
  recordWeeklyAttempt: mocks.recordWeeklyAttempt,
}))
vi.mock('@/features/exercises/last-run-trace', () => ({
  lastRunTrace: mocks.lastRunTrace,
}))
vi.mock('@/features/routines/use-daily-routine', () => ({
  autoAdvanceRoutineSegment: mocks.autoAdvanceRoutineSegment,
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: mocks.trackEvent }))
vi.mock('@/stores/usage-store', () => ({
  recordCompletion: mocks.recordCompletion,
  recordActivity: mocks.recordActivity,
}))

import { clearExerciseHistory, recordExerciseResult, } from '@/stores/exercise-history-store'

/** The routing is fire-and-forget inside recordExerciseResult; let it settle. */
const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.recordChallengeAttempt.mockResolvedValue(false)
  mocks.recordWeeklyAttempt.mockResolvedValue(false)
  mocks.saveSessionRecord.mockResolvedValue({ id: 'session-1' })
  mocks.lastRunTrace.mockReturnValue(null)
  mocks.currentUserId = 'singer-1'
  localStorage.clear()
  clearExerciseHistory()
})

describe('recordExerciseResult → sessionRecords', () => {
  it('writes one source:exercise record for a plain run', async () => {
    recordExerciseResult({
      type: 'long-note',
      score: 82,
      metrics: { durationMs: 30_000 },
      completedAt: 1,
    })
    await flush()

    expect(mocks.saveSessionRecord).toHaveBeenCalledTimes(1)
    expect(mocks.saveSessionRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'exercise',
        melodyName: 'Exercise: Long Note',
        score: 82,
        durationMs: 30_000,
      }),
      'singer-1',
    )
  })

  it('uses the base exercise trace as the measured duration authority', async () => {
    mocks.lastRunTrace.mockReturnValue({
      type: 'long-note',
      completedAt: 123,
      durationMs: 12_345,
      samples: [],
      targets: [],
    })

    recordExerciseResult({
      type: 'long-note',
      score: 82,
      metrics: {},
      completedAt: 123,
    })
    await flush()

    expect(mocks.saveSessionRecord).toHaveBeenCalledWith(
      expect.objectContaining({ durationMs: 12_345 }),
      'singer-1',
    )
  })

  it('does NOT write an exercise record when the run was a challenge', async () => {
    mocks.recordChallengeAttempt.mockResolvedValue(true)
    recordExerciseResult({
      type: 'pitch-hold',
      score: 90,
      metrics: {},
      completedAt: 1,
    })
    await flush()

    // The challenge path already wrote its own source:'challenge' record.
    expect(mocks.saveSessionRecord).not.toHaveBeenCalled()
  })

  it('does NOT write an exercise record when the run was a weekly attempt', async () => {
    mocks.recordWeeklyAttempt.mockResolvedValue(true)
    recordExerciseResult({
      type: 'siren',
      score: 75,
      metrics: {},
      completedAt: 1,
    })
    await flush()

    expect(mocks.saveSessionRecord).not.toHaveBeenCalled()
  })

  it('titles multi-word slugs correctly', async () => {
    recordExerciseResult({
      type: 'call-response',
      score: 60,
      metrics: {},
      completedAt: 1,
    })
    await flush()

    expect(mocks.saveSessionRecord).toHaveBeenCalledWith(
      expect.objectContaining({ melodyName: 'Exercise: Call Response' }),
      'singer-1',
    )
  })

  it('grants only after the plain exercise session is safely stored', async () => {
    mocks.saveSessionRecord.mockResolvedValueOnce(null)

    recordExerciseResult({
      type: 'long-note',
      score: 82,
      metrics: {},
      completedAt: 1,
    })
    await flush()

    expect(mocks.checkAndGrantBadges).not.toHaveBeenCalled()
  })

  it('does not run grants for a different account selected during the save', async () => {
    let finishSave = (): void => undefined
    mocks.saveSessionRecord.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSave = () => resolve({ id: 'session-1' })
        }),
    )

    recordExerciseResult({
      type: 'long-note',
      score: 82,
      metrics: {},
      completedAt: 1,
    })
    await Promise.resolve()
    mocks.currentUserId = 'singer-2'
    finishSave()
    await flush()

    expect(mocks.checkAndGrantBadges).not.toHaveBeenCalled()
  })

  it('still records the run in local history and activity regardless', async () => {
    recordExerciseResult({
      type: 'vibrato',
      score: 50,
      metrics: {},
      completedAt: 1,
    })
    await flush()
    // recordCompletion counts the finished run for the survey gate and
    // folds recordActivity in (see usage-store).
    expect(mocks.recordCompletion).toHaveBeenCalledOnce()
    // session_complete is saveSessionRecord's job (every run funnels through
    // it exactly once) — firing it here too would double the funnel metric.
    expect(mocks.trackEvent).not.toHaveBeenCalledWith('session_complete')
  })
})
