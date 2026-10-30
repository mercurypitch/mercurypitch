// ============================================================
// The league the phone keeps: one account's, read in the background
// ============================================================

import { createRoot, onMount } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LeagueMe, LeagueMeRead, LeagueRung, } from '@/db/services/league-service'

const auth = vi.hoisted(() => ({
  held: true,
  id: 'acc-1' as string | null,
  /** Sign in as `id`, or out with null: what a token change does. */
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
    // What a refused session leads to: signed out, asked to sign in.
    handleCloudSessionRejected: vi.fn(() => {
      auth.as(null)
      return true
    }),
  }
})

vi.mock('@/db/services/league-service', () => ({
  readLeagueMe: vi.fn(),
  fetchLeagueLadder: vi.fn(),
}))

import { handleCloudSessionRejected } from '@/db/services/auth-service'
import { fetchLeagueLadder, readLeagueMe } from '@/db/services/league-service'
import { installLeagueRefresh, LEAGUE_FRESH_MS, leagueCard, leagueLadder, leagueReadFailed, leagueReading, leagueReadThisWeek, refreshLeague, resetLeagueStoreForTests, } from './league-store'

const me = vi.mocked(readLeagueMe)
const ladder = vi.mocked(fetchLeagueLadder)

const ok = (answer: LeagueMe): LeagueMeRead => ({ status: 'ok', me: answer })
const NO_ANSWER: LeagueMeRead = { status: 'unreachable' }

/** Sunday night, the last hour of the week of 26 October 2026. */
const SUNDAY = Date.parse('2026-11-01T23:00:00Z')
/** Five past midnight on Monday, UTC: the next week. */
const MONDAY = Date.parse('2026-11-02T00:05:00Z')

const LADDER: LeagueRung[] = [1, 2, 3].map((rank) => ({
  id: `l${rank}`,
  rank,
  name: `Rung ${rank}`,
  trophyAsset: `/leagues/l${rank}.webp`,
  badgeAsset: null,
  isMystery: false,
  promoteCount: 10,
  relegateCount: 10,
}))

function league(points: number): LeagueMe {
  return {
    eligible: true,
    weekStart: '2026-10-26T00:00:00.000Z',
    league: LADDER[1],
    points,
    rank: 4,
    cohortSize: 23,
    standings: [],
  }
}

/** Let the reads the store started settle. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

let stop: (() => void) | null = null

beforeEach(() => {
  auth.as('acc-1')
  resetLeagueStoreForTests()
  me.mockReset().mockResolvedValue(ok(league(120)))
  ladder.mockReset().mockResolvedValue(LADDER)
  vi.mocked(handleCloudSessionRejected).mockClear()
})

afterEach(() => {
  stop?.()
  stop = null
  vi.restoreAllMocks()
})

describe('the league the phone keeps', () => {
  it("is the account's that read it, and nobody else's", async () => {
    await refreshLeague()
    expect(leagueCard()?.points).toBe(120)
    expect(leagueLadder()).toHaveLength(3)

    auth.as('acc-2')
    expect(leagueCard()).toBeNull()
    auth.as(null)
    expect(leagueCard()).toBeNull()
  })

  it('is kept on the phone, under its own key', async () => {
    await refreshLeague()
    const kept = JSON.parse(localStorage.getItem('mp:league-card') ?? 'null')
    expect(kept).toMatchObject({ accountId: 'acc-1', me: { points: 120 } })
  })

  it("keeps no other member's name on the phone", async () => {
    me.mockResolvedValue(
      ok({
        ...league(120),
        standings: [
          { userId: 'u9', displayName: 'Ana', points: 310, rank: 1 },
          { userId: 'acc-1', displayName: 'Maya', points: 120, rank: 2 },
        ],
      }),
    )
    await refreshLeague()
    // In memory, for the screen that shows the board...
    expect(leagueCard()?.standings).toHaveLength(2)
    // ...and not in storage.
    const raw = localStorage.getItem('mp:league-card') ?? ''
    expect(raw).not.toContain('Ana')
    expect(JSON.parse(raw).me.standings).toBeUndefined()
  })

  it('stays as it was when a read gets no answer, and says so', async () => {
    await refreshLeague()
    me.mockResolvedValue(NO_ANSWER)
    await refreshLeague()
    expect(leagueReadFailed()).toBe(true)
    expect(leagueCard()?.points).toBe(120)
  })

  it('goes on saying so while the next read is out, until one lands', async () => {
    me.mockResolvedValue(NO_ANSWER)
    await refreshLeague()
    let answer: (value: LeagueMeRead) => void = () => {}
    me.mockReturnValue(
      new Promise<LeagueMeRead>((resolve) => {
        answer = resolve
      }),
    )
    const read = refreshLeague()
    expect(leagueReading()).toBe(true)
    expect(leagueReadFailed()).toBe(true)
    answer(ok(league(120)))
    await read
    expect(leagueReadFailed()).toBe(false)
  })

  it("never shows one account's failed read to the next", async () => {
    me.mockResolvedValue(NO_ANSWER)
    await refreshLeague()
    expect(leagueReadFailed()).toBe(true)
    auth.as(null)
    expect(leagueReadFailed()).toBe(false)
    // The next account's own read is out, and it has failed at nothing.
    me.mockReturnValue(new Promise<LeagueMeRead>(() => {}))
    auth.as('acc-2')
    void refreshLeague()
    expect(leagueReading()).toBe(true)
    expect(leagueReadFailed()).toBe(false)
  })

  it('asks a refused session to sign in again, not to check the connection', async () => {
    me.mockResolvedValue({ status: 'refused' })
    await refreshLeague()
    expect(handleCloudSessionRejected).toHaveBeenCalledTimes(1)
    expect(leagueReadFailed()).toBe(false)
    expect(leagueCard()).toBeNull()
  })

  it('shares one read between asks that overlap', async () => {
    const first = refreshLeague()
    const second = refreshLeague()
    await Promise.all([first, second])
    expect(me).toHaveBeenCalledTimes(1)
    expect(ladder).toHaveBeenCalledTimes(1)
    // Once it is in, the next ask reads again.
    await refreshLeague()
    expect(me).toHaveBeenCalledTimes(2)
  })

  it('reads only the public ladder for a phone with no account', async () => {
    auth.as(null)
    await refreshLeague()
    expect(me).not.toHaveBeenCalled()
    expect(leagueLadder()).toHaveLength(3)
    expect(leagueReadFailed()).toBe(false)
  })

  it('drops an answer for an account that changed hands while it was out', async () => {
    let answer: (value: LeagueMeRead) => void = () => {}
    me.mockReturnValue(
      new Promise<LeagueMeRead>((resolve) => {
        answer = resolve
      }),
    )
    const read = refreshLeague()
    auth.as('acc-2')
    answer(ok(league(999)))
    await read
    expect(localStorage.getItem('mp:league-card')).toBeNull()
    auth.as('acc-1')
    expect(leagueCard()).toBeNull()
  })
})

describe('the league week', () => {
  it("is judged by when the league was read, on the phone's clock", async () => {
    vi.spyOn(Date, 'now').mockReturnValue(SUNDAY)
    await refreshLeague()
    expect(leagueReadThisWeek(SUNDAY + 30 * 60_000)).toBe(true)
    expect(leagueReadThisWeek(MONDAY)).toBe(false)
  })

  it('holds an answer read a moment ago, whatever week the server named', async () => {
    // A phone clock a week out: the server's week is not the phone's, and
    // the answer is still the one just read.
    me.mockResolvedValue(
      ok({ ...league(120), weekStart: '2026-10-19T00:00:00.000Z' }),
    )
    await refreshLeague()
    expect(leagueReadThisWeek()).toBe(true)
  })

  it('is no week at all for a phone with nothing kept', () => {
    expect(leagueReadThisWeek()).toBe(false)
  })
})

describe('reading in the background', () => {
  it('reads as the shell starts, for a signed-in phone with nothing kept', async () => {
    stop = installLeagueRefresh()
    await settle()
    expect(me).toHaveBeenCalledTimes(1)
    expect(leagueCard()?.points).toBe(120)
  })

  it("reads once at a cold start from the shell's mount", async () => {
    // NativeShell installs it inside onMount, where an effect waits for the
    // mount to finish: the start must not read once there and once again.
    const dispose = createRoot((done) => {
      onMount(() => {
        stop = installLeagueRefresh()
      })
      return done
    })
    await settle()
    expect(me).toHaveBeenCalledTimes(1)
    expect(ladder).toHaveBeenCalledTimes(1)
    dispose()
  })

  it("reads once at a cold start with another account's league kept", async () => {
    await refreshLeague()
    auth.as('acc-2')
    me.mockClear()
    ladder.mockClear()
    const dispose = createRoot((done) => {
      onMount(() => {
        stop = installLeagueRefresh()
      })
      return done
    })
    await settle()
    expect(me).toHaveBeenCalledTimes(1)
    expect(ladder).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('does not read again on a return within a quarter of an hour', async () => {
    stop = installLeagueRefresh()
    await settle()
    document.dispatchEvent(new Event('visibilitychange'))
    await settle()
    expect(me).toHaveBeenCalledTimes(1)
  })

  it('reads again on a return once the kept league is stale', async () => {
    stop = installLeagueRefresh()
    await settle()
    const later = Date.now() + LEAGUE_FRESH_MS + 1
    vi.spyOn(Date, 'now').mockReturnValue(later)
    me.mockResolvedValue(ok(league(150)))
    document.dispatchEvent(new Event('visibilitychange'))
    await settle()
    expect(me).toHaveBeenCalledTimes(2)
    expect(leagueCard()?.points).toBe(150)
  })

  it('reads again on a return once the week has turned, however fresh', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(MONDAY - 10 * 60_000)
    stop = installLeagueRefresh()
    await settle()
    expect(me).toHaveBeenCalledTimes(1)
    clock.mockReturnValue(MONDAY)
    document.dispatchEvent(new Event('visibilitychange'))
    await settle()
    expect(me).toHaveBeenCalledTimes(2)
  })

  it('lets the league go as the phone signs out, and reads for the next account', async () => {
    stop = installLeagueRefresh()
    await settle()
    expect(localStorage.getItem('mp:league-card')).not.toBeNull()

    auth.as(null)
    await settle()
    expect(localStorage.getItem('mp:league-card')).toBeNull()

    me.mockResolvedValue(ok(league(30)))
    auth.as('acc-2')
    await settle()
    expect(leagueCard()?.points).toBe(30)
  })
})
