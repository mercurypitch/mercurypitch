// ============================================================
// The shell's way into Community: pushed afresh, and its account watch
// ============================================================
//
// More's Community row pushes Community afresh: at its title, not at the
// row of a result opened on an earlier visit. And the store's account
// watch runs only on a build with Community. Both, with the switch on and
// off; the stack and the store are real.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SharedSessionView } from '@/db/services/share-service'

const build = vi.hoisted(() => ({
  community: true,
  account: 'acc-1' as string | null,
}))

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  get NATIVE_COMMUNITY() {
    return build.community
  },
}))

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  accountHeld: () => build.account !== null,
  currentAccountId: () => build.account,
}))

vi.mock('@/db/services/share-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  readSharedMelodies: vi.fn(async () => []),
  readSharedSessions: vi.fn(async () => []),
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

import { pushed, pushScreen, resetRunShell } from '../run-shell-store'
import { installCommunity, pushCommunity } from './community-entry'
import { openCommunityResult, openedResultId, refreshCommunity, resetCommunityStoreForTests, } from './community-store'

const RESULT: SharedSessionView = {
  id: 'r1',
  userId: 'ben',
  name: 'Morning scales',
  items: [],
  author: 'Ben',
  results: [80],
  date: 1,
}

beforeEach(() => {
  build.community = true
  build.account = 'acc-1'
  resetRunShell()
  resetCommunityStoreForTests()
})

/** Counts kept for another account than the one signed in now. */
async function keptForAnother(): Promise<void> {
  build.account = 'acc-2'
  await refreshCommunity()
  build.account = 'acc-1'
}

const kept = (): string | null => localStorage.getItem('mp:community-card')

afterEach(() => {
  resetRunShell()
})

describe('pushing Community from More', () => {
  it('opens it afresh, letting go of a result opened on an earlier visit', () => {
    pushScreen('community')
    openCommunityResult(RESULT, 420)
    pushScreen('community-result')

    pushCommunity()

    expect(pushed()).toBe('community')
    expect(openedResultId()).toBeNull()
  })

  it('pushes nothing on a build without Community', () => {
    build.community = false

    pushCommunity()

    expect(pushed()).toBeNull()
  })
})

describe('the account watch', () => {
  it('lets another account’s counts go on a build with Community', async () => {
    await keptForAnother()
    expect(kept()).not.toBeNull()

    const stop = installCommunity()
    stop()

    expect(kept()).toBeNull()
  })

  it('touches nothing on a build without Community', async () => {
    await keptForAnother()
    build.community = false

    const stop = installCommunity()
    stop()

    expect(kept()).not.toBeNull()
  })
})
