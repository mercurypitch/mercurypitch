// The Top Shelf's grade: cents past the shelf, and first tries.
// ============================================================

import { describe, expect, it } from 'vitest'
import { LINE_SCORE, medalFor } from './line-grade'
import type { ShelfGrade } from './shelf-grade'
import { NO_LEAPS, overshootOf, roomLine, shelfQuality, statsOf, walkLine, withLeap, } from './shelf-grade'

const FIFTH = 7

describe('a shelf', () => {
  it('landed on the first leap, exactly, is a first try worth everything', () => {
    const g = withLeap(NO_LEAPS, 7, FIFTH, true)
    expect(g).toEqual({
      leaps: 1,
      firstTry: true,
      overshootCents: 0,
      landed: true,
    })
    expect(shelfQuality(g)).toBe(1)
  })

  it('costs nothing flat within the catch: it landed, and nothing was past it', () => {
    expect(withLeap(NO_LEAPS, 6.6, FIFTH, true).overshootCents).toBe(0)
  })

  it('costs what it was sung past the ask, in cents (§7)', () => {
    const g = withLeap(NO_LEAPS, 7.18, FIFTH, true)
    expect(g.firstTry).toBe(true)
    expect(g.overshootCents).toBeCloseTo(18, 9)
    expect(shelfQuality(g)).toBeCloseTo(0.82, 9)
  })

  it('is worth nothing a whole semitone sharp, or more', () => {
    expect(shelfQuality(withLeap(NO_LEAPS, 8, FIFTH, true))).toBe(0)
    expect(shelfQuality(withLeap(NO_LEAPS, 12, FIFTH, true))).toBe(0)
  })

  it('missed first is not a first try, and is graded by the leap that landed (D6)', () => {
    let g: ShelfGrade = withLeap(NO_LEAPS, 6.3, FIFTH, false)
    expect(g).toMatchObject({ leaps: 1, firstTry: false, landed: false })
    g = withLeap(g, 7.3, FIFTH, true)
    expect(g).toMatchObject({ leaps: 2, firstTry: false, landed: true })
    expect(g.overshootCents).toBeCloseTo(30, 9)
  })

  it('keeps its grade once he is on it', () => {
    const on = withLeap(NO_LEAPS, 7.1, FIFTH, true)
    expect(withLeap(on, 9, FIFTH, true)).toBe(on)
  })

  it('reached with no leap graded counts as first try, the Line NO_STOPS', () => {
    expect(NO_LEAPS.firstTry).toBe(true)
    expect(shelfQuality(NO_LEAPS)).toBe(1)
  })

  it('only counts past, never short', () => {
    expect(overshootOf(6.5, FIFTH)).toBe(0)
    expect(overshootOf(7.5, FIFTH)).toBeCloseTo(50, 9)
  })
})

describe('the cards', () => {
  it('read the room in the Line phrasing: cents past the shelf, first times', () => {
    const run = statsOf([
      withLeap(NO_LEAPS, 7, FIFTH, true),
      withLeap(NO_LEAPS, 5.72, 5, true),
      withLeap(withLeap(NO_LEAPS, 6.2, FIFTH, false), 7, FIFTH, true),
      withLeap(NO_LEAPS, 5, 5, true),
    ])
    expect(run).toEqual({
      pct: 82,
      overshootCents: 18,
      firstTry: 3,
      shelves: 4,
    })
    expect(roomLine(run)).toBe('18¢ past the shelf · 3 of 4 first time')
    expect(medalFor(run.pct, LINE_SCORE)).toBe('silver')
  })

  it('read the walk as §7 writes it, weighted by each room shelves', () => {
    expect(
      walkLine([
        { pct: 100, overshootCents: 0, firstTry: 1, shelves: 1 },
        { pct: 80, overshootCents: 20, firstTry: 4, shelves: 4 },
        { pct: 70, overshootCents: 30, firstTry: 3, shelves: 4 },
      ]),
    ).toBe('22¢ past the shelf on average · 8 of 9 first time')
  })

  it('say nothing for a walk with no rooms in it', () => {
    expect(walkLine([])).toBe('')
  })
})
