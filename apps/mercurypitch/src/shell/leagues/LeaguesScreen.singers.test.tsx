// ============================================================
// The Leagues screen: Report and Block on the rows that name a singer
// ============================================================
//
// Slice 4b. A row shows a member's own name only for the viewer and for a
// member who opted in; every other row is a weekly stand-in whose id is a
// membership's (`named: false`), and a worker before `named` sends neither.
// The sheet, its flow, the service and the blocked store are real; the
// worker's block route is a stand-in at the network edge.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LeagueMe, LeagueMeRead, LeagueRung, LeagueStanding, } from '@/db/services/league-service'
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

vi.mock('@/db/services/league-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  readLeagueMe: vi.fn(),
  fetchLeagueLadder: vi.fn(),
}))

import { SingerSheet } from '@/components/moderation/SingerSheet'
import { fetchLeagueLadder, readLeagueMe } from '@/db/services/league-service'
import { resetBlockedSingersForTests } from '@/stores/blocked-singers-store'
import { closeSingerSheet } from '@/stores/singer-sheet-store'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { resetLeagueStoreForTests } from './league-store'
import { LeaguesScreen } from './LeaguesScreen'

const me = vi.mocked(readLeagueMe)
const ladder = vi.mocked(fetchLeagueLadder)

const RUNG: LeagueRung = {
  id: 'l2',
  rank: 2,
  name: 'Sparkwing',
  trophyAsset: '/leagues/l2.webp',
  badgeAsset: null,
  isMystery: false,
  promoteCount: 2,
  relegateCount: 0,
}

function row(
  rank: number,
  userId: string,
  displayName: string,
  named?: boolean,
): LeagueStanding {
  return {
    userId,
    displayName,
    points: 100 - rank,
    rank,
    ...(named === undefined ? {} : { named }),
  }
}

/** Ada opted in; the second is a stand-in; the singer is third; the
 *  fourth came from a worker that predates `named`. */
const STANDINGS = [
  row(1, 'ada', 'Ada', true),
  row(2, 'member-7f3a', 'Singer-7f3a12', false),
  row(3, 'acc-1', 'Maya', true),
  row(4, 'old', 'Old Row'),
]

function league(standings: LeagueStanding[]): LeagueMe {
  return {
    eligible: true,
    weekStart: '2026-10-26T00:00:00.000Z',
    league: RUNG,
    points: 97,
    rank: 3,
    cohortSize: 4,
    standings,
  }
}

const ok = (answer: LeagueMe): LeagueMeRead => ({ status: 'ok', me: answer })

let view: RenderedShell | null = null
let blockRequests: unknown[] = []

const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

const moreButtons = (): string[] =>
  [...document.querySelectorAll('[data-singer-more]')].map(
    (button) => button.getAttribute('aria-label') ?? '',
  )

const places = (): string[] =>
  [...document.querySelectorAll('[data-league-row]')].map(
    (element) => element.getAttribute('data-league-row') ?? '',
  )

function press(selector: string): void {
  const element = document.querySelector<HTMLElement>(selector)
  if (element === null) throw new Error(`Nothing at ${selector}`)
  element.click()
}

function pressButton(name: string): void {
  const button = [...document.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === name,
  )
  if (button === undefined) throw new Error(`No button named ${name}`)
  button.click()
}

beforeEach(() => {
  resetLeagueStoreForTests()
  resetBlockedSingersForTests()
  blockRequests = []
  me.mockReset().mockResolvedValue(ok(league(STANDINGS)))
  ladder.mockReset().mockResolvedValue([RUNG])
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET'
      if (method === 'POST' && new URL(url).pathname === '/api/blocks') {
        blockRequests.push(JSON.parse(String(init.body)))
        return Response.json({ blocked: true }, { status: 201 })
      }
      return Response.json({ blocks: [] })
    }),
  )
})

afterEach(() => {
  closeSingerSheet()
  view?.unmount()
  view = null
  vi.unstubAllGlobals()
})

describe('the Leagues screen’s singers', () => {
  it('offers Report and Block on a row that shows another member’s own name, and on no other', async () => {
    view = renderShell(() => <LeaguesScreen />)
    await settle()

    expect(places()).toEqual(['1', '2', '3', '4'])
    expect(moreButtons()).toEqual(['More about Ada'])
  })

  it('hides a singer blocked from the board at once, keeps every place, and reads the league again', async () => {
    view = renderShell(() => (
      <>
        <LeaguesScreen />
        <SingerSheet />
      </>
    ))
    await settle()
    expect(me).toHaveBeenCalledTimes(1)
    // The league is read again, and that read is still out: what the board
    // shows meanwhile is the phone's own doing.
    me.mockReturnValue(new Promise<LeagueMeRead>(() => {}))

    press('[data-singer-more="ada"]')
    press('[data-testid="singer-choose-block"]')
    pressButton('Block Ada')
    await settle()

    expect(blockRequests).toEqual([{ userId: 'ada' }])
    expect(me).toHaveBeenCalledTimes(2)
    expect(places()).toEqual(['2', '3', '4'])
    // Cut by place: second moves up, third holds, as the server's cut does.
    const zones = [...document.querySelectorAll('[data-league-row]')].map(
      (element) => element.getAttribute('data-zone'),
    )
    expect(zones).toEqual(['promote', 'hold', 'hold'])
  })
})
