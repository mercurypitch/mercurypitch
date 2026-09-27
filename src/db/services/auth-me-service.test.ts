// ============================================================
// readMe — the account read that says WHY it has no answer
// ============================================================
//
// fetchMe() answers null for a signed-out phone and for a phone with no
// network alike, and the account card read that null as "You are signed
// out" (S6 audit D1, REQ-NAM-049). readMe keeps the two apart.

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

import { heldAccountProvider, readMe } from '@/db/services/auth-me-service'
import { getAuthToken, setAuthToken } from '@/db/services/user-service'

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

function answer(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fn = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

const ME = {
  user: {
    id: 'user-1',
    authProvider: 'apple',
    email: 'singer@example.test',
  },
  profile: { displayName: 'Alex' },
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readMe', () => {
  it('names a lost connection as unreachable, and keeps the session', async () => {
    setAuthToken(makeToken('apple'))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    const read = await readMe()

    expect(read).toEqual({ status: 'unreachable' })
    expect(getAuthToken()).not.toBeNull()
  })

  it('names a server that fails as unreachable, not as signed out', async () => {
    setAuthToken(makeToken('apple'))
    answer(503, { error: 'unavailable' })

    const read = await readMe()

    expect(read).toEqual({ status: 'unreachable' })
  })

  it('answers signed out when the server refuses the session', async () => {
    setAuthToken(makeToken('apple'))
    answer(401, { error: 'Invalid token' })

    const read = await readMe()

    expect(read).toEqual({ status: 'signed-out' })
  })

  it('answers signed out with no token, without asking the server', async () => {
    const fetchMock = answer(200, ME)

    const read = await readMe()

    expect(read).toEqual({ status: 'signed-out' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('hands back the account when the server answers', async () => {
    setAuthToken(makeToken('apple'))
    answer(200, ME)

    const read = await readMe()

    expect(read).toEqual({ status: 'ok', me: ME })
  })
})

describe('heldAccountProvider', () => {
  it('names the provider of the account the phone holds, with no network', () => {
    setAuthToken(makeToken('google'))

    const provider = heldAccountProvider()

    expect(provider).toBe('google')
  })

  it('names nothing for the anonymous device identity', () => {
    setAuthToken(makeToken('anonymous'))

    const provider = heldAccountProvider()

    expect(provider).toBeNull()
  })
})
