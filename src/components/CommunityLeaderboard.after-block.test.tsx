// ============================================================
// The Leaderboard after a block made from one of its rows
// ============================================================
//
// The worker leaves a blocked singer out of its ranking, so every row after
// theirs moves up one: the board reads again from the top, as deep as it
// was loaded, and Load more carries on from there without skipping anyone.
// And the sheet hands the focus back to the "..." now at the place it was
// opened from, through the board's read that draws every row anew. The
// sheet, its flow, the service and the blocked store are real; the worker's
// leaderboard is a stand-in that pages as handleLeaderboard does.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as FollowService from '@/db/services/follow-service'
import type * as Defaults from '@/lib/defaults'

const server = vi.hoisted(() => ({
  singers: [] as Array<{ userId: string; displayName: string; rank: number }>,
  blocked: new Set<string>(),
  pages: [] as Array<{ offset: number; limit: number }>,
  /** Holds the next page back until let go. */
  hold: null as null | Promise<void>,
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
    listFriendRequests: async () => ({ incoming: [], outgoing: [] }),
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

// Ranked over everyone, the singers hidden from the viewer dropped, then
// sliced: handleLeaderboard's order of work.
vi.mock('@/db/services/leaderboard-service', () => ({
  loadLeaderboardPage: async (opts: { offset?: number; limit?: number }) => {
    const offset = opts.offset ?? 0
    const limit = opts.limit ?? 25
    server.pages.push({ offset, limit })
    const shown = server.singers.filter((s) => !server.blocked.has(s.userId))
    const users = shown.slice(offset, offset + limit).map((user) => ({
      ...user,
      score: 1000 - user.rank,
      streak: 0,
      longestStreak: 0,
      totalSessions: 3,
      bestScore: 90,
      accuracy: 88,
    }))
    if (server.hold !== null) await server.hold
    return { total: shown.length, users }
  },
}))

vi.mock('@/db/services/league-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchLeagueLadder: async () => [],
  fetchLeagueMe: async () => null,
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
import { SingerSheet } from '@/components/moderation/SingerSheet'
import { resetBlockedSingersForTests } from '@/stores/blocked-singers-store'
import { closeSingerSheet } from '@/stores/singer-sheet-store'

const settle = async (): Promise<void> => {
  for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0))
}

const shownRanks = (): number[] =>
  [...document.querySelectorAll<HTMLElement>('tr[data-user-id]')].map((row) =>
    Number(row.dataset.rank),
  )

const moreAbout = (name: string): HTMLElement =>
  screen.getByRole('button', { name: `More about ${name}` })

beforeEach(() => {
  server.singers = Array.from({ length: 30 }, (_, i) => ({
    userId: `s${i + 1}`,
    displayName: `S${i + 1}`,
    rank: i + 1,
  }))
  server.blocked = new Set()
  server.pages = []
  server.hold = null
  resetBlockedSingersForTests()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET'
      if (method === 'POST' && new URL(url).pathname === '/api/blocks') {
        const { userId } = JSON.parse(String(init.body)) as { userId: string }
        server.blocked.add(userId)
        return Response.json({ userId, blocked: true }, { status: 201 })
      }
      return Response.json({ blocks: [] })
    }),
  )
})

afterEach(() => {
  closeSingerSheet()
  cleanup()
  vi.unstubAllGlobals()
})

async function showGlobal(): Promise<void> {
  render(() => (
    <>
      <CommunityLeaderboard view="global" />
      <SingerSheet />
    </>
  ))
  await waitFor(() => expect(shownRanks()).toHaveLength(25))
}

async function blockFromRow(name: string): Promise<void> {
  const more = moreAbout(name)
  more.focus()
  fireEvent.click(more)
  await settle()
  fireEvent.click(screen.getByTestId('singer-choose-block'))
  await settle()
  fireEvent.click(screen.getByRole('button', { name: `Block ${name}` }))
  await waitFor(() => screen.getByTestId('singer-blocked'))
}

describe('the global board after a block from its own row', () => {
  it('reads again from the top, and Load more skips nobody', async () => {
    await showGlobal()

    await blockFromRow('S10')
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await settle()

    expect(server.pages.at(-1)).toEqual({ offset: 0, limit: 25 })
    fireEvent.click(screen.getByRole('button', { name: 'Load more players' }))
    await waitFor(() => expect(shownRanks()).toHaveLength(29))

    // Every rank but the blocked singer's 10, each in its place.
    expect(shownRanks()).toEqual(
      server.singers.map((s) => s.rank).filter((rank) => rank !== 10),
    )
  })

  it('reads again as deep as it was loaded', async () => {
    await showGlobal()
    fireEvent.click(screen.getByRole('button', { name: 'Load more players' }))
    await waitFor(() => expect(shownRanks()).toHaveLength(30))

    await blockFromRow('S27')
    await settle()

    expect(server.pages.at(-1)).toEqual({ offset: 0, limit: 30 })
    expect(shownRanks()).toHaveLength(29)
  })

  it('drops a page asked for before the read from the top', async () => {
    await showGlobal()
    let letGo: () => void = () => {}
    server.hold = new Promise<void>((resolve) => {
      letGo = resolve
    })
    fireEvent.click(screen.getByRole('button', { name: 'Load more players' }))
    await settle()
    server.hold = null

    // The read from the top lands first; the page from before it, after.
    await blockFromRow('S5')
    await waitFor(() => expect(shownRanks()).toHaveLength(25))
    letGo()
    await settle()

    const ranks = shownRanks()
    expect(ranks).toHaveLength(25)
    expect(new Set(ranks).size).toBe(25)
    expect(ranks).not.toContain(5)
  })

  it('hands the focus to the "..." now at the blocked row’s place, through the read', async () => {
    await showGlobal()
    // The read after the block is held back, to land after the close.
    let letGo: () => void = () => {}
    server.hold = new Promise<void>((resolve) => {
      letGo = resolve
    })

    await blockFromRow('S10')
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await settle()

    expect(document.activeElement).toBe(moreAbout('S11'))

    // The read lands and draws every row anew: the focus stays put.
    server.hold = null
    letGo()
    await waitFor(() => expect(server.pages.length).toBeGreaterThan(1))
    await settle()

    expect(document.activeElement).toBe(moreAbout('S11'))
    expect(document.activeElement?.closest('tr')?.dataset.rank).toBe('11')
  })
})
