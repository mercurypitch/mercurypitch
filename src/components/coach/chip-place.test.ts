// The tour chip's placement rule (chip-place.ts): where it floats so it
// covers nothing, on boxes laid out by hand.

import { describe, expect, it } from 'vitest'
import type { Box, ChipForm, ChipRoom, ChipSize } from './chip-place'
import { BAND, freeSpot, GAP, placeChip, stillClear } from './chip-place'

const box = (
  left: number,
  top: number,
  width: number,
  height: number,
): Box => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
})

/** A phone's column: 366 px wide from x 12, 716 px tall from y 58. */
const AREA = box(12, 58, 366, 716)
const SIZES: Record<ChipForm, ChipSize> = {
  full: { width: 300, height: 46 },
  short: { width: 160, height: 46 },
  mini: { width: 90, height: 46 },
}

const room = (hard: Box[], art: Box[] = [], area = AREA): ChipRoom => ({
  area,
  hard,
  art,
})

describe('freeSpot', () => {
  it('takes the end of the top row when nothing is there', () => {
    expect(freeSpot(AREA, [], SIZES.full)).toEqual({ left: 78, top: 58 })
  })

  it("takes the far side of a title's row, clear of the title's own words", () => {
    // "Good evening" from x 16, and its date under it
    const title = box(16, 64, 173, 31)
    const date = box(16, 98, 150, 18)

    expect(freeSpot(AREA, [title, date], SIZES.short)).toEqual({
      left: 218,
      top: 58,
    })
  })

  it('takes the end of the row where there is room on both sides of something', () => {
    const middle = box(150, 64, 20, 30)

    expect(freeSpot(AREA, [middle], SIZES.mini)).toEqual({ left: 288, top: 58 })
  })

  it('opens the next row under what fills the first, by the gap', () => {
    const row = box(12, 58, 366, 40)

    expect(freeSpot(AREA, [row], SIZES.short)).toEqual({
      left: 218,
      top: 102,
    })
  })

  it('keeps 4 px from everything beside it, and no more', () => {
    const area = box(0, 0, 200, 46)
    const left = box(0, 0, 36, 46)
    expect(freeSpot(area, [left], SIZES.short)).toEqual({ left: 40, top: 0 })
    const closer = box(0, 0, 37, 46)
    expect(freeSpot(area, [closer], SIZES.short)).toBeNull()
  })

  it('takes no row lower than it is allowed to', () => {
    const row = box(12, 58, 366, 100)

    expect(freeSpot(AREA, [row], SIZES.short, 58 + BAND)).toBeNull()
    expect(freeSpot(AREA, [row], SIZES.short)).toEqual({
      left: 218,
      top: 158 + GAP,
    })
  })

  it('finds nothing where the area is too small for it', () => {
    expect(freeSpot(box(0, 0, 100, 40), [], SIZES.mini)).toBeNull()
  })
})

describe('placeChip', () => {
  it('stands whole in the free room at the top of the column', () => {
    const title = box(16, 64, 50, 24)

    expect(placeChip({ column: room([title]), sizes: SIZES })).toEqual({
      form: 'full',
      left: 78,
      top: 58,
      where: 'column',
      covers: 'nothing',
    })
  })

  it('shrinks to its short line where only that fits by the title', () => {
    const title = box(16, 64, 173, 31)
    const date = box(16, 98, 150, 18)
    const cards = box(12, 120, 366, 654)

    const placed = placeChip({
      column: room([title, date, cards]),
      sizes: SIZES,
    })

    expect(placed).toMatchObject({ form: 'short', left: 218, top: 58 })
  })

  it('takes the nearest free spot further down, whole or short', () => {
    // the top is full; whole fits under a row at 300, short under one at 200
    const top = box(12, 58, 366, 120)
    const narrow = box(12, 178, 200, 122)

    expect(
      placeChip({ column: room([top, narrow]), sizes: SIZES }),
    ).toMatchObject({ form: 'short', top: 178 + GAP, where: 'column' })
    // where both open on the same row, whole
    expect(placeChip({ column: room([top]), sizes: SIZES })).toMatchObject({
      form: 'full',
      top: 178 + GAP,
    })
  })

  it("is Merc alone at the column's top before it goes to the bar", () => {
    const title = box(16, 64, 250, 31)
    const below = box(12, 110, 366, 664)
    const bar = room([], [], box(181, 2, 116, 46))

    expect(
      placeChip({ column: room([title, below]), bar, sizes: SIZES }),
    ).toMatchObject({ form: 'mini', left: 288, top: 58, where: 'column' })
  })

  it("stands in the bar where the column has no room at all, as on a phone's stage", () => {
    const stage = box(12, 58, 366, 716)
    const bar = room([box(62, 15, 111, 20)], [], box(8, 2, 374, 46))

    expect(
      placeChip({ column: room([stage]), bar, sizes: SIZES }),
    ).toMatchObject({ form: 'short', where: 'bar', covers: 'nothing' })
    // and where only Merc fits in it, Merc
    const narrowBar = room([], [], box(181, 2, 116, 46))
    expect(
      placeChip({ column: room([stage]), bar: narrowBar, sizes: SIZES }),
    ).toMatchObject({ form: 'mini', where: 'bar', left: 207, top: 2 })
  })

  it('stands over a picture only where nothing else is free, never over words', () => {
    const picture = box(12, 58, 366, 716)
    const words = box(12, 58, 200, 30)

    // whole, under the words, before short beside them
    expect(
      placeChip({ column: room([words], [picture]), sizes: SIZES }),
    ).toMatchObject({ form: 'full', top: 88 + GAP, covers: 'art' })
    const more = box(12, 110, 366, 664)
    expect(
      placeChip({ column: room([words, more], [picture]), sizes: SIZES }),
    ).toMatchObject({ form: 'short', left: 218, top: 58, covers: 'art' })
  })

  it('says so when nowhere is free', () => {
    const stage = box(12, 58, 366, 716)

    expect(placeChip({ column: room([stage]), sizes: SIZES })).toEqual({
      form: 'short',
      left: 218,
      top: 58,
      where: 'column',
      covers: 'something',
    })
  })
})

describe('stillClear', () => {
  const at = box(218, 58, 160, 46)

  it('holds a spot nothing has come under', () => {
    expect(stillClear(room([box(16, 64, 173, 31)]), at, 'nothing')).toBe(true)
  })

  it('lets go of it when words or a card come under it', () => {
    expect(stillClear(room([box(300, 90, 40, 20)]), at, 'nothing')).toBe(false)
    expect(stillClear(room([], [box(200, 80, 200, 80)]), at, 'nothing')).toBe(
      false,
    )
  })

  it('holds a spot over art while only art is under it', () => {
    expect(stillClear(room([], [box(0, 0, 400, 400)]), at, 'art')).toBe(true)
    expect(stillClear(room([box(300, 90, 40, 20)]), at, 'art')).toBe(false)
  })

  it('never holds a spot that covered something', () => {
    expect(stillClear(room([]), at, 'something')).toBe(false)
  })
})
