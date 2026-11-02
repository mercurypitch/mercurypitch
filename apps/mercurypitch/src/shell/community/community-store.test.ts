// ============================================================
// The Community store: whose read it is, what the phone keeps, and when
// it asks nothing
// ============================================================
//
// The share and profile reads are stand-ins at the service edge; the store,
// its keeping and its storage are real.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SharedMelodyView, SharedSessionView, } from '@/db/services/share-service'

const held = vi.hoisted(() => ({
  account: 'acc-1' as string | null,
}))

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  accountHeld: () => held.account !== null,
  currentAccountId: () => held.account,
}))

vi.mock('@/db/services/share-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  readSharedMelodies: vi.fn(),
  readSharedSessions: vi.fn(),
  loadPublishedShareCounts: vi.fn(),
  loadUserProfile: vi.fn(),
}))

vi.mock('@/db/services/progress-session-records', () => ({
  loadProgressSessionRecords: vi.fn(),
}))

vi.mock('@/db/services/streak-service', () => ({
  getCurrentStreak: vi.fn(),
}))

import { loadProgressSessionRecords } from '@/db/services/progress-session-records'
import { loadPublishedShareCounts, loadUserProfile, readSharedMelodies, readSharedSessions, } from '@/db/services/share-service'
import { getCurrentStreak } from '@/db/services/streak-service'
import { communityBoard, communityCounts, communityProblem, communityProfile, refreshCommunity, resetCommunityStoreForTests, } from './community-store'

const melodies = vi.mocked(readSharedMelodies)
const sessions = vi.mocked(readSharedSessions)
const history = vi.mocked(loadProgressSessionRecords)

function melody(id: string, name = 'Moon River'): SharedMelodyView {
  return {
    id,
    userId: 'ada',
    name,
    items: [],
    author: 'Ada',
    tags: [],
    date: 1_700_000_000_000,
  }
}

function result(id: string): SharedSessionView {
  return {
    id,
    userId: 'ben',
    name: 'Morning scales',
    items: [],
    author: 'Ben',
    results: [80],
    date: 1_700_000_000_000,
  }
}

const RUN = {
  id: 'run-1',
  userId: 'acc-1',
  endedAt: '2026-10-30T10:00:00.000Z',
  score: 82,
  source: 'practice',
}

beforeEach(() => {
  held.account = 'acc-1'
  resetCommunityStoreForTests()
  melodies.mockReset().mockResolvedValue([melody('m1')])
  sessions.mockReset().mockResolvedValue([result('r1'), result('r2')])
  history.mockReset().mockResolvedValue({
    records: [RUN] as never,
    available: true,
    complete: true,
    totalAvailable: 1,
  })
  vi.mocked(getCurrentStreak).mockReset().mockResolvedValue(3)
  vi.mocked(loadPublishedShareCounts)
    .mockReset()
    .mockResolvedValue({ melodies: 1, sessions: 0 })
  vi.mocked(loadUserProfile)
    .mockReset()
    .mockResolvedValue({
      userId: 'acc-1',
      displayName: 'Maya',
      joinDate: Date.parse('2026-10-05T10:00:00Z'),
    })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('a read', () => {
  it('is shown to the account that asked for it, and to no other', async () => {
    await refreshCommunity()
    expect(communityBoard()?.melodies.map((row) => row.id)).toEqual(['m1'])
    expect(communityCounts()).toEqual({ melodies: 1, results: 2 })

    held.account = 'acc-2'

    expect(communityBoard()).toBeNull()
    expect(communityCounts()).toBeNull()
    expect(communityProfile()).toBeNull()
  })

  it('keeps two numbers on the phone for the More row, never a name or a title', async () => {
    await refreshCommunity()

    const kept = localStorage.getItem('mp:community-card') ?? ''
    expect(JSON.parse(kept)).toMatchObject({
      viewer: 'acc-1',
      melodies: 1,
      results: 2,
    })
    expect(kept).not.toMatch(/Ada|Ben|Moon River|Morning scales/u)
  })

  it('reads the signed-in singer’s figures with the lists', async () => {
    await refreshCommunity()
    expect(communityProfile()).toMatchObject({
      name: 'Maya',
      totalRuns: 1,
      streak: 3,
      published: { melodies: 1, sessions: 0 },
    })
    expect(communityProfile()?.runs.map((run) => run.score)).toEqual([82])
  })

  it('reads no figures for a phone with no account, and shows it the lists', async () => {
    held.account = null
    await refreshCommunity()
    expect(history).not.toHaveBeenCalled()
    expect(communityProfile()).toBeNull()
    expect(communityBoard()?.results).toHaveLength(2)
  })
})

describe('a read that gets nothing', () => {
  it('says so, and keeps what was loaded before', async () => {
    await refreshCommunity()
    melodies.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await refreshCommunity()

    expect(communityProblem()).toBe('unreachable')
    expect(communityBoard()?.melodies.map((row) => row.id)).toEqual(['m1'])
  })

  it('is not sent at all from a phone that knows it is offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    await refreshCommunity()

    expect(melodies).not.toHaveBeenCalled()
    expect(communityProblem()).toBe('offline')
    expect(communityBoard()).toBeNull()
  })

  it('counts as failed when a signed-in singer’s runs could not be read', async () => {
    history.mockResolvedValueOnce({
      records: [],
      available: false,
      complete: false,
      totalAvailable: null,
    })

    await refreshCommunity()

    // A profile of no runs would be a profile that is wrong.
    expect(communityProfile()).toBeNull()
    expect(communityProblem()).toBe('unreachable')
    expect(communityBoard()?.melodies).toHaveLength(1)
  })

  it('is forgotten once a read lands', async () => {
    melodies.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await refreshCommunity()
    expect(communityProblem()).toBe('unreachable')

    await refreshCommunity()

    expect(communityProblem()).toBeNull()
  })
})

describe('asks that overlap', () => {
  it('share one read, unless a fresh one is asked for after a block', async () => {
    const first = refreshCommunity()
    const second = refreshCommunity()
    await Promise.all([first, second])
    expect(melodies).toHaveBeenCalledTimes(1)

    let letGo: () => void = () => {}
    melodies.mockReturnValueOnce(
      new Promise((resolve) => {
        letGo = () => resolve([melody('m1'), melody('m2')])
      }),
    )
    const out = refreshCommunity()
    // Blocked meanwhile: an answer given after the block, not the one out.
    melodies.mockResolvedValueOnce([melody('m2')])
    await refreshCommunity(true)
    letGo()
    await out

    expect(melodies).toHaveBeenCalledTimes(3)
    expect(communityBoard()?.melodies.map((row) => row.id)).toEqual(['m2'])
  })
})

describe('a row read again', () => {
  it('is the object the screen drew while it is unchanged, so its buttons keep the focus', async () => {
    await refreshCommunity()
    const drawn = communityBoard()?.melodies[0]
    melodies.mockResolvedValueOnce([melody('m1'), melody('m3', 'Blue Moon')])

    await refreshCommunity()

    const rows = communityBoard()?.melodies ?? []
    expect(rows[0]).toBe(drawn)
    expect(rows[1]?.name).toBe('Blue Moon')

    melodies.mockResolvedValueOnce([melody('m1', 'Moon River, again')])
    await refreshCommunity()
    expect(communityBoard()?.melodies[0]).not.toBe(drawn)
  })
})
