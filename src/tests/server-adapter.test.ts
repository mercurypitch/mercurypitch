// ServerAdapter retry / error-handling tests.
//
// The resilience layer (exponential backoff on 5xx/429 and network errors,
// findById swallowing to null, 204 → undefined, query-string serialization)
// was previously untested — bugs here only surface under real network failure.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ServerAdapter } from '@/db/adapters/server-adapter'
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
