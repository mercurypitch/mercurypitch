// Studio scrub step tests — a notch goes to the next grid line while Snap is on, a second without it, and Shift goes finer.
import { afterEach, describe, expect, it } from 'vitest'
import { publishStudioScrubGrid, studioScrubFrame, studioScrubGrid, } from './scrub-step'

const RATE = 48_000

afterEach(() => publishStudioScrubGrid(null))

describe('studioScrubFrame', () => {
  it('steps a second, or a tenth with Shift, when Snap is off or no timeline says otherwise', () => {
    const off = { snap: false, pixelsPerSecond: 40 }
    expect(studioScrubFrame(1.37 * RATE, 1, off, false)).toBe(2.37 * RATE)
    expect(studioScrubFrame(1.37 * RATE, -1, null, true)).toBe(1.27 * RATE)
    expect(studioScrubFrame(0.5 * RATE, -1, off, false)).toBe(0)
  })

  it('goes to the next grid line and back to the one before while Snap is on', () => {
    // 40 px/s draws a line every second.
    const grid = { snap: true, pixelsPerSecond: 40 }
    expect(studioScrubFrame(1.37 * RATE, 1, grid, false)).toBe(2 * RATE)
    expect(studioScrubFrame(1.37 * RATE, -1, grid, false)).toBe(1 * RATE)
    expect(studioScrubFrame(2 * RATE, 1, grid, false)).toBe(3 * RATE)
    expect(studioScrubFrame(2 * RATE, -1, grid, false)).toBe(1 * RATE)
  })

  it('goes to the grid ten times closer with Shift', () => {
    const grid = { snap: true, pixelsPerSecond: 40 }
    expect(studioScrubFrame(1.37 * RATE, 1, grid, true)).toBe(1.4 * RATE)
    expect(studioScrubFrame(1.37 * RATE, -1, grid, true)).toBe(1.3 * RATE)
  })

  it('lands on whole beats of a tempo whose beat is not a whole number of frames', () => {
    // 97 bpm: a beat is 29690.72 frames, and 40 px/s draws a line on each.
    const grid = { snap: true, pixelsPerSecond: 40, tempoBpm: 97 }
    const beat = (60 * RATE) / 97
    // The playhead stands on beat 3, rounded down to a whole frame.
    const onLine = Math.floor(3 * beat)
    expect(studioScrubFrame(onLine, 1, grid, false)).toBe(Math.round(4 * beat))
    expect(studioScrubFrame(onLine, -1, grid, false)).toBe(Math.round(2 * beat))
  })
})

describe('the published grid', () => {
  it('is what the timeline last said, and nothing once it is gone', () => {
    expect(studioScrubGrid()).toBeNull()
    publishStudioScrubGrid({ snap: true, pixelsPerSecond: 80 })
    expect(studioScrubGrid()).toEqual({ snap: true, pixelsPerSecond: 80 })
    publishStudioScrubGrid(null)
    expect(studioScrubGrid()).toBeNull()
  })
})
