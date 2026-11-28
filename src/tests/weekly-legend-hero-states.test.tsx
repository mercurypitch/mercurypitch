// ============================================================
// Home's Legend card when no Legend is on screen
// ============================================================
//
// The card used to answer three different situations with one line, "the
// first Legend is on its way": still loading, nothing running, and a network
// that cannot reach the server. On a work network that blocks the API, that
// told a singer a Legend was coming while one was live. And the way to past
// Legends only showed while one was running, so the empty card was a dead end.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActiveWeeklyRead } from '@/features/challenges/weekly-service'

const tabs: string[] = []
let reads = 0
/** Whether each read went as a person's press (weekly-service.ts). */
const asked: boolean[] = []
let nextRead: () => Promise<ActiveWeeklyRead> = () =>
  Promise.resolve({ status: 'ok', challenge: null })

vi.mock('@/features/challenges/weekly-service', () => ({
  readActiveWeekly: (options?: { userAction?: boolean }) => {
    reads += 1
    asked.push(options?.userAction === true)
    return nextRead()
  },
  getWeeklyBoard: () => Promise.resolve(null),
  hoursUntil: () => 72,
}))

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
  setActiveTab: (tab: string) => tabs.push(tab),
}))

vi.mock('@/stores/notifications-store', () => ({
  showNotification: () => {},
}))

const { WeeklyLegendHero } =
  await import('@/features/challenges/WeeklyLegendHero')
const { takeRequestedLeaderboardView } =
  await import('@/lib/pending-leaderboard-view')
const { TAB_LEADERBOARD } = await import('@/features/tabs/constants')

beforeEach(() => {
  tabs.length = 0
  reads = 0
  asked.length = 0
  takeRequestedLeaderboardView()
  nextRead = () => Promise.resolve({ status: 'ok', challenge: null })
})

afterEach(() => {
  cleanup()
})

describe('the Legend card with nothing running', () => {
  it('says so, without promising a date or a period', async () => {
    render(() => <WeeklyLegendHero />)
    const none = await waitFor(() => screen.getByTestId('legend-none'))
    expect(none.textContent).toContain('No Legend is running right now.')
    expect(none.textContent).not.toMatch(/week|on its way/i)
    expect(screen.queryByTestId('legend-unreachable')).toBeNull()
  })

  it('still offers the past Legends, opening the Legends view', async () => {
    render(() => <WeeklyLegendHero />)
    fireEvent.click(await waitFor(() => screen.getByTestId('legend-past-link')))
    expect(tabs).toEqual([TAB_LEADERBOARD])
    expect(takeRequestedLeaderboardView()).toBe('legends')
  })

  it('leaves the link out where the archive is already underneath', async () => {
    render(() => <WeeklyLegendHero showPastLink={false} />)
    await waitFor(() => screen.getByTestId('legend-none'))
    expect(screen.queryByTestId('legend-past-link')).toBeNull()
  })
})

describe('the Legend card when the server cannot be reached', () => {
  it('blames the network, not the schedule, and offers no dead link', async () => {
    nextRead = () => Promise.resolve({ status: 'unreachable' })
    render(() => <WeeklyLegendHero />)
    const message = await waitFor(() =>
      screen.getByTestId('legend-unreachable'),
    )
    expect(message.textContent).toContain('Couldn')
    expect(message.textContent).toContain('network')
    expect(screen.queryByTestId('legend-none')).toBeNull()
    expect(screen.queryByTestId('legend-past-link')).toBeNull()
  })

  it('reads again on Try again, and shows the Legend once it lands', async () => {
    nextRead = () => Promise.resolve({ status: 'unreachable' })
    render(() => <WeeklyLegendHero />)
    const retry = await waitFor(() => screen.getByTestId('legend-retry'))
    nextRead = () =>
      Promise.resolve({
        status: 'ok',
        challenge: {
          id: 'c1',
          slug: 'c1',
          title: 'Hold the Night',
          description: 'Silent Night, first line',
          featType: 'sustain',
          voiceTypeSplit: null,
          difficulty: 'beginner',
          targetItems: [],
          targetScore: 75,
          hearItUrl: null,
          startsAt: '2026-12-21T00:00:00.000Z',
          endsAt: '2027-01-18T00:00:00.000Z',
          rewardBadgeId: null,
          founderScore: null,
          founderTrace: null,
          status: 'active',
        },
      })
    fireEvent.click(retry)
    await waitFor(() => screen.getByText('Hold the Night'))
    expect(reads).toBe(2)
    expect(screen.queryByTestId('legend-unreachable')).toBeNull()
  })

  // While the API is out of reach a read the page makes by itself is refused
  // at once (api-reachability.ts); Try again is the singer asking, so it goes.
  it('asks on Try again as the singer, and on its first read as the page', async () => {
    nextRead = () => Promise.resolve({ status: 'unreachable' })
    render(() => <WeeklyLegendHero />)
    fireEvent.click(await waitFor(() => screen.getByTestId('legend-retry')))
    await waitFor(() => expect(asked).toEqual([false, true]))
  })
})

describe('Try again on the Legend card, while its read is out', () => {
  // That read can take its whole 8 s deadline. The button stays where it is,
  // holding the focus, and waits (aria-disabled, as the Leagues screen's Try
  // again does); a press while it waits sends nothing. One press, one request.
  it('waits, and sends nothing more for further presses', async () => {
    nextRead = () => Promise.resolve({ status: 'unreachable' })
    render(() => <WeeklyLegendHero />)
    const retry = await waitFor(() => screen.getByTestId('legend-retry'))
    let answer: (read: ActiveWeeklyRead) => void = () => undefined
    nextRead = () =>
      new Promise<ActiveWeeklyRead>((resolve) => {
        answer = resolve
      })

    fireEvent.click(retry)
    await waitFor(() => expect(reads).toBe(2))
    const waiting = screen.getByTestId('legend-retry')
    expect(waiting).toBe(retry)
    expect(waiting.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(waiting)
    fireEvent.click(waiting)
    expect(reads).toBe(2)

    answer({ status: 'unreachable' })
    await waitFor(() =>
      expect(
        screen.getByTestId('legend-retry').getAttribute('aria-disabled'),
      ).toBeNull(),
    )
    expect(reads).toBe(2)
  })
})

describe('the Legend card while the first read is in flight', () => {
  it('holds its place and says nothing yet', async () => {
    nextRead = () => new Promise<ActiveWeeklyRead>(() => {})
    render(() => <WeeklyLegendHero />)
    const loading = await waitFor(() => screen.getByTestId('legend-loading'))
    expect(loading.getAttribute('aria-busy')).toBe('true')
    expect(loading.textContent?.trim()).toBe('')
    expect(screen.queryByTestId('legend-none')).toBeNull()
  })
})
