// ============================================================
// A run that could not be saved says so
// ============================================================
// saveSessionRecord returned null for two different things: "nobody is
// signed in" (correct, quiet) and "the write failed" (a lost run). Callers
// cannot tell them apart and never could, so the second one was silent for
// every producer at once. The service itself now warns, once per failure.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ownerId: 'user-1',
  create: vi.fn(),
  showNotification: vi.fn(),
}))

vi.mock('@/db', () => ({
  getDb: async () => ({
    getRepository: () => ({
      create: mocks.create,
      update: vi.fn(async (_id: string, patch: object) => ({ ...patch })),
    }),
  }),
}))
vi.mock('@/db/services/user-service', () => ({
  getUserId: () => mocks.ownerId,
}))
vi.mock('@/db/services/streak-service', () => ({
  getCurrentStreak: async () => 0,
}))
vi.mock('@/db/services/practice-minutes', () => ({
  addScoredMs: async () => 0,
  NOMINAL_RUN_MS: 60_000,
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))
vi.mock('@/stores/notifications-store', () => ({
  showNotification: mocks.showNotification,
}))

import { saveSessionRecord, SESSION_SAVE_FAILURE_CHANNEL, SESSION_SAVE_FAILURE_MESSAGE, } from '@/db/services/session-service'

const payload = {
  melodyName: 'Challenge: Held Note',
  score: 82,
  accuracy: 82,
  notesHit: 8,
  notesTotal: 10,
  durationMs: 30_000,
} as const

beforeEach(() => {
  mocks.ownerId = 'user-1'
  mocks.create.mockReset()
  mocks.showNotification.mockReset()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('saveSessionRecord', () => {
  it('warns once, on a channel, when the write fails for a signed-in singer', async () => {
    mocks.create.mockRejectedValue(
      new Error('ServerAdapter: request failed after 3 attempts'),
    )
    const saved = await saveSessionRecord(payload, 'user-1')
    expect(saved).toBeNull()
    expect(mocks.showNotification).toHaveBeenCalledTimes(1)
    expect(mocks.showNotification).toHaveBeenCalledWith(
      SESSION_SAVE_FAILURE_MESSAGE,
      'warning',
      { channel: SESSION_SAVE_FAILURE_CHANNEL },
    )
  })

  it('stays quiet when nobody is signed in', async () => {
    mocks.ownerId = 'somebody-else'
    const saved = await saveSessionRecord(payload, 'user-1')
    expect(saved).toBeNull()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.showNotification).not.toHaveBeenCalled()
  })

  it('stays quiet when the singer signed out while the write was in flight', async () => {
    mocks.create.mockImplementation(async () => {
      mocks.ownerId = 'signed-out'
      throw new Error('HybridAdapter: write identity changed before dispatch')
    })
    const saved = await saveSessionRecord(payload, 'user-1')
    expect(saved).toBeNull()
    expect(mocks.showNotification).not.toHaveBeenCalled()
  })

  it('says nothing when the save lands', async () => {
    mocks.create.mockImplementation(async (entity: object) => ({
      id: 'rec-1',
      createdAt: 'now',
      updatedAt: 'now',
      ...entity,
    }))
    const saved = await saveSessionRecord(payload, 'user-1')
    expect(saved?.id).toBe('rec-1')
    expect(mocks.showNotification).not.toHaveBeenCalled()
  })
})
