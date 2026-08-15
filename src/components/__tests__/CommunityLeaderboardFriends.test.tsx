// ============================================================
// The one button that adds a friend
// ============================================================
//
// Friends are a registered-account feature on both sides of every row, and the
// worker enforces it (workers/db-worker/node-tests/follow-requests-integration
// .test.ts). This is what an anonymous singer meets first: the button on a
// stranger's card.
//
// Before the gate it fired the ask anyway, spent a round trip, and answered
// the press with a warning toast — a refusal where the singer had asked for a
// door. Removing stays exempt here exactly as it is in the worker: a row from
// before the rule must still be escapable by whoever holds it.

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as FollowService from '@/db/services/follow-service'
import type * as Defaults from '@/lib/defaults'

const mocks = vi.hoisted(() => ({
  registered: true,
  followState: { accepted: [] as string[], pending: [] as string[] },
  requestFriend: vi.fn(async () => ({ ok: true, status: 'pending' as const })),
  removeFriend: vi.fn(async () => ({ ok: true })),
  acceptFriend: vi.fn(async () => ({ ok: true, status: 'accepted' as const })),
  listFriendRequests: vi.fn(async () => ({ incoming: [], outgoing: [] })),
  getMyFriendCode: vi.fn(async (): Promise<string | null> => null),
  redeemFriendCode: vi.fn(async () => ({ ok: true })),
  showNotification: vi.fn(),
  openAuthModal: vi.fn(),
}))

vi.mock('@/db/services/follow-service', async () => {
  // The refusal sentence is the real one on purpose: the point of exporting it
  // is that the client and the worker cannot drift, and a test that retyped it
  // would prove only that the retyping matches itself.
  const actual = await vi.importActual<typeof FollowService>(
    '@/db/services/follow-service',
  )
  return {
    FRIENDS_NEED_ACCOUNT: actual.FRIENDS_NEED_ACCOUNT,
    formatFriendCode: actual.formatFriendCode,
    friendInviteUrl: actual.friendInviteUrl,
    acceptFriend: mocks.acceptFriend,
    getMyFriendCode: mocks.getMyFriendCode,
    listFriendRequests: mocks.listFriendRequests,
    loadFollowState: async () => mocks.followState,
    redeemFriendCode: mocks.redeemFriendCode,
    removeFriend: mocks.removeFriend,
    requestFriend: mocks.requestFriend,
  }
})

vi.mock('@/db/services/auth-service', () => ({
  accountHeld: () => mocks.registered,
  hasValidToken: () => true,
}))

vi.mock('@/db/services/user-service', () => ({
  authVersion: () => 0,
  getUserId: () => 'me',
}))

vi.mock('@/db/services/leaderboard-service', () => ({
  loadLeaderboardPage: async () => ({
    total: 1,
    users: [
      {
        userId: 'nightingale',
        displayName: 'Nightingale',
        score: 4200,
        rank: 1,
        streak: 6,
        longestStreak: 41,
        totalSessions: 120,
        bestScore: 93,
        accuracy: 88,
      },
    ],
  }),
}))

vi.mock('@/db/services/league-service', () => ({
  fetchLeagueLadder: async () => [],
  fetchLeagueMe: async () => null,
  formatCutCountdown: () => '2d',
  msUntilNextCut: () => 0,
}))

vi.mock('@/db/services/challenges-service', () => ({
  loadChallengeDefinitions: async () => [],
  loadChallengeProgress: async () => [],
}))

vi.mock('@/lib/pending-friend-code', () => ({
  peekPendingFriendCode: () => null,
  takePendingFriendCode: () => null,
}))

vi.mock('@/stores/notifications-store', () => ({
  showNotification: mocks.showNotification,
}))

vi.mock('@/stores/ui-store', () => ({
  openAuthModal: mocks.openAuthModal,
}))

// Spread rather than replace: ui-store and others read IS_TEST from this
// module at import time, and a bare object fails the suite at collection.
vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<typeof Defaults>()),
  API_BASE_URL: 'http://api.test',
}))

import { CommunityLeaderboard } from '@/components/CommunityLeaderboard'

/** Render the global board and open the one singer's card. */
async function openSingerCard(): Promise<HTMLElement> {
  const { container } = render(() => <CommunityLeaderboard view="global" />)
  // By row, not by name: the same name is also on the podium, and the row is
  // what carries the click that opens the profile.
  const row = await waitFor(() => {
    const found = container.querySelector<HTMLElement>(
      'tr[data-user-id="nightingale"]',
    )
    expect(found).not.toBeNull()
    return found as HTMLElement
  })
  fireEvent.click(row)
  return await waitFor(() => screen.getByTestId('follow-button'))
}

describe('adding a friend from the board', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.registered = true
    mocks.followState = { accepted: [], pending: [] }
  })

  it('offers an anonymous singer the account instead of the round trip', async () => {
    mocks.registered = false

    const button = await openSingerCard()
    expect(button.textContent).toContain('Add Friend')
    fireEvent.click(button)

    await waitFor(() =>
      expect(mocks.openAuthModal).toHaveBeenCalledWith('register'),
    )
    expect(mocks.showNotification).toHaveBeenCalledWith(
      'Create an account to add friends',
      'info',
    )
    // The whole point: no ask is sent, so nothing lands in a table for a
    // singer who could never have answered it.
    expect(mocks.requestFriend).not.toHaveBeenCalled()
  })

  it('sends the ask for a registered singer, and says it was sent', async () => {
    const button = await openSingerCard()
    fireEvent.click(button)

    // The toast lands after the graph is re-read, so wait on it rather than
    // on the call that starts it.
    await waitFor(() =>
      expect(mocks.showNotification).toHaveBeenCalledWith(
        'Request sent',
        'info',
      ),
    )
    expect(mocks.requestFriend).toHaveBeenCalledWith('nightingale')
    expect(mocks.openAuthModal).not.toHaveBeenCalled()
  })

  it('lets an anonymous singer end a row from before the rule', async () => {
    // The exemption, mirrored from the worker. The button reads "Friends"
    // because the row is already accepted; pressing it must remove, not offer
    // an account the singer does not need in order to leave.
    mocks.registered = false
    mocks.followState = { accepted: ['nightingale'], pending: [] }

    const button = await openSingerCard()
    expect(button.textContent).toContain('Friends')
    fireEvent.click(button)

    await waitFor(() =>
      expect(mocks.showNotification).toHaveBeenCalledWith('Removed', 'info'),
    )
    expect(mocks.removeFriend).toHaveBeenCalledWith('nightingale')
    expect(mocks.openAuthModal).not.toHaveBeenCalled()
  })

  it('does the same for an ask that has not been answered yet', async () => {
    // "Requested" is the third state the one button carries. Taking an ask
    // back is a remove too, and it must not be gated either.
    mocks.registered = false
    mocks.followState = { accepted: [], pending: ['nightingale'] }

    const button = await openSingerCard()
    expect(button.textContent).toContain('Requested')
    fireEvent.click(button)

    await waitFor(() =>
      expect(mocks.removeFriend).toHaveBeenCalledWith('nightingale'),
    )
    expect(mocks.openAuthModal).not.toHaveBeenCalled()
  })

  it('reports the server’s refusal when it is the server that refuses', async () => {
    // A registered client whose account was refused anyway — a stale token, or
    // a target who is still anonymous. The gate above must not swallow this
    // path: the singer sees the worker's own sentence.
    mocks.requestFriend.mockResolvedValueOnce({
      ok: false,
      error: 'That singer hasn’t created an account yet',
    } as never)

    const button = await openSingerCard()
    fireEvent.click(button)

    await waitFor(() =>
      expect(mocks.showNotification).toHaveBeenCalledWith(
        'That singer hasn’t created an account yet',
        'warning',
      ),
    )
    expect(mocks.openAuthModal).not.toHaveBeenCalled()
  })
})
