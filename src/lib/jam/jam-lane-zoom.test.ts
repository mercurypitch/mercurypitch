// ── Jam lane zoom tests ──────────────────────────────────────────────
// The scalar that decides how big the picture is, and the three things
// it scales. Kept honest here rather than in the draw call, for the same
// reason jam-lane-geometry exists: nothing inside a requestAnimationFrame
// can be asserted on, and this lane has already shipped with arithmetic
// nobody could see.

import { describe, expect, it } from 'vitest'
import { clampJamZoom, formatJamZoom, isJamZoom, isJamZoomDefault, JAM_BAND_LOOKAROUND_SEC, JAM_LANE_SPAN_TIGHT, JAM_LANE_SPAN_WIDE, JAM_NOTE_LABEL_MIN_PILL, JAM_PILL_BASE, JAM_PILL_SEMITONE_CAP, JAM_ZOOM_MAX, JAM_ZOOM_MIN, JAM_ZOOM_STEP, jamLaneMinSpan, jamPillHeight, jamTrailWidth, laneBandMidis, steppedJamZoom, zoomFromPinch, zoomFromWheel, } from '@/lib/jam/jam-lane-zoom'
import type { JamSongNote } from '@/lib/jam/types'

describe('clampJamZoom', () => {
  it('holds the range at both ends', () => {
    expect(clampJamZoom(0.2)).toBe(JAM_ZOOM_MIN)
    expect(clampJamZoom(99)).toBe(JAM_ZOOM_MAX)
    expect(clampJamZoom(2.5)).toBe(2.5)
  })

  it('treats a non-number as no zoom rather than as a blank lane', () => {
    // A NaN here reaches laneWindowSec, which divides by it -- the lane
    // would show a window of NaN seconds and draw nothing at all.
    expect(clampJamZoom(Number.NaN)).toBe(JAM_ZOOM_MIN)
    expect(clampJamZoom(Number.POSITIVE_INFINITY)).toBe(JAM_ZOOM_MIN)
  })
})

describe('isJamZoom', () => {
  it('accepts a value inside the range', () => {
    expect(isJamZoom(1)).toBe(true)
    expect(isJamZoom(3.75)).toBe(true)
  })

  it('rejects everything localStorage can hand back instead', () => {
    for (const bad of [
      '2',
      null,
      undefined,
      {},
      [],
      Number.NaN,
      0,
      -1,
      4.01,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(isJamZoom(bad)).toBe(false)
    }
  })
})

describe('steppedJamZoom', () => {
  it('multiplies rather than adds, so a notch feels the same everywhere', () => {
    expect(steppedJamZoom(1, 1)).toBeCloseTo(JAM_ZOOM_STEP, 10)
    expect(steppedJamZoom(2, 1)).toBeCloseTo(2 * JAM_ZOOM_STEP, 10)
    expect(steppedJamZoom(2, -1)).toBeCloseTo(2 / JAM_ZOOM_STEP, 10)
  })

  it('stops at the ends instead of running past them', () => {
    expect(steppedJamZoom(JAM_ZOOM_MAX, 1)).toBe(JAM_ZOOM_MAX)
    expect(steppedJamZoom(JAM_ZOOM_MIN, -1)).toBe(JAM_ZOOM_MIN)
  })

  it('walks the whole range in a countable number of notches', () => {
    let zoom = JAM_ZOOM_MIN
    let notches = 0
    while (zoom < JAM_ZOOM_MAX && notches < 100) {
      zoom = steppedJamZoom(zoom, 1)
      notches++
    }
    expect(zoom).toBe(JAM_ZOOM_MAX)
    expect(notches).toBeLessThanOrEqual(8)
  })
})

describe('zoomFromWheel', () => {
  it('zooms in on a wheel towards the content and out on a wheel away', () => {
    expect(zoomFromWheel(2, -100)).toBeCloseTo(2 * JAM_ZOOM_STEP, 10)
    expect(zoomFromWheel(2, 100)).toBeCloseTo(2 / JAM_ZOOM_STEP, 10)
  })

  it('ignores a delta with no vertical component', () => {
    // A horizontal scroll and a nudged trackpad both arrive here. Neither
    // is a request to zoom, and treating them as one made the lane creep.
    expect(zoomFromWheel(2, 0)).toBe(2)
    expect(zoomFromWheel(2, Number.NaN)).toBe(2)
  })
})

describe('zoomFromPinch', () => {
  it('scales with the spread, measured from where the gesture started', () => {
    expect(zoomFromPinch(1, 100, 200)).toBe(2)
    expect(zoomFromPinch(2, 200, 100)).toBe(1)
  })

  it('comes back to where it began when the fingers do', () => {
    // Accumulating per-frame ratios drifts; a pinch out and back has to
    // land on the zoom it started from.
    expect(zoomFromPinch(1.6, 180, 180)).toBeCloseTo(1.6, 10)
  })

  it('refuses to divide by a degenerate gesture', () => {
    expect(zoomFromPinch(2, 0, 120)).toBe(2)
    expect(zoomFromPinch(2, 120, 0)).toBe(2)
  })

  it('still respects the range', () => {
    expect(zoomFromPinch(1, 50, 5000)).toBe(JAM_ZOOM_MAX)
    expect(zoomFromPinch(4, 5000, 50)).toBe(JAM_ZOOM_MIN)
  })
})

describe('formatJamZoom', () => {
  it('reads as a multiplier, at most one decimal', () => {
    expect(formatJamZoom(1)).toBe('1×')
    expect(formatJamZoom(1.5625)).toBe('1.6×')
    expect(formatJamZoom(4)).toBe('4×')
  })

  it('never shows a multiplier the lane cannot be at', () => {
    expect(formatJamZoom(99)).toBe('4×')
    expect(formatJamZoom(Number.NaN)).toBe('1×')
  })
})

describe('isJamZoomDefault', () => {
  it('is true at 1x and false the moment anything moved it', () => {
    expect(isJamZoomDefault(1)).toBe(true)
    expect(isJamZoomDefault(1.25)).toBe(false)
    expect(isJamZoomDefault(4)).toBe(false)
  })
})

describe('jamLaneMinSpan', () => {
  it('runs from the zen ribbon floor to a tight band', () => {
    expect(jamLaneMinSpan(JAM_ZOOM_MIN)).toBeCloseTo(JAM_LANE_SPAN_WIDE, 10)
    expect(jamLaneMinSpan(JAM_ZOOM_MAX)).toBeCloseTo(JAM_LANE_SPAN_TIGHT, 10)
  })

  it('only ever tightens as the zoom goes in', () => {
    let previous = Number.POSITIVE_INFINITY
    for (const zoom of [1, 1.5, 2, 2.5, 3, 3.5, 4]) {
      const span = jamLaneMinSpan(zoom)
      expect(span).toBeLessThanOrEqual(previous)
      previous = span
    }
  })
})

describe('jamPillHeight', () => {
  it('is taller than the shipped 9/6/4/6 at every zoom, given the room', () => {
    // The old heights were legible on a desktop and a smudge on a phone.
    const roomy = 40
    expect(jamPillHeight('perfect', 1, roomy)).toBeGreaterThan(9)
    expect(jamPillHeight('close', 1, roomy)).toBeGreaterThan(6)
    expect(jamPillHeight('miss', 1, roomy)).toBeGreaterThan(4)
    expect(jamPillHeight('neutral', 1, roomy)).toBeGreaterThan(6)
  })

  it('grows with the zoom', () => {
    const roomy = 60
    expect(jamPillHeight('neutral', 4, roomy)).toBeGreaterThan(
      jamPillHeight('neutral', 1, roomy),
    )
  })

  it('keeps the verdict readable as height, not only as colour', () => {
    const roomy = 60
    expect(jamPillHeight('perfect', 2, roomy)).toBeGreaterThan(
      jamPillHeight('close', 2, roomy),
    )
    expect(jamPillHeight('close', 2, roomy)).toBeGreaterThan(
      jamPillHeight('miss', 2, roomy),
    )
  })

  it('never lets one semitone paint over its neighbour', () => {
    // The whole reason the lane bands at all: a pill taller than the row
    // it sits on makes a perfect note and a whole-tone miss the same
    // picture, which is the bug the verdict colours were added to fix.
    for (const zoom of [1, 1.5, 2, 3, 4]) {
      for (const pxPerSemitone of [3, 5, 7.2, 12, 20, 45]) {
        for (const kind of ['perfect', 'close', 'miss', 'neutral'] as const) {
          expect(jamPillHeight(kind, zoom, pxPerSemitone)).toBeLessThanOrEqual(
            pxPerSemitone * JAM_PILL_SEMITONE_CAP + 1e-9,
          )
        }
      }
    }
  })

  it('stays visible in a lane squeezed by a twelve-person room', () => {
    expect(jamPillHeight('miss', 1, 0.5)).toBeGreaterThanOrEqual(2)
  })

  it('falls back to the unscaled wish when the band has no height yet', () => {
    expect(jamPillHeight('neutral', 1, 0)).toBe(JAM_PILL_BASE.neutral)
  })

  it('reaches the note-label threshold once there is room for a name', () => {
    // The label rule is "a pill at least this tall", so at least one
    // realistic lane has to be able to get there or the feature is dead
    // code. A two-lane desktop stage gives about 20px a semitone.
    expect(jamPillHeight('perfect', 2, 20)).toBeGreaterThanOrEqual(
      JAM_NOTE_LABEL_MIN_PILL,
    )
  })
})

describe('jamTrailWidth', () => {
  it('thickens with the zoom, from the shipped 2px', () => {
    expect(jamTrailWidth(1)).toBe(2)
    expect(jamTrailWidth(4)).toBeCloseTo(3.5, 10)
    expect(jamTrailWidth(2)).toBeGreaterThan(jamTrailWidth(1))
  })
})

describe('laneBandMidis', () => {
  const notes: JamSongNote[] = [
    { midi: 60, startSec: 0, endSec: 1 },
    { midi: 62, startSec: 10, endSec: 11 },
    { midi: 84, startSec: 100, endSec: 101 },
  ]

  it('takes only the notes the window can see', () => {
    // The shipped lane fed the WHOLE song in, so a two-octave number gave
    // a semitone three pixels and every verdict drew the same.
    const midis = laneBandMidis({
      notes,
      windowFrom: 0,
      windowTo: 2,
      sungMidis: [],
    })
    expect(midis).toEqual([60])
    expect(midis).not.toContain(84)
  })

  it('looks a little further than the window, so a leap does not arrive as a jump', () => {
    const justOutside = laneBandMidis({
      notes,
      windowFrom: 11 + JAM_BAND_LOOKAROUND_SEC / 2,
      windowTo: 12,
      sungMidis: [],
    })
    expect(justOutside).toContain(62)
  })

  it('includes what this singer is actually producing', () => {
    // A trail drawn outside its own lane says nothing at all.
    const midis = laneBandMidis({
      notes,
      windowFrom: 0,
      windowTo: 2,
      sungMidis: [48.4, 71.2],
    })
    expect(midis).toContain(48.4)
    expect(midis).toContain(71.2)
  })

  it('returns nothing during an instrumental gap, so the caller can hold still', () => {
    expect(
      laneBandMidis({ notes, windowFrom: 50, windowTo: 55, sungMidis: [] }),
    ).toEqual([])
  })
})
