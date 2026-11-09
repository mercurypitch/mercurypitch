// Studio MIDI roll tests — a sequence's notes draw in ticks; the roll opens over the clip's window with air above and below its notes, or on the octaves around middle C when it has none; a zoom and a pan stay inside the window, a zoom closing in to a sixteenth at the most; a pointer picks only a note the clip plays, on its body or its right edge; and a point gives a whole tick and a pitch on the keyboard.
import { describe, expect, it } from 'vitest'
import { xToTime } from '@/lib/roll-geometry'
import type { StudioSequence } from '../model/types'
import { panStudioRoll, studioRollHit, studioRollNotes, studioRollPoint, studioRollViewport, zoomStudioRoll, } from './roll'

const SEQUENCE: Pick<StudioSequence, 'notes'> = {
  notes: [
    { id: 1, pitch: 60, startTick: 960, lengthTicks: 480, velocity: 0.8 },
    { id: 2, pitch: 67, startTick: 1920, lengthTicks: 960, velocity: 0.5 },
    // Starts before the window and sounds into it: kept, dimmed, never picked.
    { id: 3, pitch: 64, startTick: 480, lengthTicks: 1000, velocity: 0.5 },
  ],
}

/** A clip's window from beat 1 to beat 4 at 960 ticks a beat. */
const WINDOW = { startTick: 960, endTick: 3840 }

describe('studioRollNotes', () => {
  it('draws each note from its start to its end in ticks, by its id', () => {
    expect(studioRollNotes(SEQUENCE)[1]).toEqual({
      id: 2,
      start: 1920,
      end: 2880,
      midi: 67,
    })
  })
})

describe('studioRollViewport', () => {
  it("opens over the clip's window, with two semitones of air around the notes it plays", () => {
    expect(studioRollViewport(SEQUENCE, WINDOW, 800, 300)).toEqual({
      start: 960,
      end: 3840,
      minMidi: 58,
      maxMidi: 69,
      width: 800,
      height: 300,
    })
  })

  it('opens on the octaves around middle C for a clip with no notes', () => {
    expect(studioRollViewport({ notes: [] }, WINDOW, 800, 300)).toMatchObject({
      minMidi: 48,
      maxMidi: 72,
    })
  })
})

describe('zoom and pan', () => {
  const view = studioRollViewport(SEQUENCE, WINDOW, 800, 300)

  it('zooms about the pointer and stays inside the window', () => {
    // Act: closing in by half at the middle, then out past the window.
    const closer = zoomStudioRoll(view, 0.5, 400, WINDOW)
    const wider = zoomStudioRoll(view, 4, 400, WINDOW)

    // Assert
    expect(xToTime(400, closer)).toBeCloseTo(xToTime(400, view), 6)
    expect([closer.start, closer.end]).toEqual([1680, 3120])
    expect([wider.start, wider.end]).toEqual([960, 3840])
  })

  it('closes in to a sixteenth note at the most', () => {
    const closest = zoomStudioRoll(view, 0.0001, 0, WINDOW)
    expect(closest.end - closest.start).toBe(240)
    expect(closest.start).toBe(960)
  })

  it('opens out to a window shorter than a beat, and no further', () => {
    // Arrange: a clip of a tenth of a beat.
    const short = { startTick: 960, endTick: 1056 }
    const shortView = studioRollViewport(SEQUENCE, short, 800, 300)

    // Act
    const widest = zoomStudioRoll(shortView, 100, 400, short)

    // Assert
    expect([widest.start, widest.end]).toEqual([960, 1056])
  })

  it('pans inside the window, stopping at both of its edges', () => {
    const closer = zoomStudioRoll(view, 0.5, 400, WINDOW)
    expect(panStudioRoll(closer, -5000, WINDOW).start).toBe(960)
    expect(panStudioRoll(closer, 5000, WINDOW).end).toBe(3840)
    expect(panStudioRoll(closer, 100, WINDOW).start).toBe(1780)
  })
})

describe('studioRollHit and studioRollPoint', () => {
  // 800 px over 2880 ticks: 3.6 ticks a pixel; rows of 300 / 12 = 25 px.
  const view = studioRollViewport(SEQUENCE, WINDOW, 800, 300)

  it('picks a note the clip plays on its body or its right edge, and never one outside the window', () => {
    // Note 1 spans x 0 to 133.3, on the row of pitch 60 (y 225 to 250).
    expect(studioRollHit(SEQUENCE, WINDOW, view, 50, 230)).toEqual({
      id: 1,
      zone: 'body',
    })
    expect(studioRollHit(SEQUENCE, WINDOW, view, 131, 230)).toEqual({
      id: 1,
      zone: 'end',
    })
    expect(studioRollHit(SEQUENCE, WINDOW, view, 50, 10)).toBeNull()
    // Note 3 is drawn from x 0 to 144 on the row of pitch 64 (y 125 to 150).
    expect(studioRollHit(SEQUENCE, WINDOW, view, 50, 130)).toBeNull()
  })

  it('gives a whole tick and a pitch on the keyboard at a point', () => {
    expect(studioRollPoint(view, 100, 230)).toEqual({ tick: 1320, pitch: 60 })
    expect(studioRollPoint(view, 0, -2000).pitch).toBe(127)
  })
})
