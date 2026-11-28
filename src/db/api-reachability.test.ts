// ============================================================
// While the API is out of reach, a call to it fails at once
// ============================================================
//
// The bug this exists for: once the API host stopped answering, every call
// still found that out for itself. A read waited its 8 s deadline, and a
// cloud write asked /api/auth/me for 8 s and then waited 20 s of its own.
// These drive the gate through fetchWithDeadline, as every caller does; only
// fetch is faked, at the network edge.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/stores/notifications-store', () => ({ showNotification: vi.fn() }))

import { showNotification } from '@/stores/notifications-store'
import { API_READ_DEADLINE_MS, ApiDeadlineError, ApiUnreachableError, fetchWithDeadline, resetApiUnreachableNoticeForTests, } from './api-fetch'
import { API_UNREACHABLE_FIRST_WINDOW_MS, API_UNREACHABLE_LONGEST_WINDOW_MS, resetApiReachabilityForTests, } from './api-reachability'

const API = 'http://api.test'
const ME = `${API}/api/auth/me`

type Reply = 'hold' | 'refuse' | number

/**
 * The API at the network edge. Each request is answered by `reply`: 'hold'
 * never answers until its signal aborts, 'refuse' is the TypeError a network
 * error gives, and a number is that HTTP status.
 */
function network(reply: (url: string) => Reply) {
  const sent: string[] = []
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    sent.push(url)
    const answer = reply(url)
    if (answer === 'hold') {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    }
    if (answer === 'refuse')
      return Promise.reject(new TypeError('Failed to fetch'))
    return Promise.resolve(new Response('{}', { status: answer }))
  })
  vi.stubGlobal('fetch', fetchMock)
  return { sent }
}

/** Where a call stands once the timers have been advanced. */
function track(promise: Promise<Response>) {
  const state: { settled: boolean; status?: number; error?: unknown } = {
    settled: false,
  }
  promise.then(
    (res) => {
      state.settled = true
      state.status = res.status
    },
    (error: unknown) => {
      state.settled = true
      state.error = error
    },
  )
  return state
}

/** A read that ran out of time, which closes the window. */
async function holdOneRead(): Promise<void> {
  const read = track(fetchWithDeadline(ME))
  await vi.advanceTimersByTimeAsync(API_READ_DEADLINE_MS)
  expect(read.error).toBeInstanceOf(ApiDeadlineError)
}

beforeEach(() => {
  vi.useFakeTimers()
  resetApiReachabilityForTests()
  resetApiUnreachableNoticeForTests()
  vi.mocked(showNotification).mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('after a call to the API gets no answer', () => {
  it('refuses the next call at once and sends nothing', async () => {
    const net = network(() => 'hold')
    await holdOneRead()

    const next = track(
      fetchWithDeadline(`${API}/api/sessionRecords`, {
        method: 'POST',
        body: '{"score":1}',
      }),
    )
    await vi.advanceTimersByTimeAsync(0)

    expect(next.error).toBeInstanceOf(ApiUnreachableError)
    expect(net.sent).toHaveLength(1)
  })

  it('refuses at once after a network error as well as after a deadline', async () => {
    const net = network(() => 'refuse')
    await expect(fetchWithDeadline(ME)).rejects.toBeInstanceOf(TypeError)

    const next = track(fetchWithDeadline(`${API}/api/weekly/active`))
    await vi.advanceTimersByTimeAsync(0)

    expect(next.error).toBeInstanceOf(ApiUnreachableError)
    expect(net.sent).toHaveLength(1)
  })

  it('names the address without its query, which can carry a code', async () => {
    network(() => 'refuse')
    await fetchWithDeadline(ME).catch(() => undefined)

    const error = await fetchWithDeadline(
      `${API}/api/auth/reset-password?token=secret-123`,
    ).catch((e: unknown) => e)

    expect((error as Error).message).not.toContain('secret-123')
    expect((error as ApiUnreachableError).url).toBe(
      `${API}/api/auth/reset-password`,
    )
  })

  it('tells the singer once, not again for every call it refuses', async () => {
    network(() => 'hold')
    await holdOneRead()

    for (let i = 0; i < 3; i++)
      await fetchWithDeadline(ME).catch(() => undefined)

    expect(showNotification).toHaveBeenCalledOnce()
  })
})

describe('the probe at the end of the window', () => {
  it('lets exactly one call through, and refuses the rest while it is out', async () => {
    const net = network(() => 'hold')
    await holdOneRead()
    await vi.advanceTimersByTimeAsync(API_UNREACHABLE_FIRST_WINDOW_MS)

    const probe = track(fetchWithDeadline(ME))
    const second = track(fetchWithDeadline(`${API}/api/weekly/active`))
    await vi.advanceTimersByTimeAsync(0)

    expect(probe.settled).toBe(false)
    expect(second.error).toBeInstanceOf(ApiUnreachableError)
    expect(net.sent).toEqual([ME, ME])
  })

  it('opens the API to every call when the probe gets an answer, even an error status', async () => {
    let reply: Reply = 'hold'
    const net = network(() => reply)
    await holdOneRead()
    await vi.advanceTimersByTimeAsync(API_UNREACHABLE_FIRST_WINDOW_MS)
    reply = 503

    const probe = await fetchWithDeadline(ME)
    const after = await Promise.all([
      fetchWithDeadline(`${API}/api/weekly/active`),
      fetchWithDeadline(`${API}/api/leagues`),
    ])

    expect(probe.status).toBe(503)
    expect(after.map((r) => r.status)).toEqual([503, 503])
    expect(net.sent).toHaveLength(4)
  })

  it('doubles the window after each probe that gets no answer, up to five minutes', async () => {
    const net = network(() => 'hold')
    await holdOneRead()
    // Each window runs from the moment the call before it gave up.
    const windows = [30_000, 60_000, 120_000, 240_000, 300_000, 300_000]
    expect(windows[0]).toBe(API_UNREACHABLE_FIRST_WINDOW_MS)
    expect(windows.at(-1)).toBe(API_UNREACHABLE_LONGEST_WINDOW_MS)

    for (const windowMs of windows) {
      await vi.advanceTimersByTimeAsync(windowMs - 1)
      const early = track(fetchWithDeadline(ME))
      await vi.advanceTimersByTimeAsync(0)
      expect(early.error).toBeInstanceOf(ApiUnreachableError)
      await vi.advanceTimersByTimeAsync(1)
      const sentBefore = net.sent.length
      const probe = track(fetchWithDeadline(ME))
      await vi.advanceTimersByTimeAsync(API_READ_DEADLINE_MS)
      expect(probe.error).toBeInstanceOf(ApiDeadlineError)
      expect(net.sent.length).toBe(sentBefore + 1)
    }
  })
})

describe('what clears it', () => {
  it('clears at once when the browser says it is back online', async () => {
    const net = network(() => 'hold')
    await holdOneRead()

    window.dispatchEvent(new Event('online'))
    const calls = [track(fetchWithDeadline(ME)), track(fetchWithDeadline(ME))]
    await vi.advanceTimersByTimeAsync(0)

    expect(calls.every((c) => !c.settled)).toBe(true)
    expect(net.sent).toHaveLength(3)
  })

  it('clears when the tab comes back after the window has ended', async () => {
    const net = network(() => 'hold')
    await holdOneRead()
    await vi.advanceTimersByTimeAsync(API_UNREACHABLE_FIRST_WINDOW_MS)

    showTab()
    const calls = [track(fetchWithDeadline(ME)), track(fetchWithDeadline(ME))]
    await vi.advanceTimersByTimeAsync(0)

    expect(calls.every((c) => !c.settled)).toBe(true)
    expect(net.sent).toHaveLength(3)
  })

  it('stays closed when the tab comes back inside the window', async () => {
    network(() => 'hold')
    await holdOneRead()

    showTab()
    const next = track(fetchWithDeadline(ME))
    await vi.advanceTimersByTimeAsync(0)

    expect(next.error).toBeInstanceOf(ApiUnreachableError)
  })

  it('clears when a request that was already out gets its answer', async () => {
    let reply: Reply = 'hold'
    const answers: Array<(r: Response) => void> = []
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        if (reply !== 'hold') return Promise.resolve(new Response('{}'))
        return new Promise<Response>((resolve, reject) => {
          answers.push(resolve)
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        })
      }),
    )
    const slowWrite = track(
      fetchWithDeadline(`${API}/api/sessionRecords`, { method: 'POST' }),
    )
    await holdOneRead()

    answers[0]?.(new Response('{}', { status: 201 }))
    await vi.advanceTimersByTimeAsync(0)
    reply = 200
    const next = track(fetchWithDeadline(ME))
    await vi.advanceTimersByTimeAsync(0)

    expect(slowWrite.status).toBe(201)
    expect(next.status).toBe(200)
  })
})

describe('what does not close it', () => {
  it('stays open when the server answers with an error status', async () => {
    const net = network(() => 500)
    await fetchWithDeadline(ME)
    await fetchWithDeadline(`${API}/api/weekly/active`)

    const next = await fetchWithDeadline(ME)

    expect(next.status).toBe(500)
    expect(net.sent).toHaveLength(3)
  })

  it('stays open when the caller cancels its own request', async () => {
    const net = network(() => 'hold')
    const caller = new AbortController()
    const cancelled = track(fetchWithDeadline(ME, { signal: caller.signal }))
    caller.abort()
    await vi.advanceTimersByTimeAsync(0)
    expect((cancelled.error as Error).name).toBe('AbortError')

    const next = track(fetchWithDeadline(ME))
    await vi.advanceTimersByTimeAsync(0)

    expect(next.settled).toBe(false)
    expect(net.sent).toHaveLength(2)
    expect(showNotification).not.toHaveBeenCalled()
  })

  it('lets the next call probe when the caller cancels the probe', async () => {
    const net = network(() => 'hold')
    await holdOneRead()
    await vi.advanceTimersByTimeAsync(API_UNREACHABLE_FIRST_WINDOW_MS)
    const caller = new AbortController()
    void fetchWithDeadline(ME, { signal: caller.signal }).catch(() => undefined)
    caller.abort()
    await vi.advanceTimersByTimeAsync(0)

    const next = track(fetchWithDeadline(ME))
    await vi.advanceTimersByTimeAsync(0)

    expect(next.settled).toBe(false)
    expect(net.sent).toHaveLength(3)
  })

  it('does not count a failure sent before the API last answered', async () => {
    let reply: Reply = 'hold'
    const net = network(() => reply)
    const old = track(fetchWithDeadline(ME))
    reply = 200
    await fetchWithDeadline(`${API}/api/weekly/active`)

    await vi.advanceTimersByTimeAsync(API_READ_DEADLINE_MS)
    expect(old.error).toBeInstanceOf(ApiDeadlineError)
    const next = await fetchWithDeadline(ME)

    expect(next.status).toBe(200)
    expect(net.sent).toHaveLength(3)
  })
})

describe('a call a person asked for', () => {
  it('goes out inside the window as a probe', async () => {
    const net = network(() => 'hold')
    await holdOneRead()

    const retry = track(
      fetchWithDeadline(`${API}/api/weekly/active`, undefined, {
        userAction: true,
      }),
    )
    await vi.advanceTimersByTimeAsync(0)

    expect(retry.settled).toBe(false)
    expect(net.sent).toHaveLength(2)
  })

  it('opens the API to every call when its answer comes', async () => {
    let reply: Reply = 'hold'
    const net = network(() => reply)
    await holdOneRead()
    reply = 200

    await fetchWithDeadline(
      `${API}/api/auth/login`,
      { method: 'POST' },
      {
        userAction: true,
      },
    )
    const next = await fetchWithDeadline(ME)

    expect(next.status).toBe(200)
    expect(net.sent).toHaveLength(3)
  })
})

describe('a press that sends several requests at once', () => {
  // A Try again can read a whole screen, a sign-out flushes as it goes. When
  // none of them gets an answer, that is one probe that failed: the window
  // doubles once, not once for each request.
  it('doubles the window once when none of them gets an answer', async () => {
    const net = network(() => 'hold')
    await holdOneRead()
    const press = [1, 2, 3].map(() =>
      track(fetchWithDeadline(ME, undefined, { userAction: true })),
    )
    await vi.advanceTimersByTimeAsync(API_READ_DEADLINE_MS)
    expect(press.every((call) => call.error instanceof ApiDeadlineError)).toBe(
      true,
    )

    // Doubled once: 60 s from when they gave up, not 240 s.
    await vi.advanceTimersByTimeAsync(2 * API_UNREACHABLE_FIRST_WINDOW_MS - 1)
    const early = track(fetchWithDeadline(ME))
    await vi.advanceTimersByTimeAsync(0)
    expect(early.error).toBeInstanceOf(ApiUnreachableError)
    await vi.advanceTimersByTimeAsync(1)
    const sentBefore = net.sent.length
    const probe = track(fetchWithDeadline(ME))
    await vi.advanceTimersByTimeAsync(0)
    expect(probe.settled).toBe(false)
    expect(net.sent).toHaveLength(sentBefore + 1)
  })

  it('still doubles again for the next press that goes unanswered', async () => {
    network(() => 'hold')
    await holdOneRead()
    for (let press = 0; press < 2; press++) {
      const call = track(fetchWithDeadline(ME, undefined, { userAction: true }))
      await vi.advanceTimersByTimeAsync(API_READ_DEADLINE_MS)
      expect(call.error).toBeInstanceOf(ApiDeadlineError)
    }

    // 30 s, doubled by each press: 120 s from when the second gave up.
    await vi.advanceTimersByTimeAsync(4 * API_UNREACHABLE_FIRST_WINDOW_MS - 1)
    const early = track(fetchWithDeadline(ME))
    await vi.advanceTimersByTimeAsync(0)
    expect(early.error).toBeInstanceOf(ApiUnreachableError)
  })
})

describe('a retry of a call already let through', () => {
  it('is sent even though the attempt before it closed the window', async () => {
    const net = network(() => 'refuse')
    await fetchWithDeadline(ME).catch(() => undefined)

    const retry = fetchWithDeadline(ME, undefined, { retry: true })

    await expect(retry).rejects.toBeInstanceOf(TypeError)
    expect(net.sent).toHaveLength(2)
  })
})

describe('a call to the site worker', () => {
  it('is never refused, and its failure leaves the API alone and unannounced', async () => {
    const net = network((url) => (url.startsWith('/api/uvr') ? 'refuse' : 200))
    await fetchWithDeadline('/api/uvr/health', undefined, {
      siteWorker: true,
    }).catch(() => undefined)

    const again = fetchWithDeadline('/api/uvr/health', undefined, {
      siteWorker: true,
    })
    await expect(again).rejects.toBeInstanceOf(TypeError)
    const api = await fetchWithDeadline(ME)

    expect(api.status).toBe(200)
    expect(net.sent).toHaveLength(3)
    expect(showNotification).not.toHaveBeenCalled()
  })

  it('is not refused while the API is out of reach', async () => {
    let reply: Reply = 'hold'
    network(() => reply)
    await holdOneRead()
    reply = 200

    const site = await fetchWithDeadline('/api/share/shorten', undefined, {
      siteWorker: true,
    })

    expect(site.status).toBe(200)
  })
})

/** The tab comes back into view, as it does after a phone was unlocked. */
function showTab(): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  })
  document.dispatchEvent(new Event('visibilitychange'))
}
