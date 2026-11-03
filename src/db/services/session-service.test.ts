// ============================================================
// creditPracticeTime — practice without a session record
// ============================================================
//
// A drill stopped before its end writes no session record: the record
// would carry a score graded on the rounds it reached to every goal, board
// and Progress thread. Its time still counts toward the day and the
// streak, through the accumulator saveSessionRecord credits, and
// everything that refreshes on a credited run refreshes for it too.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ownerId: 'singer-1',
  create: vi.fn(),
  addScoredMs: vi.fn(async () => 3),
}))

vi.mock('@/db', () => ({
  getDb: async () => ({
    getRepository: () => ({ create: mocks.create, update: vi.fn() }),
  }),
}))
vi.mock('@/db/services/user-service', () => ({
  getUserId: () => mocks.ownerId,
}))
vi.mock('@/db/services/streak-service', () => ({
  getCurrentStreak: async () => 0,
}))
vi.mock('@/db/services/practice-minutes', () => ({
  addScoredMs: mocks.addScoredMs,
  NOMINAL_RUN_MS: 90_000,
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))
vi.mock('@/stores/notifications-store', () => ({ showNotification: vi.fn() }))

import { creditPracticeTime, sessionRecordVersion } from './session-service'

beforeEach(() => {
  mocks.ownerId = 'singer-1'
  mocks.create.mockReset()
  mocks.addScoredMs.mockClear()
})

describe('creditPracticeTime', () => {
  it('credits the measured time to the day, and writes no record', async () => {
    const version = sessionRecordVersion()

    await creditPracticeTime(12_345.6, 'singer-1')

    expect(mocks.addScoredMs).toHaveBeenCalledWith(12_346, 'singer-1')
    expect(mocks.create).not.toHaveBeenCalled()
    // The daily goal and the streak card refresh on this, as on a record.
    expect(sessionRecordVersion()).toBe(version + 1)
  })

  it("credits no nominal length for a time it never measured: that is a finished run's", async () => {
    const version = sessionRecordVersion()

    for (const unmeasured of [undefined, 0, -5, Number.NaN, 86_400_001]) {
      await creditPracticeTime(unmeasured, 'singer-1')
    }

    expect(mocks.addScoredMs).not.toHaveBeenCalled()
    expect(sessionRecordVersion()).toBe(version)
  })

  it('credits nobody who signed out before it ran', async () => {
    mocks.ownerId = 'singer-2'

    await creditPracticeTime(30_000, 'singer-1')

    expect(mocks.addScoredMs).not.toHaveBeenCalled()
  })
})
