// ============================================================
// Opening the database never waits on the network
// ============================================================
//
// The bug: on a network that holds requests to the API host for a minute,
// a signed-in singer could not read or write anything on the device for
// that minute, on every page load. getDb() awaited restoreAuth(), whose
// /api/auth/me had no deadline, and every Dexie read and write goes
// through getDb(). These run the real auth service, HybridAdapter and
// ServerAdapter; only fetch is faked, at the network edge.
//
// The second half is the risk the fix carries. Checking the session in the
// background means a write can race that check, and HybridAdapter's write
// hook (requireAuth) provisions an anonymous identity for a first-time
// writer. A singer who holds a token must never be given a second identity
// by that race.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  API_BASE_URL: 'http://api.test',
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))
vi.mock('@/stores/notifications-store', () => ({ showNotification: vi.fn() }))

import { closeDatabase, getDb } from '@/db'
import { API_READ_DEADLINE_MS, API_UNREACHABLE_CHANNEL, ApiUnreachableError, fetchWithDeadline, resetApiUnreachableNoticeForTests, } from '@/db/api-fetch'
import { API_UNREACHABLE_FIRST_WINDOW_MS } from '@/db/api-reachability'
import type { SessionRecord } from '@/db/entities'
import { needsSignIn, restoreAuth } from '@/db/services/auth-service'
import { getAuthToken, getUserId, setAuthToken, } from '@/db/services/user-service'
import type { DbEntity } from '@/db/types'
import { showNotification } from '@/stores/notifications-store'

const API = 'http://api.test'
const DEVICE_ID = 'device-1'

let minted = 0

/** A worker-shaped JWT. The client decodes `sub`, `provider` and `exp` only. */
function token(sub: string, provider: 'password' | 'anonymous'): string {
  minted += 1
  const body = btoa(
    JSON.stringify({
      sub,
      provider,
      exp: Math.floor(Date.now() / 1000) + 3600,
      // Every token in this file is distinct, so no test inherits a session
      // an earlier one verified.
      iat: minted,
    }),
  )
  return `header.${body}.signature`
}

interface Call {
  url: string
  init?: RequestInit
}

/**
 * The API at the network edge. `answer` returns a response, an error to
 * reject with, or 'hold': a request nobody answers until the test does, or
 * until its signal aborts.
 */
function fakeApi(
  answer: (url: string, init?: RequestInit) => Response | Error | 'hold',
) {
  const calls: Call[] = []
  const held: Array<
    Call & { resolve: (r: Response) => void; reject: (e: unknown) => void }
  > = []
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    calls.push({ url, init })
    const reply = answer(url, init)
    if (reply === 'hold') {
      return new Promise<Response>((resolve, reject) => {
        held.push({ url, init, resolve, reject })
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    }
    return reply instanceof Error
      ? Promise.reject(reply)
      : Promise.resolve(reply)
  })
  vi.stubGlobal('fetch', fetchMock)
  return {
    calls,
    to: (path: string) =>
      calls.filter((c) => c.url.split('?')[0] === `${API}${path}`),
    /** Answer every held request to `path`. */
    answer(path: string, response: () => Response): void {
      for (const h of held.filter((x) => x.url === `${API}${path}`))
        h.resolve(response())
    },
    /** Settle whatever is still held, so nothing outlives its test. */
    release(): void {
      for (const h of held)
        h.reject(new DOMException('Released by the test.', 'AbortError'))
    },
  }
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/** Whether `promise` settles within `ms` of real time. */
async function settlesWithin(
  promise: Promise<unknown>,
  ms: number,
): Promise<'settled' | 'still waiting'> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const waiting = new Promise<'still waiting'>((resolve) => {
    timer = setTimeout(() => resolve('still waiting'), ms)
  })
  const settled = promise.then(
    () => 'settled' as const,
    () => 'settled' as const,
  )
  try {
    return await Promise.race([settled, waiting])
  } finally {
    clearTimeout(timer)
  }
}

/** Where a promise stands, for tests on fake timers. */
function track<T>(promise: Promise<T>) {
  const state: { settled: boolean; value?: T; error?: unknown } = {
    settled: false,
  }
  promise.then(
    (value) => {
      state.settled = true
      state.value = value
    },
    (error: unknown) => {
      state.settled = true
      state.error = error
    },
  )
  return state
}

function practiceRun(
  userId: string,
): Omit<SessionRecord, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    userId,
    melodyName: 'Exercise: Long Tones',
    startedAt: '2026-11-27T10:00:00.000Z',
    endedAt: '2026-11-27T10:01:00.000Z',
    score: 80,
    accuracy: 80,
    notesHit: 8,
    notesTotal: 10,
    streak: 0,
    results: [],
  }
}

let api: ReturnType<typeof fakeApi> | null = null

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('mp:userId', DEVICE_ID)
  resetApiUnreachableNoticeForTests()
  vi.mocked(showNotification).mockClear()
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(async () => {
  api?.release()
  api = null
  vi.useRealTimers()
  await closeDatabase()
  setAuthToken(null)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('opening the database while the API answers nothing', () => {
  it('opens for a signed-in singer without waiting for /api/auth/me', async () => {
    setAuthToken(token('acct-1', 'password'))
    api = fakeApi((url) => (url.endsWith('/api/auth/me') ? 'hold' : json([])))

    const opening = getDb()

    expect(await settlesWithin(opening, 1000)).toBe('settled')
    // The check still went out; it simply is not waited for.
    expect(api.to('/api/auth/me')).toHaveLength(1)
  })

  it("reads and writes the device's own data while the check is out", async () => {
    setAuthToken(token('acct-1', 'password'))
    api = fakeApi((url) => (url.endsWith('/api/auth/me') ? 'hold' : json([])))
    const opening = getDb()
    expect(await settlesWithin(opening, 1000)).toBe('settled')
    const groups = (await opening).getRepository<DbEntity & { name: string }>(
      'sessionGroups',
    )

    const made = await groups.create({ name: 'Warm-ups' })

    expect((await groups.findById(made.id))?.name).toBe('Warm-ups')
  })
})

describe('a stale session found after the database opened', () => {
  it('signs an account out when the server refuses its token, as at startup', async () => {
    setAuthToken(token('acct-1', 'password'))
    api = fakeApi((url) => (url.endsWith('/api/auth/me') ? 'hold' : json([])))
    const opening = getDb()
    expect(await settlesWithin(opening, 1000)).toBe('settled')

    api.answer('/api/auth/me', () => json({ error: 'Unauthorized' }, 401))

    await vi.waitFor(() => expect(getAuthToken()).toBeNull())
    expect(needsSignIn()).toBe(true)
    expect(showNotification).toHaveBeenCalledWith(
      expect.stringContaining('session has expired'),
      'warning',
      expect.anything(),
    )
  })

  it('keeps what the device saved while the check was out', async () => {
    setAuthToken(token('acct-1', 'password'))
    api = fakeApi((url) => (url.endsWith('/api/auth/me') ? 'hold' : json([])))
    const opening = getDb()
    expect(await settlesWithin(opening, 1000)).toBe('settled')
    const groups = (await opening).getRepository<DbEntity & { name: string }>(
      'sessionGroups',
    )
    const made = await groups.create({ name: 'Saved before the answer' })

    api.answer('/api/auth/me', () => json({ error: 'Unauthorized' }, 401))
    await vi.waitFor(() => expect(getAuthToken()).toBeNull())

    expect((await groups.findById(made.id))?.name).toBe(
      'Saved before the answer',
    )
  })

  it('keeps the session when the server cannot be reached', async () => {
    const stored = token('acct-1', 'password')
    setAuthToken(stored)
    api = fakeApi((url) =>
      url.endsWith('/api/auth/me')
        ? new TypeError('Failed to fetch')
        : json([]),
    )

    await getDb()
    await vi.waitFor(() => expect(api?.to('/api/auth/me')).toHaveLength(1))

    expect(getAuthToken()).toBe(stored)
    expect(needsSignIn()).toBe(false)
  })

  it('keeps the session when /api/auth/me runs out of time, and says why once', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const stored = token('acct-1', 'password')
    setAuthToken(stored)
    api = fakeApi((url) => (url.endsWith('/api/auth/me') ? 'hold' : json([])))

    const opening = track(getDb())
    await vi.advanceTimersByTimeAsync(0)
    expect(opening.settled).toBe(true)
    await vi.advanceTimersByTimeAsync(API_READ_DEADLINE_MS)

    expect(getAuthToken()).toBe(stored)
    expect(needsSignIn()).toBe(false)
    expect(showNotification).toHaveBeenCalledOnce()
    expect(showNotification).toHaveBeenCalledWith(
      expect.stringContaining("Can't reach Mercury Pitch's servers"),
      'warning',
      expect.objectContaining({ channel: API_UNREACHABLE_CHANNEL }),
    )
  })
})

describe('a write that races the startup check', () => {
  // The check running out of time is the API out of reach, so the write that
  // waited on it is refused at once rather than spending 20 s of its own
  // (src/db/api-reachability.ts). What matters as much: it is refused under
  // the session the singer has, and no identity is minted for it.
  it('is refused at once when the check runs out of time, and mints nothing', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const stored = token('acct-1', 'password')
    setAuthToken(stored)
    api = fakeApi((url, init) => {
      if (url.endsWith('/api/auth/me')) return 'hold'
      if (url.endsWith('/api/sessionRecords') && init?.method === 'POST')
        return json({ id: 'run-1', ...practiceRun('acct-1') })
      return json({ token: token(DEVICE_ID, 'anonymous'), userId: DEVICE_ID })
    })
    const opening = track(getDb())
    await vi.advanceTimersByTimeAsync(0)
    expect(opening.settled).toBe(true)

    const saving = track(
      (opening.value as Awaited<ReturnType<typeof getDb>>)
        .getRepository<SessionRecord>('sessionRecords')
        .create(practiceRun('acct-1')),
    )
    await vi.advanceTimersByTimeAsync(API_READ_DEADLINE_MS)

    expect(saving.error).toBeInstanceOf(ApiUnreachableError)
    // The write waited on the startup check rather than asking again...
    expect(api.to('/api/auth/me')).toHaveLength(1)
    // ...never asked for an identity, sent nothing...
    expect(api.to('/api/auth/anonymous')).toHaveLength(0)
    expect(api.to('/api/sessionRecords')).toHaveLength(0)
    // ...and the singer keeps the session they had.
    expect(getAuthToken()).toBe(stored)
    expect(getUserId()).toBe('acct-1')
    expect(needsSignIn()).toBe(false)
  })

  it('is refused, not re-homed, when the server refuses an account mid-write', async () => {
    setAuthToken(token('acct-1', 'password'))
    api = fakeApi((url) =>
      url.endsWith('/api/auth/me')
        ? 'hold'
        : json({ token: token(DEVICE_ID, 'anonymous'), userId: DEVICE_ID }),
    )
    const opening = getDb()
    expect(await settlesWithin(opening, 1000)).toBe('settled')
    const saving = (await opening)
      .getRepository<SessionRecord>('sessionRecords')
      .create(practiceRun('acct-1'))

    api.answer('/api/auth/me', () => json({ error: 'Unauthorized' }, 401))

    await expect(saving).rejects.toThrow()
    expect(api.to('/api/auth/anonymous')).toHaveLength(0)
    // Nothing was sent under any identity, the old one or a new one.
    expect(api.to('/api/sessionRecords')).toHaveLength(0)
    expect(api.to('/api/auth/me')).toHaveLength(1)
    expect(getAuthToken()).toBeNull()
    expect(needsSignIn()).toBe(true)
    expect(localStorage.getItem('mp:userId')).toBe(DEVICE_ID)
  })

  it("re-provisions only the device's own identity when its anonymous token is refused", async () => {
    setAuthToken(token(DEVICE_ID, 'anonymous'))
    const reissued = token(DEVICE_ID, 'anonymous')
    api = fakeApi((url, init) => {
      if (url.endsWith('/api/auth/me')) return 'hold'
      if (url.endsWith('/api/auth/anonymous'))
        return json({
          token: reissued,
          userId: DEVICE_ID,
          isNew: false,
          user: { authProvider: 'anonymous' },
        })
      if (url.endsWith('/api/sessionRecords') && init?.method === 'POST')
        return json({ id: 'run-1', ...practiceRun(DEVICE_ID) })
      return json([])
    })
    const opening = getDb()
    expect(await settlesWithin(opening, 1000)).toBe('settled')
    const saving = (await opening)
      .getRepository<SessionRecord>('sessionRecords')
      .create(practiceRun(DEVICE_ID))

    api.answer('/api/auth/me', () => json({ error: 'Unauthorized' }, 401))

    await expect(saving).resolves.toMatchObject({ id: 'run-1' })
    const provisioned = api.to('/api/auth/anonymous')
    expect(provisioned).toHaveLength(1)
    expect(JSON.parse(String(provisioned[0]?.init?.body)).deviceId).toBe(
      DEVICE_ID,
    )
    const [write] = api.to('/api/sessionRecords')
    expect(new Headers(write?.init?.headers).get('authorization')).toBe(
      `Bearer ${reissued}`,
    )
    expect(getUserId()).toBe(DEVICE_ID)
  })
})

// Once a request to the API got no answer, calls to it are refused at once for
// a while (src/db/api-reachability.ts). A refusal is the network failing, found
// out early, so every rule above for a server that cannot be reached holds: no
// sign-out, nothing on the device lost, and no second identity.
describe('while the API is out of reach', () => {
  /** Opens the database for a signed-in singer and lets /me run out of time. */
  async function openWithApiOutOfReach(
    answer: Parameters<typeof fakeApi>[0],
  ): Promise<Awaited<ReturnType<typeof getDb>>> {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    api = fakeApi(answer)
    const opening = track(getDb())
    await vi.advanceTimersByTimeAsync(API_READ_DEADLINE_MS)
    expect(opening.settled).toBe(true)
    return opening.value as Awaited<ReturnType<typeof getDb>>
  }

  it("keeps a singer's session when the check of it is refused", async () => {
    const stored = token('acct-1', 'password')
    setAuthToken(stored)
    await openWithApiOutOfReach((url) =>
      url.endsWith('/api/auth/me') ? 'hold' : json([]),
    )

    const restored = await restoreAuth()

    expect(restored).toBe(true)
    expect(api?.to('/api/auth/me')).toHaveLength(1)
    expect(getAuthToken()).toBe(stored)
    expect(needsSignIn()).toBe(false)
  })

  it("reads and writes the device's own data", async () => {
    setAuthToken(token('acct-1', 'password'))
    const db = await openWithApiOutOfReach(() => 'hold')
    const groups = db.getRepository<DbEntity & { name: string }>(
      'sessionGroups',
    )

    const made = await groups.create({ name: 'Kept on this phone' })

    expect((await groups.findById(made.id))?.name).toBe('Kept on this phone')
  })

  it('mints no identity for a visitor whose first cloud write is refused', async () => {
    const db = await openWithApiOutOfReach(() => 'hold')
    // A visitor has no session to check, and a read of their own rows needs
    // no request, so the window is closed by what Home asks first.
    const legend = track(fetchWithDeadline(`${API}/api/weekly/active`))
    await vi.advanceTimersByTimeAsync(API_READ_DEADLINE_MS)
    expect(legend.error).toBeDefined()

    const saving = track(
      db
        .getRepository<SessionRecord>('sessionRecords')
        .create(practiceRun(DEVICE_ID)),
    )
    await vi.advanceTimersByTimeAsync(0)

    // Refused at once by HybridAdapter, as when provisioning meets a network
    // error: the identity request was not sent, so there is none to write as.
    expect(saving.settled).toBe(true)
    expect((saving.error as Error).message).toContain('not being saved')
    expect(api?.to('/api/auth/anonymous')).toHaveLength(0)
    expect(api?.to('/api/sessionRecords')).toHaveLength(0)
    expect(getAuthToken()).toBeNull()
    expect(getUserId()).toBe(DEVICE_ID)
  })

  it('sends a write once the window is over, under the stored session, and mints nothing', async () => {
    const stored = token('acct-1', 'password')
    setAuthToken(stored)
    let meAnswers = false
    const db = await openWithApiOutOfReach((url, init) => {
      if (url.endsWith('/api/auth/me'))
        return meAnswers ? json({ user: { id: 'acct-1' } }) : 'hold'
      if (url.endsWith('/api/sessionRecords') && init?.method === 'POST')
        return json({ id: 'run-1', ...practiceRun('acct-1') })
      return json([])
    })
    await vi.advanceTimersByTimeAsync(API_UNREACHABLE_FIRST_WINDOW_MS)
    meAnswers = true

    const saving = track(
      db
        .getRepository<SessionRecord>('sessionRecords')
        .create(practiceRun('acct-1')),
    )
    await vi.advanceTimersByTimeAsync(0)

    expect(saving.value?.id).toBe('run-1')
    expect(api?.to('/api/auth/anonymous')).toHaveLength(0)
    const [write] = api?.to('/api/sessionRecords') ?? []
    expect(new Headers(write?.init?.headers).get('authorization')).toBe(
      `Bearer ${stored}`,
    )
  })

  it('still signs an account out when the probe is answered with a refusal', async () => {
    setAuthToken(token('acct-1', 'password'))
    let meAnswers = false
    await openWithApiOutOfReach((url) => {
      if (url.endsWith('/api/auth/me'))
        return meAnswers ? json({ error: 'Unauthorized' }, 401) : 'hold'
      return json([])
    })
    await vi.advanceTimersByTimeAsync(API_UNREACHABLE_FIRST_WINDOW_MS)
    meAnswers = true

    const restored = await restoreAuth()

    expect(restored).toBe(false)
    expect(getAuthToken()).toBeNull()
    expect(needsSignIn()).toBe(true)
  })
})
