// Studio note roll end tests — the roll shows two of the song's bars past the clip's end; a drag puts the end on the nearest grid line, a line past the window's start at the least and as far as it may go at the most, on any whole tick with Snap off; and an end is said as a bar, a beat, or after a beat.
import { describe, expect, it } from 'vitest'
import { rollEndTick, rollEndWords, studioRollRange } from './roll-end'

/** Bars of 3840 ticks, the song's first on tick -1920 of the sequence. */
const METER = { beatTicks: 960, beatsPerBar: 4, originTick: -1920 }
/** Sixteenths through the song's bar lines. */
const GRID = { ticks: 240, offset: -1920 }

describe('the roll past the clip’s end', () => {
  it('shows two bars past the end, from the window’s start', () => {
    // Act
    const range = studioRollRange({ startTick: 960, endTick: 7680 }, METER)

    // Assert
    expect(range).toEqual({ startTick: 960, endTick: 7680 + 7680 })
  })

  it('shows two bars past a drafted end instead', () => {
    // Act
    const range = studioRollRange(
      { startTick: 960, endTick: 7680 },
      METER,
      3000,
    )

    // Assert
    expect(range).toEqual({ startTick: 960, endTick: 3000 + 7680 })
  })
})

describe('where a drag puts the end', () => {
  it('lands on the nearest line of the grid', () => {
    // Act, Assert: 5000 is nearer 5040 than 4800.
    expect(rollEndTick(5000, GRID, 960, 100_000)).toBe(5040)
    expect(rollEndTick(4900, GRID, 960, 100_000)).toBe(4800)
  })

  it('stays a line past the window’s start, and no further than it may go', () => {
    // Act, Assert: the first line past 960 is 1200.
    expect(rollEndTick(-5000, GRID, 960, 100_000)).toBe(1200)
    expect(rollEndTick(200_000, GRID, 960, 100_000)).toBe(100_000)
  })

  it('lands on any whole tick with Snap off, a tick past the start at the least', () => {
    // Act, Assert
    expect(rollEndTick(5000.4, null, 960, 100_000)).toBe(5000)
    expect(rollEndTick(0, null, 960, 100_000)).toBe(961)
  })
})

describe('an end, said', () => {
  it('names a bar line, a beat, and a place after a beat', () => {
    // Act, Assert: bar 3 starts on tick 5760.
    expect(rollEndWords(5760, METER)).toBe('bar 3')
    expect(rollEndWords(5760 + 1920, METER)).toBe('bar 3, beat 3')
    expect(rollEndWords(5760 + 2160, METER)).toBe('bar 3, after beat 3')
  })
})
