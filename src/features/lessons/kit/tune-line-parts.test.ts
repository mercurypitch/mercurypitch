// ============================================================
// Tune line parts tests — which beads a part shows, and how its moved beads slide
// ============================================================
//
// The pure half of a part beside the tune (tune-line-parts.ts): the beads
// that show (all, the first few as a line draws while it sounds, or one
// alone), a pitch class at any octave, whether a part between two shapes
// is the same part, so its moved beads slide rather than jump, and the
// slide itself: only the beads that moved travel, eased, landing on their
// rows after SLIDE_SEC.

import { describe, expect, it } from 'vitest'
import type { TunePart } from './tune-line-parts'
import { pcOf, samePart, shownBeads, SLIDE_SEC, slidePitches, } from './tune-line-parts'

/** "Twinkle"'s first line's copy in C major's thirds, beside line 0. */
const COPY: TunePart = {
  line: 0,
  at: [4, 4, 11, 11, 12, 12, 11],
  label: 'copy',
}

describe('shownBeads', () => {
  it('shows every bead of a part by default', () => {
    expect(shownBeads(COPY)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('shows the first few of a line drawing as it sounds, never more than it has', () => {
    expect(shownBeads({ ...COPY, shown: 3 })).toEqual([0, 1, 2])
    expect(shownBeads({ ...COPY, shown: 0 })).toEqual([])
    expect(shownBeads({ ...COPY, shown: 12 })).toHaveLength(7)
  })

  it('shows one bead alone, and none for a bead the part does not have', () => {
    expect(shownBeads({ ...COPY, only: 4 })).toEqual([4])
    expect(shownBeads({ ...COPY, only: 7 })).toEqual([])
    expect(shownBeads({ ...COPY, only: -1 })).toEqual([])
  })
})

describe('pcOf', () => {
  it('gives a pitch class at any octave, below C4 too', () => {
    expect(pcOf(60)).toBe(0)
    expect(pcOf(61)).toBe(1)
    expect(pcOf(48)).toBe(0)
    expect(pcOf(-3)).toBe(9)
    expect(pcOf(66.6)).toBe(7)
  })
})

describe('samePart', () => {
  it('holds for a part on the same line, as long, with the same label', () => {
    expect(samePart(COPY, { ...COPY, at: COPY.at.map((a) => a + 1) })).toBe(
      true,
    )
  })

  it('fails for no part before, another line, another length or another label', () => {
    expect(samePart(undefined, COPY)).toBe(false)
    expect(samePart(COPY, { ...COPY, line: 1 })).toBe(false)
    expect(samePart(COPY, { ...COPY, at: [4, 4, 11] })).toBe(false)
    expect(samePart(COPY, { ...COPY, label: 'part' })).toBe(false)
  })
})

describe('slidePitches', () => {
  // Step 2's switch: the copy's beads over D, E and A move up a semitone
  const KEY = [64, 64, 71, 71, 72, 72, 71]
  const UP4 = [64, 64, 71, 71, 73, 73, 71]

  it('leaves the beads that did not move on their rows from the start', () => {
    const at = slidePitches(KEY, UP4, 0.1)
    for (const i of [0, 1, 2, 3, 6]) expect(at[i]).toBe(UP4[i])
  })

  it('moves the beads that moved from where they were, eased, to land on their rows', () => {
    const start = slidePitches(KEY, UP4, 0)
    const middle = slidePitches(KEY, UP4, SLIDE_SEC / 2)
    const landed = slidePitches(KEY, UP4, SLIDE_SEC)
    expect(start[4]).toBe(72)
    expect(middle[4]).toBeCloseTo(72.5, 5)
    expect(landed[4]).toBe(73)
    expect(slidePitches(KEY, UP4, 5)).toEqual(UP4)
  })

  it('eases in and out: a quarter of the way through it has gone less than a quarter of the way', () => {
    const quarter = slidePitches(KEY, UP4, SLIDE_SEC / 4)[4] - 72
    expect(quarter).toBeGreaterThan(0)
    expect(quarter).toBeLessThan(0.25)
  })

  it('puts a bead with no place before straight on its row', () => {
    expect(slidePitches([64], [64, 66], 0)).toEqual([64, 66])
  })
})
