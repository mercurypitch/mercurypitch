// Auth session races — old verification and renewal responses cannot change a newer session.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/defaults', () => ({ API_BASE_URL: 'http://api.test' }))
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))
// These tests exercise auth ownership; logout's grant engine has its own suite.
vi.mock('@/db/services/grant-flush', () => ({
  flushGrants: vi.fn(),
  discardPendingGrants: vi.fn(),
}))
vi.mock('@/stores/notifications-store', () => ({ showNotification: vi.fn() }))

import type { AuthResponse } from '@/db/services/auth-service'
import { adoptSession, logout, needsSignIn, refreshSession, restoreAuth, } from '@/db/services/auth-service'
import { getAuthToken, setAuthToken } from '@/db/services/user-service'
import { showNotification } from '@/stores/notifications-store'

function token(subject: string, lifetime = 3600): string {
  const body = btoa(
    JSON.stringify({
      sub: subject,
      provider: 'password',
      exp: Math.floor(Date.now() / 1000) + lifetime,
    }),
  )
  return `header.${body}.signature`
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function acceptSession(value: string): void {
  adoptSession({ token: value } as AuthResponse)
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}')),
  )
  logout()
  localStorage.clear()
  vi.mocked(showNotification).mockClear()
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('refresh response ownership', () => {
  it.each([
    ['fetch', 'logout'],
    ['fetch', 'replacement'],
    ['fetch', 'same-token sign-in'],
    ['body', 'logout'],
    ['body', 'replacement'],
    ['body', 'same-token sign-in'],
  ] as const)(
    'ignores a success waiting on %s after %s',
    async (stage, transition) => {
      const old = token('old-account')
      const renewed = token('old-account', 7200)
      const replacement = token('new-account')
      setAuthToken(old)
      const response = deferred<Response>()
      const body = deferred<unknown>()
      const readBody = vi.fn(() => body.promise)
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) =>
          url.endsWith('/refresh')
            ? response.promise
            : Promise.resolve(new Response('{}')),
        ),
      )
      const pending = refreshSession()
      if (stage === 'body') {
        response.resolve({
          ok: true,
          status: 200,
          json: readBody,
        } as unknown as Response)
        await vi.waitFor(() => expect(readBody).toHaveBeenCalledOnce())
      }
      if (transition === 'logout') logout()
      else if (transition === 'replacement') acceptSession(replacement)
      else {
        logout()
        acceptSession(old)
      }
      const expected =
        transition === 'logout'
          ? null
          : transition === 'replacement'
            ? replacement
            : old
      if (stage === 'fetch')
        response.resolve(
          new Response(JSON.stringify({ token: renewed, expiresAt: 'later' })),
        )
      else body.resolve({ token: renewed, expiresAt: 'later' })

      expect(await pending).toBeNull()
      expect(getAuthToken()).toBe(expected)
      expect(needsSignIn()).toBe(transition === 'logout')
      expect(showNotification).not.toHaveBeenCalled()
    },
  )

  it('does not reject a session adopted again while its old refresh was pending', async () => {
    const current = token('account')
    setAuthToken(current)
    const response = deferred<Response>()
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.endsWith('/refresh')
          ? response.promise
          : Promise.resolve(new Response('{}')),
      ),
    )
    const pending = refreshSession()
    logout()
    acceptSession(current)
    response.resolve(new Response('{}', { status: 401 }))

    expect(await pending).toBeNull()
    expect(getAuthToken()).toBe(current)
    expect(needsSignIn()).toBe(false)
    expect(showNotification).not.toHaveBeenCalled()
  })

  it('still adopts a refresh for the unchanged session and verifies that exact token', async () => {
    const current = token('account')
    const renewed = token('account', 7200)
    setAuthToken(current)
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ token: renewed, expiresAt: 'later' })),
    )
    vi.stubGlobal('fetch', fetchMock)

    expect(await refreshSession()).toEqual({
      token: renewed,
      expiresAt: 'later',
    })
    expect(getAuthToken()).toBe(renewed)
    expect(await restoreAuth()).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${current}`,
        }),
      }),
    )
  })
})

describe('verification response ownership', () => {
  it('does not report an old verification as signed in after logout', async () => {
    setAuthToken(token('account'))
    const response = deferred<Response>()
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.endsWith('/me')
          ? response.promise
          : Promise.resolve(new Response('{}')),
      ),
    )
    const pending = restoreAuth()
    logout()
    response.resolve(new Response('{}'))

    expect(await pending).toBe(false)
    expect(getAuthToken()).toBeNull()
    expect(needsSignIn()).toBe(true)
  })

  it.each([200, 401, 404])(
    'does not apply an old %s to an unverified replacement token',
    async (status) => {
      const old = token('old-account')
      const replacement = token('new-account')
      setAuthToken(old)
      const response = deferred<Response>()
      const fetchMock = vi
        .fn()
        .mockReturnValueOnce(response.promise)
        .mockResolvedValue(new Response('{}'))
      vi.stubGlobal('fetch', fetchMock)
      const pending = restoreAuth()
      setAuthToken(replacement)
      response.resolve(new Response('{}', { status }))

      expect(await pending).toBe(false)
      expect(getAuthToken()).toBe(replacement)
      expect(showNotification).not.toHaveBeenCalled()
      expect(await restoreAuth()).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls[1]?.[1]).toEqual({
        headers: { Authorization: `Bearer ${replacement}` },
      })
    },
  )

  it('does not reuse a verification cache for a different token', async () => {
    acceptSession(token('old-account'))
    const replacement = token('new-account')
    setAuthToken(replacement)
    const fetchMock = vi.fn(async () => new Response('{}', { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await restoreAuth()).toBe(false)
    expect(getAuthToken()).toBeNull()
    expect(needsSignIn()).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('honors a current-token refusal after another request verified that same token', async () => {
    setAuthToken(token('account'))
    const accepted = deferred<Response>()
    const refused = deferred<Response>()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockReturnValueOnce(accepted.promise)
        .mockReturnValueOnce(refused.promise),
    )
    const first = restoreAuth()
    const second = restoreAuth()
    accepted.resolve(new Response('{}'))
    expect(await first).toBe(true)
    refused.resolve(new Response('{}', { status: 401 }))

    expect(await second).toBe(false)
    expect(getAuthToken()).toBeNull()
    expect(needsSignIn()).toBe(true)
  })

  it('ignores an old suspension body that finishes after a new sign-in', async () => {
    setAuthToken(token('old-account'))
    const body = deferred<string>()
    const readBody = vi.fn(() => body.promise)
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          ({
            ok: false,
            status: 403,
            clone: () => ({ text: readBody }),
          }) as unknown as Response,
      ),
    )
    const pending = restoreAuth()
    await vi.waitFor(() => expect(readBody).toHaveBeenCalledOnce())
    const replacement = token('new-account')
    acceptSession(replacement)
    body.resolve(JSON.stringify({ code: 'account_suspended' }))

    expect(await pending).toBe(true)
    expect(getAuthToken()).toBe(replacement)
    expect(needsSignIn()).toBe(false)
    expect(showNotification).not.toHaveBeenCalled()
  })
})
