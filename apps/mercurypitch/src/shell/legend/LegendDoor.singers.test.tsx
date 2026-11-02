// ============================================================
// The Legend room's door: Report and Block on the board's singers
// ============================================================
//
// Slice 4b. The board's entries carry the singer's id (the Founder's does
// not, nor does an entry from a worker before it), and so do the past
// podiums' places, each on a line of its own with its "...", as on the web.
// The sheet, its flow, the service and the blocked store are real; the
// worker's block route is a stand-in at the network edge.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArchivedWeeklyChallenge, WeeklyBoard, WeeklyChallenge, } from '@/features/challenges/weekly-service'
import type * as Defaults from '@/lib/defaults'

vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<typeof Defaults>()),
  API_BASE_URL: 'http://api.test',
}))

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  accountHeld: () => true,
  currentAccountId: () => 'acc-1',
}))

vi.mock('@/db/services/user-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getUserId: () => 'acc-1',
}))

import { SingerSheet } from '@/components/moderation/SingerSheet'
import { blockSingerAndHide, resetBlockedSingersForTests, } from '@/stores/blocked-singers-store'
import { closeSingerSheet } from '@/stores/singer-sheet-store'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import type { LegendTake } from './legend-take'
import { LegendDoor } from './LegendDoor'

const take = {
  lineNote: () => null,
  linePlaying: () => false,
  playLine: vi.fn(),
  start: vi.fn(),
} as unknown as LegendTake

const RUNNING = {
  id: 'legend-1',
  title: 'Vincero',
  description: '',
  targetItems: [],
  targetScore: 70,
  hearItUrl: null,
  endsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  founderScore: 88,
} as unknown as WeeklyChallenge

function board(top: WeeklyBoard['top']): WeeklyBoard {
  return {
    top,
    attemptedCount: 9,
    rankedCount: 6,
    completedCount: 3,
    targetScore: 70,
    founderScore: 88,
    frozen: false,
    you: null,
  }
}

/** Ana's entry carries her id; the Founder's and an older worker's none. */
const TOP: WeeklyBoard['top'] = [
  { rank: 1, userId: 'ana', displayName: 'Ana', best: 95, isFounder: false },
  { rank: 2, displayName: 'The Founder', best: 88, isFounder: true },
  { rank: 3, userId: 'acc-1', displayName: 'Maya', best: 80, isFounder: false },
  { rank: 4, userId: 'luka', displayName: 'Luka', best: 70, isFounder: false },
]

const PAST = {
  ...RUNNING,
  id: 'legend-0',
  title: 'Nessun dorma',
  results: {
    version: 2,
    top3: [
      { rank: 1, userId: 'iva', displayName: 'Iva', best: 91 },
      { rank: 2, userId: 'ben', displayName: 'Ben', best: 84 },
      { rank: 3, userId: 'acc-1', displayName: 'Maya', best: 80 },
    ],
    attemptedCount: 40,
    completedCount: 12,
    closedAt: '2026-10-21T08:00:00Z',
  },
} as unknown as ArchivedWeeklyChallenge

let view: RenderedShell | null = null
const onBlocked = vi.fn()

const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

function show(top: WeeklyBoard['top'], archive: ArchivedWeeklyChallenge[]) {
  view = renderShell(() => (
    <>
      <LegendDoor
        take={take}
        now={() => Date.now()}
        running={() => RUNNING}
        reading={() => false}
        unreachable={() => false}
        onRetry={() => undefined}
        board={() => board(top)}
        archive={() => archive}
        onBlocked={onBlocked}
      />
      <SingerSheet />
    </>
  ))
}

const moreButtons = (): string[] =>
  [...document.querySelectorAll('[data-singer-more]')].map(
    (button) => button.getAttribute('aria-label') ?? '',
  )

const podium = (): string[] =>
  [...document.querySelectorAll('.mp-legend-podium__row')].map(
    (row) => row.getAttribute('data-rank') ?? '',
  )

function press(selector: string): void {
  const element = document.querySelector<HTMLElement>(selector)
  if (element === null) throw new Error(`Nothing at ${selector}`)
  element.click()
}

beforeEach(() => {
  resetBlockedSingersForTests()
  onBlocked.mockClear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ blocked: true }, { status: 201 })),
  )
})

afterEach(() => {
  closeSingerSheet()
  view?.unmount()
  view = null
  vi.unstubAllGlobals()
})

describe('the Legend board’s singers', () => {
  it('offers Report and Block on a singer’s entry, never the Founder’s or the singer’s own', () => {
    show(TOP, [])

    expect(podium()).toEqual(['1', '2', '3'])
    expect(moreButtons()).toEqual(['More about Ana'])
  })

  it('offers nothing on a board from a worker that sends no ids', () => {
    show(
      TOP.map(({ userId: _userId, ...entry }) => entry),
      [],
    )

    expect(moreButtons()).toEqual([])
  })

  it('hides a singer blocked from the board at once, keeps the places, and has it read again', async () => {
    show(TOP, [])

    press('[data-singer-more="ana"]')
    press('[data-testid="singer-choose-block"]')
    press('[data-testid="singer-block-confirm"]')
    await settle()

    expect(podium()).toEqual(['2', '3', '4'])
    expect(onBlocked).toHaveBeenCalledTimes(1)
  })
})

/** Each past podium place, as its line reads: place, name, score. */
const pastPlaces = (): string[][] =>
  [...document.querySelectorAll('.mp-legend-past__place')].map((place) =>
    [...place.querySelectorAll('span')]
      .filter((part) => part.getAttribute('aria-hidden') !== 'true')
      .map((part) => part.textContent ?? ''),
  )

const pastMore = (): string[] =>
  [
    ...document.querySelectorAll(
      '[data-singer-board="legend-past"] [data-singer-more]',
    ),
  ].map((button) => button.getAttribute('aria-label') ?? '')

describe('a past Legend’s podium in the room', () => {
  it('gives each place a line of its own, a "..." where it names another singer, and keeps Practice', () => {
    show(TOP, [PAST])

    expect(pastPlaces()).toEqual([
      ['1', 'Iva', '91%'],
      ['2', 'Ben', '84%'],
      ['3', 'Maya', '80%'],
    ])
    expect(pastMore()).toEqual(['More about Iva', 'More about Ben'])
    expect(
      document.querySelector('[data-testid="legend-past-practice"]')
        ?.textContent,
    ).toBe('Practice')
  })

  it('offers Report and Block on a place, and has the podiums read again after a block', async () => {
    show(TOP, [PAST])

    press('[data-singer-board="legend-past"] [data-singer-more="ben"]')
    expect(
      document.querySelector('[data-testid="singer-choose-report"]'),
    ).not.toBeNull()
    press('[data-testid="singer-choose-block"]')
    press('[data-testid="singer-block-confirm"]')
    await settle()

    expect(onBlocked).toHaveBeenCalledTimes(1)
    expect(pastPlaces()[1]).toEqual(['2', 'Name withheld', '84%'])
  })

  it('withholds a blocked singer’s name, the place kept, with no "..." on it', async () => {
    show(TOP, [PAST])

    await blockSingerAndHide('iva')

    expect(pastPlaces()[0]).toEqual(['1', 'Name withheld', '91%'])
    expect(pastMore()).toEqual(['More about Ben'])
  })

  it('hands the focus to the "..." now at the blocked place’s, as the sheet closes', async () => {
    show(TOP, [PAST])

    press('[data-singer-board="legend-past"] [data-singer-more="iva"]')
    press('[data-testid="singer-choose-block"]')
    press('[data-testid="singer-block-confirm"]')
    await settle()
    const done = [...document.querySelectorAll('button')].find(
      (button) => button.textContent === 'Done',
    )
    done?.click()
    await settle()

    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'More about Ben',
    )
  })
})
