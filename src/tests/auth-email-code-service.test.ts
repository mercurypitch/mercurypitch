// ============================================================
// Auth email-code service — what it stores, and when it stores nothing
// ============================================================
//
// Two things worth pinning. The address is normalised before it leaves, so a
// capitalised paste finds the same account the lowercase one would. And a
// verify that comes back owing a second factor stores NOTHING — the code was
// right and bought nothing, which is the whole point of the fork.

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

import { requestLoginCode, verifyLoginCode, } from '@/db/services/auth-email-code-service'
import { getAuthToken } from '@/db/services/user-service'

function makeToken(): string {
  const body = btoa(
    JSON.stringify({
      sub: 'user-1',
      provider: 'emailcode',
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `header.${body}.signature`
}

function mockFetchOnce(
  status: number,
  body: unknown,
): ReturnType<typeof vi.fn> {
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

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('requestLoginCode', () => {
  it('normalises the address and returns the ceremony', async () => {
    const fetchMock = mockFetchOnce(200, { ok: true, ceremony: 'ceremony-1' })

    expect(await requestLoginCode('  Maff@Example.COM ', 'turnstile')).toBe(
      'ceremony-1',
    )
    const body = JSON.parse(
      (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string,
    ) as Record<string, unknown>
    expect(body.email).toBe('maff@example.com')
    expect(body.cfTurnstileToken).toBe('turnstile')
  })

  it('surfaces the server sentence on a refusal', async () => {
    mockFetchOnce(503, {
      error: 'Email delivery is unavailable in this pull-request preview',
    })
    await expect(requestLoginCode('maff@example.com')).rejects.toThrow(
      'Email delivery is unavailable in this pull-request preview',
    )
  })
})

describe('verifyLoginCode', () => {
  it('adopts the session it is handed', async () => {
    const token = makeToken()
    mockFetchOnce(200, { token, userId: 'user-1' })

    await verifyLoginCode('ceremony-1', '123456')
    expect(getAuthToken()).toBe(token)
  })

  it('stores nothing when the account still owes a second factor', async () => {
    mockFetchOnce(200, { twofaRequired: true, ceremony: 'twofa-ceremony' })

    const outcome = await verifyLoginCode('ceremony-1', '123456')
    expect(outcome).toEqual({
      twofaRequired: true,
      ceremony: 'twofa-ceremony',
    })
    // The one assertion that matters: a client which ignored `twofaRequired`
    // entirely would still be holding no token.
    expect(getAuthToken()).toBeNull()
  })

  it('trims the code, because a pasted one carries whitespace', async () => {
    const fetchMock = mockFetchOnce(200, { token: makeToken() })
    await verifyLoginCode('ceremony-1', ' 123456 ')
    const body = JSON.parse(
      (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string,
    ) as Record<string, unknown>
    expect(body.code).toBe('123456')
  })

  it('throws the server sentence on a dead code', async () => {
    mockFetchOnce(401, { error: 'That code is not valid or has expired' })
    await expect(verifyLoginCode('ceremony-1', '000000')).rejects.toThrow(
      'That code is not valid or has expired',
    )
    expect(getAuthToken()).toBeNull()
  })
})
