// ============================================================
// The public boards' read that tells a failure from an empty board
// ============================================================
//
// The phone's Community (slice 4c) says "Could not load Community" with Try
// again when the boards cannot be read, and "Nothing shared yet" when they
// are empty. The web's quiet reads answer both with an empty list, because
// the cloud repository swallows a failed read unless it is asked not to.
// Against the real ServerAdapter, with the worker a stand-in at fetch.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { ServerAdapter } = await import('@/db/adapters/server-adapter')
  const server = new ServerAdapter({ baseUrl: 'http://api.test' })
  return { getDb: async () => server }
})

import { loadSharedMelodies, loadSharedSessions, readSharedMelodies, readSharedSessions, } from './share-service'

const refused = () =>
  Promise.resolve({
    ok: false,
    status: 400,
    statusText: 'Bad Request',
    text: async () => 'Invalid query',
  })

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('reading the public boards for a screen that says when it failed', () => {
  it('rejects a board the worker refused, where the quiet read answers empty', async () => {
    vi.stubGlobal('fetch', vi.fn(refused))

    await expect(readSharedMelodies()).rejects.toThrow(/400/u)
    await expect(readSharedSessions()).rejects.toThrow(/400/u)
    expect(await loadSharedMelodies()).toEqual([])
    expect(await loadSharedSessions()).toEqual([])
  })

  it('rejects a board that never answered, once the retries are spent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    const read = readSharedSessions()
    const settled = expect(read).rejects.toThrow('Failed to fetch')
    await vi.advanceTimersByTimeAsync(2000)
    await settled
  })

  it('answers an empty board as empty, newest first, public rows only', async () => {
    const fetchMock = vi.fn(async (_url: string) =>
      Promise.resolve({ ok: true, status: 200, json: async () => [] }),
    )
    vi.stubGlobal('fetch', fetchMock)

    expect(await readSharedMelodies()).toEqual([])
    const asked = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(asked.pathname).toBe('/api/sharedMelodies')
    expect(asked.searchParams.get('where[isPublic]')).toBe('true')
    expect(asked.searchParams.get('orderDir')).toBe('desc')
  })
})
