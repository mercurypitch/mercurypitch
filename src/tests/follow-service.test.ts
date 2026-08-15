// ============================================================
// Follow service — the client half of the consent rule
// ============================================================
//
// The worker refuses to hand out a stranger's numbers without both sides
// agreeing (workers/db-worker/node-tests/follow-requests-integration.test.ts
// proves that). These are the things the client must get right so the rule is
// legible on screen rather than merely enforced behind it:
//
//   - a follow is created through /api/friends/*, never the generic CRUD
//     route that could only ever write the unagreed half
//   - a removal clears BOTH directions, in one call the server owns
//   - an ask that has not been answered reads as pending, not as a friend
//
// fetch is stubbed rather than a service double: the URL, verb and body ARE
// the contract with the worker, and asserting on a hand-written stand-in
// would prove only that the stand-in matches itself.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A getter, so a test can take the backend away and prove the offline paths
// answer without a round trip rather than throwing at the fetch.
const config = vi.hoisted(() => ({
  base: 'http://api.test' as string | undefined,
}))
vi.mock('@/lib/defaults', () => ({
  get API_BASE_URL(): string | undefined {
    return config.base
  },
}))
vi.mock('@/db/services/user-service', () => ({
  getAuthHeaders: () => ({ Authorization: 'Bearer test-token' }),
  getUserId: () => 'me',
}))

// Whether this browser holds a REAL account (password/Google) rather than a
// lazily provisioned device id. Every existing test below runs as a registered
// singer, which is what the service was written for; `describe('still
// anonymous')` is the one that flips it.
const account = vi.hoisted(() => ({ registered: true }))
vi.mock('@/db/services/auth-service', () => ({
  hasUpgradedAccount: () => account.registered,
}))

const rows = vi.hoisted(() => ({
  value: [] as Array<Record<string, unknown>>,
  broken: false,
}))
vi.mock('@/db', () => ({
  getDb: async () => {
    if (rows.broken) throw new Error('store unavailable')
    return {
      getRepository: () => ({ findAll: async () => rows.value }),
    }
  },
}))

import { acceptFriend, getFollowing, getMyFriendCode, listFriendRequests, loadFollowState, redeemFriendCode, removeFriend, requestFriend, } from '@/db/services/follow-service'

interface Call {
  url: string
  method: string
  body: unknown
  headers: Record<string, string>
}

let calls: Call[]

/** Answer every request with `status` and `payload`. */
function stubFetch(status: number, payload: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      calls.push({
        url,
        method: init?.method ?? 'GET',
        body: init?.body == null ? null : JSON.parse(String(init.body)),
        headers: (init?.headers ?? {}) as Record<string, string>,
      })
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: async () => payload,
      } as Response)
    }),
  )
}

beforeEach(() => {
  calls = []
  rows.value = []
  rows.broken = false
  config.base = 'http://api.test'
  account.registered = true
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('asking', () => {
  it('posts to the friends route, not to the follows table', async () => {
    stubFetch(201, { status: 'pending' })

    await expect(requestFriend('other')).resolves.toEqual({
      ok: true,
      status: 'pending',
      displayName: undefined,
    })
    expect(calls).toEqual([
      {
        url: 'http://api.test/api/friends/request',
        method: 'POST',
        body: { userId: 'other' },
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      },
    ])
    // The route that used to create the unagreed half must never be reached.
    expect(calls.some((c) => c.url.includes('/api/follows'))).toBe(false)
  })

  it('reports an immediate friendship when they had asked first', async () => {
    stubFetch(200, { status: 'accepted' })
    await expect(requestFriend('other')).resolves.toMatchObject({
      ok: true,
      status: 'accepted',
    })
  })

  it('refuses yourself and the empty id without a round trip', async () => {
    stubFetch(201, { status: 'pending' })

    await expect(requestFriend('me')).resolves.toMatchObject({ ok: false })
    await expect(requestFriend('')).resolves.toMatchObject({ ok: false })
    expect(calls).toEqual([])
  })

  it('surfaces the server’s own refusal rather than a generic one', async () => {
    stubFetch(404, { error: 'No such singer' })
    await expect(requestFriend('ghost')).resolves.toEqual({
      ok: false,
      error: 'No such singer',
    })
  })

  it('falls back to its own wording when the server sends none', async () => {
    stubFetch(500, {})
    await expect(requestFriend('other')).resolves.toEqual({
      ok: false,
      error: 'Could not send the request',
    })
  })

  it('does not claim success when the network fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    )
    await expect(requestFriend('other')).resolves.toEqual({
      ok: false,
      error: 'Could not reach the server',
    })
  })
})

describe('answering', () => {
  it('accepts through the route only the recipient can use', async () => {
    stubFetch(200, { status: 'accepted' })

    await expect(acceptFriend('asker')).resolves.toMatchObject({
      ok: true,
      status: 'accepted',
    })
    expect(calls[0]).toMatchObject({
      url: 'http://api.test/api/friends/accept',
      method: 'POST',
      body: { userId: 'asker' },
    })
  })

  it('removes in one call, because both directions go together', async () => {
    stubFetch(200, { ok: true })

    await expect(removeFriend('friend')).resolves.toMatchObject({ ok: true })
    // One request, not a delete per row: a client that had to issue two could
    // land the first and lose the second, leaving the friendship half-alive.
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      url: 'http://api.test/api/friends/remove',
      method: 'POST',
      body: { userId: 'friend' },
    })
  })

  it('reports a failed accept instead of showing a friendship', async () => {
    stubFetch(404, { error: 'No request from that singer' })
    await expect(acceptFriend('nobody')).resolves.toEqual({
      ok: false,
      error: 'No request from that singer',
    })
  })

  it('reports a failed remove with the server’s reason', async () => {
    stubFetch(401, {})
    await expect(removeFriend('friend')).resolves.toEqual({
      ok: false,
      error: 'Could not remove that friend',
    })
  })
})

describe('the request list', () => {
  it('reads both directions from the endpoint', async () => {
    const incoming = [
      {
        userId: 'asker',
        displayName: 'Asker',
        avatarUrl: null,
        createdAt: '2026-08-09T12:00:00.000Z',
      },
    ]
    stubFetch(200, { incoming, outgoing: [] })

    await expect(listFriendRequests()).resolves.toEqual({
      incoming,
      outgoing: [],
    })
    expect(calls[0]).toMatchObject({
      url: 'http://api.test/api/friends/requests',
      method: 'GET',
    })
  })

  it('resolves empty rather than throwing when the read fails', async () => {
    stubFetch(500, {})
    await expect(listFriendRequests()).resolves.toEqual({
      incoming: [],
      outgoing: [],
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    )
    await expect(listFriendRequests()).resolves.toEqual({
      incoming: [],
      outgoing: [],
    })
  })

  it('tolerates a worker that sends only one half', async () => {
    stubFetch(200, {})
    await expect(listFriendRequests()).resolves.toEqual({
      incoming: [],
      outgoing: [],
    })
  })
})

describe('reading your own rows', () => {
  it('splits agreed from asked', async () => {
    rows.value = [
      { followedUserId: 'friend', status: 'accepted' },
      { followedUserId: 'asked', status: 'pending' },
      // No status at all: written before the column existed, so nobody ever
      // agreed to it. Reading it as accepted is the bug this replaced.
      { followedUserId: 'legacy' },
    ]

    await expect(loadFollowState()).resolves.toEqual({
      accepted: ['friend'],
      pending: ['asked', 'legacy'],
    })
    await expect(getFollowing()).resolves.toEqual(['friend'])
  })

  it('resolves empty when the store is unreachable', async () => {
    // Signed out, or a browser with IndexedDB blocked. The Friends tab has to
    // render something, and "no friends" is the truthful something.
    rows.broken = true
    await expect(loadFollowState()).resolves.toEqual({
      accepted: [],
      pending: [],
    })
    await expect(getFollowing()).resolves.toEqual([])
  })
})

describe('a build with no backend', () => {
  // Follows only mean anything against a shared server, so every one of these
  // must answer locally instead of constructing a request to `undefined/api/…`.
  beforeEach(() => {
    config.base = undefined
    stubFetch(200, {})
  })

  it('says so instead of pretending, on every write', async () => {
    for (const action of [
      requestFriend('other'),
      acceptFriend('other'),
      removeFriend('other'),
      redeemFriendCode('K7QM2X4B'),
    ]) {
      await expect(action).resolves.toMatchObject({
        ok: false,
        error: 'Friends need a connection',
      })
    }
    expect(calls).toEqual([])
  })

  it('reads empty without a request', async () => {
    await expect(listFriendRequests()).resolves.toEqual({
      incoming: [],
      outgoing: [],
    })
    await expect(getMyFriendCode()).resolves.toBeNull()
    expect(calls).toEqual([])
  })
})

describe('minting your own code', () => {
  it('returns the code the worker minted', async () => {
    stubFetch(200, { code: 'K7QM2X4B' })

    await expect(getMyFriendCode()).resolves.toBe('K7QM2X4B')
    expect(calls[0]).toMatchObject({
      url: 'http://api.test/api/friends/code',
      method: 'GET',
    })
  })

  it('is null rather than a broken code when the mint fails', async () => {
    stubFetch(503, { error: 'Could not allocate a code, try again' })
    await expect(getMyFriendCode()).resolves.toBeNull()

    stubFetch(200, {})
    await expect(getMyFriendCode()).resolves.toBeNull()

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    )
    await expect(getMyFriendCode()).resolves.toBeNull()
  })
})

describe('a reply that is not JSON', () => {
  it('still fails closed, with the caller’s own wording', async () => {
    // A proxy error page or an HTML 502 — the status is the truth, and the
    // body must not turn a refusal into an unhandled rejection.
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 502,
          json: () => Promise.reject(new SyntaxError('Unexpected token <')),
        } as unknown as Response),
      ),
    )

    await expect(requestFriend('other')).resolves.toEqual({
      ok: false,
      error: 'Could not send the request',
    })
  })
})

describe('still anonymous', () => {
  // Friends are an account feature on both sides of every row, and the worker
  // is the authority (see the 403s in
  // workers/db-worker/node-tests/follow-requests-integration.test.ts). These
  // are the client's half: an anonymous singer must not spend a round trip to
  // be told what is already knowable from the token in localStorage, and the
  // wording they see must be the one the server would have sent.
  beforeEach(() => {
    account.registered = false
    stubFetch(201, { status: 'pending' })
  })

  it('refuses every add without asking the server', async () => {
    for (const action of [
      requestFriend('other'),
      acceptFriend('asker'),
      redeemFriendCode('K7QM2X4B'),
    ]) {
      await expect(action).resolves.toEqual({
        ok: false,
        error: 'Create an account to add friends',
      })
    }
    expect(calls).toEqual([])
  })

  it('has no code to show and no requests to answer', async () => {
    await expect(getMyFriendCode()).resolves.toBeNull()
    await expect(listFriendRequests()).resolves.toEqual({
      incoming: [],
      outgoing: [],
    })
    expect(calls).toEqual([])
  })

  it('can still leave a row it is already in', async () => {
    // The deliberate exemption, mirroring the worker: needing an account to
    // get OUT of a friendship that needed none to get into would strand the
    // people this rule is meant to protect.
    stubFetch(200, { ok: true })
    await expect(removeFriend('friend')).resolves.toMatchObject({ ok: true })
    expect(calls[0]).toMatchObject({
      url: 'http://api.test/api/friends/remove',
      body: { userId: 'friend' },
    })
  })

  it('says "you can’t friend yourself" before it says "make an account"', async () => {
    // Order matters for the sentence that lands: telling someone to register
    // in order to add themselves would be advice they cannot act on.
    await expect(requestFriend('me')).resolves.toEqual({
      ok: false,
      error: 'You can’t friend yourself',
    })
    expect(calls).toEqual([])
  })
})

describe('friend codes', () => {
  it('links both directions in one redeem', async () => {
    stubFetch(200, { ok: true, displayName: 'Owner', status: 'accepted' })

    await expect(redeemFriendCode('K7QM2X4B')).resolves.toEqual({
      ok: true,
      displayName: 'Owner',
    })
    expect(calls[0]).toMatchObject({
      url: 'http://api.test/api/friends/redeem',
      method: 'POST',
      body: { code: 'K7QM2X4B' },
    })
  })

  it('passes the server’s refusal through to the panel', async () => {
    stubFetch(404, { error: 'No one found for that code' })
    await expect(redeemFriendCode('ZZZZZZZZ')).resolves.toEqual({
      ok: false,
      error: 'No one found for that code',
    })
  })
})
