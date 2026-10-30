// ============================================================
// The Leagues screen: signed out, its league, a failed read, the ladder
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LeagueMe, LeagueMeRead, LeagueRung, } from '@/db/services/league-service'

const auth = vi.hoisted(() => ({
  held: true,
  id: 'acc-1' as string | null,
  as: (_id: string | null): void => {},
}))

vi.mock('@/db/services/auth-service', async (importOriginal) => {
  const { createSignal } = await import('solid-js')
  const [version, setVersion] = createSignal(0)
  auth.as = (id) => {
    auth.id = id
    auth.held = id !== null
    setVersion((v) => v + 1)
  }
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    accountHeld: () => {
      version()
      return auth.held
    },
    currentAccountId: () => auth.id,
  }
})

vi.mock('@/db/services/user-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getUserId: () => auth.id ?? 'device',
}))

vi.mock('@/db/services/league-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  readLeagueMe: vi.fn(),
  fetchLeagueLadder: vi.fn(),
}))

vi.mock('../settings/sign-in-state', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  openSignIn: vi.fn(),
}))

import { fetchLeagueLadder, readLeagueMe } from '@/db/services/league-service'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { openSignIn } from '../settings/sign-in-state'
import { refreshLeague, resetLeagueStoreForTests } from './league-store'
import { LeaguesScreen } from './LeaguesScreen'

const me = vi.mocked(readLeagueMe)
const ladder = vi.mocked(fetchLeagueLadder)

const ok = (answer: LeagueMe): LeagueMeRead => ({ status: 'ok', me: answer })
const NO_ANSWER: LeagueMeRead = { status: 'unreachable' }

/** A read held open until the test answers it. */
function heldRead(): (value: LeagueMeRead) => void {
  let answer: (value: LeagueMeRead) => void = () => {}
  me.mockReturnValueOnce(
    new Promise<LeagueMeRead>((resolve) => {
      answer = resolve
    }),
  )
  return (value) => answer(value)
}

const NAMES = ['', 'Mercling', 'Sparkwing', 'Skyvox', 'Highnova']

const LADDER: LeagueRung[] = [1, 2, 3, 4].map((rank) => ({
  id: `l${rank}`,
  rank,
  name: NAMES[rank],
  trophyAsset: `/leagues/l${rank}.webp`,
  badgeAsset: null,
  isMystery: false,
  promoteCount: rank === 1 ? 15 : 10,
  relegateCount: rank === 1 ? 0 : 10,
}))

/** Sparkwing, 23 strong, the singer 4th; four with points, the rest none. */
function league(over: Partial<LeagueMe> = {}): LeagueMe {
  const points = [300, 220, 160, 120, ...Array<number>(19).fill(0)]
  return {
    eligible: true,
    weekStart: '2026-10-26T00:00:00.000Z',
    league: LADDER[1],
    points: 120,
    rank: 4,
    cohortSize: 23,
    standings: points.map((p, i) => ({
      userId: i === 3 ? 'acc-1' : `other-${i}`,
      displayName: i === 3 ? 'Maya' : `Singer-${i}`,
      points: p,
      rank: i + 1,
    })),
    ...over,
  }
}

let view: RenderedShell | null = null

const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

async function open(): Promise<void> {
  view = renderShell(() => <LeaguesScreen />)
  await settle()
}

/** What a launch finds: this league kept on the phone, read at `readAt`. */
function keep(readAt: number): void {
  // The phone keeps no board (league-store.ts).
  const { standings: _standings, ...kept } = league()
  localStorage.setItem(
    'mp:league-card',
    JSON.stringify({ accountId: 'acc-1', readAt, me: kept }),
  )
}

const q = (selector: string): Element | null => document.querySelector(selector)
const all = (selector: string): Element[] => [
  ...document.querySelectorAll(selector),
]

beforeEach(() => {
  auth.as('acc-1')
  resetLeagueStoreForTests()
  me.mockReset().mockResolvedValue(ok(league()))
  ladder.mockReset().mockResolvedValue(LADDER)
  vi.mocked(openSignIn).mockClear()
})

afterEach(() => {
  view?.unmount()
  view = null
})

describe('the Leagues screen, signed out', () => {
  beforeEach(() => {
    auth.as(null)
  })

  it('offers the sign-in sheet, and asks no league of the server', async () => {
    await open()
    expect(q('[data-testid="league-invite"]')).not.toBeNull()
    expect(me).not.toHaveBeenCalled()
    ;(q('[data-testid="league-sign-in"]') as HTMLButtonElement).click()
    expect(openSignIn).toHaveBeenCalledTimes(1)
  })

  it('reads the league of who signs in from the invite', async () => {
    await open()
    expect(me).not.toHaveBeenCalled()
    auth.as('acc-1')
    await settle()
    expect(me).toHaveBeenCalledTimes(1)
    expect(q('.mp-league-hero__name')?.textContent).toBe('Sparkwing')
  })

  it('shows the ladder, with every rung above the first veiled', async () => {
    await open()
    const art = all('[data-league-rung] img').map((img) =>
      img.getAttribute('src'),
    )
    // Highest first: Highnova, Skyvox, Sparkwing veiled; Mercling shown.
    expect(art).toEqual([
      '/leagues/locked.webp',
      '/leagues/locked.webp',
      '/leagues/locked.webp',
      '/leagues/l1.webp',
    ])
  })
})

describe('the Leagues screen, signed in', () => {
  it("shows the singer's rung, place and points", async () => {
    await open()
    expect(q('.mp-league-hero__name')?.textContent).toBe('Sparkwing')
    expect(q('.mp-league-hero__place')?.textContent).toBe(
      '4th of 23 this week, 120 points',
    )
    expect(q('[data-league-fact="zone"]')?.textContent).toBe(
      'On course to move up to Skyvox',
    )
    expect(q('[data-league-fact="cut"]')?.textContent).toMatch(
      /^The next cut is in /u,
    )
  })

  it('draws the cut the server makes: only members with points move up', async () => {
    await open()
    const promoted = all('[data-league-row][data-zone="promote"]').map((row) =>
      row.getAttribute('data-league-row'),
    )
    expect(promoted).toEqual(['1', '2', '3', '4'])
    expect(q('[data-league-line="promote"]')?.textContent).toBe(
      'Above this line, up to Skyvox',
    )
    expect(q('[data-league-line="demote"]')?.textContent).toBe(
      'Below this line, down to Mercling',
    )
    expect(all('[data-league-row][data-zone="demote"]')).toHaveLength(10)
  })

  it("marks the singer's own row, and only theirs", async () => {
    await open()
    const mine = all('[data-league-row][data-you="on"]')
    expect(mine).toHaveLength(1)
    expect(mine[0].textContent).toContain('Maya')
    expect(mine[0].textContent).toContain('You')
  })

  it('keeps the You mark out of the name that a long one cuts short', async () => {
    await open()
    const mine = q('[data-league-row][data-you="on"]')
    // The text that truncates is the name alone; the mark is beside it.
    expect(mine?.querySelector('.mp-league-row__text')?.textContent).toBe(
      'Maya',
    )
    expect(
      mine?.querySelector('.mp-league-row__text .mp-league-row__you'),
    ).toBeNull()
    expect(mine?.querySelector('.mp-league-row__you')?.textContent).toBe('You')
  })

  it('marks the rung on the ladder and unveils the ones climbed', async () => {
    await open()
    expect(
      q('[data-league-rung][data-current="on"]')?.getAttribute(
        'data-league-rung',
      ),
    ).toBe('2')
    const art = all('[data-league-rung] img').map((img) =>
      img.getAttribute('src'),
    )
    expect(art).toEqual([
      '/leagues/locked.webp',
      '/leagues/locked.webp',
      '/leagues/l2.webp',
      '/leagues/l1.webp',
    ])
  })

  it('says a read got no answer, and tries again', async () => {
    me.mockResolvedValueOnce(NO_ANSWER)
    await open()
    expect(q('[data-testid="league-retry"]')).not.toBeNull()
    expect(q('[data-testid="league-hero"]')).toBeNull()
    ;(q('[data-testid="league-retry"]') as HTMLButtonElement).click()
    await settle()
    expect(q('[data-testid="league-retry"]')).toBeNull()
    expect(q('.mp-league-hero__name')?.textContent).toBe('Sparkwing')
  })

  it('keeps Try again, and its focus, while the retry is out', async () => {
    me.mockResolvedValueOnce(NO_ANSWER)
    await open()
    const retry = q('[data-testid="league-retry"]') as HTMLButtonElement
    retry.focus()
    const answer = heldRead()
    retry.click()
    // The same button, still focused, marked as waiting.
    expect(q('[data-testid="league-retry"]')).toBe(retry)
    expect(document.activeElement).toBe(retry)
    expect(retry.getAttribute('aria-disabled')).toBe('true')
    // A second press while it waits asks nothing more.
    retry.click()
    expect(me).toHaveBeenCalledTimes(2)
    answer(ok(league()))
    await settle()
    // The league took its place, and the focus with it.
    expect(q('[data-testid="league-retry"]')).toBeNull()
    expect(document.activeElement).toBe(q('.mp-league-hero__name'))
  })

  it('names a server that has no leagues yet', async () => {
    me.mockResolvedValue(ok({ eligible: false, reason: 'unavailable' }))
    await open()
    expect(q('[data-testid="league-unavailable"]')).not.toBeNull()
  })

  it('shows a league read a moment ago, whatever week the phone says it is', async () => {
    // A phone clock a week out: what was just read is still this week's.
    me.mockResolvedValue(ok(league({ weekStart: '2020-01-06T00:00:00.000Z' })))
    await open()
    expect(q('.mp-league-hero__name')?.textContent).toBe('Sparkwing')
  })

  it('shows the kept league at once, and waits for the board', async () => {
    keep(Date.now())
    vi.resetModules()
    const store = await import('./league-store')
    const { LeaguesScreen: Fresh } = await import('./LeaguesScreen')
    const answer = heldRead()
    view = renderShell(() => <Fresh />)
    expect(q('.mp-league-hero__name')?.textContent).toBe('Sparkwing')
    expect(q('[data-testid="league-board-loading"]')?.textContent).toBe(
      'Loading the standings',
    )
    expect(q('[data-testid="league-empty"]')).toBeNull()
    answer(ok(league()))
    await settle()
    expect(q('[data-testid="league-board-loading"]')).toBeNull()
    expect(all('[data-league-row]')).toHaveLength(23)
    store.resetLeagueStoreForTests()
  })

  it("reads this week's league in place of last week's, keeping the rung unveiled", async () => {
    keep(Date.now() - 8 * 86_400_000)
    localStorage.setItem('mp:league-ladder', JSON.stringify(LADDER))
    vi.resetModules()
    const store = await import('./league-store')
    const { LeaguesScreen: Fresh } = await import('./LeaguesScreen')
    const answer = heldRead()
    view = renderShell(() => <Fresh />)
    // Last week's place is not shown as this week's...
    expect(q('[data-testid="league-hero"]')).toBeNull()
    expect(q('[data-testid="league-loading"]')).not.toBeNull()
    // ...and the ladder still shows the trophy the singer has seen, with
    // no rung called theirs until this week's answer says which.
    const art = all('[data-league-rung] img').map((img) =>
      img.getAttribute('src'),
    )
    expect(art.slice(2)).toEqual(['/leagues/l2.webp', '/leagues/l1.webp'])
    expect(q('[data-league-rung][data-current="on"]')).toBeNull()
    expect(document.body.textContent).not.toContain('Reach Sparkwing')
    answer(ok(league()))
    await settle()
    expect(q('.mp-league-hero__name')?.textContent).toBe('Sparkwing')
    expect(me).toHaveBeenCalledTimes(1)
    store.resetLeagueStoreForTests()
  })

  it('opens the board on its words when nobody has scored', async () => {
    me.mockResolvedValue(ok(league({ standings: [], rank: null, points: 0 })))
    await open()
    expect(q('[data-testid="league-empty"]')).not.toBeNull()
    expect(q('.mp-league-hero__place')?.textContent).toBe(
      'No points yet this week',
    )
  })
})

describe('the Leagues screen, open across the cut', () => {
  // Sunday, a minute before midnight UTC: the last minute of the week.
  const SUNDAY = Date.parse('2026-11-01T23:59:00Z')

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(SUNDAY)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("reads the new week's league when the week turns", async () => {
    await open()
    expect(q('.mp-league-hero__place')?.textContent).toBe(
      '4th of 23 this week, 120 points',
    )
    me.mockResolvedValue(
      ok(
        league({
          weekStart: '2026-11-02T00:00:00.000Z',
          league: LADDER[2],
          points: 0,
          rank: null,
          standings: [],
        }),
      ),
    )
    // The screen's clock ticks past midnight.
    vi.advanceTimersByTime(2 * 60_000)
    expect(me).toHaveBeenCalledTimes(2)
    await settle()
    expect(q('.mp-league-hero__name')?.textContent).toBe('Skyvox')
    expect(q('.mp-league-hero__place')?.textContent).toBe(
      'No points yet this week',
    )
    // One read for the turn, not one a minute.
    vi.advanceTimersByTime(5 * 60_000)
    expect(me).toHaveBeenCalledTimes(2)
  })

  it('takes a read that lands past midnight, before its next tick, as this week', async () => {
    vi.setSystemTime(Date.parse('2026-11-01T23:59:30Z'))
    await open()
    expect(me).toHaveBeenCalledTimes(1)
    // Any read after the next one never answers: the test counts asks.
    me.mockReturnValue(new Promise<LeagueMeRead>(() => {}))
    me.mockResolvedValueOnce(
      ok(league({ weekStart: '2026-11-02T00:00:00.000Z' })),
    )
    // Forty seconds on, past midnight and before the screen's clock ticks,
    // the app comes back to the front and the store reads.
    vi.setSystemTime(Date.parse('2026-11-02T00:00:10Z'))
    await refreshLeague()
    await settle()
    expect(me).toHaveBeenCalledTimes(2)
    expect(q('.mp-league-hero__name')?.textContent).toBe('Sparkwing')
  })
})
