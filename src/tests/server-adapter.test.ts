// ServerAdapter retry / error-handling tests.
//
// The resilience layer (exponential backoff on 5xx/429 and network errors,
// findById swallowing to null, 204 → undefined, query-string serialization)
// was previously untested — bugs here only surface under real network failure.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetCloudReadWarningsForTests, ServerAdapter, } from '@/db/adapters/server-adapter'
import type { DbEntity } from '@/db/types'

interface Rec extends DbEntity {
  score: number
}

function repo() {
  return new ServerAdapter({ baseUrl: 'http://api.test' }).getRepository<Rec>(
    'sessionRecords',
  )
}

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
})
const fail = (status: number, body = '') => ({
  ok: false,
  status,
  statusText: `status-${status}`,
  text: async () => body,
})

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('ServerAdapter retry semantics', () => {
  it('retries once on 500 then resolves', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fail(500))
      .mockResolvedValueOnce(ok({ id: 'a', score: 1 }))
    vi.stubGlobal('fetch', fetchMock)

    const p = repo().create({ score: 1 })
    await vi.advanceTimersByTimeAsync(2000)
    await expect(p).resolves.toMatchObject({ id: 'a' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting retries on persistent 500 (3 attempts)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fail(500, 'boom'))
    vi.stubGlobal('fetch', fetchMock)

    const p = repo().create({ score: 1 })
    const assertion = expect(p).rejects.toThrow(/500/)
    await vi.advanceTimersByTimeAsync(2000)
    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('retries on 429', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fail(429))
      .mockResolvedValueOnce(ok({ id: 'a', score: 1 }))
    vi.stubGlobal('fetch', fetchMock)

    const p = repo().create({ score: 1 })
    await vi.advanceTimersByTimeAsync(2000)
    await expect(p).resolves.toMatchObject({ id: 'a' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does NOT retry a 4xx (403) — throws immediately', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fail(403))
    vi.stubGlobal('fetch', fetchMock)

    const p = repo().create({ score: 1 })
    const assertion = expect(p).rejects.toThrow(/403/)
    await vi.advanceTimersByTimeAsync(2000)
    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries a TypeError (network failure) but not other errors', async () => {
    const networkThenOk = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(ok({ id: 'a', score: 1 }))
    vi.stubGlobal('fetch', networkThenOk)
    const p1 = repo().create({ score: 1 })
    await vi.advanceTimersByTimeAsync(2000)
    await expect(p1).resolves.toMatchObject({ id: 'a' })
    expect(networkThenOk).toHaveBeenCalledTimes(2)

    const plainError = vi.fn().mockRejectedValue(new Error('boom'))
    vi.stubGlobal('fetch', plainError)
    const p2 = repo().create({ score: 1 })
    const assertion = expect(p2).rejects.toThrow('boom')
    await vi.advanceTimersByTimeAsync(2000)
    await assertion
    expect(plainError).toHaveBeenCalledTimes(1)
  })
})

describe('ServerAdapter lazy identity provisioning', () => {
  function hookedRepo(beforeWrite: () => Promise<unknown>) {
    return new ServerAdapter({
      baseUrl: 'http://api.test',
      beforeWrite,
    }).getRepository<Rec>('sessionRecords')
  }

  it('awaits beforeWrite before create/update/delete', async () => {
    const order: string[] = []
    const beforeWrite = vi.fn(async () => {
      order.push('provision')
    })
    const fetchMock = vi.fn(async () => {
      order.push('fetch')
      return ok({ id: 'a', score: 1 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const r = hookedRepo(beforeWrite)

    await r.create({ score: 1 })
    await r.update('a', { score: 2 })
    await r.delete('a')

    expect(beforeWrite).toHaveBeenCalledTimes(3)
    // Provisioning must complete first, or the request goes out unauthenticated.
    expect(order).toEqual([
      'provision',
      'fetch',
      'provision',
      'fetch',
      'provision',
      'fetch',
    ])
  })

  it('never calls beforeWrite for reads — browsing must not create an account', async () => {
    const beforeWrite = vi.fn(async () => undefined)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([])))
    const r = hookedRepo(beforeWrite)

    await r.findAll()
    await r.findById('x')
    await r.count()

    expect(beforeWrite).not.toHaveBeenCalled()
  })

  it('does not dispatch a write with a newly selected account identity', async () => {
    let identity = 'singer-a'
    let releaseProvisioning = (): void => undefined
    const beforeWrite = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseProvisioning = resolve
        }),
    )
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: 'a', score: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const guardedRepo = new ServerAdapter({
      baseUrl: 'http://api.test',
      beforeWrite,
      headers: () => ({ Authorization: `Bearer token-${identity}` }),
      writeIdentity: () => identity,
    }).getRepository<Rec>('sessionRecords')

    const writing = guardedRepo.create({ score: 1 })
    identity = 'singer-b'
    releaseProvisioning()

    await expect(writing).rejects.toThrow(/write identity changed/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('pins the validated credential before a later account switch', async () => {
    let identity = 'singer-a'
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: 'a', score: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const guardedRepo = new ServerAdapter({
      baseUrl: 'http://api.test',
      beforeWrite: async () => undefined,
      headers: () => {
        const authorization = `Bearer token-${identity}`
        queueMicrotask(() => {
          identity = 'singer-b'
        })
        return { Authorization: authorization }
      },
      writeIdentity: () => identity,
    }).getRepository<Rec>('sessionRecords')

    await guardedRepo.create({ score: 1 })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/api/sessionRecords',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-singer-a',
        }),
      }),
    )
    expect(identity).toBe('singer-b')
  })

  it('attributes a delayed write error to the frozen operation identity', async () => {
    let identity = 'singer-a'
    let releaseResponse = (_response: ReturnType<typeof fail>): void =>
      undefined
    const onErrorResponse = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<ReturnType<typeof fail>>((resolve) => {
            releaseResponse = resolve
          }),
      ),
    )
    const guardedRepo = new ServerAdapter({
      baseUrl: 'http://api.test',
      beforeWrite: async () => undefined,
      headers: () => {
        const authorization = `Bearer token-${identity}`
        queueMicrotask(() => {
          identity = 'singer-b'
        })
        return { Authorization: authorization }
      },
      writeIdentity: () => identity,
      onErrorResponse,
    }).getRepository<Rec>('sessionRecords')

    const writing = guardedRepo.create({ score: 1 })
    await vi.waitFor(() => expect(identity).toBe('singer-b'))
    releaseResponse(fail(403, JSON.stringify({ code: 'account_suspended' })))

    await expect(writing).rejects.toThrow(/403/)
    expect(onErrorResponse).not.toHaveBeenCalled()
  })

  it('resolves reads empty on 401 (no identity yet) without warning', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail(401)))

    await expect(repo().findAll()).resolves.toEqual([])
    await expect(repo().findById('x')).resolves.toBeNull()
    await expect(repo().count()).resolves.toBe(0)
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

describe('ServerAdapter response handling', () => {
  it('ignores an old account error after the selected identity changes', async () => {
    let identity = 'singer-a'
    let releaseResponse = (_response: ReturnType<typeof fail>): void =>
      undefined
    const onErrorResponse = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<ReturnType<typeof fail>>((resolve) => {
            releaseResponse = resolve
          }),
      ),
    )
    const guardedRepo = new ServerAdapter({
      baseUrl: 'http://api.test',
      writeIdentity: () => identity,
      headers: () => ({ Authorization: `Bearer token-${identity}` }),
      onErrorResponse,
    }).getRepository<Rec>('sessionRecords')

    const reading = guardedRepo.findAll({ throwOnError: true })
    identity = 'singer-b'
    releaseResponse(fail(403, JSON.stringify({ code: 'account_suspended' })))

    await expect(reading).rejects.toThrow(/403/)
    expect(onErrorResponse).not.toHaveBeenCalled()
  })

  it('keeps ordinary findAll reads offline-tolerant but lets audited reads reject', async () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined)
    const fetchMock = vi.fn().mockResolvedValue(fail(403, 'forbidden'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(repo().findAll()).resolves.toEqual([])
    await expect(repo().findAll({ throwOnError: true })).rejects.toThrow(/403/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    warnSpy.mockRestore()
  })

  it('keeps ordinary count reads offline-tolerant but lets audited reads reject', async () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined)
    const fetchMock = vi.fn().mockResolvedValue(fail(403, 'forbidden'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(repo().count()).resolves.toBe(0)
    await expect(repo().count({ throwOnError: true })).rejects.toThrow(/403/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    warnSpy.mockRestore()
  })

  it('reports a structured failure before consuming it for the thrown error', async () => {
    const onErrorResponse = vi.fn()
    const body = JSON.stringify({ code: 'account_suspended' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail(403, body)))
    const suspendedRepo = new ServerAdapter({
      baseUrl: 'http://api.test',
      onErrorResponse,
    }).getRepository<Rec>('sessionRecords')

    await expect(suspendedRepo.create({ score: 1 })).rejects.toThrow(/403/)
    expect(onErrorResponse).toHaveBeenCalledWith(403, body)
  })

  it('findById swallows a 404 and returns null', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fail(404))
    vi.stubGlobal('fetch', fetchMock)
    await expect(repo().findById('x')).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('delete treats 204 No Content as success (undefined)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 })
    vi.stubGlobal('fetch', fetchMock)
    await expect(repo().delete('x')).resolves.toBeUndefined()
  })

  it('serializes where/orderBy/limit/offset into the query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([]))
    vi.stubGlobal('fetch', fetchMock)

    await repo().findAll({
      where: { userId: 'u1' },
      orderBy: 'score',
      orderDir: 'desc',
      limit: 10,
      offset: 5,
    })

    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('where%5BuserId%5D=u1')
    expect(url).toContain('orderBy=score')
    expect(url).toContain('orderDir=desc')
    expect(url).toContain('limit=10')
    expect(url).toContain('offset=5')
  })
})

// ── What a failed cloud read says ───────────────────────────────
//
// A failed read still resolves empty, so the console line is the only thing
// telling anyone whether a library is empty or broken. It used to say "cloud
// backend unreachable" for every failure, once per session, and then name two
// remedies that only exist in dev. These pin down each of those three.

describe('a failed cloud read explains itself', () => {
  function spyOnWarn() {
    return vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  }
  let warnSpy: ReturnType<typeof spyOnWarn>
  const warnings = () => warnSpy.mock.calls.map((call) => String(call[0]))

  beforeEach(() => {
    resetCloudReadWarningsForTests()
    // Restored in afterEach, not at the end of each body: a spy left behind by
    // a failing assertion is adopted by the next `vi.spyOn`, carrying its calls
    // with it, and the suite starts depending on its own order.
    warnSpy = spyOnWarn()
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('names the status when the backend answered, and the table it read', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail(404, 'not found')))

    await expect(repo().findAll()).resolves.toEqual([])

    const [line] = warnings()
    // The whole defect: a backend that answered is not an unreachable one.
    expect(line).toContain('the backend answered 404')
    expect(line).not.toContain('could not be reached')
    expect(line).toContain('sessionRecords')
  })

  it('says unreachable only when the network really failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    )

    const pending = repo().findAll()
    await vi.advanceTimersByTimeAsync(2000)
    await expect(pending).resolves.toEqual([])

    expect(warnings()[0]).toContain('the backend could not be reached')
  })

  it('speaks up again when a different failure follows the first', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(fail(404))
        .mockResolvedValue(fail(403, 'forbidden')),
    )

    await repo().findAll()
    await repo().findAll()

    // The old latch was once per session, so this second, different, and
    // usually more interesting failure never reached the console at all.
    const lines = warnings()
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('answered 404')
    expect(lines[1]).toContain('answered 403')
  })

  it('stays quiet while the same failure repeats', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail(404)))

    await repo().findAll()
    await repo().findById('x')
    await repo().count()

    expect(warnings()).toHaveLength(1)
  })

  it('says nothing at all when there is simply no cloud identity yet', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail(401)))

    await expect(repo().findAll()).resolves.toEqual([])

    // Routine: identities are provisioned on the first write, so a visitor
    // who has not written anything has no rows and no problem.
    expect(warnings()).toHaveLength(0)
  })

  it('carries the status on the error so callers need not parse the message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail(404, 'gone')))

    await expect(repo().findAll({ throwOnError: true })).rejects.toMatchObject({
      status: 404,
    })
  })

  it('offers the dev remedies in dev', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail(404)))

    await repo().findAll()

    expect(warnings()[0]).toContain('pnpm dev:db')
  })

  it('keeps the dev remedies out of a production console', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail(404)))

    // A fresh module graph is the only honest way to read the other branch of
    // IS_DEV. Someone on mercurypitch.com was being told to run a dev command,
    // which is exactly what this stops.
    vi.resetModules()
    vi.doMock('@/lib/defaults', async (importOriginal) => {
      const actual = await importOriginal<Record<string, unknown>>()
      return { ...actual, IS_DEV: false }
    })
    const { ServerAdapter: Shipped } =
      await import('@/db/adapters/server-adapter')

    await new Shipped({ baseUrl: 'http://api.test' })
      .getRepository<Rec>('sessionRecords')
      .findAll()

    const [line] = warnings()
    expect(line).toContain('the backend answered 404')
    expect(line).not.toContain('pnpm dev:db')
    expect(line).not.toContain('VITE_API_BASE_URL')

    vi.doUnmock('@/lib/defaults')
    vi.resetModules()
  })
})

// ── A refused session must not look like an empty account ───────
//
// Reads degrade to empty so the app still loads, and a 401 becomes a
// NoIdentityError, which is routine — identities mint on the first write. That
// combination meant nothing downstream ever learned a session had been
// refused, so an expired one looked exactly like a new visitor: an empty
// library, no explanation. `onUnauthorized` is the seam that fixes it.

describe('a refused session reaches the auth layer', () => {
  it('tells the caller before swallowing the 401 as routine', async () => {
    const onUnauthorized = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail(401)))
    const repo = new ServerAdapter({
      baseUrl: 'http://api.test',
      onUnauthorized,
    }).getRepository<Rec>('sessionRecords')

    // Still empty, still silent: offline tolerance is unchanged.
    await expect(repo.findAll()).resolves.toEqual([])
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('reports it on every kind of read, since any of them can be the first', async () => {
    const onUnauthorized = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail(401)))
    const repo = new ServerAdapter({
      baseUrl: 'http://api.test',
      onUnauthorized,
    }).getRepository<Rec>('sessionRecords')

    await repo.findById('x')
    await repo.count()
    expect(onUnauthorized).toHaveBeenCalledTimes(2)
  })

  it('does not sign out the account that replaced the one being refused', async () => {
    const onUnauthorized = vi.fn()
    let identity = 'account-a'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        // The switch lands while this request is in flight.
        identity = 'account-b'
        return fail(401)
      }),
    )
    const repo = new ServerAdapter({
      baseUrl: 'http://api.test',
      onUnauthorized,
      writeIdentity: () => identity,
    }).getRepository<Rec>('sessionRecords')

    await expect(repo.findAll()).resolves.toEqual([])

    // Account B is signed in and fine; refusing A's stale request must not
    // take B's session down with it.
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('leaves the 401 as a NoIdentityError, so nothing starts logging it', async () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined)
    try {
      resetCloudReadWarningsForTests()
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail(401)))
      const repo = new ServerAdapter({
        baseUrl: 'http://api.test',
        onUnauthorized: vi.fn(),
      }).getRepository<Rec>('sessionRecords')

      await repo.findAll()
      expect(warnSpy).not.toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
    }
  })
})
