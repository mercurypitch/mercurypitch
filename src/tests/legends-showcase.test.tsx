// ============================================================
// The Legends view: the live challenge and its history, on the Leaderboard
// ============================================================
//
// The Leaderboard's fourth view listed the 24 static Vocal Challenges under
// the heading "Weekly" — none of them weekly — while the actual Legend, the
// one thing in the app with a board and winners, appeared nowhere on the page
// for competition. This is what replaced it: the same live card as Home, then
// every closed Legend with its frozen podium and medals.

import { render, screen, waitFor } from '@solidjs/testing-library'
import { cleanup } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as WeeklyService from '@/features/challenges/weekly-service'

const LIVE = {
  id: 'live',
  slug: 'live',
  title: 'The Impossible Note',
  description: 'Hold the B4',
  featType: 'money-note',
  voiceTypeSplit: null,
  difficulty: 'advanced',
  targetItems: [],
  targetScore: 70,
  hearItUrl: null,
  startsAt: '2026-08-31T00:00:00.000Z',
  endsAt: '2026-09-28T00:00:00.000Z',
  rewardBadgeId: null,
  founderScore: null,
  status: 'active',
}

const CLOSED = {
  ...LIVE,
  id: 'closed',
  slug: 'closed',
  title: 'The One Before',
  status: 'closed',
  results: {
    version: 2,
    top3: [{ userId: 'u1', displayName: 'Alto', best: 97, rank: 1 }],
    attemptedCount: 5,
    completedCount: 2,
    closedAt: '2026-08-31T00:10:00.000Z',
  },
}

vi.mock('@/features/challenges/weekly-service', async () => {
  const actual = await vi.importActual<typeof WeeklyService>(
    '@/features/challenges/weekly-service',
  )
  return {
    ...actual,
    getActiveWeekly: () => Promise.resolve(LIVE),
    getWeeklyBoard: () => Promise.resolve(null),
    getWeeklyArchive: () => Promise.resolve([CLOSED]),
    hoursUntil: () => 72,
  }
})

vi.mock('@/features/challenges/board-consent', () => ({
  hasBoardConsent: () => Promise.resolve(true),
  grantBoardConsent: () => Promise.resolve(true),
}))

vi.mock('@/features/challenges/weekly-attempt', () => ({
  beginWeeklyAttempt: () => {},
  clearWeeklyAttempt: () => {},
  weeklyAttemptVersion: () => 0,
}))

vi.mock('@/stores/ui-store', () => ({
  openChallengeStage: () => {},
  setActiveTab: () => {},
}))

vi.mock('@/stores/notifications-store', () => ({
  showNotification: () => {},
}))

const { LegendsShowcase } =
  await import('@/features/challenges/LegendsShowcase')

afterEach(() => {
  cleanup()
})

describe('the Legends view', () => {
  it('shows the live challenge and the archive together', async () => {
    render(() => <LegendsShowcase />)

    await waitFor(() => screen.getByText('The Impossible Note'))
    await waitFor(() => screen.getByText('The One Before'))
    expect(screen.getByTestId('legends-showcase')).toBeTruthy()
    // The archive card carries its podium, and the podium its medal.
    expect(
      screen
        .getByTestId('podium-closed')
        .querySelector('img')
        ?.getAttribute('src'),
    ).toBe('/badges/firstvoice.webp')
  })

  it('does not offer a link to past challenges from the page that is them', async () => {
    render(() => <LegendsShowcase />)
    await waitFor(() => screen.getByText('Sing it'))
    expect(screen.queryByText('See past challenges')).toBeNull()
  })

  it('still lets the singer take the live Legend from here', async () => {
    render(() => <LegendsShowcase />)
    expect(await screen.findByText('Sing it')).toBeTruthy()
  })
})
