// ============================================================
// The web's Legend boards: Report and Block on the singers they name
// ============================================================
//
// Slice 4b. The live board's entries carry each singer's id (the Founder's
// none), so a singer's row ends in a "..." for Report and Block; the past
// podiums are read without an account, so a place there offers Report
// alone, and a singer the viewer blocked is withheld by the viewer's own
// device. Both are on the Leaderboard's Legends view, which the phone
// reaches from Progress. The blocked store is real; the worker is a
// stand-in at the network edge.

import { cleanup, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Defaults from '@/lib/defaults'
import type * as WeeklyService from './weekly-service'

const data = vi.hoisted(() => ({
  board: null as unknown,
  archive: [] as unknown[],
}))

vi.mock('./weekly-service', async (importOriginal) => ({
  ...(await importOriginal<typeof WeeklyService>()),
  getActiveWeekly: () =>
    Promise.resolve({
      id: 'c1',
      slug: 'c1',
      title: 'The Impossible Note',
      description: 'Hold the B4',
      featType: 'money-note',
      targetItems: [],
      targetScore: 70,
      hearItUrl: null,
      endsAt: '2026-12-28T00:00:00.000Z',
      founderScore: 88,
    }),
  getWeeklyBoard: () => Promise.resolve(data.board),
  getWeeklyArchive: () => Promise.resolve(data.archive),
  hoursUntil: () => 72,
}))

vi.mock('./board-consent', () => ({
  hasBoardConsent: () => Promise.resolve(true),
  grantBoardConsent: () => Promise.resolve(true),
}))

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  accountHeld: () => true,
  currentAccountId: () => 'me',
}))

vi.mock('@/db/services/user-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getUserId: () => 'me',
}))

vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<typeof Defaults>()),
  API_BASE_URL: 'http://api.test',
}))

import { blockSingerAndHide, resetBlockedSingersForTests, } from '@/stores/blocked-singers-store'
import { closeSingerSheet, singerSheetSubject, } from '@/stores/singer-sheet-store'
import { PastWeeklyChallenges } from './PastWeeklyChallenges'
import { WeeklyLegendHero } from './WeeklyLegendHero'

const moreButtons = (): string[] =>
  [...document.querySelectorAll('[data-singer-more]')].map(
    (button) => button.getAttribute('aria-label') ?? '',
  )

beforeEach(() => {
  resetBlockedSingersForTests()
  data.board = {
    top: [
      {
        rank: 1,
        userId: 'ana',
        displayName: 'Ana',
        best: 95,
        isFounder: false,
      },
      { rank: 2, displayName: 'The Founder', best: 88, isFounder: true },
      {
        rank: 3,
        userId: 'me',
        displayName: 'Maya',
        best: 80,
        isFounder: false,
      },
      {
        rank: 4,
        userId: 'cleo',
        displayName: 'Cleo',
        best: 70,
        isFounder: false,
      },
    ],
    attemptedCount: 9,
    rankedCount: 4,
    completedCount: 3,
    targetScore: 70,
    founderScore: 88,
    frozen: false,
    you: null,
  }
  data.archive = [
    {
      id: 'p1',
      slug: 'p1',
      title: 'Nessun dorma',
      description: 'A closed one',
      featType: 'money-note',
      difficulty: 'advanced',
      targetItems: [],
      targetScore: 70,
      endsAt: '2026-10-21T00:00:00.000Z',
      results: {
        version: 2,
        top3: [
          { rank: 1, userId: 'iva', displayName: 'Iva', best: 91 },
          { rank: 2, userId: 'me', displayName: 'Maya', best: 84 },
          { rank: 3, displayName: null, best: 80, redacted: true },
        ],
        attemptedCount: 12,
        completedCount: 4,
        closedAt: '2026-10-21T08:00:00Z',
      },
    },
  ]
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ blocked: true }, { status: 201 })),
  )
})

afterEach(() => {
  closeSingerSheet()
  cleanup()
  vi.unstubAllGlobals()
})

describe('the live Legend’s board', () => {
  it('ends a singer’s row in a "...", never the Founder’s or the singer’s own', async () => {
    render(() => <WeeklyLegendHero />)

    await waitFor(() => expect(moreButtons()).toEqual(['More about Ana']))
  })

  it('loses a singer blocked from here at once, the places kept', async () => {
    const { container } = render(() => <WeeklyLegendHero />)
    await waitFor(() => expect(moreButtons()).toHaveLength(1))

    await blockSingerAndHide('ana')

    const ranks = [...container.querySelectorAll('ol li')].map(
      (row) => row.firstElementChild?.textContent,
    )
    expect(ranks).toEqual(['2', '3', '4'])
    expect(moreButtons()).toEqual(['More about Cleo'])
  })
})

describe('a past Legend’s podium', () => {
  it('offers Report alone on a place that names another singer', async () => {
    render(() => <PastWeeklyChallenges />)
    const more = await waitFor(() =>
      screen.getByRole('button', { name: 'More about Iva' }),
    )

    more.click()

    expect(moreButtons()).toEqual(['More about Iva'])
    expect(singerSheetSubject()).toMatchObject({
      userId: 'iva',
      reportOnly: true,
    })
  })

  it('withholds the name of a singer the viewer blocked, the place kept', async () => {
    await blockSingerAndHide('iva')
    const { container } = render(() => <PastWeeklyChallenges />)

    await waitFor(() => screen.getByText('Nessun dorma'))

    const places = [...container.querySelectorAll('ol li')].map(
      (place) => place.textContent,
    )
    expect(places[0]).toContain('<redacted>')
    expect(places[1]).toContain('Maya')
    expect(moreButtons()).toEqual([])
  })
})
