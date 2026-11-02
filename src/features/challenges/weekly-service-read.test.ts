// ============================================================
// readActiveWeekly — the running Legend, or why there is none
// ============================================================
//
// getActiveWeekly answers null for a server with nothing running and for no
// answer alike. The native Legend room says those two differently ("No
// Legend is open right now" against "Could not load the Legend"), so it
// reads through this, and the web keeps its null.
//
// The archive is read with the session, so the worker can withhold the
// names of the singers in a block with the reader (REQ-RB-014).

import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/defaults', () => ({ API_BASE_URL: 'http://api.test' }))
vi.mock('@/db/services/user-service', () => ({
  getAuthHeaders: () => ({ Authorization: 'Bearer reader-token' }),
}))

import { getActiveWeekly, getWeeklyArchive, readActiveWeekly, } from './weekly-service'

function answer(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readActiveWeekly', () => {
  it('gives the running Legend', async () => {
    answer(200, { challenge: { id: 'legend-1', title: 'Vincero' } })
    expect(await readActiveWeekly()).toMatchObject({
      status: 'ok',
      challenge: { id: 'legend-1' },
    })
  })

  it('says nothing is running, apart from no answer', async () => {
    answer(200, { challenge: null })
    expect(await readActiveWeekly()).toEqual({ status: 'ok', challenge: null })
    answer(503, { error: 'Unavailable' })
    expect(await readActiveWeekly()).toEqual({ status: 'unreachable' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    expect(await readActiveWeekly()).toEqual({ status: 'unreachable' })
  })

  it('leaves the web its null for both', async () => {
    answer(200, { challenge: null })
    expect(await getActiveWeekly()).toBeNull()
    answer(503, { error: 'Unavailable' })
    expect(await getActiveWeekly()).toBeNull()
  })
})

describe('getWeeklyArchive', () => {
  it('reads the closed Legends with the reader’s session', async () => {
    answer(200, { archive: [{ id: 'legend-0', title: 'Vincero' }] })

    expect(await getWeeklyArchive()).toEqual([
      { id: 'legend-0', title: 'Vincero' },
    ])
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('http://api.test/api/weekly/archive')
    expect(init?.headers).toEqual({ Authorization: 'Bearer reader-token' })
  })
})
