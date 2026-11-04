// ============================================================
// Lyrics lookups — a failed request leaves no timer and no listener behind
// ============================================================
//
// Each LRCLIB request runs under a 25-second timeout tied to the caller's
// abort signal. The timeout was cleared only after a fetch that answered, so
// a fetch that rejected (offline, a refused connection) left its timer
// running for the full 25 s, and every request left a listener on the
// caller's signal. Offline, one search tries up to four queries, and each
// left both behind.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { searchLyrics, searchLyricsMulti } from './lyrics-service'

/** The listeners each lookup adds to and takes off the caller's signal. */
function countListeners(signal: AbortSignal) {
  const counts = { added: 0, removed: 0 }
  const add = signal.addEventListener.bind(signal)
  const remove = signal.removeEventListener.bind(signal)
  vi.spyOn(signal, 'addEventListener').mockImplementation((...args) => {
    counts.added += 1
    add(...args)
  })
  vi.spyOn(signal, 'removeEventListener').mockImplementation((...args) => {
    counts.removed += 1
    remove(...args)
  })
  return counts
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')))
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('lyrics lookups while offline', () => {
  it('leave no timeout running once a search has failed', async () => {
    const controller = new AbortController()
    const listeners = countListeners(controller.signal)

    const matches = await searchLyricsMulti(
      'Artist - Song (Live)',
      controller.signal,
    )

    expect(matches).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
    expect(listeners.added).toBeGreaterThan(1)
    expect(listeners.removed).toBe(listeners.added)
  })

  it('leave nothing behind from the strict lookup either', async () => {
    const controller = new AbortController()
    const listeners = countListeners(controller.signal)

    const result = await searchLyrics('Artist - Song', controller.signal)

    expect(result).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    expect(listeners.removed).toBe(listeners.added)
  })
})
