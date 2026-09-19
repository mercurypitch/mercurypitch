// ── Jam lane geometry tests ──────────────────────────────────────────
// One rule, stated every way it can be stated: the song second under the
// playhead is the second being played. The lane shipped drawing the
// reference notes four seconds early -- the window was anchored so that
// `pos` fell a quarter of the way across while the playhead line and the
// live trail sat three quarters along -- and nothing went red, because
// the arithmetic lived inside a canvas draw call.
//
// Every case now runs across the zoom range and across lane widths from
// a phone to a wide desktop, because the window is no longer a constant:
// it is width / (60 * zoom), clamped. A ruler that is right at 1x on a
// 640px lane and wrong at 3x on a 320px one is a ruler that will ship
// wrong again.

import { describe, expect, it } from 'vitest'
import { BASE_PX_PER_SEC, LANE_WINDOW_MAX_SEC, LANE_WINDOW_MIN_SEC, laneSecToX, laneWindow, laneWindowSec, liveSampleX, NOW_AT, } from '@/lib/jam/jam-lane-geometry'
import { JAM_ZOOM_MAX, JAM_ZOOM_MIN } from '@/lib/jam/jam-lane-zoom'

/** A phone lane, a laptop lane, a lane on half a wide monitor. */
const WIDTHS = [320, 480, 640, 1001]
const ZOOMS = [JAM_ZOOM_MIN, 1.5, 2, 3, JAM_ZOOM_MAX]

/** Every width x zoom pair, with the window each one produces. */
function* lanes(): Generator<{ width: number; zoom: number; win: number }> {
  for (const width of WIDTHS) {
    for (const zoom of ZOOMS) {
      yield { width, zoom, win: laneWindowSec(width, zoom) }
    }
  }
}

describe('laneWindowSec', () => {
  it('is the width divided by the pixels a second takes at this zoom', () => {
    // 640px at 1x is 10.67s; the same lane at 2x is 5.33s.
    expect(laneWindowSec(640, 1)).toBeCloseTo(640 / BASE_PX_PER_SEC, 10)
    expect(laneWindowSec(640, 2)).toBeCloseTo(640 / (BASE_PX_PER_SEC * 2), 10)
  })

  it('shows LESS song as the zoom goes in', () => {
    for (const width of WIDTHS) {
      for (let i = 1; i < ZOOMS.length; i++) {
        expect(laneWindowSec(width, ZOOMS[i]!)).toBeLessThanOrEqual(
          laneWindowSec(width, ZOOMS[i - 1]!),
        )
      }
    }
  })

  it('shows MORE song as the lane gets wider, at the same scale', () => {
    // This is the whole point of pixels-per-second: dragging the split
    // towards the lanes has to buy more song, not fatter pills.
    for (const zoom of ZOOMS) {
      for (let i = 1; i < WIDTHS.length; i++) {
        expect(laneWindowSec(WIDTHS[i]!, zoom)).toBeGreaterThanOrEqual(
          laneWindowSec(WIDTHS[i - 1]!, zoom),
        )
      }
    }
  })

  it('never shows less than a phrase, nor more than the history buffer', () => {
    // The floor stops a narrow lane at 4x showing one syllable; the
    // ceiling keeps the 12s behind the playhead inside the 600-sample
    // trail buffer, which is about 30s at ~20 samples a second.
    expect(laneWindowSec(200, JAM_ZOOM_MAX)).toBe(LANE_WINDOW_MIN_SEC)
    expect(laneWindowSec(4000, JAM_ZOOM_MIN)).toBe(LANE_WINDOW_MAX_SEC)
    for (const { win } of lanes()) {
      expect(win).toBeGreaterThanOrEqual(LANE_WINDOW_MIN_SEC)
      expect(win).toBeLessThanOrEqual(LANE_WINDOW_MAX_SEC)
    }
  })

  it('survives a zero width and a nonsense zoom rather than dividing by them', () => {
    expect(Number.isFinite(laneWindowSec(0, 1))).toBe(true)
    expect(Number.isFinite(laneWindowSec(640, 0))).toBe(true)
    expect(Number.isFinite(laneWindowSec(640, Number.NaN))).toBe(true)
  })
})

describe('laneWindow', () => {
  it('puts NOW_AT of the window behind the playhead', () => {
    for (const { win } of lanes()) {
      const w = laneWindow(30, win)
      expect(w.from).toBeCloseTo(30 - win * NOW_AT, 10)
      expect(w.to).toBeCloseTo(30 + win * (1 - NOW_AT), 10)
    }
  })

  it('shows exactly the window it was given, at any position', () => {
    for (const { win } of lanes()) {
      for (const pos of [0, 0.5, 12.25, 187]) {
        const w = laneWindow(pos, win)
        expect(w.to - w.from).toBeCloseTo(win, 10)
      }
    }
  })

  it('keeps the song ahead of the playhead, not behind it', () => {
    // The window used to be built the other way round: six seconds of
    // future and two of past. The lane then scrolled a song that had not
    // happened yet.
    for (const { win } of lanes()) {
      const w = laneWindow(100, win)
      expect(w.to - 100).toBeLessThan(100 - w.from)
    }
  })
})

describe('laneSecToX', () => {
  it('draws the second being played under the playhead', () => {
    for (const { width, win } of lanes()) {
      for (const pos of [0, 3.5, 42, 190.75]) {
        expect(laneSecToX(pos, pos, width, win)).toBeCloseTo(width * NOW_AT, 8)
      }
    }
  })

  it('draws a note starting exactly at the playhead position at the playhead', () => {
    // The bug, pinned. With the old window `pos` landed at 0.25 * width,
    // so the note sitting under the playhead line was the one starting
    // four seconds later -- and LEAD_IN_SEC being four seconds made the
    // "you're up" cue agree with the wrong note.
    const width = 800
    const win = laneWindowSec(width, 1)
    const x = laneSecToX(60, 60, width, win)
    expect(x).toBeCloseTo(600, 8)
    expect(x).not.toBeCloseTo(200, 0)
  })

  it('spans the lane from the window start to the window end', () => {
    const pos = 17
    for (const { width, win } of lanes()) {
      const { from, to } = laneWindow(pos, win)
      expect(laneSecToX(from, pos, width, win)).toBeCloseTo(0, 8)
      expect(laneSecToX(to, pos, width, win)).toBeCloseTo(width, 8)
    }
  })

  it('puts what is already sung to the left of the playhead', () => {
    for (const { width, win } of lanes()) {
      expect(laneSecToX(9, 10, width, win)).toBeLessThan(
        laneSecToX(10, 10, width, win),
      )
      expect(laneSecToX(11, 10, width, win)).toBeGreaterThan(
        laneSecToX(10, 10, width, win),
      )
    }
  })

  it('moves a fixed note left by one second of pixels as the song advances', () => {
    for (const { width, win } of lanes()) {
      const pxPerSec = width / win
      expect(
        laneSecToX(20, 10, width, win) - laneSecToX(20, 11, width, win),
      ).toBeCloseTo(pxPerSec, 8)
    }
  })

  it('draws a second the same size at every width, until the clamps bite', () => {
    // Inside the clamps the scale IS the zoom: 60px a second at 1x,
    // whatever the lane is. That is what makes zooming mean something.
    for (const zoom of ZOOMS) {
      for (const width of [400, 640]) {
        const win = laneWindowSec(width, zoom)
        if (win === LANE_WINDOW_MIN_SEC || win === LANE_WINDOW_MAX_SEC) continue
        const pxPerSec =
          laneSecToX(11, 10, width, win) - laneSecToX(10, 10, width, win)
        expect(pxPerSec).toBeCloseTo(BASE_PX_PER_SEC * zoom, 6)
      }
    }
  })
})

describe('liveSampleX', () => {
  it('lands the newest sample on the playhead', () => {
    for (const { width, win } of lanes()) {
      expect(liveSampleX(0, width, win)).toBeCloseTo(width * NOW_AT, 8)
      expect(liveSampleX(0, width, win)).toBeCloseTo(
        laneSecToX(9, 9, width, win),
        8,
      )
    }
  })

  it('shares one ruler with the reference notes', () => {
    // A sample taken `age` ago has to land where the song second `age`
    // ago lands, or the trail and the line it is aiming at drift apart.
    // At every zoom and every width, because the window they share is
    // now derived from both.
    const pos = 45
    for (const { width, win } of lanes()) {
      for (const ageMs of [0, 250, 1000, 4500, win * 1000]) {
        expect(liveSampleX(ageMs, width, win)).toBeCloseTo(
          laneSecToX(pos - ageMs / 1000, pos, width, win),
          8,
        )
      }
    }
  })

  it('walks a whole window off the left edge', () => {
    for (const { width, win } of lanes()) {
      expect(liveSampleX(win * 1000, width, win)).toBeCloseTo(
        width * NOW_AT - width,
        8,
      )
    }
  })

  it('keeps the whole trail inside the sample buffer it is drawn from', () => {
    // 600 samples at ~20/s is about 30 seconds of history. The share of
    // the window behind the playhead must stay well inside that, or the
    // trail simply stops in mid-lane at the oldest sample.
    expect(LANE_WINDOW_MAX_SEC * NOW_AT).toBeLessThan(30)
  })
})
