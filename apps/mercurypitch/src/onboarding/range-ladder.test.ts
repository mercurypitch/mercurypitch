// ============================================================
// The range ladder: where it stands, how it grows, what lights
// ============================================================

import { describe, expect, it } from 'vitest'
import { REACH_CENTS } from '@/lib/merc/constants'
import type { LadderView } from './range-ladder'
import { emptyLadder, growLadder, heightOf, LADDER_HOME, LADDER_MARGIN, LADDER_MIN_SPAN, ladderAround, pinName, reachCents, RUNG_SEMITONES, rungColour, rungLit, rungsOf, } from './range-ladder'

function view(over: Partial<LadderView>): LadderView {
  return { ...emptyLadder(null), ...over }
}

describe('the ladder', () => {
  it('stands two octaves tall around the held note, or around A3 with none', () => {
    expect(ladderAround(40)).toEqual({ base: 28, top: 52 })
    expect(ladderAround(null)).toEqual({
      base: LADDER_HOME - LADDER_MIN_SPAN / 2,
      top: LADDER_HOME + LADDER_MIN_SPAN / 2,
    })
  })

  it('grows in whole rungs to keep the voice on it with a tone to spare', () => {
    const span = ladderAround(57)

    const grown = growLadder(span, 40, 72)

    expect(grown.base).toBeLessThanOrEqual(40 - LADDER_MARGIN)
    expect(grown.top).toBeGreaterThanOrEqual(72 + LADDER_MARGIN)
    expect((span.base - grown.base) % RUNG_SEMITONES).toBe(0)
    expect((grown.top - span.top) % RUNG_SEMITONES).toBe(0)
    expect(grown.base).toBeGreaterThan(40 - LADDER_MARGIN - RUNG_SEMITONES)
  })

  it('never shrinks, and hands back the same span when nothing grows', () => {
    const span = { base: 30, top: 70 }

    expect(growLadder(span, 50, 55)).toBe(span)
    expect(growLadder(span, null, null)).toBe(span)
  })

  it('puts a rung at every whole tone, both ends included', () => {
    expect(rungsOf({ base: 40, top: 48 })).toEqual([40, 42, 44, 46, 48])
  })

  it('places a pitch by its height, kept on the ladder at either end', () => {
    const span = { base: 40, top: 64 }

    expect(heightOf(52, span)).toBe(0.5)
    expect(heightOf(30, span)).toBe(0)
    expect(heightOf(80, span)).toBe(1)
  })

  it("hands Merc's reach the height as cents from the middle, the ends at full reach", () => {
    const span = { base: 40, top: 64 }

    expect(reachCents(52, span)).toBe(0)
    expect(reachCents(40, span)).toBe(-REACH_CENTS)
    expect(reachCents(64, span)).toBe(REACH_CENTS)
    expect(reachCents(58, span)).toBe(REACH_CENTS / 2)
    expect(reachCents(80, span)).toBe(REACH_CENTS)
  })
})

describe('rungLit', () => {
  it('lights a rung for its own semitone and the one above it while sliding', () => {
    const sliding = view({ lit: [45] })

    expect(rungLit(44, sliding)).toBe(true)
    expect(rungLit(45, sliding)).toBe(true)
    expect(rungLit(46, sliding)).toBe(false)
    expect(rungLit(42, sliding)).toBe(false)
  })

  it('lights every rung between the pins once the range locks', () => {
    const locked = view({ lit: [40, 67], low: 40, high: 67, locked: true })

    expect(rungLit(52, locked)).toBe(true)
    expect(rungLit(39, locked)).toBe(true)
    expect(rungLit(68, locked)).toBe(false)
    expect(rungLit(37, locked)).toBe(false)
  })
})

describe('the colours and the pins', () => {
  it('runs teal at the foot, the house blue in the middle, violet at the top', () => {
    expect(rungColour(0)).toBe('rgb(45, 212, 191)')
    expect(rungColour(0.5)).toBe('rgb(88, 166, 255)')
    expect(rungColour(1)).toBe('rgb(188, 140, 255)')
    expect(rungColour(2)).toBe(rungColour(1))
  })

  it('names a pin by its note', () => {
    expect(pinName(40)).toBe('E2')
    expect(pinName(67)).toBe('G4')
  })
})
