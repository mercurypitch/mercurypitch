// Studio double tap tests — a second tap on the same target within 300 ms and 24 px is a double tap; a slower, farther or other-target tap is not; a third quick tap starts again; and a reset forgets the first tap.
import { describe, expect, it } from 'vitest'
import { createStudioDoubleTap } from './double-tap'

const tap = (time: number, x = 100, y = 40, target = 'clip-a') => ({
  target,
  x,
  y,
  time,
})

describe('createStudioDoubleTap', () => {
  it('counts a second tap on the same target, up to 300 ms and 24 px from the first, as a double tap', () => {
    const taps = createStudioDoubleTap()

    expect(taps.tap(tap(1000))).toBe(false)
    // 24 px away, straight down.
    expect(taps.tap(tap(1300, 100, 64))).toBe(true)
  })

  it('does not count a second tap that came more than 300 ms later', () => {
    const taps = createStudioDoubleTap()

    taps.tap(tap(1000))

    expect(taps.tap(tap(1301))).toBe(false)
  })

  it('does not count a second tap that landed more than 24 px away', () => {
    const taps = createStudioDoubleTap()

    taps.tap(tap(1000))

    expect(taps.tap(tap(1100, 125))).toBe(false)
  })

  it('does not count a tap on another target, and starts from it instead', () => {
    const taps = createStudioDoubleTap()

    taps.tap(tap(1000))

    expect(taps.tap(tap(1100, 100, 40, 'clip-b'))).toBe(false)
    expect(taps.tap(tap(1200, 100, 40, 'clip-b'))).toBe(true)
  })

  it('starts again after a double tap, so three quick taps open once', () => {
    const taps = createStudioDoubleTap()

    const results = [1000, 1100, 1200].map((time) => taps.tap(tap(time)))

    expect(results).toEqual([false, true, false])
  })

  it('forgets the first tap on a reset', () => {
    const taps = createStudioDoubleTap()

    taps.tap(tap(1000))
    taps.reset()

    expect(taps.tap(tap(1100))).toBe(false)
  })
})
