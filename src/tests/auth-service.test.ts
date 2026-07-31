// ============================================================
// Auth Service Tests — anonymous bootstrap, login, register
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/defaults', () => ({
  API_BASE_URL: 'http://api.test',
}))

import { hasValidToken, loginWithGoogle, loginWithPassword, logout, registerWithPassword, requireAuth, restoreAuth, } from '@/db/services/auth-service'
import { getAuthHeaders, getAuthToken, getUserId, setAuthToken, } from '@/db/services/user-service'

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
  const fn = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
    text: async () => JSON.stringify(body),
  }))
  vi.stubGlobal('fetch', fn)
  return fn
}

beforeEach(() => {
  localStorage.clear()
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
  it('requests an anonymous token with the persisted device id', async () => {
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

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe('http://api.test/api/auth/anonymous')
    expect(JSON.parse(init.body as string)).toEqual({ deviceId })
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
    expect(res.user.authProvider).toBe('password')
    expect(getAuthToken()).not.toBeNull()
  })

  it('throws the human-readable server message on bad credentials', async () => {
    mockFetchOnce(401, { error: 'Invalid email or password' })
    await expect(loginWithPassword('a@b.com', 'wrong')).rejects.toThrow(
      'Invalid email or password',
    )
    expect(getAuthToken()).toBeNull()
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
    })
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
