// ============================================================
// The Leagues screen: where the focus goes when the singer sheet closes
// ============================================================
//
// WCAG 2.4.3, on a native board. A block takes the row the sheet was opened
// from off the board, and the league's read after it draws every row anew;
// the focus goes to the "..." now at that place, and stays there through
// the read. With no "..." left, it goes to the league's name. The sheet,
// its flow, the service and the blocked store are real; the league read is
// held back, to land after the close.

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
  trophyAsset: null,
  badgeAsset: null,
  isMystery: false,
  promoteCount: 1,
  relegateCount: 0,
}

const row = (rank: number, userId: string, name: string): LeagueStanding => ({
  userId,
  displayName: name,
  points: 100 - rank,
  rank,
  named: true,
})

function read(standings: LeagueStanding[]): LeagueMeRead {
  const answer: LeagueMe = {
    eligible: true,
    weekStart: '2026-10-26T00:00:00.000Z',
    league: RUNG,
    points: 90,
    rank: 9,
    cohortSize: 9,
    standings,
  }
  return { status: 'ok', me: answer }
}

let view: RenderedShell | null = null

const settle = async (): Promise<void> => {
  for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0))
}

const more = (userId: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-singer-more="${userId}"]`)

function pressButton(name: string): void {
  const button = [...document.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === name,
  )
  if (button === undefined) throw new Error(`No button named ${name}`)
  button.click()
}

/** Block a singer from their row's "...", and close the sheet with Done. */
async function blockFromRow(userId: string, name: string): Promise<void> {
  const button = more(userId)
  if (button === null) throw new Error(`No "..." for ${userId}`)
  button.click()
  await settle()
  document
    .querySelector<HTMLElement>('[data-testid="singer-choose-block"]')
    ?.click()
  await settle()
  pressButton(`Block ${name}`)
  await settle()
  pressButton('Done')
  await settle()
}

/** The league's next read, held until let go. */
function holdNextRead(answer: LeagueMeRead): () => void {
  let letGo: () => void = () => {}
  me.mockReturnValueOnce(
    new Promise<LeagueMeRead>((resolve) => {
      letGo = () => resolve(answer)
    }),
  )
  return () => letGo()
}

beforeEach(() => {
  resetLeagueStoreForTests()
  resetBlockedSingersForTests()
  ladder.mockReset().mockResolvedValue([RUNG])
  me.mockReset()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit = {}) => {
      if ((init.method ?? 'GET') === 'POST') {
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

function show(): void {
  view = renderShell(() => (
    <>
      <LeaguesScreen />
      <SingerSheet />
    </>
  ))
}

describe('the focus, as the singer sheet closes on the Leagues screen', () => {
  it('goes to the "..." now at the blocked row’s place, and stays through the read', async () => {
    me.mockResolvedValueOnce(
      read([
        row(1, 'ada', 'Ada'),
        row(2, 'ben', 'Ben'),
        row(3, 'cleo', 'Cleo'),
      ]),
    )
    show()
    await settle()
    const letGo = holdNextRead(
      read([row(1, 'ada', 'Ada'), row(3, 'cleo', 'Cleo')]),
    )

    await blockFromRow('ben', 'Ben')

    const landed = more('cleo')
    expect(document.activeElement).toBe(landed)

    letGo()
    await settle()

    // Every row drawn anew by the read: the focus is on Cleo's new "...".
    expect(more('cleo')).not.toBe(landed)
    expect(document.activeElement).toBe(more('cleo'))
  })

  it('goes to the league’s name when no "..." is left', async () => {
    me.mockResolvedValueOnce(
      read([row(1, 'ada', 'Ada'), row(2, 'acc-1', 'Me')]),
    )
    show()
    await settle()
    me.mockResolvedValue(read([row(2, 'acc-1', 'Me')]))

    await blockFromRow('ada', 'Ada')

    const name = document.querySelector('.mp-league-hero__name')
    expect(name?.textContent).toBe('Sparkwing')
    expect(document.activeElement).toBe(name)
  })
})
