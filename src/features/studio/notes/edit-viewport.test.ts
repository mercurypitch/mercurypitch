// Studio note roll navigation tests — the roll follows a finger both ways, inside the clip's window and on the keyboard; a pinch zooms each axis by the fingers' spread along it, about the point between them, a row never under 14 px; the wheel scrolls rows, Shift with it time, a trackpad both, and Ctrl with it zooms time; and a drag held at an edge scrolls toward the side it went.
import { describe, expect, it } from 'vitest'
import type { RollViewport } from '@/lib/roll-geometry'
import { xToTime } from '@/lib/roll-geometry'
import { studioRollPitchAt } from '@/lib/studio/midi/roll-rows'
import { dragNoteRoll, noteEdgeScroll, pinchNoteRoll, wheelNoteRoll, } from './edit-viewport'

/** Two bars of clip; one bar of it shown across 960 px (2 ticks a pixel), rows of 20 px from 48 to 71. */
const WINDOW = { startTick: 0, endTick: 7680 }
const VIEW: RollViewport = {
  start: 1920,
  end: 3840,
  minMidi: 48,
  maxMidi: 71,
  width: 960,
  height: 480,
}

const rowsOf = (viewport: RollViewport) =>
  viewport.maxMidi - viewport.minMidi + 1
const fingers = (ax: number, ay: number, bx: number, by: number) => ({
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
})

describe('dragNoteRoll', () => {
  it('moves the content with a finger: right shows earlier ticks, down shows higher rows', () => {
    expect(dragNoteRoll(VIEW, WINDOW, 100, 40)).toMatchObject({
      start: 1720,
      end: 3640,
      minMidi: 50,
      maxMidi: 73,
    })
  })

  it("stops at the clip window's start and at the top of the keyboard", () => {
    expect(dragNoteRoll(VIEW, WINDOW, 5000, 5000)).toMatchObject({
      start: 0,
      end: 1920,
      minMidi: 104,
      maxMidi: 127,
    })
  })
})

describe('pinchNoteRoll', () => {
  it('zooms time by how far the fingers spread sideways, about the point between them', () => {
    // Act: fingers 160 px apart, then 240 px, about x 480.
    const zoomed = pinchNoteRoll(
      VIEW,
      WINDOW,
      fingers(400, 200, 560, 200),
      fingers(360, 200, 600, 200),
      true,
    )

    // Assert
    expect(zoomed.end - zoomed.start).toBeCloseTo(1280, 6)
    expect(xToTime(480, zoomed)).toBeCloseTo(xToTime(480, VIEW), 6)
    expect(rowsOf(zoomed)).toBe(24)
  })

  it('zooms rows by how far they spread up and down, the pitch between them staying put', () => {
    const zoomed = pinchNoteRoll(
      VIEW,
      WINDOW,
      fingers(480, 150, 480, 310),
      fingers(480, 110, 480, 350),
      true,
    )
    expect(rowsOf(zoomed)).toBeCloseTo(16, 6)
    expect(studioRollPitchAt(230, zoomed)).toBeCloseTo(
      studioRollPitchAt(230, VIEW),
      6,
    )
    expect([zoomed.start, zoomed.end]).toEqual([1920, 3840])
  })

  it('zooms both at a slant', () => {
    const zoomed = pinchNoteRoll(
      VIEW,
      WINDOW,
      fingers(400, 150, 560, 310),
      fingers(360, 110, 600, 350),
      true,
    )
    expect([zoomed.end - zoomed.start, rowsOf(zoomed)].map(Math.round)).toEqual(
      [1280, 16],
    )
  })

  it('pans both ways with the point between the fingers when they do not spread', () => {
    const panned = pinchNoteRoll(
      VIEW,
      WINDOW,
      fingers(400, 200, 560, 260),
      fingers(450, 220, 610, 280),
      true,
    )
    expect(panned).toMatchObject({
      start: 1820,
      end: 3740,
      minMidi: 49,
      maxMidi: 72,
    })
  })

  it('keeps a row at least 14 px tall however far the fingers close', () => {
    // Arrange: 30 rows of 16 px.
    const close = { ...VIEW, minMidi: 40, maxMidi: 69 }

    // Act
    const zoomed = pinchNoteRoll(
      close,
      WINDOW,
      fingers(480, 120, 480, 360),
      fingers(480, 200, 480, 280),
      true,
    )

    // Assert
    expect(close.height / rowsOf(zoomed)).toBeCloseTo(14, 6)
  })

  it('leaves the rows alone when a finger is on the velocity lane', () => {
    const zoomed = pinchNoteRoll(
      VIEW,
      WINDOW,
      fingers(400, 10, 560, 70),
      fingers(350, 0, 610, 90),
      false,
    )
    expect([zoomed.minMidi, zoomed.maxMidi]).toEqual([48, 71])
    expect(zoomed.end - zoomed.start).toBeLessThan(1920)
  })
})

describe('wheelNoteRoll', () => {
  it('scrolls the rows: a turn down shows lower notes', () => {
    expect(
      wheelNoteRoll(VIEW, WINDOW, { x: 0, y: 0, deltaX: 0, deltaY: 40 }),
    ).toMatchObject({ minMidi: 46, maxMidi: 69, start: 1920 })
  })

  it('scrolls time with Shift, later for a turn down', () => {
    expect(
      wheelNoteRoll(VIEW, WINDOW, {
        x: 0,
        y: 0,
        deltaX: 0,
        deltaY: 100,
        shift: true,
      }),
    ).toMatchObject({ start: 2120, minMidi: 48 })
  })

  it("scrolls both with a trackpad's two-way swipe", () => {
    expect(
      wheelNoteRoll(VIEW, WINDOW, { x: 0, y: 0, deltaX: 50, deltaY: -20 }),
    ).toMatchObject({ start: 2020, minMidi: 49 })
  })

  it('zooms time about the pointer with Ctrl or Cmd: a notch a quarter, a trackpad pinch its own amount', () => {
    // Act
    const notch = wheelNoteRoll(VIEW, WINDOW, {
      x: 240,
      y: 0,
      deltaX: 0,
      deltaY: -3,
      deltaMode: 1,
      mod: true,
    })
    const pinch = wheelNoteRoll(VIEW, WINDOW, {
      x: 240,
      y: 0,
      deltaX: 0,
      deltaY: -40,
      mod: true,
    })

    // Assert
    expect(notch.end - notch.start).toBeCloseTo(1536, 6)
    expect(pinch.end - pinch.start).toBeCloseTo(1920 / Math.exp(0.4), 6)
    expect(xToTime(240, pinch)).toBeCloseTo(xToTime(240, VIEW), 6)
  })
})

describe('noteEdgeScroll', () => {
  it('scrolls toward an edge a drag went to, faster the deeper in', () => {
    // Act: 10 px from the right edge, and 30 px past the left one, for a tenth of a second.
    const near = noteEdgeScroll(
      VIEW,
      { x: 950, y: 200 },
      { x: 600, y: 200 },
      0.1,
      true,
    )
    const past = noteEdgeScroll(
      VIEW,
      { x: -30, y: 200 },
      { x: 300, y: 200 },
      0.1,
      true,
    )

    // Assert
    expect(near.x).toBeCloseTo(17.5, 6)
    expect(past.x).toBeCloseTo(-67.5, 6)
  })

  it('does not scroll toward an edge the drag did not go to', () => {
    // Arrange: a note grabbed near the right edge, dragged left.
    const grabbed = noteEdgeScroll(
      VIEW,
      { x: 940, y: 200 },
      { x: 955, y: 200 },
      0.1,
      true,
    )
    expect(grabbed).toEqual({ x: 0, y: 0 })
  })

  it('scrolls the rows too, unless the drag runs along time alone', () => {
    const down = noteEdgeScroll(
      VIEW,
      { x: 400, y: 470 },
      { x: 400, y: 200 },
      0.1,
      true,
    )
    const along = noteEdgeScroll(
      VIEW,
      { x: 400, y: 470 },
      { x: 400, y: 200 },
      0.1,
      false,
    )
    expect(down.y).toBeCloseTo(17.5, 6)
    expect(along.y).toBe(0)
  })
})
