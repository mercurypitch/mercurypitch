// ============================================================
// fetchWithDeadline — a call to the API gives up when its time is up
// ============================================================
//
// The bug this exists for: a network whose proxy held every request to the
// API host for about a minute before refusing it. fetch() has no deadline of
// its own, so each call waited out that minute, and startup waited for one.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/stores/notifications-store', () => ({ showNotification: vi.fn() }))

import { showNotification } from '@/stores/notifications-store'
import { API_READ_DEADLINE_MS, API_UNREACHABLE_CHANNEL, API_WRITE_DEADLINE_MS, ApiDeadlineError, deadlineFor, fetchWithDeadline, resetApiUnreachableNoticeForTests, } from './api-fetch'

const URL = 'http://api.test/api/auth/me'

/**
 * A request nobody answers, as the held network had it: it settles only when
 * its signal aborts, and then rejects the way a browser's fetch does.
 */
function heldFetch() {
  return vi.fn(
    (_input: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      }),
  )
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

beforeEach(() => {
  vi.useFakeTimers()
  resetApiUnreachableNoticeForTests()
  vi.mocked(showNotification).mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('a request nobody answers', () => {
  it('gives up on a read at its eight-second deadline, and aborts it', async () => {
    const fetchMock = heldFetch()
    vi.stubGlobal('fetch', fetchMock)

    const read = track(fetchWithDeadline(URL))
    await vi.advanceTimersByTimeAsync(API_READ_DEADLINE_MS - 1)
    expect(read.settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    expect(read.error).toBeInstanceOf(ApiDeadlineError)
    const init = fetchMock.mock.calls[0]?.[1]
    expect(init?.signal?.aborted).toBe(true)
  })

  it('gives a write twenty seconds before it gives up', async () => {
    vi.stubGlobal('fetch', heldFetch())

    const write = track(
      fetchWithDeadline('http://api.test/api/sessionRecords', {
        method: 'POST',
        body: '{"score":1}',
      }),
    )
    await vi.advanceTimersByTimeAsync(API_WRITE_DEADLINE_MS - 1)
    expect(write.settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    expect(write.error).toBeInstanceOf(ApiDeadlineError)
  })

  // Older Android WebViews, where the native app runs this same code, have
  // neither of the newer AbortSignal helpers.
  it('keeps its deadline where AbortSignal has no timeout() and no any()', async () => {
    const signal = AbortSignal as unknown as Record<string, unknown>
    const timeout = signal.timeout
    const any = signal.any
    signal.timeout = undefined
    signal.any = undefined
    try {
      vi.stubGlobal('fetch', heldFetch())

      const read = track(fetchWithDeadline(URL))
      await vi.advanceTimersByTimeAsync(API_READ_DEADLINE_MS)

      expect(read.error).toBeInstanceOf(ApiDeadlineError)
    } finally {
      signal.timeout = timeout
      signal.any = any
    }
  })
})

describe('a request that ends before its deadline', () => {
  it('hands back the answer that came in time', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"user":{}}', { status: 200 })),
    )

    const res = await fetchWithDeadline(URL)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ user: {} })
  })

  it('passes a network failure on as the TypeError it is', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    const read = track(fetchWithDeadline(URL))
    await vi.advanceTimersByTimeAsync(0)

    expect(read.error).toBeInstanceOf(TypeError)
    expect(read.error).not.toBeInstanceOf(ApiDeadlineError)
  })

  it("stops when the caller's own signal aborts, and does not call that a deadline", async () => {
    vi.stubGlobal('fetch', heldFetch())
    const caller = new AbortController()

    const read = track(fetchWithDeadline(URL, { signal: caller.signal }))
    await vi.advanceTimersByTimeAsync(1000)
    caller.abort()
    await vi.advanceTimersByTimeAsync(0)

    expect((read.error as Error | undefined)?.name).toBe('AbortError')
    expect(read.error).not.toBeInstanceOf(ApiDeadlineError)
  })
})

describe('how long a request may take', () => {
  it('gives a read eight seconds and a small write twenty', () => {
    expect(deadlineFor()).toBe(8_000)
    expect(deadlineFor({ method: 'GET' })).toBe(8_000)
    expect(deadlineFor({ method: 'POST', body: '{"deviceId":"d"}' })).toBe(
      20_000,
    )
    expect(deadlineFor({ method: 'DELETE' })).toBe(20_000)
  })

  // The db-worker refuses a CRUD body over 256 KiB (MAX_WRITE_BYTES). At
  // 64 kbit/s, 8 bytes a millisecond, the largest one it takes needs 32.8 s.
  it('gives a large body the time it needs at 64 kbit/s', () => {
    const largest = 'x'.repeat(256 * 1024)

    expect(deadlineFor({ method: 'POST', body: largest })).toBe(32_768)
    expect(deadlineFor({ method: 'PATCH', body: new Blob([largest]) })).toBe(
      32_768,
    )
  })
})

describe('telling the singer', () => {
  it('says once per page load that the servers cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await fetchWithDeadline(URL).catch(() => undefined)
    vi.stubGlobal('fetch', heldFetch())
    const held = fetchWithDeadline(URL).catch(() => undefined)
    await vi.advanceTimersByTimeAsync(API_READ_DEADLINE_MS)
    await held

    expect(showNotification).toHaveBeenCalledOnce()
    expect(showNotification).toHaveBeenCalledWith(
      expect.stringContaining("Can't reach Mercury Pitch's servers"),
      'warning',
      expect.objectContaining({ channel: API_UNREACHABLE_CHANNEL }),
    )
  })

  it('says nothing when the server answers, even with an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 503 })),
    )

    await fetchWithDeadline(URL)

    expect(showNotification).not.toHaveBeenCalled()
  })

  it('says nothing when the caller cancels its own request', async () => {
    vi.stubGlobal('fetch', heldFetch())
    const caller = new AbortController()

    const read = fetchWithDeadline(URL, { signal: caller.signal }).catch(
      () => undefined,
    )
    caller.abort()
    await read

    expect(showNotification).not.toHaveBeenCalled()
  })
})
