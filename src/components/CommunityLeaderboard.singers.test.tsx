// ============================================================
// The Leaderboard's singers: Report and Block from every row that names one
// ============================================================
//
// Slice 4b. The phone reaches this board from Progress's league card in
// every build, the store's included, so each row naming another singer ends
// in a "..." that opens the singer sheet, and a singer blocked from here
// leaves every view at once, the others keeping their places. The blocked
// store and the service are real; the worker is a stand-in at the network
// edge, and the boards' reads are the services' stand-ins.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as FollowService from '@/db/services/follow-service'
import type { LeagueMe } from '@/db/services/league-service'
import type * as Defaults from '@/lib/defaults'

const mocks = vi.hoisted(() => ({
  board: [] as Array<{ userId: string; displayName: string; rank: number }>,
  league: null as unknown,
  incoming: [] as FollowService.FriendRequest[],
}))

vi.mock('@/db/services/follow-service', async () => {
  const actual = await vi.importActual<typeof FollowService>(
    '@/db/services/follow-service',
  )
  return {
    FRIENDS_NEED_ACCOUNT: actual.FRIENDS_NEED_ACCOUNT,
    formatFriendCode: actual.formatFriendCode,
    friendInviteUrl: actual.friendInviteUrl,
    acceptFriend: vi.fn(async () => ({ ok: true })),
    getMyFriendCode: vi.fn(async () => null),
    listFriendRequests: async () => ({
      incoming: mocks.incoming,
      outgoing: [],
    }),
    loadFollowState: async () => ({ accepted: [], pending: [] }),
    redeemFriendCode: vi.fn(async () => ({ ok: true })),
    removeFriend: vi.fn(async () => ({ ok: true })),
    requestFriend: vi.fn(async () => ({ ok: true })),
  }
})

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  accountHeld: () => true,
  currentAccountId: () => 'me',
  hasValidToken: () => true,
}))

vi.mock('@/db/services/user-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  authVersion: () => 0,
  getUserId: () => 'me',
}))

vi.mock('@/db/services/leaderboard-service', () => ({
  loadLeaderboardPage: async () => ({
    total: mocks.board.length,
    users: mocks.board.map((user) => ({
      ...user,
      score: 1000 - user.rank,
      streak: 0,
      longestStreak: 0,
      totalSessions: 3,
      bestScore: 90,
      accuracy: 88,
    })),
  }),
}))

vi.mock('@/db/services/league-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchLeagueLadder: async () => [],
  fetchLeagueMe: async () => mocks.league,
}))

vi.mock('@/lib/pending-friend-code', () => ({
  peekPendingFriendCode: () => null,
  takePendingFriendCode: () => null,
}))

vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<typeof Defaults>()),
  API_BASE_URL: 'http://api.test',
}))

import { CommunityLeaderboard } from '@/components/CommunityLeaderboard'
import { blockSingerAndHide, resetBlockedSingersForTests, } from '@/stores/blocked-singers-store'
import { closeSingerSheet, singerSheetSubject, } from '@/stores/singer-sheet-store'

const moreButtons = (): string[] =>
  [...document.querySelectorAll('[data-singer-more]')].map(
    (button) => button.getAttribute('aria-label') ?? '',
  )

beforeEach(() => {
  mocks.board = [
    { userId: 'ana', displayName: 'Ana', rank: 1 },
    { userId: 'ben', displayName: 'Ben', rank: 2 },
    { userId: 'me', displayName: 'Maya', rank: 3 },
    { userId: 'cleo', displayName: 'Cleo', rank: 4 },
  ]
  mocks.league = null
  mocks.incoming = []
  resetBlockedSingersForTests()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit = {}) =>
      (init.method ?? 'GET') === 'GET'
        ? Response.json({ blocks: [] })
        : Response.json({ blocked: true }, { status: 201 }),
    ),
  )
})

afterEach(() => {
  closeSingerSheet()
  cleanup()
  vi.unstubAllGlobals()
})

describe('the Leaderboard’s rows', () => {
  it('end in a "..." where they name another singer, and the singer’s own in none', async () => {
    render(() => <CommunityLeaderboard view="global" />)

    await waitFor(() =>
      expect(moreButtons()).toEqual([
        'More about Ana',
        'More about Ben',
        'More about Cleo',
      ]),
    )
  })

  it('open the singer sheet from the "...", and not the singer’s card', async () => {
    const { container } = render(() => <CommunityLeaderboard view="global" />)
    const more = await waitFor(() =>
      screen.getByRole('button', { name: 'More about Ben' }),
    )

    fireEvent.click(more)

    expect(singerSheetSubject()).toMatchObject({
      userId: 'ben',
      displayName: 'Ben',
    })
    expect(container.querySelector('.leaderboard-profile-modal')).toBeNull()
  })

  it('lose a singer blocked from here at once, every medal kept on its place', async () => {
    const { container } = render(() => <CommunityLeaderboard view="global" />)
    await waitFor(() => expect(moreButtons()).toHaveLength(3))

    await blockSingerAndHide('ben')

    const ranks = [
      ...container.querySelectorAll<HTMLElement>('tr[data-user-id]'),
    ].map((row) => row.dataset.rank)
    expect(ranks).toEqual(['1', '3', '4'])
    const podium = [...container.querySelectorAll('.podium-name')].map(
      (name) => name.textContent,
    )
    expect(podium).toEqual(['Ana', 'Hidden', 'Maya'])
  })

  it('offer Report and Block on a league row that shows a name, and on no stand-in', async () => {
    const league: LeagueMe = {
      eligible: true,
      weekStart: '2026-10-26T00:00:00.000Z',
      league: {
        id: 'l2',
        rank: 2,
        name: 'Sparkwing',
        trophyAsset: null,
        badgeAsset: null,
        isMystery: false,
        promoteCount: 1,
        relegateCount: 0,
      },
      points: 50,
      rank: 3,
      cohortSize: 3,
      standings: [
        { userId: 'ana', displayName: 'Ana', points: 90, rank: 1, named: true },
        {
          userId: 'member-7f3a',
          displayName: 'Singer-7f3a12',
          points: 70,
          rank: 2,
          named: false,
        },
        { userId: 'me', displayName: 'Maya', points: 50, rank: 3, named: true },
      ],
    }
    mocks.league = league
    render(() => <CommunityLeaderboard view="league" />)

    await waitFor(() => expect(moreButtons()).toEqual(['More about Ana']))
  })

  it('offer Report and Block on a friend request', async () => {
    mocks.incoming = [
      {
        userId: 'robin',
        displayName: 'Robin',
        avatarUrl: null,
        createdAt: '2026-11-01',
      },
    ]
    render(() => <CommunityLeaderboard view="friends" />)
    const more = await waitFor(() =>
      screen.getByRole('button', { name: 'More about Robin' }),
    )

    fireEvent.click(more)

    expect(singerSheetSubject()).toMatchObject({
      userId: 'robin',
      displayName: 'Robin',
    })
  })
})
