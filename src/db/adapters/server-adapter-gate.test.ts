// ============================================================
// ServerAdapter while the API is out of reach
// ============================================================
//
// Once a request to the API got no answer, the adapter's later requests are
// refused at once (src/db/api-reachability.ts) instead of each waiting out a
// deadline. What must not change: a refusal is never retried, a request that
// found the network down keeps its own retries, and a read still degrades to
// empty with a console line that says what happened.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiUnreachableError } from '@/db/api-fetch'
import type { DbEntity } from '@/db/types'
import { resetCloudReadWarningsForTests, ServerAdapter } from './server-adapter'

interface Rec extends DbEntity {
  score: number
}

function repo() {
  return new ServerAdapter({ baseUrl: 'http://api.test' }).getRepository<Rec>(
    'sessionRecords',
  )
}

/** A network that refuses every request at once, as an instant CORS 403 does. */
function refusingNetwork() {
  const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** Where a promise stands once the timers have been advanced. */
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

let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers()
  resetCloudReadWarningsForTests()
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  warn.mockRestore()
})

describe('a fast refusal', () => {
  it('costs the first write its three attempts, as before, and the next one none', async () => {
    const fetchMock = refusingNetwork()
    const first = track(repo().create({ score: 1 }))
    await vi.advanceTimersByTimeAsync(2000)
    expect(first.error).toBeInstanceOf(TypeError)
    expect(fetchMock).toHaveBeenCalledTimes(3)

    const second = track(repo().create({ score: 2 }))
    await vi.advanceTimersByTimeAsync(0)

    expect(second.error).toBeInstanceOf(ApiUnreachableError)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})

describe('a request refused while the API is out of reach', () => {
  it('is not tried again', async () => {
    const fetchMock = refusingNetwork()
    await vi.advanceTimersByTimeAsync(0)
    void repo()
      .findAll()
      .catch(() => undefined)
    await vi.advanceTimersByTimeAsync(2000)
    const sent = fetchMock.mock.calls.length

    const write = track(repo().update('a', { score: 3 }))
    await vi.advanceTimersByTimeAsync(60_000)

    expect(write.error).toBeInstanceOf(ApiUnreachableError)
    expect(fetchMock).toHaveBeenCalledTimes(sent)
  })

  it('reads as empty at once, and the console says it was not sent', async () => {
    refusingNetwork()
    const first = track(repo().findAll())
    await vi.advanceTimersByTimeAsync(2000)
    expect(first.value).toEqual([])
    resetCloudReadWarningsForTests()
    warn.mockClear()

    const read = track(repo().findAll())
    await vi.advanceTimersByTimeAsync(0)

    expect(read.value).toEqual([])
    expect(String(warn.mock.calls[0]?.[0])).toContain(
      'did not answer a recent request, so this one was not sent',
    )
  })

  it('rejects a read that asked to know, rather than calling it empty', async () => {
    refusingNetwork()
    void repo()
      .findAll()
      .catch(() => undefined)
    await vi.advanceTimersByTimeAsync(2000)

    const audited = track(repo().count({ throwOnError: true }))
    await vi.advanceTimersByTimeAsync(0)

    expect(audited.error).toBeInstanceOf(ApiUnreachableError)
  })
})
