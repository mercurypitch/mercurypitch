// ============================================================
// Lesson 12 strip layout tests — 44 px chips, none overlapping, at every width
// ============================================================
//
// WEB-SPEC, Tests 7 (FACTS 75): at every width from 344 to 1440 px every
// chip and control is at least 44 px each way and none overlaps another;
// the strip is one row at 440 px of figure width and above, two below; the
// compact layout is drawn below 240 px of height. FACTS 75's figure is
// 310 px wide on a 344 px page and 651 px on a 1440 px one, and a phone's
// spans its card up to the deck's 960 px, so every figure width from 310
// to 1440 px holds every page from 344 to 1440 px: each test walks all of
// them, not a sample, at compact and full heights.

import { describe, expect, it } from 'vitest'
import type { Rect } from '@/features/lessons/kit/tune-line-layout'
import { MIN_TARGET, overlaps } from '@/features/lessons/kit/tune-line-layout'
import type { StripLayout } from './strip-layout'
import { compactFor, rowsFor, stripLayout } from './strip-layout'

/** Every figure width from the 344 px page's 310 px to 1440 px. */
const WIDTHS = Array.from({ length: 1440 - 310 + 1 }, (_, i) => 310 + i)
/** Compact: the kit's floor, 844 x 390's figure, the last below 240 (FACTS 75). */
const COMPACT_HEIGHTS = [150, 162, 239]
/** Full: the first at 240, a phone's tall figure, the deck's, a desktop's (FACTS 75). */
const FULL_HEIGHTS = [240, 310, 340, 380]
const HEIGHTS = [...COMPACT_HEIGHTS, ...FULL_HEIGHTS]
const E = 1e-9

/** Each layout at every width and height, with a label for a failure. */
function* every(
  heights: readonly number[] = HEIGHTS,
): Generator<{ at: string; L: StripLayout }> {
  for (const height of heights)
    for (const width of WIDTHS)
      yield { at: `${width} x ${height}`, L: stripLayout({ width, height }) }
}

const controlsOf = (L: StripLayout): Rect[] => [...L.chips, L.buttons]

const inside = (r: Rect, L: StripLayout): boolean =>
  r.x >= -E && r.y >= -E && r.x + r.w <= L.width + E && r.y + r.h <= L.used + E

const clash = (rs: readonly Rect[]): boolean =>
  rs.some((a, i) => rs.some((b, j) => j > i && overlaps(a, b)))

describe('stripLayout: Tests 7', () => {
  it("makes every chip and the buttons' row at least 44 px each way, inside the strip, at every width", () => {
    // Arrange
    const bad: string[] = []

    // Act
    for (const { at, L } of every())
      for (const r of controlsOf(L)) {
        if (r.w < MIN_TARGET - E || r.h < MIN_TARGET - E)
          bad.push(`${at}: ${r.w} x ${r.h}`)
        if (!inside(r, L)) bad.push(`${at}: outside the strip`)
      }

    // Assert
    expect(bad).toEqual([])
  })

  it("overlaps no chip with another or with the buttons' row, at every width", () => {
    // Arrange
    const bad: string[] = []

    // Act
    for (const { at, L } of every()) if (clash(controlsOf(L))) bad.push(at)

    // Assert
    expect(bad).toEqual([])
  })

  it('lays one row of seven from 440 px of figure width and rows of four and three below, at every width', () => {
    // Arrange
    const bad: string[] = []

    // Act
    for (const { at, L } of every()) {
      const rows = L.width >= 440 ? 1 : 2
      const ys = L.chips.map((c) => c.y)
      const want = rows === 1 ? [0, 0, 0, 0, 0, 0, 0] : [0, 0, 0, 0, 52, 52, 52]
      if (L.rows !== rows || rowsFor(L.width) !== rows) bad.push(`${at}: rows`)
      if (ys.join() !== want.join()) bad.push(`${at}: ${ys.join()}`)
    }

    // Assert
    expect(bad).toEqual([])
    expect(stripLayout({ width: 439, height: 310 }).rows).toBe(2)
    expect(stripLayout({ width: 440, height: 310 }).rows).toBe(1)
  })

  it('draws the compact layout below 240 px and the full one from 240 px, at every height and width', () => {
    // Arrange
    const bad: string[] = []

    // Act
    for (let height = 150; height <= 900; height++)
      for (const width of [310, 356, 778]) {
        const want = height < 240
        const L = stripLayout({ width, height })
        if (L.compact !== want || compactFor(height) !== want)
          bad.push(`${width} x ${height}`)
      }
    for (const width of WIDTHS) {
      const below = stripLayout({ width, height: 239 })
      const at = stripLayout({ width, height: 240 })
      if (!below.compact || at.compact) bad.push(`w ${width}`)
    }

    // Assert
    expect(bad).toEqual([])
  })
})

describe('stripLayout: the chips', () => {
  it("gives FACTS 75's widths: 71.5 to 83.0 px in rows of four on phones, 56.7 to 86.1 px in one row on a desktop", () => {
    // Act
    const chipW = (width: number): number =>
      stripLayout({ width, height: 340 }).chips[0].w

    // Assert: figures of 310 and 356 px at 344 and 390 px; 445 and 651 px at 961 and 1440 px
    expect(chipW(310)).toBeCloseTo(71.5, 9)
    expect(chipW(356)).toBeCloseTo(83.0, 9)
    expect(chipW(445)).toBeCloseTo(56.7, 1)
    expect(chipW(651)).toBeCloseTo(86.1, 1)
  })

  it("spreads the full layout's chips across the figure, 8 px apart, the row of three under the first three at the four's width", () => {
    // Arrange
    const bad: string[] = []

    // Act
    for (const { at, L } of every(FULL_HEIGHTS)) {
      const perRow = L.rows === 1 ? 7 : 4
      const row = L.chips.slice(0, perRow)
      const right = row[perRow - 1].x + row[perRow - 1].w
      const apart = row
        .slice(1)
        .every((c, i) => Math.abs(c.x - (row[i].x + row[i].w) - 8) < E)
      const widths = new Set(L.chips.map((c) => c.w.toFixed(9)))
      const under = L.chips
        .slice(perRow)
        .every((c, i) => Math.abs(c.x - L.chips[i].x) < E)
      if (Math.abs(right - L.width) > E) bad.push(`${at}: ends at ${right}`)
      if (!apart || widths.size !== 1 || !under) bad.push(`${at}: spacing`)
    }

    // Assert
    expect(bad).toEqual([])
  })

  it('keeps the chips in scale order, I to vii°, left to right and then down', () => {
    // Arrange
    const bad: string[] = []

    // Act
    for (const { at, L } of every()) {
      const read = L.chips
        .map((c, i) => ({ c, i }))
        .sort((a, b) => a.c.y - b.c.y || a.c.x - b.c.x)
        .map((x) => x.i)
      if (read.join() !== '0,1,2,3,4,5,6') bad.push(`${at}: ${read.join()}`)
    }

    // Assert
    expect(bad).toEqual([])
  })
})

describe("stripLayout: the step's buttons", () => {
  it("puts the buttons' row under the chips, across the figure, in the full layout", () => {
    // Arrange
    const bad: string[] = []

    // Act
    for (const { at, L } of every(FULL_HEIGHTS)) {
      const lowest = Math.max(...L.chips.map((c) => c.y + c.h))
      const b = L.buttons
      if (L.beside || b.x !== 0 || b.w !== L.width) bad.push(`${at}: across`)
      if (b.y - lowest !== 8 || L.used !== b.y + b.h) bad.push(`${at}: under`)
    }

    // Assert
    expect(bad).toEqual([])
  })

  it("sets the compact chips in one row beside the step's buttons wherever a 44 px button fits beside 440 px of chips", () => {
    // Arrange
    const bad: string[] = []

    // Act
    for (const { at, L } of every(COMPACT_HEIGHTS)) {
      const fits = L.width >= 440 + 8 + 44
      const last = L.chips[6]
      const besideIt = L.buttons.y === 0 && L.buttons.x === last.x + last.w + 8
      if (L.beside !== fits) bad.push(`${at}: beside ${L.beside}`)
      if (fits && (L.rows !== 1 || !besideIt || L.used !== 44))
        bad.push(`${at}: not one row`)
      if (!fits && L.buttons.y !== L.rows * 52) bad.push(`${at}: not under`)
    }

    // Assert
    expect(bad).toEqual([])
  })

  it("at 844 x 390 sets seven chips 44 px tall and wider than 44 px beside the buttons, on the figure's 778 x 162 px", () => {
    // Act
    const L = stripLayout({ width: 778, height: 162 })

    // Assert
    expect(L.compact).toBe(true)
    expect(L.chips.map((c) => [c.y, c.h])).toEqual(Array(7).fill([0, 44]))
    expect(L.chips.every((c) => c.w > 44)).toBe(true)
    expect(L.chips[0].w).toBeCloseTo(56, 9)
    expect(L.buttons).toEqual({ x: 448, y: 0, w: 330, h: 44 })
  })
})
