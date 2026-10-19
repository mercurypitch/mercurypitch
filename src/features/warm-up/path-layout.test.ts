// ============================================================
// The Warm-up path's layout: places, Merc's spots, the scale, the frame
// ============================================================
//
// W units, as the storyboard was measured (DESIGN-warm-up.md §1.2 and §3),
// with y up from the floor. The screens are the ones §3 fits: a 390 x 844
// phone, an iPhone with its insets, an iPad, and the 320 x 568 that
// scrolls.

import { describe, expect, it } from 'vitest'
import type { ScreenBox } from './path-layout'
import { columnX, columnY, fitScale, layoutTop, MAX_K, MERC_SONG_SCALE, mercFeet, MIN_K, openingScroll, pathFrame, RIM_W, segmentD, sparkleCount, sparkles, SPARKLES_MAX, stopPlaces, TOP_END_PX, TOP_LOCKED_PX, } from './path-layout'

const PHONE: ScreenBox = { width: 390, height: 844, top: 56, bottom: 0 }
const IPHONE: ScreenBox = { width: 390, height: 844, top: 103, bottom: 34 }
const IPAD: ScreenBox = { width: 820, height: 1180, top: 80, bottom: 20 }
const SMALL: ScreenBox = { width: 320, height: 568, top: 56, bottom: 0 }
const IPAD_SIDE: ScreenBox = { width: 1180, height: 820, top: 56, bottom: 0 }
const IPAD_UP: ScreenBox = { width: 820, height: 1180, top: 56, bottom: 0 }

const round = (value: number, places = 3): number =>
  Math.round(value * 10 ** places) / 10 ** places

describe('the stops', () => {
  it("stand in the storyboard's five places, names right then left", () => {
    const places = stopPlaces(5, 'rest')
    expect(places.map((p) => round(p.x))).toEqual([
      0.543, 0.455, 0.553, 0.47, 0.543,
    ])
    expect(places.map((p) => round(p.y))).toEqual([
      0.132, 0.451, 0.71, 0.976, 1.24,
    ])
    expect(places.map((p) => p.side)).toEqual([
      'right',
      'left',
      'right',
      'left',
      'right',
    ])
  })

  it('climb on for a longer plan, the last gap repeating (pw-stops)', () => {
    const places = stopPlaces(8, 'rest')
    const gaps = places.slice(1).map((p, i) => round(p.y - places[i]!.y))
    expect(gaps).toEqual([0.319, 0.259, 0.266, 0.264, 0.264, 0.264, 0.264])
    expect(places.map((p) => p.side).at(-1)).toBe('left')
  })

  it('pack closer at the end, under its titles (screen 3)', () => {
    const places = stopPlaces(5, 'end')
    const gaps = places.slice(1).map((p, i) => round(p.y - places[i]!.y))
    expect(gaps).toEqual([0.21, 0.21, 0.21, 0.21])
  })

  it('reach up to the top stop, or to Merc on it at the end', () => {
    expect(round(layoutTop(stopPlaces(5, 'rest'), 'rest'))).toBe(
      round(1.24 + RIM_W + 0.02),
    )
    // At the end: Merc's feet 0.036 over the song stop, and screen 3's
    // 0.311 W from them to his crown (option B).
    expect(round(layoutTop(stopPlaces(5, 'end'), 'end'))).toBe(
      round(0.972 + 0.036 + 0.311),
    )
    expect(layoutTop([], 'rest')).toBe(0)
  })
})

describe("Merc's height on the song", () => {
  it("is screen 3's, drawn smaller there than anywhere else (option B)", () => {
    // The renderer draws his crown's tip 0.42 W over the song stop's centre
    // at full size (PR 1102), his feet 0.036 over it; screen 3 draws him
    // 0.311 W from feet to crown.
    expect(round((0.42 - 0.036) * MERC_SONG_SCALE)).toBe(0.311)
    expect(round(MERC_SONG_SCALE, 2)).toBe(0.81)
  })

  it('the end reaches over his crown as he is drawn there', () => {
    // Measured in the end fixture at 390 x 844 at full size: his crown's
    // tip 163 px, or 0.416 W, over the song stop's centre. On the song he
    // is scaled about his feet.
    const end = stopPlaces(5, 'end')
    const crown = 0.036 + (0.416 - 0.036) * MERC_SONG_SCALE
    expect(layoutTop(end, 'end') - end[4]!.y).toBeGreaterThanOrEqual(crown)
  })
})

describe("Merc's spots", () => {
  const places = stopPlaces(5, 'rest')

  it('on the floor left of the bottom stop at the start', () => {
    expect(mercFeet(places, { at: 'floor' })).toEqual({ x: 0.2075, y: 0 })
  })

  it('beside a stop, away from its name, centred on its height', () => {
    // Ng slides' name is on the left: Merc stands on its right.
    const ng = mercFeet(places, { at: 'beside', index: 1 })
    expect(ng.x).toBeGreaterThan(places[1]!.x + RIM_W)
    expect(round(ng.y)).toBe(round(places[1]!.y - 0.175))
    // Long note's is on the right: he stands on its left.
    const longNote = mercFeet(places, { at: 'beside', index: 2 })
    expect(longNote.x).toBeLessThan(places[2]!.x - RIM_W)
  })

  it('on the song stop at the end, and on the floor for a stop not there', () => {
    const end = stopPlaces(5, 'end')
    const on = mercFeet(end, { at: 'on', index: 4 })
    expect(round(on.x)).toBe(round(end[4]!.x - 0.054))
    expect(round(on.y)).toBe(round(end[4]!.y + 0.036))
    expect(mercFeet(places, { at: 'beside', index: 9 })).toEqual({
      x: 0.2075,
      y: 0,
    })
  })
})

describe('the scale (§3)', () => {
  it('is 1 with room to spare, and never more', () => {
    const fit = fitScale({ width: 390, restRoom: 900, endRoom: 900, count: 5 })
    expect(fit).toEqual({ k: MAX_K, scrolls: false })
  })

  it('is the smaller of the rest and end fits, between the clamps', () => {
    const fit = fitScale({ width: 375, restRoom: 401, endRoom: 420, count: 5 })
    expect(round(fit.k, 2)).toBe(0.79)
    expect(fit.scrolls).toBe(false)
  })

  it('stops at 0.75, and the path scrolls', () => {
    const fit = fitScale({ width: 320, restRoom: 300, endRoom: 260, count: 5 })
    expect(fit).toEqual({ k: MIN_K, scrolls: true })
  })
})

describe("the path's frame on a screen", () => {
  it('a 390 x 844 phone: full size, the floor over the buttons, no scroll', () => {
    const frame = pathFrame(PHONE, 5, 'rest')
    expect(frame).toEqual({
      column: 390,
      unit: 390,
      k: 1,
      floor: 702,
      height: 844,
      scrolls: false,
    })
  })

  it('an iPhone with its insets: one scale for every state', () => {
    const rest = pathFrame(IPHONE, 5, 'rest')
    const end = pathFrame(IPHONE, 5, 'end')
    // 0.886 while Merc stood on the song at full size: screen 3's Merc
    // gives the path back about 5% (option B).
    expect(round(rest.k, 3)).toBe(0.935)
    expect(end.k).toBe(rest.k)
    expect(rest.floor).toBe(844 - 34 - 142)
    expect([rest.scrolls, end.scrolls]).toEqual([false, false])
  })

  it("an iPad: the phone's column, centred (option (a))", () => {
    const frame = pathFrame(IPAD, 5, 'rest')
    expect(frame.column).toBe(430)
    expect(frame.k).toBe(1)
    expect(columnX(0.5, frame)).toBe(215)
  })

  it('a 320 x 568 phone: the smallest scale, and a taller column to scroll', () => {
    const frame = pathFrame(SMALL, 5, 'rest')
    expect(frame.k).toBe(MIN_K)
    expect(frame.scrolls).toBe(true)
    // The floor keeps its distance from the column's bottom.
    expect(frame.height - frame.floor).toBe(568 - 426)
  })

  it('a long plan scrolls on a phone that fits five', () => {
    const frame = pathFrame(PHONE, 9, 'rest')
    expect(frame.k).toBe(MIN_K)
    expect(frame.scrolls).toBe(true)
    expect(frame.height).toBeGreaterThan(844)
  })

  it('the free run used: its line under the chip, and the path under both (§5.10)', () => {
    // Nine stops on an iPad upright, where the first visit's scale is set by
    // its own top room: the locked path needs the line's room too.
    const start = pathFrame(IPAD_UP, 9, 'rest')
    const locked = pathFrame(IPAD_UP, 9, 'rest', true)
    expect(locked.scrolls).toBe(false)
    expect(locked.k).toBeLessThan(start.k)
    const reach = columnY(layoutTop(stopPlaces(9, 'rest'), 'rest'), locked)
    expect(reach).toBeGreaterThanOrEqual(IPAD_UP.top + TOP_LOCKED_PX - 0.5)
    // The owner's routine on an iPad on its side: under its line too, at a
    // scale no larger than the first visit's.
    const side = pathFrame(IPAD_SIDE, 5, 'rest', true)
    expect(side.scrolls).toBe(false)
    expect(side.k).toBeLessThanOrEqual(pathFrame(IPAD_SIDE, 5, 'rest').k)
    expect(
      columnY(layoutTop(stopPlaces(5, 'rest'), 'rest'), side),
    ).toBeGreaterThanOrEqual(IPAD_SIDE.top + TOP_LOCKED_PX - 0.5)
  })

  it('an exact fit does not scroll by a rounding error', () => {
    // 379 x 768: the end's path fits its room to 1e-13 px over the floor.
    const box: ScreenBox = { width: 379, height: 768, top: 56, bottom: 0 }
    const end = pathFrame(box, 5, 'end')
    expect(end.scrolls).toBe(false)
    expect(end.floor).toBe(768 - 142)
  })

  it('a path taller than its screen opens at its floor, the end at its top', () => {
    expect(openingScroll(pathFrame(SMALL, 5, 'rest'), 'rest')).toBe('floor')
    expect(openingScroll(pathFrame(SMALL, 5, 'end'), 'end')).toBe('top')
    // On a 320 x 568 phone the end is taller than the screen: opened at its
    // top, Merc's crown on the song is under the titles, not behind them.
    const end = pathFrame(SMALL, 5, 'end')
    expect(end.scrolls).toBe(true)
    const crown = columnY(layoutTop(stopPlaces(5, 'end'), 'end'), end)
    expect(crown).toBeGreaterThanOrEqual(SMALL.top + TOP_END_PX)
  })

  it('places a W point in the column, up from its floor', () => {
    const frame = pathFrame(PHONE, 5, 'rest')
    expect(columnX(0.543, frame)).toBeCloseTo(211.77, 2)
    expect(columnY(0.132, frame)).toBeCloseTo(702 - 51.48, 2)
  })
})

describe('the path between two stops', () => {
  it('leaves the lower upright and arrives at the upper upright', () => {
    expect(segmentD({ x: 100, y: 500 }, { x: 80, y: 400 })).toBe(
      'M100 500C100 450 80 450 80 400',
    )
  })
})

describe("the night's points", () => {
  it('number 8 per 100,000 px at rest and 13.7 at the end, never past 40', () => {
    expect(sparkles(390 * 844, 'rest')).toHaveLength(26)
    expect(sparkles(390 * 844, 'end')).toHaveLength(SPARKLES_MAX)
    expect(sparkleCount(320 * 568, 'end')).toBe(25)
  })

  it('are the same points on every visit, the end adding to them', () => {
    const rest = sparkles(390 * 844, 'rest')
    expect(sparkles(390 * 844, 'rest')).toEqual(rest)
    expect(sparkles(390 * 844, 'end').slice(0, rest.length)).toEqual(rest)
  })
})
