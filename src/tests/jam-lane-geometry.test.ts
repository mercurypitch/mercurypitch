// ── Jam lane geometry tests ──────────────────────────────────────────
// One rule, stated every way it can be stated: the song second under the
// playhead is the second being played. The lane shipped drawing the
// reference notes four seconds early -- the window was anchored so that
// `pos` fell a quarter of the way across while the playhead line and the
// live trail sat three quarters along -- and nothing went red, because
// the arithmetic lived inside a canvas draw call.

import { describe, expect, it } from 'vitest'
import {
  laneSecToX,
  laneWindow,
  liveSampleX,
  NOW_AT,
  WINDOW_SEC,
} from '@/lib/jam/jam-lane-geometry'

describe('laneWindow', () => {
  it('puts NOW_AT of the window behind the playhead', () => {
    const w = laneWindow(30)
    expect(w.from).toBeCloseTo(30 - WINDOW_SEC * NOW_AT, 10)
    expect(w.to).toBeCloseTo(30 + WINDOW_SEC * (1 - NOW_AT), 10)
  })

  it('shows exactly WINDOW_SEC of song at any position', () => {
    for (const pos of [0, 0.5, 12.25, 187]) {
      const w = laneWindow(pos)
      expect(w.to - w.from).toBeCloseTo(WINDOW_SEC, 10)
    }
  })

  it('keeps the song ahead of the playhead, not behind it', () => {
    // The window used to be built the other way round: six seconds of
    // future and two of past. The lane then scrolled a song that had not
    // happened yet.
    const w = laneWindow(100)
    expect(w.to - 100).toBeLessThan(100 - w.from)
  })
})

describe('laneSecToX', () => {
  it('draws the second being played under the playhead', () => {
    for (const pos of [0, 3.5, 42, 190.75]) {
      for (const width of [320, 640, 1001]) {
        expect(laneSecToX(pos, pos, width)).toBeCloseTo(width * NOW_AT, 8)
      }
    }
  })

  it('draws a note starting exactly at the playhead position at the playhead', () => {
    // The bug, pinned. With the old window `pos` landed at 0.25 * width,
    // so the note sitting under the playhead line was the one starting
    // four seconds later -- and LEAD_IN_SEC being four seconds made the
    // "you're up" cue agree with the wrong note.
    const width = 800
    const x = laneSecToX(60, 60, width)
    expect(x).toBeCloseTo(600, 8)
    expect(x).not.toBeCloseTo(200, 0)
  })

  it('spans the lane from the window start to the window end', () => {
    const pos = 17
    const width = 500
    const { from, to } = laneWindow(pos)
    expect(laneSecToX(from, pos, width)).toBeCloseTo(0, 8)
    expect(laneSecToX(to, pos, width)).toBeCloseTo(width, 8)
  })

  it('puts what is already sung to the left of the playhead', () => {
    const width = 400
    expect(laneSecToX(9, 10, width)).toBeLessThan(laneSecToX(10, 10, width))
    expect(laneSecToX(11, 10, width)).toBeGreaterThan(laneSecToX(10, 10, width))
  })

  it('moves a fixed note left as the song advances', () => {
    const width = 800
    const pxPerSec = width / WINDOW_SEC
    expect(laneSecToX(20, 10, width) - laneSecToX(20, 11, width)).toBeCloseTo(
      pxPerSec,
      8,
    )
  })
})

describe('liveSampleX', () => {
  it('lands the newest sample on the playhead', () => {
    for (const width of [320, 640, 1001]) {
      expect(liveSampleX(0, width)).toBeCloseTo(width * NOW_AT, 8)
      expect(liveSampleX(0, width)).toBeCloseTo(laneSecToX(9, 9, width), 8)
    }
  })

  it('shares one ruler with the reference notes', () => {
    // A sample taken `age` ago has to land where the song second `age`
    // ago lands, or the trail and the line it is aiming at drift apart.
    const width = 640
    const pos = 45
    for (const ageMs of [0, 250, 1000, 4500, WINDOW_SEC * 1000]) {
      expect(liveSampleX(ageMs, width)).toBeCloseTo(
        laneSecToX(pos - ageMs / 1000, pos, width),
        8,
      )
    }
  })

  it('walks a whole window off the left edge', () => {
    const width = 600
    expect(liveSampleX(WINDOW_SEC * 1000, width)).toBeCloseTo(
      width * NOW_AT - width,
      8,
    )
  })
})
