// ============================================================
// Auth Service Tests — anonymous bootstrap, login, register
// ============================================================

import { createEffect, createRoot } from 'solid-js'
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

import { accountKnownHere } from '@/db/services/account-known'
import type { AuthResponse } from '@/db/services/auth-service'
import { consumeGoogleRedirect, deleteAccount, fetchMe, googleSignInUrl, googleTwofaPending, handleAuthErrorResponse, handleCloudSessionRejected, hasUpgradedAccount, hasValidToken, isRegisteredProvider, isTwofaChallenge, loginWithApple, loginWithGoogle, loginWithPassword, logout, needsSignIn, refreshSession, registerWithPassword, requireAuth, resendVerificationEmail, restoreAuth, takeDriveConnectResult, takeGoogleAccountCreated, takeGoogleRedirectResult, takeGoogleTwofaChallenge, } from '@/db/services/auth-service'
import { finishDriveConnect, startDriveConnect, } from '@/db/services/drive-connect-service'
import { getAuthHeaders, getAuthToken, getUserId, setAuthToken, } from '@/db/services/user-service'
import { trackEvent } from '@/lib/analytics'
import { beginGoogleReturn } from '@/lib/google-return-nonce'
import { forgetSignInMethod, lastSignInMethod, rememberSignInMethod, } from '@/lib/last-sign-in'
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

describe('which providers are an account', () => {
  it('counts every provider but the device identity', () => {
    // Phrased as "not anonymous", the way the worker's own gates ask, so a
    // provider added later is an account without anybody listing it here.
    for (const provider of ['password', 'google', 'apple', 'a-future-one']) {
      expect(isRegisteredProvider(provider)).toBe(true)
    }
    for (const provider of ['anonymous', null, undefined]) {
      expect(isRegisteredProvider(provider)).toBe(false)
    }
  })

  it('reads a held Sign in with Apple session as a real account', () => {
    setAuthToken(makeToken(3600, 'apple'))
    expect(hasUpgradedAccount()).toBe(true)
    setAuthToken(makeToken(3600, 'anonymous'))
    expect(hasUpgradedAccount()).toBe(false)
  })
})

// The Voice Mirror offers an account only to a browser that has never met
// one (owner, 2026-10-11): signed in, or signed out of an account this browser
// knows, there is no offer. Each note that survives a sign-out is enough.
describe('a real account this browser has met', () => {
  beforeEach(() => {
    // The sign-in note is a module signal: clearing storage leaves it set.
    forgetSignInMethod()
  })

  it('is false for a browser that has never met an account', () => {
    expect(accountKnownHere()).toBe(false)
  })

  it('is false for the lazily made anonymous identity', () => {
    setAuthToken(makeToken(3600, 'anonymous'))
    expect(accountKnownHere()).toBe(false)
  })

  it('is true while a real account is signed in', () => {
    setAuthToken(makeToken(3600, 'google'))
    expect(accountKnownHere()).toBe(true)
  })

  it('stays true after that account signs out here', () => {
    setAuthToken(makeToken(3600, 'password'))
    logout()

    expect(hasUpgradedAccount()).toBe(false)
    expect(accountKnownHere()).toBe(true)
  })

  it("is true from the last sign-in's note alone", () => {
    rememberSignInMethod('passkey')
    expect(getAuthToken()).toBeNull()
    expect(needsSignIn()).toBe(false)

    expect(accountKnownHere()).toBe(true)
  })

  it("is true for a real account's session that ran out", () => {
    setAuthToken(makeToken(-100, 'google'))

    expect(hasUpgradedAccount()).toBe(false)
    expect(accountKnownHere()).toBe(true)
  })

  it('answers false rather than throwing when storage refuses reads', () => {
    const blocked = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked')
      })
    try {
      expect(accountKnownHere()).toBe(false)
    } finally {
      blocked.mockRestore()
    }
  })

  it('follows a sign-in without a reload', () => {
    const seen: boolean[] = []
    const dispose = createRoot((done) => {
      createEffect(() => seen.push(accountKnownHere()))
      return done
    })

    setAuthToken(makeToken(3600, 'google'))
    dispose()

    expect(seen).toEqual([false, true])
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

// The server can end a session while this device still holds its token: the
// expiry sweep, "sign out everywhere", a password reset on another device.
// The token has to go. Dropping it QUIETLY let getUserId() fall back to the
// device id, and the next write minted a brand-new anonymous identity for it:
// a signed-in singer's practice was saved to a throwaway account with nothing
// on screen to say so. An account's refused token asks for a sign-in instead.
describe('a session the server refused', () => {
  beforeEach(() => {
    // Forget any session an earlier test verified, so /me is really asked.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}')),
    )
    logout()
    localStorage.clear()
    showNotificationMock.mockClear()
  })

  it('asks an account to sign in rather than minting a new identity', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    setAuthToken(makeToken(3600, 'password'))
    const fetchMock = mockFetchOnce(401, { error: 'Unauthorized' })

    expect(await requireAuth()).toBe(false)
    expect(getAuthToken()).toBeNull()
    expect(needsSignIn()).toBe(true)
    expect(showNotificationMock).toHaveBeenCalledWith(
      expect.stringContaining('session has expired'),
      'warning',
      expect.anything(),
    )
    // One /me, and never an /anonymous handshake for the device.
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).not.toHaveBeenCalledWith(
      'http://api.test/api/auth/anonymous',
      expect.anything(),
    )
    infoSpy.mockRestore()
  })

  it('re-provisions the same device when an anonymous token is refused', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    setAuthToken(makeToken(3600, 'anonymous'))
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: makeToken(3600),
            userId: 'device',
            isNew: false,
            user: { authProvider: 'anonymous' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    expect(await requireAuth()).toBe(true)
    expect(needsSignIn()).toBe(false)
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'http://api.test/api/auth/anonymous',
    )
    expect(showNotificationMock).not.toHaveBeenCalled()
    infoSpy.mockRestore()
  })

  it('asks an account to sign in when its refresh is refused, expired or not', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    // A refresh is attempted exactly when the token is old.
    setAuthToken(makeToken(-100, 'password'))
    mockFetchOnce(401, { error: 'Unauthorized' })

    expect(await refreshSession()).toBeNull()
    expect(getAuthToken()).toBeNull()
    expect(needsSignIn()).toBe(true)
    infoSpy.mockRestore()
  })

  it('ignores a refusal for a token a sign-in replaced while it was out', async () => {
    setAuthToken(makeToken(3600, 'password'))
    const fresh = makeToken(7200, 'password')
    let answerMe: ((response: Response) => void) | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.endsWith('/api/auth/me')
          ? new Promise<Response>((resolve) => {
              answerMe = resolve
            })
          : Promise.resolve(
              new Response(
                JSON.stringify({
                  token: fresh,
                  userId: 'user-1',
                  isNew: false,
                  user: { authProvider: 'password' },
                }),
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            ),
      ),
    )

    const restoring = restoreAuth()
    await loginWithPassword('a@b.com', 'secret123')
    answerMe?.(new Response('{}', { status: 401 }))

    expect(await restoring).toBe(true)
    expect(getAuthToken()).toBe(fresh)
    expect(needsSignIn()).toBe(false)
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

/**
 * Land on `/` the way the worker answers a sign-in THIS browser started: the
 * nonce googleSignInUrl() keeps, echoed back as `gauth_nonce`.
 */
function returnFromStartedSignIn(fragment: string): void {
  const nonce = beginGoogleReturn()
  history.replaceState(null, '', `/#${fragment}&gauth_nonce=${nonce}`)
}

describe('Google redirect signup tracking', () => {
  it('REQ-SFA-004 fires signup exactly once when gauth_new=1 is present', () => {
    localStorage.setItem('mp:gauthReturnHash', '#/mirror')
    returnFromStartedSignIn(`gauth=${makeToken(3600, 'google')}&gauth_new=1`)

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
    returnFromStartedSignIn(`gauth=${makeToken(3600, 'google')}&gauth_new=1`)

    consumeGoogleRedirect()

    expect(takeGoogleAccountCreated()).toBe(true)
  })

  it('REQ-VPR-014 reports nothing for a returning Google user', () => {
    localStorage.setItem('mp:gauthReturnHash', '#/mirror')
    returnFromStartedSignIn(`gauth=${makeToken(3600, 'google')}`)

    consumeGoogleRedirect()

    expect(takeGoogleAccountCreated()).toBe(false)
  })

  // One-shot, like its sibling: a second reader must not see a stale true
  // from a sign-up two navigations ago and adopt somebody else's takes.
  it('REQ-VPR-014 reports creation exactly once', () => {
    localStorage.setItem('mp:gauthReturnHash', '#/mirror')
    returnFromStartedSignIn(`gauth=${makeToken(3600, 'google')}&gauth_new=1`)

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
    returnFromStartedSignIn('gauth_error=account_suspended')

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
    // can act on (owner report, 2026-08-17). The worker could not read the
    // state, so there is no nonce to echo: this is the one error honoured
    // without one.
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
    returnFromStartedSignIn('gauth_error=some_new_worker_code')

    consumeGoogleRedirect()

    expect(takeGoogleRedirectResult()).toEqual({
      ok: false,
      error: 'some_new_worker_code',
    })
  })
})

// Login CSRF. A fragment is text in a link, so anyone holding a session token
// for their own account can write `/#gauth=<it>&gauth_new=1` and send it. A
// browser that never started that sign-in must not store the session, must
// not count a sign-up, and must not mark anything for adoption.
describe('a Google return this browser never started', () => {
  afterEach(() => {
    // The outcomes are one-shot module state; drain them so a case that
    // leaves one behind cannot answer for the next.
    takeGoogleRedirectResult()
    takeGoogleAccountCreated()
  })

  it('stores no session from a planted fragment, and says why', () => {
    rememberSignInMethod('password')
    history.replaceState(
      null,
      '',
      `/#gauth=${makeToken(3600, 'google')}&gauth_new=1`,
    )

    consumeGoogleRedirect()

    expect(getAuthToken()).toBeNull()
    expect(takeGoogleAccountCreated()).toBe(false)
    expect(trackEventMock).not.toHaveBeenCalled()
    expect(lastSignInMethod()).toBe('password')
    expect(window.location.hash).toBe('')
    expect(takeGoogleRedirectResult()).toEqual({
      ok: false,
      error:
        "that sign-in didn't start in this browser, so it wasn't used. Sign in again from here.",
    })
  })

  it('keeps the account a singer is already signed in to', () => {
    const own = makeToken(3600, 'password')
    setAuthToken(own)
    history.replaceState(null, '', `/#gauth=${makeToken(3600, 'google')}`)

    consumeGoogleRedirect()

    expect(getAuthToken()).toBe(own)
  })

  it('refuses a nonce that is not the one this browser kept', () => {
    beginGoogleReturn()
    history.replaceState(
      null,
      '',
      `/#gauth=${makeToken(3600, 'google')}&gauth_nonce=guessed-nonce-guessed-nonce`,
    )

    consumeGoogleRedirect()

    expect(getAuthToken()).toBeNull()
  })

  it('opens no second-factor pane for a planted ceremony', () => {
    history.replaceState(null, '', '/#gauth_2fa=planted-ceremony')

    consumeGoogleRedirect()

    expect(takeGoogleTwofaChallenge()).toBeNull()
  })

  it('signs nobody out on a planted suspension code', () => {
    const own = makeToken(3600, 'password')
    setAuthToken(own)
    history.replaceState(null, '', '/#gauth_error=account_suspended')

    consumeGoogleRedirect()

    expect(getAuthToken()).toBe(own)
    expect(needsSignIn()).toBe(false)
    expect(takeGoogleRedirectResult()).toBeNull()
  })

  it('puts no words of the link into the app', () => {
    history.replaceState(
      null,
      '',
      `/#gauth_error=${encodeURIComponent('Your account is locked. Call 555-0100.')}`,
    )

    consumeGoogleRedirect()

    expect(takeGoogleRedirectResult()).toBeNull()
    expect(window.location.hash).toBe('')
  })
})

describe('a Google return this browser did start', () => {
  afterEach(() => {
    // One-shot module state, drained so a case that fails part-way cannot
    // leave an outcome behind for the next.
    takeGoogleRedirectResult()
    takeGoogleAccountCreated()
    takeGoogleTwofaChallenge()
  })

  // The whole client half: googleSignInUrl() keeps a nonce and posts it, the
  // worker echoes it, and the return carrying it is the one that counts.
  async function startSignIn(): Promise<string> {
    const fetchMock = mockFetchOnce(200, {
      url: 'https://accounts.google.com/o/oauth2/v2/auth?state=signed',
    })
    await googleSignInUrl()
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    return (JSON.parse(init.body as string) as { nonce: string }).nonce
  }

  it('signs in with the session that comes back with its own nonce', async () => {
    const nonce = await startSignIn()
    const token = makeToken(3600, 'google')
    history.replaceState(
      null,
      '',
      `/#gauth=${token}&gauth_new=1&gauth_nonce=${nonce}`,
    )

    consumeGoogleRedirect()

    expect(getAuthToken()).toBe(token)
    expect(takeGoogleAccountCreated()).toBe(true)
    expect(takeGoogleRedirectResult()).toEqual({ ok: true })
  })

  it('honours that return once, so a replayed link signs nobody in', async () => {
    const nonce = await startSignIn()
    const fragment = `/#gauth=${makeToken(3600, 'google')}&gauth_nonce=${nonce}`
    history.replaceState(null, '', fragment)
    consumeGoogleRedirect()
    takeGoogleRedirectResult()
    setAuthToken(null)
    history.replaceState(null, '', fragment)

    consumeGoogleRedirect()

    expect(getAuthToken()).toBeNull()
  })

  it('opens the second-factor pane for its own ceremony', async () => {
    const nonce = await startSignIn()
    history.replaceState(
      null,
      '',
      `/#gauth_2fa=own-ceremony&gauth_nonce=${nonce}`,
    )

    consumeGoogleRedirect()

    expect(takeGoogleTwofaChallenge()).toBe('own-ceremony')
    expect(getAuthToken()).toBeNull()
  })

  it('says a second factor is owed without taking the ceremony', async () => {
    const nonce = await startSignIn()
    history.replaceState(
      null,
      '',
      `/#gauth_2fa=own-ceremony&gauth_nonce=${nonce}`,
    )
    expect(googleTwofaPending()).toBe(false)

    consumeGoogleRedirect()

    expect(googleTwofaPending()).toBe(true)
    // Asking did not take it: the dialog still opens on it.
    expect(takeGoogleTwofaChallenge()).toBe('own-ceremony')
    expect(googleTwofaPending()).toBe(false)
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
    returnFromStartedSignIn(
      `gauth=${makeToken(3600, 'google')}&gdrive_error=declined`,
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

  // The live path: the worker no longer stores the grant in the callback,
  // so what comes back is a sealed grant for finishDriveConnect to commit.
  // It takes the same tail as a success -- route restored, stash spent --
  // and is no more a sign-in than a success is.
  it('records a pending grant from a #gdrive_pending return, one-shot', () => {
    localStorage.setItem('mp:gauthReturnHash', '#/settings/sync')
    history.replaceState(null, '', '/#gdrive_pending=SEALED.blob')

    consumeGoogleRedirect()

    expect(takeDriveConnectResult()).toEqual({ pending: 'SEALED.blob' })
    expect(takeDriveConnectResult()).toBeNull()
    expect(takeGoogleRedirectResult()).toBeNull()
    expect(window.location.hash).toBe('#/settings/sync')
    expect(localStorage.getItem('mp:gauthReturnHash')).toBeNull()
  })
})

// Committing the sealed grant. The worker binds it to the account whose
// bearer token makes this call, so the request has to carry the session and
// the grant -- and every way the commit can fail comes back as a reason the
// settings page can show, never as a thrown error.
describe('finishDriveConnect', () => {
  it('does not call the worker while signed out', async () => {
    setAuthToken(null)
    const fetchMock = mockFetchOnce(200, { ok: true })

    expect(await finishDriveConnect('SEALED')).toEqual({
      ok: false,
      error: 'signed_out',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('commits the grant with an authenticated POST to /drive/finish', async () => {
    setAuthToken(makeToken(3600, 'password'))
    const token = getAuthToken()
    const fetchMock = mockFetchOnce(200, { ok: true })

    expect(await finishDriveConnect('SEALED')).toEqual({ ok: true })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe('http://api.test/api/auth/drive/finish')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${token}`,
    )
    expect(JSON.parse(init.body as string)).toEqual({ pending: 'SEALED' })
  })

  it('reports a grant the worker refuses as finish_failed', async () => {
    setAuthToken(makeToken(3600, 'password'))
    mockFetchOnce(403, {
      error: 'This Drive grant was started by a different account',
    })

    expect(await finishDriveConnect('SEALED')).toEqual({
      ok: false,
      error: 'finish_failed',
    })
  })

  it('reports a network failure as offline', async () => {
    setAuthToken(makeToken(3600, 'password'))
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    )

    expect(await finishDriveConnect('SEALED')).toEqual({
      ok: false,
      error: 'offline',
    })
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

  it("carries a sign-up's hint for the first mail, and nothing when there is none", async () => {
    const hint = {
      twin: 'David Bowie',
      lowMidi: 48,
      highMidi: 72,
      accuracy: 80,
    }
    const fetchMock = mockFetchOnce(200, {
      token: makeToken(3600),
      userId: 'new-account',
      isNew: true,
      user: { authProvider: 'password' },
    })
    await registerWithPassword('a@b.com', 'secret123', 'Maff', undefined, {
      newsletterOptIn: true,
      voiceprintHint: hint,
      signupSource: 'karaoke',
    })
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toMatchObject({
      newsletterOptIn: true,
      voiceprintHint: hint,
      signupSource: 'karaoke',
    })

    const plain = mockFetchOnce(200, {
      token: makeToken(3600),
      userId: 'other-account',
      isNew: true,
      user: { authProvider: 'password' },
    })
    await registerWithPassword('c@d.com', 'secret123')
    const [, plainInit] = plain.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    const body = JSON.parse(plainInit.body as string) as Record<string, unknown>
    expect('voiceprintHint' in body).toBe(false)
    expect('signupSource' in body).toBe(false)
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

  it("carries a native sign-up's hint for the first mail, and nothing when there is none", async () => {
    // One sheet both registers and signs in, so the hint goes up every time
    // and the worker reads it only when the account is created.
    const hint = { twin: 'David Bowie', lowMidi: 48, highMidi: 72 }
    const session = {
      token: makeToken(3600),
      userId: 'new-account',
      isNew: true,
      user: { authProvider: 'apple' },
    }
    const bodyOf = (fetchMock: ReturnType<typeof vi.fn>) => {
      const [, init] = fetchMock.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ]
      return JSON.parse(init.body as string) as Record<string, unknown>
    }

    const google = mockFetchOnce(200, session)
    await loginWithGoogle('google-id-token', { voiceprintHint: hint })
    expect(bodyOf(google)).toMatchObject({
      idToken: 'google-id-token',
      voiceprintHint: hint,
    })

    const apple = mockFetchOnce(200, session)
    await loginWithApple(
      { identityToken: 'apple-jwt', nonce: 'n-1' },
      { voiceprintHint: hint },
    )
    expect(bodyOf(apple)).toMatchObject({
      identityToken: 'apple-jwt',
      voiceprintHint: hint,
    })

    const plain = mockFetchOnce(200, session)
    await loginWithApple({ identityToken: 'apple-jwt', nonce: 'n-1' })
    expect('voiceprintHint' in bodyOf(plain)).toBe(false)
  })

  it('hands a Google second factor back as a challenge, not as an error', async () => {
    // This route CAN be challenged, so it must not go through `postAuth`,
    // which turns a challenge into a synthetic 409. Native Google sign-in is
    // the only caller, and it maps an unrecognised numeric status to
    // `network` — so the singer with 2FA on was told their phone was
    // offline, on every attempt, with no code pane to finish in.
    mockFetchOnce(200, { twofaRequired: true, ceremony: 'ceremony-token' })

    const res = await loginWithGoogle('google-id-token')

    expect(isTwofaChallenge(res)).toBe(true)
    // The token was right and that alone buys nothing, same as password.
    expect(getAuthToken()).toBeNull()
  })
})

// The note the Home strip reads to offer the same way back in. The web Google
// redirect writes it in `consumeGoogleRedirect`; a native sign-in has no
// redirect, so the route writes it. Without it an iPhone that signed in with
// Apple is never offered the Apple sheet again.
describe('the way a native sign-in is remembered', () => {
  const session = (authProvider: string) => ({
    token: makeToken(3600, authProvider),
    userId: 'u',
    isNew: false,
    user: { authProvider },
  })

  beforeEach(() => {
    // A different method first, so each test proves the route wrote its own.
    rememberSignInMethod('passkey')
  })

  it('remembers an Apple sign-in', async () => {
    mockFetchOnce(200, session('apple'))

    await loginWithApple({ identityToken: 'apple-jwt', nonce: 'n-1' })

    expect(lastSignInMethod()).toBe('apple')
  })

  it('remembers a native Google sign-in', async () => {
    mockFetchOnce(200, session('google'))

    await loginWithGoogle('google-id-token')

    expect(lastSignInMethod()).toBe('google')
  })

  it('remembers it when the account then owes a second factor', async () => {
    // On the first factor, as the password route does: the account still
    // gets in this way next time.
    mockFetchOnce(200, { twofaRequired: true, ceremony: 'ceremony-token' })

    await loginWithApple({ identityToken: 'apple-jwt', nonce: 'n-1' })

    expect(lastSignInMethod()).toBe('apple')
  })

  it('remembers nothing from a refused sign-in', async () => {
    mockFetchOnce(401, { error: 'invalid_token' })

    await expect(
      loginWithApple({ identityToken: 'apple-jwt', nonce: 'n-1' }),
    ).rejects.toThrow()

    expect(lastSignInMethod()).toBe('passkey')
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

// ── A refused cloud session ─────────────────────────────────────
//
// Reads degrade to empty and a 401 is routine (identities mint on the first
// write), so before this an expired session and a brand-new visitor were
// indistinguishable: the library was simply empty. Only an upgraded account
// has a session to lose, which is the discriminator these pin down.

describe('handleCloudSessionRejected', () => {
  it('signs an upgraded account out and asks it to sign in again', () => {
    setAuthToken(makeToken(3600, 'password'))

    expect(handleCloudSessionRejected()).toBe(true)
    expect(getAuthToken()).toBeNull()
    expect(needsSignIn()).toBe(true)
    expect(showNotificationMock).toHaveBeenCalledTimes(1)
    expect(String(showNotificationMock.mock.calls[0][0])).toContain('expired')
  })

  it('stays silent for a lazily provisioned anonymous identity', () => {
    setAuthToken(makeToken(3600, 'anonymous'))

    // Routine, not a failure: this visitor has written nothing yet. Signing
    // them "out" would mean re-provisioning on the next write for no reason,
    // and telling them their session expired would be a lie.
    expect(handleCloudSessionRejected()).toBe(false)
    expect(getAuthToken()).not.toBeNull()
    expect(needsSignIn()).toBe(false)
    expect(showNotificationMock).not.toHaveBeenCalled()
  })

  it('stays silent when there is no token at all', () => {
    expect(handleCloudSessionRejected()).toBe(false)
    expect(needsSignIn()).toBe(false)
    expect(showNotificationMock).not.toHaveBeenCalled()
  })

  it('acts once, however many reads are refused at the same time', () => {
    setAuthToken(makeToken(3600, 'google'))

    // A page load fires a dozen reads; they all come back 401 together.
    const outcomes = [
      handleCloudSessionRejected(),
      handleCloudSessionRejected(),
      handleCloudSessionRejected(),
    ]

    expect(outcomes).toEqual([true, false, false])
    expect(showNotificationMock).toHaveBeenCalledTimes(1)
  })

  it('can act without notifying, for callers that show their own message', () => {
    setAuthToken(makeToken(3600, 'password'))

    expect(handleCloudSessionRejected(false)).toBe(true)
    expect(needsSignIn()).toBe(true)
    expect(showNotificationMock).not.toHaveBeenCalled()
  })

  it('signs out an account whose token already ran out', () => {
    // The commonest lost session of all. Treated as nobody's, it left the
    // library empty with no word about signing in.
    setAuthToken(makeToken(-100, 'password'))

    expect(handleCloudSessionRejected()).toBe(true)
    expect(getAuthToken()).toBeNull()
    expect(needsSignIn()).toBe(true)
  })
})
