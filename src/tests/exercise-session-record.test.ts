// ============================================================
// Exercise → sessionRecords routing
// ============================================================
//
// A finished exercise must post exactly ONE sessionRecord, tagged with the
// right source, so it ranks on the leaderboard without double-counting a run
// that was really a challenge or weekly attempt.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  saveSessionRecord: vi.fn(async () => null),
  recordChallengeAttempt: vi.fn(async () => false),
  recordWeeklyAttempt: vi.fn(async () => false),
  autoAdvanceRoutineSegment: vi.fn(),
  trackEvent: vi.fn(),
  recordActivity: vi.fn(),
}))

vi.mock('@/db/services/session-service', () => ({
  saveSessionRecord: mocks.saveSessionRecord,
}))
vi.mock('@/features/challenges/challenge-attempt', () => ({
  recordChallengeAttempt: mocks.recordChallengeAttempt,
}))
vi.mock('@/features/challenges/weekly-attempt', () => ({
  recordWeeklyAttempt: mocks.recordWeeklyAttempt,
}))
vi.mock('@/features/routines/use-daily-routine', () => ({
  autoAdvanceRoutineSegment: mocks.autoAdvanceRoutineSegment,
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: mocks.trackEvent }))
vi.mock('@/stores/usage-store', () => ({
  recordActivity: mocks.recordActivity,
}))

import { clearExerciseHistory, recordExerciseResult, } from '@/stores/exercise-history-store'

/** The routing is fire-and-forget inside recordExerciseResult; let it settle. */
const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.recordChallengeAttempt.mockResolvedValue(false)
  mocks.recordWeeklyAttempt.mockResolvedValue(false)
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
    )
  })

  it('still records the run in local history and activity regardless', async () => {
    recordExerciseResult({
      type: 'vibrato',
      score: 50,
      metrics: {},
      completedAt: 1,
    })
    await flush()
    expect(mocks.recordActivity).toHaveBeenCalledOnce()
    // session_complete is saveSessionRecord's job (every run funnels through
    // it exactly once) — firing it here too would double the funnel metric.
    expect(mocks.trackEvent).not.toHaveBeenCalledWith('session_complete')
  })
})
