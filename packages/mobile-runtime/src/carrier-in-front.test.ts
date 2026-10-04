// ============================================================
// The carrier in front: played again while it plays, never paused
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InFrontHost } from './carrier-in-front'
import { keepInFront } from './carrier-in-front'

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

  it('leaves one that does not play alone', () => {
    plays = false
    const front = keepInFront(host)

    front.now()
    front.follow()
    vi.advanceTimersByTime(5000)

    expect(element.play).not.toHaveBeenCalled()
  })

  it('plays it again once a second, until a beat finds it not playing', () => {
    const front = keepInFront(host)
    front.follow()
    vi.advanceTimersByTime(3000)
    expect(element.play).toHaveBeenCalledTimes(3)

    plays = false
    vi.advanceTimersByTime(1000)
    plays = true
    vi.advanceTimersByTime(3000)

    // The beat ended; the next report or the page turning starts it again.
    expect(element.play).toHaveBeenCalledTimes(3)
  })

  it('beats once a second however often it is followed', () => {
    const front = keepInFront(host)

    front.follow()
    front.follow()
    front.follow()
    vi.advanceTimersByTime(1000)

    expect(element.play).toHaveBeenCalledTimes(1)
  })

  it('stops when asked', () => {
    const front = keepInFront(host)
    front.follow()

    front.stop()
    vi.advanceTimersByTime(3000)

    expect(element.play).not.toHaveBeenCalled()
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
    expect(element.play).toHaveBeenCalledTimes(2)
  })
})
