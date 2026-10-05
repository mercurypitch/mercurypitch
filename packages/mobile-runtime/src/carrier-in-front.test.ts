// ============================================================
// The carrier in front: played again at our own moments, never on a timer,
// never paused
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InFrontHost } from './carrier-in-front'
import { keepInFront, ONCE_MORE_MS } from './carrier-in-front'

let plays = true
const element = { play: vi.fn(async (): Promise<void> => undefined) }
const host: InFrontHost = {
  playingCarrier: () => (plays ? element : null),
}

beforeEach(() => {
  vi.useFakeTimers()
  plays = true
  element.play.mockReset()
  element.play.mockImplementation(async () => undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('keeping the carrier in front', () => {
  it('plays a carrier that plays, at once', () => {
    keepInFront(host).now()

    expect(element.play).toHaveBeenCalledTimes(1)
  })

  it('plays it once more a moment later, for a clock that starts with the moment', () => {
    keepInFront(host).now()

    vi.advanceTimersByTime(ONCE_MORE_MS)

    expect(element.play).toHaveBeenCalledTimes(2)
  })

  it('never plays it again on its own after that', () => {
    // Build 546 played it once a second, and one play landed just after
    // YouTube took the sound: WebKit took it back, and YouTube stopped.
    keepInFront(host).now()

    vi.advanceTimersByTime(60_000)

    expect(element.play).toHaveBeenCalledTimes(2)
  })

  it('gives moments close together one once more, after the last', () => {
    const front = keepInFront(host)

    front.now()
    vi.advanceTimersByTime(ONCE_MORE_MS - 50)
    front.now()
    vi.advanceTimersByTime(ONCE_MORE_MS - 50)
    expect(element.play).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(50)
    expect(element.play).toHaveBeenCalledTimes(3)
  })

  it('leaves one that does not play alone, then and a moment later', () => {
    plays = false
    keepInFront(host).now()

    vi.advanceTimersByTime(ONCE_MORE_MS)

    expect(element.play).not.toHaveBeenCalled()
  })

  it('leaves one that stopped playing alone a moment later', () => {
    keepInFront(host).now()
    plays = false

    vi.advanceTimersByTime(ONCE_MORE_MS)

    expect(element.play).toHaveBeenCalledTimes(1)
  })

  it('forgets the once more when asked', () => {
    const front = keepInFront(host)
    front.now()

    front.stop()
    vi.advanceTimersByTime(ONCE_MORE_MS)

    expect(element.play).toHaveBeenCalledTimes(1)
  })

  it('shrugs off a play WebKit refuses, at once or later', async () => {
    element.play.mockImplementationOnce(() => {
      throw new Error('NotAllowedError')
    })
    element.play.mockImplementationOnce(async () => {
      throw new Error('AbortError')
    })
    const front = keepInFront(host)

    expect(() => {
      front.now()
      front.now()
    }).not.toThrow()
    // A rejection left unheard would fail the run.
    await vi.runAllTimersAsync()
    expect(element.play).toHaveBeenCalledTimes(3)
  })
})
