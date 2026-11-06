// Studio take clock — a take's playhead holds through its count-in, runs with the clock and loops a loop's range; it leads only where the song shows no frame of its own.
import { describe, expect, it } from 'vitest'
import type { StudioTakeClock } from './take-clock'
import { sameTakeClock, takeLeads, takePlayheadFrame } from './take-clock'

const RATE = 48_000
/** Song frame 96000 (2 s) leaves the graph at clock time 10 s: a count-in ends there. */
const plain: StudioTakeClock = {
  anchor: { frame: 2 * RATE, time: 10 },
  loop: null,
}

describe('takePlayheadFrame', () => {
  it('holds at the take’s first frame through the count-in, then runs at 48 kHz', () => {
    expect(takePlayheadFrame(plain, 8)).toBe(2 * RATE)
    expect(takePlayheadFrame(plain, 10)).toBe(2 * RATE)
    expect(takePlayheadFrame(plain, 13.5)).toBe(5.5 * RATE)
  })

  it('comes back to a loop’s start at its end, pass after pass', () => {
    const loop: StudioTakeClock = {
      anchor: { frame: RATE, time: 10 },
      loop: { startFrame: RATE, endFrame: 3 * RATE },
    }
    expect(takePlayheadFrame(loop, 11.5)).toBe(2.5 * RATE)
    // 5 s in: two passes of 2 s and a second of the third.
    expect(takePlayheadFrame(loop, 15)).toBe(2 * RATE)
  })
})

describe('takeLeads', () => {
  it('leads with no song playing, and past a playing song’s frame', () => {
    expect(takeLeads(plain, 5 * RATE, 0, false)).toBe(true)
    // The song stands at its 4 s end while its tail rings out.
    expect(takeLeads(plain, 5 * RATE, 4 * RATE, true)).toBe(true)
    expect(takeLeads(plain, 3 * RATE, 3 * RATE, true)).toBe(false)
  })

  it('leaves a loop take to a song that plays its range', () => {
    const loop = { ...plain, loop: { startFrame: 0, endFrame: RATE } }
    expect(takeLeads(loop, RATE - 1, 10, true)).toBe(false)
    expect(takeLeads(loop, RATE - 1, 10, false)).toBe(true)
  })
})

describe('sameTakeClock', () => {
  it('tells a new place from a new object for the same one', () => {
    const copy = { anchor: { ...plain.anchor }, loop: null }
    expect(sameTakeClock(plain, copy)).toBe(true)
    expect(
      sameTakeClock(plain, {
        ...copy,
        anchor: { frame: 2 * RATE, time: 10.1 },
      }),
    ).toBe(false)
    expect(
      sameTakeClock(plain, { ...copy, loop: { startFrame: 0, endFrame: 1 } }),
    ).toBe(false)
    expect(sameTakeClock(plain, null)).toBe(false)
    expect(sameTakeClock(null, null)).toBe(true)
  })
})
