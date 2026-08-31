// ============================================================
// Auth Service Tests — anonymous bootstrap, login, register
// ============================================================

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

import type { AuthResponse } from '@/db/services/auth-service'
import { consumeGoogleRedirect, deleteAccount, fetchMe, handleAuthErrorResponse, hasValidToken, isTwofaChallenge, loginWithGoogle, loginWithPassword, logout, registerWithPassword, requireAuth, resendVerificationEmail, restoreAuth, startDriveConnect, takeDriveConnectResult, takeGoogleAccountCreated, takeGoogleRedirectResult, } from '@/db/services/auth-service'
import { getAuthHeaders, getAuthToken, getUserId, setAuthToken, } from '@/db/services/user-service'
import { trackEvent } from '@/lib/analytics'
import { showNotification } from '@/stores/notifications-store'

const trackEventMock = vi.mocked(trackEvent)
const showNotificationMock = vi.mocked(showNotification)

function makeToken(expiresInSeconds: number, provider = 'anonymous'): string {
  const payload = {
    sub: 'user-1',
    provider,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  }
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `header.${body}.signature`
}

function mockFetchOnce(
  status: number,
  body: unknown,
): ReturnType<typeof vi.fn> {
  const response = (): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  const fn = vi.fn(async () => response())
  vi.stubGlobal('fetch', fn)
  return fn
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  trackEventMock.mockClear()
  showNotificationMock.mockClear()
  history.replaceState(null, '', '/')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('token storage', () => {
  it('persists and clears the auth token', () => {
    setAuthToken('abc')
    expect(getAuthToken()).toBe('abc')
    expect(getAuthHeaders()).toEqual({ Authorization: 'Bearer abc' })
    logout()
    expect(getAuthToken()).toBeNull()
    expect(getAuthHeaders()).toEqual({})
  })

  it('treats expired tokens as invalid', () => {
    setAuthToken(makeToken(-100))
    expect(hasValidToken()).toBe(false)
    setAuthToken(makeToken(3600))
    expect(hasValidToken()).toBe(true)
  })
})

describe('restoreAuth', () => {
  // The whole point of lazy provisioning: a visitor who only browses must
  // never end up with a users row. Startup and the account UI call this.
  it('never provisions an identity when no token is stored', async () => {
    const fetchMock = mockFetchOnce(200, {
      token: makeToken(3600),
      userId: 'u',
      isNew: true,
      user: { authProvider: 'anonymous' },
    })
    expect(await restoreAuth()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(getAuthToken()).toBeNull()
  })

  it('reuses a stored session without re-authenticating', async () => {
    setAuthToken(makeToken(3600))
    const fetchMock = mockFetchOnce(200, {})
    expect(await restoreAuth()).toBe(true)
    // One /api/auth/me verification, never an /anonymous handshake.
    expect(fetchMock).not.toHaveBeenCalledWith(
      'http://api.test/api/auth/anonymous',
      expect.anything(),
    )
  })

  it('reports signed-out for an expired token', async () => {
    setAuthToken(makeToken(-100))
    const fetchMock = mockFetchOnce(200, {})
    expect(await restoreAuth()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('requireAuth', () => {
  it('shares one anonymous bootstrap across concurrent callers', async () => {
    const deviceId = getUserId()
    let finishRequest: (() => void) | undefined
    const requestStarted = new Promise<void>((resolve) => {
      finishRequest = resolve
    })
    let releaseResponse: (() => void) | undefined
    const responseReleased = new Promise<void>((resolve) => {
      releaseResponse = resolve
    })
    const fetchMock = vi.fn(async () => {
      finishRequest?.()
      await responseReleased
      return {
        ok: true,
        status: 200,
        statusText: '200',
        json: async () => ({
          token: makeToken(3600),
          userId: deviceId,
          isNew: true,
          user: { id: deviceId, authProvider: 'anonymous' },
        }),
        text: async () => '',
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const first = requireAuth()
    await requestStarted
    const second = requireAuth()

    // requireAuth is an async wrapper, so the outer promises differ; the
    // invariant is that both ride one /api/auth/anonymous handshake.
    expect(fetchMock).toHaveBeenCalledOnce()

    releaseResponse?.()
    await expect(Promise.all([first, second])).resolves.toEqual([true, true])
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  // REQ-SFA-003: anonymous provisioning is not account creation and must
  // never emit the signup funnel event.
  it('requests an anonymous token with the persisted device id, without tracking signup', async () => {
    const deviceId = getUserId()
    const fetchMock = mockFetchOnce(200, {
      token: makeToken(3600),
      userId: deviceId,
      isNew: true,
      user: { id: deviceId, authProvider: 'anonymous' },
    })

    const ok = await requireAuth()
    expect(ok).toBe(true)
    expect(getAuthToken()).not.toBeNull()
    expect(trackEventMock).not.toHaveBeenCalled()

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe('http://api.test/api/auth/anonymous')
    // The deviceId is published on the leaderboard, so it is not the
    // credential any more — the secret beside it is, and it must actually be
    // sent or every anonymous singer is locked out of their own history.
    expect(JSON.parse(init.body as string)).toEqual({
      deviceId,
      deviceSecret: expect.stringMatching(/^[A-Za-z0-9_-]{22,128}$/),
    })
  })

  it('skips the network when a valid token exists', async () => {
    setAuthToken(makeToken(3600))
    const fetchMock = mockFetchOnce(200, {})
    expect(await requireAuth()).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns false instead of throwing on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await requireAuth()).toBe(false)
    warnSpy.mockRestore()
  })

  it('stops retrying anonymous auth after a 403 (upgraded account)', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const fetchMock = mockFetchOnce(403, { error: 'Account requires login' })
    expect(await requireAuth()).toBe(false)
    expect(fetchMock).toHaveBeenCalledOnce()

    // The 403 is remembered — no further network attempts
    expect(await requireAuth()).toBe(false)
    expect(fetchMock).toHaveBeenCalledOnce()
    infoSpy.mockRestore()
  })

  it('resumes after an explicit login clears the signed-out state', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    mockFetchOnce(403, { error: 'Account requires login' })
    await requireAuth()

    mockFetchOnce(200, {
      token: makeToken(3600, 'password'),
      userId: 'u',
      isNew: false,
      user: { authProvider: 'password' },
    })
    await loginWithPassword('a@b.com', 'secret123')
    expect(await requireAuth()).toBe(true)
    infoSpy.mockRestore()
  })

  it('clears a suspended password session and never falls back to anonymous', async () => {
    logout() // reset the module-level one-verification cache from earlier tests
    setAuthToken(makeToken(3600, 'password'))
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const fetchMock = mockFetchOnce(403, {
      error: 'This account is suspended.',
      code: 'account_suspended',
    })

    expect(await requireAuth()).toBe(false)
    expect(getAuthToken()).toBeNull()
    expect(await requireAuth()).toBe(false)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(showNotificationMock).toHaveBeenCalledOnce()
    expect(showNotificationMock).toHaveBeenCalledWith(
      expect.stringContaining('account is suspended'),
      'error',
      { channel: 'account-suspension', durationMs: 15000 },
    )
    infoSpy.mockRestore()
  })

  it('retains a suspended anonymous probe and recovers the same device after restore', async () => {
    logout() // reset the module-level one-verification cache from earlier tests
    const deviceId = getUserId()
    setAuthToken(makeToken(3600, 'anonymous'))
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'This account is suspended.',
            code: 'account_suspended',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      // Once restored, suspension's tokenVersion bump keeps the old bearer
      // revoked. That 401 is the signal to mint a fresh token for this device.
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: makeToken(3600, 'anonymous'),
            userId: deviceId,
            isNew: false,
            user: { id: deviceId, authProvider: 'anonymous' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    expect(await requireAuth()).toBe(false)
    expect(getAuthToken()).not.toBeNull()

    expect(await requireAuth()).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/auth/me')
    expect(fetchMock.mock.calls[1][0]).toBe('http://api.test/api/auth/me')
    expect(fetchMock.mock.calls[2][0]).toBe(
      'http://api.test/api/auth/anonymous',
    )
    const init = fetchMock.mock.calls[2][1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({
      deviceId,
      deviceSecret: expect.stringMatching(/^[A-Za-z0-9_-]{22,128}$/),
    })
    infoSpy.mockRestore()
  })

  it('does not turn a suspended anonymous device without a token into a new identity', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const fetchMock = mockFetchOnce(403, {
      error: 'This account is suspended.',
      code: 'account_suspended',
    })

    expect(await requireAuth()).toBe(false)
    expect(getAuthToken()).toBeNull()
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(showNotificationMock).not.toHaveBeenCalled()
    expect(infoSpy).toHaveBeenCalledWith(
      '[auth] suspended account cannot sync personal data',
    )
    infoSpy.mockRestore()
  })
})

describe('suspension response recognition', () => {
  it('ignores non-403, malformed, and unrelated errors', () => {
    expect(handleAuthErrorResponse(401, '{')).toBe(false)
    expect(handleAuthErrorResponse(403, '{')).toBe(false)
    expect(
      handleAuthErrorResponse(403, JSON.stringify({ code: 'other' })),
    ).toBe(false)
    expect(showNotificationMock).not.toHaveBeenCalled()
  })
})

describe('Google redirect signup tracking', () => {
  it('REQ-SFA-004 fires signup exactly once when gauth_new=1 is present', () => {
    localStorage.setItem('mp:gauthReturnHash', '#/mirror')
    history.replaceState(
      null,
      '',
      `/#gauth=${makeToken(3600, 'google')}&gauth_new=1`,
    )

    consumeGoogleRedirect()
    consumeGoogleRedirect()

    expect(trackEventMock).toHaveBeenCalledTimes(1)
    expect(trackEventMock).toHaveBeenCalledWith('signup')
    expect(window.location.hash).toBe('#/mirror')
  })

  // The signal voiceprint adoption rides on. A token cannot say whether the
  // account behind it was just created; gauth_new is the only thing that can.
  it('REQ-VPR-014 reports account creation when gauth_new=1', () => {
    localStorage.setItem('mp:gauthReturnHash', '#/mirror')
    history.replaceState(
      null,
      '',
      `/#gauth=${makeToken(3600, 'google')}&gauth_new=1`,
    )

    consumeGoogleRedirect()

    expect(takeGoogleAccountCreated()).toBe(true)
  })

  it('REQ-VPR-014 reports nothing for a returning Google user', () => {
    localStorage.setItem('mp:gauthReturnHash', '#/mirror')
    history.replaceState(null, '', `/#gauth=${makeToken(3600, 'google')}`)

    consumeGoogleRedirect()

    expect(takeGoogleAccountCreated()).toBe(false)
  })

  // One-shot, like its sibling: a second reader must not see a stale true
  // from a sign-up two navigations ago and adopt somebody else's takes.
  it('REQ-VPR-014 reports creation exactly once', () => {
    localStorage.setItem('mp:gauthReturnHash', '#/mirror')
    history.replaceState(
      null,
      '',
      `/#gauth=${makeToken(3600, 'google')}&gauth_new=1`,
    )

    consumeGoogleRedirect()

    expect(takeGoogleAccountCreated()).toBe(true)
    expect(takeGoogleAccountCreated()).toBe(false)
  })

  it('REQ-VPR-014 reports nothing when the redirect failed', () => {
    localStorage.setItem('mp:gauthReturnHash', '#/mirror')
    history.replaceState(null, '', '/#gauth_error=expired_state')

    consumeGoogleRedirect()

    expect(takeGoogleAccountCreated()).toBe(false)
  })

  // A Drive-connect pass resolves no account at all — it must never look
  // like a sign-up.
  it('REQ-VPR-014 reports nothing on a Drive-only return', () => {
    localStorage.setItem('mp:gauthReturnHash', '#/settings/sync')
    history.replaceState(null, '', '/#gdrive=1')

    consumeGoogleRedirect()

    expect(takeGoogleAccountCreated()).toBe(false)
  })

  it('shows a human suspension result without exposing the internal error code', () => {
    localStorage.setItem('mp:gauthReturnHash', '#/mirror')
    history.replaceState(null, '', '/#gauth_error=account_suspended')

    consumeGoogleRedirect()

    expect(takeGoogleRedirectResult()).toEqual({
      ok: false,
      error: expect.stringContaining('account is suspended'),
    })
    expect(showNotificationMock).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('#/mirror')
  })

  it('reads an expired sign-in link as a sentence, not a code', () => {
    // Leave the consent screen open past the state's ten-minute life and
    // the worker sends you home with this code. It used to be a raw JSON
    // page on the API origin; now it has to arrive as something a singer
    // can act on (owner report, 2026-08-17).
    localStorage.setItem('mp:gauthReturnHash', '#/mirror')
    history.replaceState(null, '', '/#gauth_error=expired_state')

    consumeGoogleRedirect()

    const expected = 'that sign-in link expired. Please try signing in again.'
    expect(takeGoogleRedirectResult()).toEqual({ ok: false, error: expected })
    // Reads as one sentence where App.tsx prefixes it.
    expect(`Google sign-in failed: ${expected}`).toBe(
      'Google sign-in failed: that sign-in link expired. Please try signing in again.',
    )
    expect(window.location.hash).toBe('#/mirror')
  })

  it('passes an unrecognised code through rather than swallowing it', () => {
    // An unmapped code is still worth more in a bug report than a generic
    // "something went wrong".
    localStorage.setItem('mp:gauthReturnHash', '#/mirror')
    history.replaceState(null, '', '/#gauth_error=some_new_worker_code')

    consumeGoogleRedirect()

    expect(takeGoogleRedirectResult()).toEqual({
      ok: false,
      error: 'some_new_worker_code',
    })
  })
})

// A connect-Drive pass is not a sign-in: the worker returns from it before
// resolving any account (so choosing a different Google account for your
// Drive cannot change who you are signed in as), which means it comes back
// carrying #gdrive and NO gauth token. Matching only '#gauth' therefore
// dropped every Drive return on the floor.
//
// Requirements: docs/specs/drive-connect-redirect.ears.md (REQ-DRV-*).
describe('startDriveConnect', () => {
  it('stashes the return route in localStorage before leaving the page', async () => {
    // Same context-switch hazard as sign-in: the Drive consent redirect can
    // come back into the installed app, where sessionStorage is blank.
    setAuthToken(makeToken(3600))
    window.location.hash = '#/settings/sync'
    mockFetchOnce(200, { url: 'https://accounts.google.com/drive-consent' })

    const result = await startDriveConnect()
    expect(result.ok).toBe(true)
    expect(localStorage.getItem('mp:gauthReturnHash')).toBe('#/settings/sync')
    expect(sessionStorage.getItem('mp:gauthReturnHash')).toBeNull()
    window.location.hash = ''
  })
})

describe('Drive connect redirect', () => {
  it('REQ-DRV-001/002: records a refusal reason from a #gdrive-only return', () => {
    localStorage.setItem('mp:gauthReturnHash', '#/settings/sync')
    history.replaceState(null, '', '/#gdrive_error=declined')

    consumeGoogleRedirect()

    expect(takeDriveConnectResult()).toEqual({ ok: false, error: 'declined' })
  })

  it('REQ-DRV-001/002: records success from a #gdrive-only return', () => {
    localStorage.setItem('mp:gauthReturnHash', '#/settings/sync')
    history.replaceState(null, '', '/#gdrive=1')

    consumeGoogleRedirect()

    expect(takeDriveConnectResult()).toEqual({ ok: true })
  })

  // The stash is one-shot. Left unconsumed it does not merely lose this
  // route -- it waits in storage and hijacks the NEXT unrelated
  // Google sign-in, which is the hazard startDriveConnect's late stash
  // exists to avoid.
  it('REQ-DRV-005: restores the stashed route and clears the stash', () => {
    localStorage.setItem('mp:gauthReturnHash', '#/settings/sync')
    history.replaceState(null, '', '/#gdrive=1')

    consumeGoogleRedirect()

    expect(window.location.hash).toBe('#/settings/sync')
    expect(localStorage.getItem('mp:gauthReturnHash')).toBeNull()
  })

  // A Drive return must not be mistaken for a sign-in.
  it('REQ-DRV-004: does not produce a sign-in result or touch the token', () => {
    setAuthToken(makeToken(3600, 'password'))
    const before = getAuthToken()
    history.replaceState(null, '', '/#gdrive=1')

    consumeGoogleRedirect()

    expect(takeGoogleRedirectResult()).toBeNull()
    expect(getAuthToken()).toBe(before)
    takeDriveConnectResult() // one-shot: drain it so it cannot leak forward
  })

  it('REQ-DRV-006: leaves an unrelated fragment alone', () => {
    localStorage.setItem('mp:gauthReturnHash', '#/settings/sync')
    history.replaceState(null, '', '/#/karaoke')

    consumeGoogleRedirect()

    expect(takeDriveConnectResult()).toBeNull()
    expect(window.location.hash).toBe('#/karaoke')
    expect(localStorage.getItem('mp:gauthReturnHash')).toBe('#/settings/sync')
  })

  // The restore lives in the shared tail of consumeGoogleRedirect, so a
  // refusal walks the same path as a success -- but only a test keeps it
  // there. A declined connect that skipped the restore would strand the
  // person on a URL reading #gdrive_error=declined with their route lost.
  it('REQ-DRV-005: a refusal also restores the route and clears the stash', () => {
    localStorage.setItem('mp:gauthReturnHash', '#/settings/sync')
    history.replaceState(null, '', '/#gdrive_error=declined')

    consumeGoogleRedirect()

    expect(window.location.hash).toBe('#/settings/sync')
    expect(localStorage.getItem('mp:gauthReturnHash')).toBeNull()
    takeDriveConnectResult() // drain the one-shot
  })

  // The worker never produces this shape today -- it returns from a Drive
  // pass before resolving any account -- but the reader of this code has
  // to handle it, because the fix moved the gdrive read OUT of the sign-in
  // branch precisely so both halves survive together.
  it('REQ-DRV-003: a combined pass records the sign-in AND the Drive refusal', () => {
    history.replaceState(
      null,
      '',
      `/#gauth=${makeToken(3600, 'google')}&gdrive_error=declined`,
    )

    consumeGoogleRedirect()

    expect(takeGoogleRedirectResult()).toEqual({ ok: true })
    expect(takeDriveConnectResult()).toEqual({ ok: false, error: 'declined' })
    expect(hasValidToken()).toBe(true)
  })

  it('REQ-DRV-007: the Drive outcome is one-shot', () => {
    history.replaceState(null, '', '/#gdrive=1')

    consumeGoogleRedirect()

    expect(takeDriveConnectResult()).toEqual({ ok: true })
    expect(takeDriveConnectResult()).toBeNull()
  })
})

describe('logout', () => {
  it('remembers that an upgraded account needs a real login', async () => {
    setAuthToken(makeToken(3600, 'password'))
    logout()
    expect(getAuthToken()).toBeNull()

    // requireAuth must not attempt (and fail) an anonymous handshake
    const fetchMock = mockFetchOnce(200, {})
    expect(await requireAuth()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps anonymous re-auth available after an anonymous logout', async () => {
    setAuthToken(makeToken(3600, 'anonymous'))
    logout()

    const fetchMock = mockFetchOnce(200, {
      token: makeToken(3600),
      userId: 'u',
      isNew: false,
      user: { authProvider: 'anonymous' },
    })
    expect(await requireAuth()).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})

describe('login and register', () => {
  it('stores the token on successful login', async () => {
    mockFetchOnce(200, {
      token: makeToken(3600),
      userId: 'u',
      isNew: false,
      user: { authProvider: 'password' },
    })
    const res = await loginWithPassword('a@b.com', 'secret123')
    expect(isTwofaChallenge(res)).toBe(false)
    expect((res as AuthResponse).user.authProvider).toBe('password')
    expect(getAuthToken()).not.toBeNull()
  })

  it('stores nothing when the account owes a second factor', async () => {
    // The password was right, and that alone must buy nothing: no token
    // stored, and a ceremony handed back for the code pane to spend.
    mockFetchOnce(200, { twofaRequired: true, ceremony: 'ceremony-token' })
    const res = await loginWithPassword('a@b.com', 'secret123')
    expect(isTwofaChallenge(res)).toBe(true)
    expect(getAuthToken()).toBeNull()
  })

  it('throws the human-readable server message on bad credentials', async () => {
    mockFetchOnce(401, { error: 'Invalid email or password' })
    await expect(loginWithPassword('a@b.com', 'wrong')).rejects.toThrow(
      'Invalid email or password',
    )
    expect(getAuthToken()).toBeNull()
  })

  it('reports a suspended login once through the form error path', async () => {
    mockFetchOnce(403, {
      error: 'This account is suspended.',
      code: 'account_suspended',
    })

    await expect(
      loginWithPassword('suspended@example.com', 'secret123'),
    ).rejects.toThrow('This account is suspended.')
    expect(getAuthToken()).toBeNull()
    expect(showNotificationMock).not.toHaveBeenCalled()
  })

  it('passes the device id along on register (account upgrade)', async () => {
    const deviceId = getUserId()
    const fetchMock = mockFetchOnce(200, {
      token: makeToken(3600),
      userId: deviceId,
      isNew: false,
      user: { authProvider: 'password' },
    })
    await registerWithPassword('a@b.com', 'secret123', 'Maff')
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toMatchObject({
      email: 'a@b.com',
      displayName: 'Maff',
      deviceId,
    })
  })

  it('passes the device id along on Google login', async () => {
    const deviceId = getUserId()
    const fetchMock = mockFetchOnce(200, {
      token: makeToken(3600),
      userId: deviceId,
      isNew: false,
      user: { authProvider: 'google' },
    })
    await loginWithGoogle('google-id-token')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe('http://api.test/api/auth/google')
    expect(JSON.parse(init.body as string)).toEqual({
      idToken: 'google-id-token',
      deviceId,
      // Signing in with a deviceId absorbs that anonymous account for good.
      deviceSecret: expect.stringMatching(/^[A-Za-z0-9_-]{22,128}$/),
    })
  })
})

describe('authenticated account endpoints', () => {
  it.each([
    ['profile', () => fetchMe()],
    ['resend verification', () => resendVerificationEmail()],
    ['account deletion', () => deleteAccount()],
  ])('handles a suspended response from %s', async (_label, request) => {
    setAuthToken(makeToken(3600, 'password'))
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    mockFetchOnce(403, {
      error: 'This account is suspended.',
      code: 'account_suspended',
    })

    await request().catch(() => undefined)

    expect(getAuthToken()).toBeNull()
    expect(showNotificationMock).toHaveBeenCalledOnce()
    expect(showNotificationMock).toHaveBeenCalledWith(
      expect.stringContaining('account is suspended'),
      'error',
      { channel: 'account-suspension', durationMs: 15000 },
    )
    infoSpy.mockRestore()
  })
})

describe('persistent identity', () => {
  it('generates the user id once and persists it', () => {
    const first = getUserId()
    expect(getUserId()).toBe(first)
    expect(localStorage.getItem('mp:userId')).toBe(first)
  })

  it('uses the JWT identity while authenticated', () => {
    const deviceId = getUserId()
    // makeToken() encodes sub: 'user-1' — an account created on
    // another device, so it differs from the local device id
    setAuthToken(makeToken(3600))
    expect(getUserId()).toBe('user-1')

    logout()
    expect(getUserId()).toBe(deviceId)
  })
})
