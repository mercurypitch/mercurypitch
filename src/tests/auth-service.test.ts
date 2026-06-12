// ============================================================
// Auth Service Tests — anonymous bootstrap, login, register
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/defaults', () => ({
  API_BASE_URL: 'http://api.test',
  GOOGLE_CLIENT_ID: 'test-client-id',
}))

import { ensureAuth, hasValidToken, loginWithGoogle, loginWithPassword, logout, registerWithPassword, } from '@/db/services/auth-service'
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

describe('ensureAuth', () => {
  it('requests an anonymous token with the persisted device id', async () => {
    const deviceId = getUserId()
    const fetchMock = mockFetchOnce(200, {
      token: makeToken(3600),
      userId: deviceId,
      isNew: true,
      user: { id: deviceId, authProvider: 'anonymous' },
    })

    const ok = await ensureAuth()
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
    expect(await ensureAuth()).toBe(true)
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
    expect(await ensureAuth()).toBe(false)
    warnSpy.mockRestore()
  })

  it('stops retrying anonymous auth after a 403 (upgraded account)', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const fetchMock = mockFetchOnce(403, { error: 'Account requires login' })
    expect(await ensureAuth()).toBe(false)
    expect(fetchMock).toHaveBeenCalledOnce()

    // The 403 is remembered — no further network attempts
    expect(await ensureAuth()).toBe(false)
    expect(fetchMock).toHaveBeenCalledOnce()
    infoSpy.mockRestore()
  })

  it('resumes after an explicit login clears the signed-out state', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    mockFetchOnce(403, { error: 'Account requires login' })
    await ensureAuth()

    mockFetchOnce(200, {
      token: makeToken(3600, 'password'),
      userId: 'u',
      isNew: false,
      user: { authProvider: 'password' },
    })
    await loginWithPassword('a@b.com', 'secret123')
    expect(await ensureAuth()).toBe(true)
    infoSpy.mockRestore()
  })
})

describe('logout', () => {
  it('remembers that an upgraded account needs a real login', async () => {
    setAuthToken(makeToken(3600, 'password'))
    logout()
    expect(getAuthToken()).toBeNull()

    // ensureAuth must not attempt (and fail) an anonymous handshake
    const fetchMock = mockFetchOnce(200, {})
    expect(await ensureAuth()).toBe(false)
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
    expect(await ensureAuth()).toBe(true)
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

  it('throws with server detail on bad credentials', async () => {
    mockFetchOnce(401, { error: 'Invalid email or password' })
    await expect(loginWithPassword('a@b.com', 'wrong')).rejects.toThrow(/401/)
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
})
