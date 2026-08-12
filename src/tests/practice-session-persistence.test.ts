// ============================================================
// Practice session persistence — grant only the account whose row was saved
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlaybackSession, PracticeResult } from '@/types'

const mocks = vi.hoisted(() => ({
  ownerId: 'singer-1',
  saveSessionRecord: vi.fn<() => Promise<{ id: string } | null>>(async () => ({
    id: 'session-1',
  })),
  checkAndGrantBadges: vi.fn(async () => undefined),
  recordCompletion: vi.fn(),
}))

vi.mock('@/db/services/user-service', () => ({
  getUserId: () => mocks.ownerId,
}))
vi.mock('@/db/services/session-service', () => ({
  saveSessionRecord: mocks.saveSessionRecord,
}))
vi.mock('@/db/services/badge-grant-engine', () => ({
  checkAndGrantBadges: mocks.checkAndGrantBadges,
}))
vi.mock('@/stores/usage-store', () => ({
  recordCompletion: mocks.recordCompletion,
}))

import { endPracticeSession, setPracticeResults, setPracticeSession, setSessionActive, } from '@/stores/practice-session-store'

const session: PlaybackSession = {
  id: 'guided-1',
  name: 'Evening practice',
  created: 1,
  deletable: true,
  items: [
    {
      id: 'item-1',
      type: 'melody',
      startBeat: 0,
      label: 'Warm up',
      melodyId: 'melody-1',
    },
  ],
}

const result = {
  score: 82,
  noteCount: 1,
  avgCents: 4,
  noteResult: [],
} as unknown as PracticeResult

function armSession(): void {
  setPracticeSession(session)
  setSessionActive(true)
  setPracticeResults([result])
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mocks.ownerId = 'singer-1'
  mocks.saveSessionRecord.mockResolvedValue({ id: 'session-1' })
  setPracticeSession(null)
  setSessionActive(false)
  setPracticeResults([])
})

describe('endPracticeSession grant routing', () => {
  it('does not run a grant pass when the session write failed', async () => {
    mocks.saveSessionRecord.mockResolvedValueOnce(null)
    armSession()

    expect(endPracticeSession()).not.toBeNull()
    await flush()

    expect(mocks.checkAndGrantBadges).not.toHaveBeenCalled()
  })

  it('does not run a grant pass for an account selected mid-save', async () => {
    let finishSave = (): void => undefined
    mocks.saveSessionRecord.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSave = () => resolve({ id: 'session-1' })
        }),
    )
    armSession()

    expect(endPracticeSession()).not.toBeNull()
    mocks.ownerId = 'singer-2'
    finishSave()
    await flush()

    expect(mocks.saveSessionRecord).toHaveBeenCalledWith(
      expect.any(Object),
      'singer-1',
    )
    expect(mocks.checkAndGrantBadges).not.toHaveBeenCalled()
  })
})
