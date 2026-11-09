// Studio MIDI roll rows tests — the pitch under a point holds when the rows sit on fractions of a semitone; rows pan and zoom on the keyboard, a zoom keeping the pitch under its anchor, and a row's height inside its limits; a touch roll opens with rows tall enough for a finger; and the window's notes are worked out once per sequence.
import { describe, expect, it } from 'vitest'
import type { RollViewport } from '@/lib/roll-geometry'
import { yToMidi } from '@/lib/roll-geometry'
import type { StudioNote } from '../model/types'
import { fitStudioRollRows, panStudioRollRows, studioRollPitchAt, studioRollRowOf, studioRollYOf, studioWindowRollNotes, zoomStudioRollRows, } from './roll-rows'

/** Two octaves from C3 to B4 in 480 px: 24 rows of 20 px. */
const VIEW: RollViewport = {
  start: 0,
  end: 3840,
  minMidi: 48,
  maxMidi: 71,
  width: 960,
  height: 480,
}

const LIMITS = { minRowHeight: 14, maxRowHeight: 48 }

const rowsOf = (viewport: RollViewport) =>
  viewport.maxMidi - viewport.minMidi + 1

describe('the pitch under a point', () => {
  it('reads row 60 between 220 and 240 px down a roll whose top row is 71', () => {
    expect(
      [219, 220, 230, 239.9].map((y) =>
        studioRollRowOf(studioRollPitchAt(y, VIEW)),
      ),
    ).toEqual([61, 60, 60, 60])
  })

  it('holds when the rows sit half a semitone off, where yToMidi does not', () => {
    // Arrange: panned up half a row, so row 71 straddles the top edge.
    const half = { ...VIEW, minMidi: 47.5, maxMidi: 70.5 }

    // Act
    const row = studioRollRowOf(studioRollPitchAt(5, half))

    // Assert
    expect(row).toBe(71)
    expect(yToMidi(5, half)).toBe(70.5)
  })

  it('stands a pitch where it reads it back', () => {
    expect(studioRollPitchAt(studioRollYOf(60.25, VIEW), VIEW)).toBeCloseTo(
      60.25,
      9,
    )
  })

  it('keeps the row on the keyboard', () => {
    expect([studioRollRowOf(-3), studioRollRowOf(140)]).toEqual([0, 127])
  })
})

describe('panStudioRollRows', () => {
  it('slides the rows by fractions of a semitone', () => {
    expect(panStudioRollRows(VIEW, 2.5)).toMatchObject({
      minMidi: 50.5,
      maxMidi: 73.5,
    })
  })

  it('stops at the top and the bottom of the keyboard, the rows shown kept', () => {
    expect(panStudioRollRows(VIEW, 500)).toMatchObject({
      minMidi: 104,
      maxMidi: 127,
    })
    expect(panStudioRollRows(VIEW, -500)).toMatchObject({
      minMidi: 0,
      maxMidi: 23,
    })
  })

  it('leaves time alone', () => {
    expect(panStudioRollRows(VIEW, 3)).toMatchObject({ start: 0, end: 3840 })
  })
})

describe('zoomStudioRollRows', () => {
  it('zooms about its anchor: the pitch under it stays under it', () => {
    // Act: half the rows, about the middle of row 60.
    const closer = zoomStudioRollRows(VIEW, 0.5, 230, LIMITS)

    // Assert
    expect(rowsOf(closer)).toBe(12)
    expect(studioRollPitchAt(230, closer)).toBeCloseTo(
      studioRollPitchAt(230, VIEW),
      9,
    )
  })

  it('keeps a row between the limits: 48 px in, 14 px out', () => {
    const tallest = zoomStudioRollRows(VIEW, 0.01, 240, LIMITS)
    const shortest = zoomStudioRollRows(VIEW, 100, 240, LIMITS)
    expect(VIEW.height / rowsOf(tallest)).toBeCloseTo(48, 9)
    expect(VIEW.height / rowsOf(shortest)).toBeCloseTo(14, 9)
  })

  it('never shrinks rows already under the floor, but lets them grow', () => {
    // Arrange: 60 rows of 8 px.
    const crowded = { ...VIEW, minMidi: 30, maxMidi: 89 }

    // Act
    const out = zoomStudioRollRows(crowded, 2, 240, LIMITS)
    const into = zoomStudioRollRows(crowded, 0.5, 240, LIMITS)

    // Assert
    expect(out).toBe(crowded)
    expect(rowsOf(into)).toBe(30)
  })

  it('stays on the keyboard when it zooms out at the top', () => {
    const top = { ...VIEW, minMidi: 104, maxMidi: 127 }
    const out = zoomStudioRollRows(top, 1.4, 0, LIMITS)
    expect(out.maxMidi).toBe(127)
    expect(rowsOf(out)).toBeCloseTo(24 * 1.4, 9)
  })
})

describe('fitStudioRollRows', () => {
  it('shows fewer rows about the middle of the ones it showed, each at least 14 px', () => {
    // Arrange: five octaves in 480 px, 8 px a row.
    const crowded = { ...VIEW, minMidi: 30, maxMidi: 89 }

    // Act
    const fitted = fitStudioRollRows(crowded, 14)

    // Assert
    expect(fitted).toMatchObject({ minMidi: 43, maxMidi: 76 })
    expect(VIEW.height / rowsOf(fitted)).toBeGreaterThanOrEqual(14)
  })

  it('leaves rows that are already tall enough as they are', () => {
    expect(fitStudioRollRows(VIEW, 14)).toBe(VIEW)
  })
})

describe('studioWindowRollNotes', () => {
  const notes: readonly StudioNote[] = [
    { id: 1, pitch: 60, startTick: 0, lengthTicks: 240, velocity: 0.8 },
    { id: 2, pitch: 62, startTick: 960, lengthTicks: 240, velocity: 0.8 },
  ]
  const window = { startTick: 480, endTick: 3840 }

  it('gives the notes starting inside the window, as the roll draws them', () => {
    expect(studioWindowRollNotes({ notes }, window)).toEqual([
      { id: 2, start: 960, end: 1200, midi: 62 },
    ])
  })

  it('works them out once for the same notes and window, and again for others', () => {
    // Act
    const first = studioWindowRollNotes({ notes }, window)
    const again = studioWindowRollNotes({ notes }, { ...window })
    const wider = studioWindowRollNotes(
      { notes },
      { startTick: 0, endTick: 3840 },
    )
    const edited = studioWindowRollNotes({ notes: [...notes] }, window)

    // Assert
    expect(again).toBe(first)
    expect(wider.map((note) => note.id)).toEqual([1, 2])
    expect(edited).not.toBe(first)
  })
})
