// ============================================================
// readLeagueMe — the league read that says WHY it has no answer
// ============================================================
//
// fetchLeagueMe() answers null for a refused session and for a phone with
// no network alike, and changes nothing either way: the web reads it so.
// The native Leagues screen tells the two apart: a refused session is asked
// to sign in again, not to check the connection.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/defaults', () => ({
  API_BASE_URL: 'http://api.test',
}))
vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}))
vi.mock('@/stores/notifications-store', () => ({
  showNotification: vi.fn(),
}))

import { fetchLeagueMe, readLeagueMe } from '@/db/services/league-service'
import { getAuthToken, setAuthToken } from '@/db/services/user-service'
import { showNotification } from '@/stores/notifications-store'

function makeToken(provider: string): string {
  const payload = {
    sub: 'user-1',
    provider,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `header.${body}.signature`
}

function answer(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  )
}

const LEAGUE = { eligible: false, reason: 'unavailable' }

beforeEach(() => {
  localStorage.clear()
  setAuthToken(makeToken('apple'))
  vi.mocked(showNotification).mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readLeagueMe', () => {
  it('gives the league when the server answers', async () => {
    answer(200, LEAGUE)
    expect(await readLeagueMe()).toEqual({ status: 'ok', me: LEAGUE })
    expect(await fetchLeagueMe()).toEqual(LEAGUE)
  })

  it('names a lost connection as unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    expect(await readLeagueMe()).toEqual({ status: 'unreachable' })
    expect(await fetchLeagueMe()).toBeNull()
  })

  it('names a server that could not answer as unreachable', async () => {
    answer(503, { error: 'Unavailable' })
    expect(await readLeagueMe()).toEqual({ status: 'unreachable' })
  })

  it('names a session the server would not take as refused', async () => {
    answer(401, { error: 'Unauthorized' })
    expect(await readLeagueMe()).toEqual({ status: 'refused' })
    expect(await fetchLeagueMe()).toBeNull()
  })

  it('tells a suspended account so, as every other read does', async () => {
    answer(403, { error: 'Suspended', code: 'account_suspended' })
    expect(await readLeagueMe()).toEqual({ status: 'refused' })
    expect(getAuthToken()).toBeNull()
    expect(showNotification).toHaveBeenCalledTimes(1)
  })

  it('takes any other 403 for no answer, and signs nobody out', async () => {
    // A block on the way, not the session: as for every data read, only a
    // 401 or a suspension says the session is gone.
    answer(403, { error: 'Forbidden' })
    expect(await readLeagueMe()).toEqual({ status: 'unreachable' })
    expect(getAuthToken()).not.toBeNull()
    expect(showNotification).not.toHaveBeenCalled()
  })
})

describe('fetchLeagueMe', () => {
  it("stays the web's passive read: a suspended answer is null, nothing more", async () => {
    answer(403, { error: 'Suspended', code: 'account_suspended' })
    expect(await fetchLeagueMe()).toBeNull()
    expect(getAuthToken()).not.toBeNull()
    expect(showNotification).not.toHaveBeenCalled()
  })
})
