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

describe('ServerAdapter response handling', () => {
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
