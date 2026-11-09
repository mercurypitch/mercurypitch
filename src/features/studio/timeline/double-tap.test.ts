// Studio double tap tests — a second tap on the same target within 300 ms and 24 px is a double tap; a slower, farther or other-target tap is not; a third quick tap starts again; and a reset forgets the first tap.
import { describe, expect, it } from 'vitest'
import { createStudioDoubleTap, STUDIO_DOUBLE_TAP_MS, STUDIO_DOUBLE_TAP_PX, } from './double-tap'

const tap = (time: number, x = 100, y = 40, target = 'clip-a') => ({
  target,
  x,
  y,
  time,
})

describe('createStudioDoubleTap', () => {
  it('counts a second tap on the same target, soon and near the first, as a double tap', () => {
    const taps = createStudioDoubleTap()

    expect(taps.tap(tap(1000))).toBe(false)
    expect(taps.tap(tap(1000 + STUDIO_DOUBLE_TAP_MS, 110, 50))).toBe(true)
  })

  it('does not count a second tap that came too late', () => {
    const taps = createStudioDoubleTap()

    taps.tap(tap(1000))

    expect(taps.tap(tap(1001 + STUDIO_DOUBLE_TAP_MS))).toBe(false)
  })

  it('does not count a second tap that landed too far away', () => {
    const taps = createStudioDoubleTap()

    taps.tap(tap(1000))

    expect(taps.tap(tap(1100, 100 + STUDIO_DOUBLE_TAP_PX + 1))).toBe(false)
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
