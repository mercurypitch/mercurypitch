// ============================================================
// Tune line layout tests — every target 44 px, none overlapping, each under its gap
// ============================================================
//
// Lesson 6 WEB-SPEC, Tests 11 (FACTS 72): at every canvas width from 308 px
// (a 344 px phone, where the minim's column comes to 44 px) to 1440 px,
// every bead, gap and bracket target is at least 44 px each way and none
// overlaps another, each gap's target lies under its own gap, and the move
// between the lines sits at the end of line 1's strip. A drawing with no
// buttons on it (the hero's compact line) keeps no floor, so all seven of
// its notes fit a phone's 176 px.

import { describe, expect, it } from 'vitest'
import type { Rect, TuneLayout, TuneLayoutSpec } from './tune-line-layout'
import { columnsOf, gapShift, MIN_TARGET, overlaps, tuneLayout, } from './tune-line-layout'

/** "Twinkle"'s two lines: six crotchets and a minim each. */
const LINE = [1, 1, 1, 1, 1, 1, 2]
const TWO = [LINE, LINE]

/** The page's states at their design heights (WEB-SPEC, Toys 1). */
const STATES: readonly (Omit<TuneLayoutSpec, 'width'> & { name: string })[] = [
  {
    name: 'one line, contour marks or gap numbers',
    height: 276,
    beats: [LINE],
    rows: 21,
    names: true,
    below: true,
    above: false,
  },
  {
    name: 'both lines with their gaps',
    height: 350,
    beats: TWO,
    rows: 10,
    names: true,
    below: true,
    above: false,
  },
  {
    name: 'both lines with the named brackets',
    height: 350,
    beats: TWO,
    rows: 10,
    names: true,
    below: false,
    above: true,
  },
  {
    name: 'free play, both strips',
    height: 438,
    beats: TWO,
    rows: 10,
    names: true,
    below: true,
    above: true,
  },
]

const WIDTHS = Array.from({ length: 1440 - 308 + 1 }, (_, i) => 308 + i)

/** Every target of a layout, by strip: the beads, the gap buttons and the brackets. */
function strips(T: TuneLayout): Rect[][] {
  return [
    T.lines.flatMap((L) => L.beads),
    T.gaps.flatMap((g) => (g.target === null ? [] : [g.target])),
    T.gaps.flatMap((g) => (g.bracket === null ? [] : [g.bracket])),
  ]
}

const inside = (r: Rect, W: number, H: number): boolean =>
  r.x >= -0.001 &&
  r.y >= -0.001 &&
  r.x + r.w <= W + 0.001 &&
  r.y + r.h <= H + 0.001

describe('tuneLayout', () => {
  it.each(STATES)(
    '$name: every target at least 44 px each way, on the canvas, at every width',
    (state) => {
      const bad: string[] = []
      for (const width of WIDTHS) {
        const T = tuneLayout({ ...state, width })
        for (const r of strips(T).flat()) {
          if (r.w < MIN_TARGET - 0.001 || r.h < MIN_TARGET - 0.001)
            bad.push(`${width}: ${r.w.toFixed(1)} x ${r.h.toFixed(1)}`)
          if (!inside(r, width, state.height))
            bad.push(`${width}: off the canvas`)
        }
      }
      expect(bad).toEqual([])
    },
  )

  it.each(STATES)(
    '$name: no two targets overlap, in a strip or across them',
    (state) => {
      const bad: number[] = []
      for (const width of WIDTHS) {
        const all = strips(tuneLayout({ ...state, width })).flat()
        // the beads' columns touch, and so do neighbouring gap buttons: touching is not overlapping
        const clash = all.some((a, i) =>
          all.some((b, j) => j > i && overlaps(a, b)),
        )
        if (clash) bad.push(width)
      }
      expect(bad).toEqual([])
    },
  )

  it.each(STATES)(
    "$name: each gap's target lies under its own gap",
    (state) => {
      const bad: string[] = []
      for (const width of WIDTHS) {
        const T = tuneLayout({ ...state, width })
        T.gaps.forEach((g, i) => {
          for (const r of [g.target, g.bracket]) {
            if (r === null) continue
            const x = g.join ? width : g.x
            if (x < r.x - 0.001 || x > r.x + r.w + 0.001)
              bad.push(`${width}: gap ${i + 1}`)
          }
        })
      }
      expect(bad).toEqual([])
    },
  )

  it("puts the move between the lines, gap 7, at the end of line 1's strip, and only there", () => {
    for (const width of [308, 324, 339, 354, 640, 1440]) {
      // Act
      const T = tuneLayout({ ...STATES[1], width })

      // Assert: thirteen gaps, the seventh the join, in line 1's strip, flush right
      expect(T.gaps).toHaveLength(13)
      expect(T.gaps.map((g) => g.join)).toEqual(
        Array.from({ length: 13 }, (_, i) => i === 6),
      )
      const join = T.gaps[6]
      expect(join.line).toBe(0)
      expect(join.bracket).toBeNull()
      const t = join.target
      expect(t).not.toBeNull()
      if (t === null) return
      expect(t.x + t.w).toBeCloseTo(width, 6)
      expect(t.y).toBe(T.lines[0].below?.top)
    }
  })

  it('stacks two lines, the first above the second, each on its own band of rows', () => {
    // Act: the phone's figure, 354 px across the card's inner width
    const T = tuneLayout({ ...STATES[1], width: 354 })

    // Assert
    const [a, b] = T.lines
    expect(a.bandBottom).toBeLessThan(b.bandTop)
    expect(a.cols).toHaveLength(7)
    expect(b.cols).toHaveLength(7)
    // ten rows 9 px apart at 390 x 844's 350 px canvas (WEB-SPEC, Toys 1)
    expect(a.rowGap).toBeCloseTo(9, 6)
    expect(a.bandBottom - a.bandTop).toBeCloseTo(97, 6)
  })

  it('fits every note of a line with no buttons on it: eight crotchets in 176 px', () => {
    // Act: the hero's compact line between the Mercs on a 390 px phone
    const T = tuneLayout({
      width: 176,
      height: 150,
      beats: [LINE],
      rows: 16,
      names: false,
      below: false,
      above: false,
      fill: true,
      targets: false,
    })

    // Assert: 22 px a crotchet and 44 the minim, the last ending at the line's end
    const cols = T.lines[0].cols
    expect(cols.map((c) => c.w)).toEqual([...Array(6).fill(22), 44])
    expect(cols[6].x + cols[6].w).toBe(176)
  })

  it('keeps the 44 px floor, and every layout as it was, wherever a column is a button', () => {
    for (const state of STATES)
      for (const width of [300, 308, 324, 339, 354, 640, 1440])
        expect(tuneLayout({ ...state, width, targets: true })).toEqual(
          tuneLayout({ ...state, width }),
        )
  })
})

describe('columnsOf', () => {
  it('gives each note its length, a minim twice a crotchet, while eight crotchets fit', () => {
    // Act: 354 px, 44.25 px a crotchet
    const cols = columnsOf(354, LINE)

    // Assert
    expect(cols.map((c) => c.w)).toEqual([...Array(6).fill(44.25), 88.5])
    expect(cols[6].x + cols[6].w).toBe(354)
  })

  it('holds the crotchets at 44 px when they no longer fit, and gives the minim what is left', () => {
    // Assert: 75 px at a 375 px phone, 60 at 360 and 44 at 344 (FACTS 72)
    expect(columnsOf(339, LINE)[6].w).toBe(75)
    expect(columnsOf(324, LINE)[6].w).toBe(60)
    expect(columnsOf(308, LINE)[6].w).toBe(44)
    expect(
      columnsOf(308, LINE)
        .slice(0, 6)
        .every((c) => c.w === 44),
    ).toBe(true)
  })

  it('lets a drawing with no buttons share any width, with no floor', () => {
    // Act
    const cols = columnsOf(176, LINE, 0)

    // Assert: no column runs past the line, and none is empty
    expect(cols.map((c) => c.w)).toEqual([...Array(6).fill(22), 44])
    expect(cols.every((c) => c.w > 0 && c.x + c.w <= 176)).toBe(true)
  })
})

describe('gapShift', () => {
  it('shifts the gap buttons left only on the narrowest phones, by at most half a crotchet', () => {
    // Assert: none at 388 px phones and up, 6 px at 360, 22 at 344 (FACTS 72)
    expect(gapShift(352, LINE)).toBe(0)
    expect(gapShift(330, LINE)).toBe(0)
    expect(gapShift(324, LINE)).toBe(6)
    expect(gapShift(308, LINE)).toBe(22)
    expect(gapShift(300, LINE)).toBe(22)
  })
})
