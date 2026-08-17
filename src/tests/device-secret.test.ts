// ============================================================
// The device secret — this browser's anonymous credential
// ============================================================
//
// The user id is published: it is `userProfiles.id`, it is in every
// leaderboard row, and for an anonymous singer it used to be the entire
// credential — so the public board was a list of working logins. The id stays
// public and this secret takes over the credential job.
//
// What matters here is the part the worker cannot check for us: that the
// secret is stable across calls (or the account is unreachable next launch),
// that it is not derived from the id (or publishing the id publishes it), and
// that erasing the account forgets it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  API_BASE_URL: 'http://api.test',
}))

import { googleSignInUrl } from '@/db/services/auth-service'
import { getDeviceId, getDeviceSecret, getUserId, resetUserId, } from '@/db/services/user-service'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('getDeviceSecret', () => {
  it('answers the same value every time, and persists it', () => {
    const first = getDeviceSecret()

    expect(first).not.toBe('')
    expect(getDeviceSecret()).toBe(first)
    // Persisted, not merely memoised: the next launch is a fresh module and
    // a different value there would lock the singer out of their own account.
    expect(localStorage.getItem('mp:deviceSecret')).toBe(first)
  })

  it('is url-safe base64 of 256 bits', () => {
    const secret = getDeviceSecret()

    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/)
    // No padding and no + or /: it travels in a JSON body today, and the
    // shape should not be the thing that breaks if it ever travels elsewhere.
    expect(secret).not.toContain('=')
  })

  it('is unrelated to the published id', () => {
    const id = getUserId() // mints and persists one
    const secret = getDeviceSecret()

    expect(id).not.toBe('')
    expect(secret).not.toBe(id)
    // Not derived from it either — the id is printed on the leaderboard, so
    // anything recoverable from it is public by construction.
    expect(secret).not.toContain(id)
    expect(secret).not.toContain(id.slice(0, 8))
    expect(secret).not.toContain(id.replace(/-/g, ''))
  })

  it('differs between browsers', () => {
    const mine = getDeviceSecret()
    localStorage.clear()

    expect(getDeviceSecret()).not.toBe(mine)
  })

  it('mints a new one rather than throwing when storage is unavailable', () => {
    // Private mode with storage blocked. The worker still admits an account
    // that has never bound a secret, so this degrades to the old behaviour
    // instead of making the app unusable.
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })

    expect(getDeviceSecret()).toBe('')
  })

  it('returns empty rather than throwing when the write fails', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    expect(getDeviceSecret()).toBe('')
  })
})

describe('resetUserId', () => {
  it('forgets the secret along with the id', () => {
    const oldId = getDeviceId()
    const oldSecret = getDeviceSecret()

    const newId = resetUserId()

    expect(newId).not.toBe(oldId)
    // Carrying the old secret over would leave the new identity holding a
    // credential the deleted account had already bound — the worker would
    // rightly refuse to bind it to anything else.
    expect(localStorage.getItem('mp:deviceSecret')).toBeNull()
    expect(getDeviceSecret()).not.toBe(oldSecret)
  })

  it('still resets the id when the secret cannot be removed', () => {
    getDeviceSecret()
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })

    expect(() => resetUserId()).not.toThrow()
    expect(getDeviceId()).not.toBe('')
  })
})

describe('googleSignInUrl', () => {
  // Signing in with Google absorbs this browser's anonymous progress into the
  // Google account, permanently. So the worker needs the secret — and the
  // consent URL is therefore fetched with a POST rather than assembled from a
  // query string, because a secret in a URL lands in browser history, server
  // logs and Referer headers.

  function stubStart(
    status: number,
    payload: unknown,
  ): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: async () => payload,
      } as Response),
    )
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stashes the return route where a fresh context can read it', async () => {
    // On Android the redirect can land in the installed PWA — a different
    // browsing context whose sessionStorage starts empty. Only localStorage
    // crosses that boundary, so the route stash must live there.
    window.location.hash = '#/settings/sync'
    stubStart(200, { url: 'https://accounts.google.com/o/oauth2/v2/auth' })
    await googleSignInUrl()
    expect(localStorage.getItem('mp:gauthReturnHash')).toBe('#/settings/sync')
    expect(sessionStorage.getItem('mp:gauthReturnHash')).toBeNull()
    window.location.hash = ''
  })

  it('posts the secret in a body and returns the worker’s url', async () => {
    const fetchMock = stubStart(200, {
      url: 'https://accounts.google.com/o/oauth2/v2/auth?state=signed',
    })

    await expect(googleSignInUrl()).resolves.toBe(
      'https://accounts.google.com/o/oauth2/v2/auth?state=signed',
    )

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe('http://api.test/api/auth/google/start')
    expect(init.method).toBe('POST')
    expect(url).not.toContain('deviceSecret')
    expect(JSON.parse(init.body as string)).toEqual({
      deviceId: getUserId(),
      deviceSecret: getDeviceSecret(),
      returnTo: expect.any(String),
    })
  })

  it('throws rather than navigating somewhere useless', async () => {
    // The caller shows an error. Returning a half-built URL would send the
    // singer to Google and back with nothing to show for it.
    stubStart(503, {})
    await expect(googleSignInUrl()).rejects.toThrow()

    stubStart(200, {})
    await expect(googleSignInUrl()).rejects.toThrow()
  })
})
