// ============================================================
// Challenge attempt exclusivity — one finished exercise, one session record
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ownerId: 'singer-1',
  saveSessionRecord: vi.fn<() => Promise<{ id: string } | null>>(async () => ({
    id: 'session-1',
  })),
  loadChallengeProgress: vi.fn(async () => []),
  saveChallengeProgress: vi.fn(async (progress) => ({
    ...progress,
    id: 'progress-1',
  })),
  checkAndGrantBadges: vi.fn(async () => undefined),
  grantBadgeByRef: vi.fn(async () => undefined),
  showNotification: vi.fn(),
  presentChallengeResult: vi.fn(),
}))

vi.mock('@/db/services/user-service', () => ({
  getUserId: () => mocks.ownerId,
}))
vi.mock('@/db/services/session-service', () => ({
  saveSessionRecord: mocks.saveSessionRecord,
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
  lastRunTrace: () => null,
}))
vi.mock('@/stores/notifications-store', () => ({
  showNotification: mocks.showNotification,
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))
vi.mock('@/features/challenges/challenge-result-store', () => ({
  presentChallengeResult: mocks.presentChallengeResult,
  whileFinalizing: async (work: () => Promise<void>) => work(),
}))

import { activeChallengeAttempt, beginChallengeAttempt, clearChallengeAttempt, recordChallengeAttempt, } from '@/features/challenges/challenge-attempt'
import { activeWeeklyAttempt, beginWeeklyAttempt, clearWeeklyAttempt, recordWeeklyAttempt, } from '@/features/challenges/weekly-attempt'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.ownerId = 'singer-1'
  mocks.saveSessionRecord.mockResolvedValue({ id: 'session-1' })
  mocks.loadChallengeProgress.mockResolvedValue([])
  mocks.saveChallengeProgress.mockImplementation(async (progress) => ({
    ...progress,
    id: 'progress-1',
  }))
  clearChallengeAttempt()
  clearWeeklyAttempt()
})

describe('scored challenge ownership', () => {
  it('lets the newly armed weekly take replace a stale personal challenge', async () => {
    beginChallengeAttempt({
      challengeId: 'personal-1',
      title: 'Hold steady',
      category: 'control',
      exercise: 'long-note',
      targetScore: 75,
    })
    beginWeeklyAttempt({
      challengeId: 'weekly-1',
      title: 'One clear note',
      exercise: 'long-note',
      targetScore: 70,
    })

    expect(activeChallengeAttempt()).toBeNull()
    expect(activeWeeklyAttempt()?.challengeId).toBe('weekly-1')
    expect(await recordChallengeAttempt({ type: 'long-note', score: 82 })).toBe(
      false,
    )
    expect(await recordWeeklyAttempt({ type: 'long-note', score: 82 })).toBe(
      true,
    )
    expect(mocks.saveSessionRecord).toHaveBeenCalledTimes(1)
    expect(mocks.saveSessionRecord).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'weekly' }),
      'singer-1',
    )
  })

  it('lets the newly armed personal challenge replace a stale weekly take', async () => {
    beginWeeklyAttempt({
      challengeId: 'weekly-1',
      title: 'One clear note',
      exercise: 'long-note',
      targetScore: 70,
    })
    beginChallengeAttempt({
      challengeId: 'personal-1',
      title: 'Hold steady',
      category: 'control',
      exercise: 'long-note',
      targetScore: 75,
    })

    expect(activeWeeklyAttempt()).toBeNull()
    expect(activeChallengeAttempt()?.challengeId).toBe('personal-1')
    expect(await recordWeeklyAttempt({ type: 'long-note', score: 82 })).toBe(
      false,
    )
    expect(await recordChallengeAttempt({ type: 'long-note', score: 82 })).toBe(
      true,
    )
    expect(mocks.saveSessionRecord).toHaveBeenCalledTimes(1)
    expect(mocks.saveSessionRecord).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'challenge' }),
      'singer-1',
    )
  })

  it('keeps a weekly take armed when its session cannot be saved', async () => {
    mocks.saveSessionRecord.mockResolvedValueOnce(null)
    beginWeeklyAttempt({
      challengeId: 'weekly-offline',
      title: 'One clear note',
      exercise: 'long-note',
      targetScore: 70,
    })

    expect(await recordWeeklyAttempt({ type: 'long-note', score: 82 })).toBe(
      true,
    )
    expect(activeWeeklyAttempt()?.challengeId).toBe('weekly-offline')
    expect(mocks.presentChallengeResult).not.toHaveBeenCalled()
    expect(mocks.checkAndGrantBadges).not.toHaveBeenCalled()
    expect(mocks.showNotification).toHaveBeenCalledWith(
      expect.stringContaining("couldn't save"),
      'error',
    )
  })

  it('does not celebrate a personal challenge without both persisted rows', async () => {
    mocks.saveSessionRecord.mockResolvedValueOnce(null)
    beginChallengeAttempt({
      challengeId: 'personal-offline',
      title: 'Hold steady',
      category: 'control',
      exercise: 'long-note',
      targetScore: 75,
      rewardBadgeId: 'steady-voice',
    })

    expect(await recordChallengeAttempt({ type: 'long-note', score: 82 })).toBe(
      true,
    )
    expect(activeChallengeAttempt()?.challengeId).toBe('personal-offline')
    expect(mocks.grantBadgeByRef).not.toHaveBeenCalled()
    expect(mocks.checkAndGrantBadges).not.toHaveBeenCalled()
    expect(mocks.showNotification).toHaveBeenCalledWith(
      expect.stringContaining('challenge completion was saved'),
      'error',
    )
  })

  it('keeps the failure copy truthful when neither challenge row was saved', async () => {
    mocks.saveChallengeProgress.mockResolvedValueOnce(null)
    beginChallengeAttempt({
      challengeId: 'personal-offline',
      title: 'Hold steady',
      category: 'control',
      exercise: 'long-note',
      targetScore: 75,
    })

    await recordChallengeAttempt({ type: 'long-note', score: 82 })

    expect(mocks.showNotification).toHaveBeenCalledWith(
      expect.stringContaining('was not marked complete'),
      'error',
    )
  })

  it('does not write a challenge session when progress itself was not saved', async () => {
    mocks.saveChallengeProgress.mockResolvedValueOnce(null)
    beginChallengeAttempt({
      challengeId: 'personal-no-progress',
      title: 'Hold steady',
      category: 'control',
      exercise: 'long-note',
      targetScore: 75,
    })

    expect(await recordChallengeAttempt({ type: 'long-note', score: 82 })).toBe(
      true,
    )
    expect(mocks.saveSessionRecord).not.toHaveBeenCalled()
    expect(activeChallengeAttempt()?.challengeId).toBe('personal-no-progress')
    expect(mocks.showNotification).toHaveBeenCalledWith(
      expect.stringContaining("couldn't save"),
      'error',
    )
  })
})
