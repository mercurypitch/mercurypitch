// ============================================================
// The hidden clock: a song behind another app still ends
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHiddenClock, HIDDEN_TICK_MS } from './hidden-clock'

function setPageHidden(hidden: boolean): void {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(
    hidden ? 'hidden' : 'visible',
  )
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the hidden clock', () => {
  it('stays quiet while the page is in front, where the frames are', () => {
    const tick = vi.fn()
    const stop = createHiddenClock(() => true, tick)

    vi.advanceTimersByTime(HIDDEN_TICK_MS * 5)

    expect(tick).not.toHaveBeenCalled()
    stop()
  })

  it('ticks about once a second behind another app, and stops on the way back', () => {
    const tick = vi.fn()
    const stop = createHiddenClock(() => true, tick)

    setPageHidden(true)
    vi.advanceTimersByTime(HIDDEN_TICK_MS * 3)
    expect(tick).toHaveBeenCalledTimes(3)

    setPageHidden(false)
    vi.advanceTimersByTime(HIDDEN_TICK_MS * 3)
    expect(tick).toHaveBeenCalledTimes(3)
    stop()
  })

  it('does not tick for a song that is not playing', () => {
    const tick = vi.fn()
    let playing = false
    const stop = createHiddenClock(() => playing, tick)
    setPageHidden(true)

    vi.advanceTimersByTime(HIDDEN_TICK_MS * 2)
    expect(tick).not.toHaveBeenCalled()

    playing = true
    vi.advanceTimersByTime(HIDDEN_TICK_MS)
    expect(tick).toHaveBeenCalledTimes(1)
    stop()
  })

  it('starts one timer however often the page says it is hidden', () => {
    const tick = vi.fn()
    const stop = createHiddenClock(() => true, tick)

    setPageHidden(true)
    setPageHidden(true)
    vi.advanceTimersByTime(HIDDEN_TICK_MS)

    expect(tick).toHaveBeenCalledTimes(1)
    stop()
  })

  it('stops for good when the mixer goes', () => {
    const tick = vi.fn()
    const stop = createHiddenClock(() => true, tick)
    setPageHidden(true)

    stop()
    vi.advanceTimersByTime(HIDDEN_TICK_MS * 3)
    setPageHidden(true)
    vi.advanceTimersByTime(HIDDEN_TICK_MS * 3)

    expect(tick).not.toHaveBeenCalled()
  })
})
