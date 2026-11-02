// ============================================================
// The Community store across accounts: what goes when the account does
// ============================================================
//
// What the store kept for an account (the counts in storage, the read, the
// figures and where the list was) goes when that account signs out or the
// phone changes hands, as the league the Leagues row names goes. A token
// refreshed for the same account is not a change. The share and profile
// reads are stand-ins at the service edge; the store and its storage are
// real.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SharedSessionView } from '@/db/services/share-service'

const held = vi.hoisted(() => ({
  account: 'acc-1' as string | null,
  /** Sign in or out as the token would: every reader is told. */
  as: (_account: string | null): void => {},
}))

vi.mock('@/db/services/auth-service', async (importOriginal) => {
  const { createSignal } = await import('solid-js')
  const [version, setVersion] = createSignal(0)
  held.as = (account) => {
    held.account = account
    setVersion((v) => v + 1)
  }
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    accountHeld: () => {
      version()
      return held.account !== null
    },
    currentAccountId: () => {
      version()
      return held.account
    },
  }
})

vi.mock('@/db/services/share-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  readSharedMelodies: vi.fn(async () => []),
  readSharedSessions: vi.fn(async () => [RESULT]),
  loadPublishedShareCounts: vi.fn(async () => null),
  loadUserProfile: vi.fn(async () => null),
}))

vi.mock('@/db/services/progress-session-records', () => ({
  loadProgressSessionRecords: vi.fn(async () => ({
    records: [],
    available: true,
    complete: true,
    totalAvailable: 0,
  })),
}))

vi.mock('@/db/services/streak-service', () => ({
  getCurrentStreak: vi.fn(async () => 0),
}))

import { communityBoard, communityCounts, communityListTop, installCommunityWatch, openCommunityResult, refreshCommunity, resetCommunityStoreForTests, } from './community-store'

const RESULT: SharedSessionView = {
  id: 'r1',
  userId: 'ben',
  name: 'Morning scales',
  items: [],
  author: 'Ben',
  results: [80],
  date: 1,
}

const kept = (): string | null => localStorage.getItem('mp:community-card')

let stopWatching: (() => void) | null = null

beforeEach(() => {
  held.as('acc-1')
  resetCommunityStoreForTests()
})

afterEach(() => {
  stopWatching?.()
  stopWatching = null
})

describe('what Community kept for an account', () => {
  it('goes from the phone, its counts in storage included, when the account signs out', async () => {
    stopWatching = installCommunityWatch()
    await refreshCommunity()
    expect(kept()).not.toBeNull()

    held.as(null)

    expect(kept()).toBeNull()
    expect(communityCounts()).toBeNull()
    held.as('acc-1')
    expect(communityBoard()).toBeNull()
  })

  it('stays through a token refreshed for the same account', async () => {
    stopWatching = installCommunityWatch()
    await refreshCommunity()

    held.as('acc-1')

    expect(JSON.parse(kept() ?? 'null')).toMatchObject({ viewer: 'acc-1' })
    expect(communityCounts()).toEqual({ melodies: 0, results: 1 })
  })

  it('stays as the shell starts when it is this account’s', async () => {
    await refreshCommunity()

    stopWatching = installCommunityWatch()

    expect(JSON.parse(kept() ?? 'null')).toMatchObject({ viewer: 'acc-1' })
    expect(communityBoard()?.results).toHaveLength(1)
  })

  it('goes as the shell starts when it is another account’s', async () => {
    held.as('acc-2')
    await refreshCommunity()
    held.as('acc-1')
    expect(kept()).not.toBeNull()

    stopWatching = installCommunityWatch()

    expect(kept()).toBeNull()
  })

  it('keeps where the list was for the account that scrolled it, and for no other', () => {
    openCommunityResult(RESULT, 300)
    expect(communityListTop()).toBe(300)

    held.as('acc-2')

    expect(communityListTop()).toBeNull()
  })
})
