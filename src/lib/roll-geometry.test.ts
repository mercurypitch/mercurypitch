// Roll geometry tests — a roll maps its time across the width and pitch down the height and back, keeps a short note clickable, picks the note on top and its body or end, keeps what overlaps the view, fits notes with air or an empty roll on its fallback, zooms about the pointer inside the material and its floor, and pans without changing the span. Counted in seconds here, as the Lab's bench counts.
import { describe, expect, it } from 'vitest'
import type { RollNote, RollScale, RollViewport } from './roll-geometry'
import { fitViewport, hitTest, midiToY, noteRect, panViewport, timeToX, visibleNotes, xToTime, yToMidi, zoomViewport, } from './roll-geometry'

/** In seconds, as the Lab's transcription bench draws: a fifth of a second at the closest, 30 seconds when empty, a second at the least when fitted. */
const SECONDS: RollScale = { minSpan: 0.2, emptySpan: 30, minFitSpan: 1 }

const viewport: RollViewport = {
  start: 0,
  end: 10,
  minMidi: 40,
  maxMidi: 49,
  width: 1000,
  height: 100,
}

const note = (
  id: string,
  start: number,
  end: number,
  midi: number,
): RollNote & { id: string } => ({ id, start, end, midi })

describe('roll axes', () => {
  it('maps time across the full width and back', () => {
    expect(timeToX(0, viewport)).toBe(0)
    expect(timeToX(10, viewport)).toBe(1000)
    expect(timeToX(2.5, viewport)).toBe(250)
    expect(xToTime(250, viewport)).toBeCloseTo(2.5, 6)
  })

  it('draws higher pitches higher up', () => {
    expect(midiToY(49, viewport)).toBe(0)
    expect(midiToY(40, viewport)).toBe(90)
    expect(yToMidi(0, viewport)).toBe(49)
    expect(yToMidi(95, viewport)).toBe(40)
  })

  it('is stable through a round trip at every row', () => {
    for (let midi = 40; midi <= 49; midi += 1) {
      const y = midiToY(midi, viewport) + 1
      expect(yToMidi(y, viewport)).toBe(midi)
    }
  })
})

describe('noteRect', () => {
  it('places a note at its time and pitch', () => {
    const rect = noteRect(note('a', 2, 3, 45), viewport)
    expect(rect).toEqual({ x: 200, width: 100, y: 40, height: 10 })
  })

  it('keeps a sub-pixel note wide enough to click', () => {
    const rect = noteRect(note('a', 2, 2.0001, 45), viewport)
    expect(rect.width).toBeGreaterThanOrEqual(2)
  })
})

describe('hitTest', () => {
  const notes = [note('a', 2, 4, 45), note('b', 5, 6, 42)]

  it('finds the note under the cursor', () => {
    expect(hitTest(notes, viewport, 250, 45)?.note.id).toBe('a')
    expect(hitTest(notes, viewport, 550, 75)?.note.id).toBe('b')
  })

  it('misses when the cursor is off the note', () => {
    expect(hitTest(notes, viewport, 250, 5)).toBeNull()
    expect(hitTest(notes, viewport, 450, 45)).toBeNull()
  })

  it('grabs the end for a resize, and the body elsewhere', () => {
    expect(hitTest(notes, viewport, 398, 45)?.zone).toBe('end')
    expect(hitTest(notes, viewport, 250, 45)?.zone).toBe('body')
  })

  it('leaves a short note movable rather than all edge', () => {
    // A 4 px note with a 6 px grab zone would be nothing but resize handle.
    const short = [note('s', 2, 2.004, 45)]
    expect(hitTest(short, viewport, 200.5, 45)?.zone).toBe('body')
  })

  it('picks the note drawn last where two overlap', () => {
    const stacked = [note('under', 2, 4, 45), note('over', 2, 4, 45)]
    expect(hitTest(stacked, viewport, 250, 45)?.note.id).toBe('over')
  })
})

describe('visibleNotes', () => {
  it('keeps anything overlapping the span, including notes straddling it', () => {
    const window: RollViewport = { ...viewport, start: 4, end: 6 }
    const notes = [
      note('before', 0, 1, 45),
      note('straddling', 3, 7, 45),
      note('inside', 4.5, 5, 45),
      note('after', 8, 9, 45),
    ]
    expect(visibleNotes(notes, window).map((entry) => entry.id)).toEqual([
      'straddling',
      'inside',
    ])
  })
})

describe('fitViewport', () => {
  it('frames the notes with air above and below', () => {
    const fitted = fitViewport(
      [note('a', 0, 1, 40), note('b', 5, 9, 52)],
      800,
      200,
      SECONDS,
    )
    expect(fitted.minMidi).toBe(38)
    expect(fitted.maxMidi).toBe(54)
    expect(fitted.end).toBe(9)
  })

  it('falls back to a playable range when there is nothing to frame', () => {
    const fitted = fitViewport([], 800, 200, SECONDS)
    expect(fitted.minMidi).toBe(28)
    expect(fitted.maxMidi).toBe(60)
    expect(fitted.end).toBe(30)
  })

  it("keeps to its scale's spans in any unit: an empty roll, and one of short notes", () => {
    // 960 ticks a beat: an empty roll shows a bar, a fitted one a beat at least.
    const ticks: RollScale = { minSpan: 240, emptySpan: 3840, minFitSpan: 960 }
    expect(fitViewport([], 800, 200, ticks).end).toBe(3840)
    expect(fitViewport([note('a', 0, 10, 60)], 800, 200, ticks).end).toBe(960)
    const closest = zoomViewport(
      { ...viewport, end: 3840 },
      0.0001,
      0,
      3840,
      ticks,
    )
    expect(closest.end - closest.start).toBe(240)
  })
})

describe('zoomViewport', () => {
  it('keeps the anchored instant under the cursor', () => {
    const before = xToTime(500, viewport)
    const zoomed = zoomViewport(viewport, 0.5, 500, 60, SECONDS)
    expect(xToTime(500, zoomed)).toBeCloseTo(before, 6)
    expect(zoomed.end - zoomed.start).toBeCloseTo(5, 6)
  })

  it('will not zoom out past the material or in past a fifth of a second', () => {
    expect(
      zoomViewport(viewport, 100, 500, 20, SECONDS).end -
        zoomViewport(viewport, 100, 500, 20, SECONDS).start,
    ).toBeCloseTo(20, 6)
    const tight = zoomViewport(viewport, 0.001, 500, 60, SECONDS)
    expect(tight.end - tight.start).toBeCloseTo(0.2, 6)
  })

  it('stays inside the material at either end', () => {
    const atStart = zoomViewport(viewport, 2, 0, 60, SECONDS)
    expect(atStart.start).toBe(0)
    const late: RollViewport = {
      ...viewport,
      start: 50,
      end: 60,
    }
    const atEnd = zoomViewport(late, 2, 1000, 60, SECONDS)
    expect(atEnd.end).toBeCloseTo(60, 6)
  })
})

describe('panViewport', () => {
  it('slides without changing the span', () => {
    const panned = panViewport(viewport, 5, 60)
    expect(panned.start).toBe(5)
    expect(panned.end).toBe(15)
  })

  it('stops at both ends of the material', () => {
    expect(panViewport(viewport, -100, 60).start).toBe(0)
    const panned = panViewport(viewport, 100, 60)
    expect(panned.end).toBe(60)
    expect(panned.start).toBe(50)
  })
})
