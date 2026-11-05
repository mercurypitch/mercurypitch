// ============================================================
// Stopwatch strip tests — every length read, and every reading fits
// ============================================================
//
// Lesson 17 WEB-SPEC, Tests 3: every reading at 60, 90, 100 and 120 BPM
// for every value, dotted values and a tied pair, two decimals at most;
// a tied pair in one cell; a beat of sixteenths that does not fit reading
// "4 × 0.25 s" once under its beat, closed up where even that has no room;
// a lone note too narrow for its cell reading on the row under it; second-
// row readings kept apart and inside the figure; and a strip that reads
// only the cells it is told to. When each reading shows is the toy's; the
// drawing's tests hold that none shows before its note ends.

import { describe, expect, it } from 'vitest'
import type { Bar, NoteValue, Written } from './rhythm-model'
import { placeBars } from './rhythm-model'
import type { StripPlan } from './stopwatch-strip'
import { planStrip, readWidth } from './stopwatch-strip'

const note = (value: NoteValue, more: Partial<Written> = {}): Written => ({
  kind: 'note',
  value,
  ...more,
})
const rest = (value: NoteValue): Written => ({ kind: 'rest', value })
const times = (n: number, w: Written): Written[] =>
  Array.from({ length: n }, () => w)

/** A strip `width` px wide over `beats`, drawn as the rhythm bar's one line is: the 4/4's room at the left. */
function plan(
  bars: readonly Bar[],
  bpm: number,
  width = 2000,
  beats = bars.length * 4,
  reads?: (index: number) => boolean,
): StripPlan {
  const x0 = 30
  const x1 = width - 4
  return planStrip(placeBars(bars), bpm, {
    x: (beat) => x0 + (beat / beats) * (x1 - x0),
    left: 4,
    right: x1,
    reads: reads === undefined ? undefined : (_c, i) => reads(i),
  })
}

const texts = (p: StripPlan): string[] => p.readings.map((r) => r.text)

/** Whether two readings on one row share any pixel: two packed edge to edge do not. */
const overlap = (p: StripPlan): boolean =>
  p.readings.some((a, i) =>
    p.readings.some(
      (b, j) =>
        j > i &&
        a.row === b.row &&
        Math.abs(a.x - b.x) < (a.width + b.width) / 2 - 1e-9,
    ),
  )

describe('planStrip', () => {
  it('reads every value at 60 BPM, dotted values and tied pairs, in seconds to two decimals at most', () => {
    // Act
    const whole = plan([[note(4)]], 60)
    const halves = plan([[note(2), note(2)]], 60)
    const quarters = plan([times(4, note(1))], 60)
    const eighths = plan([times(8, note(0.5))], 60)
    const sixteenths = plan([times(16, note(0.25))], 60)
    const dotted = plan(
      [
        [note(2, { dotted: true }), note(1)],
        [note(1, { dotted: true }), note(0.5), note(2)],
      ],
      60,
    )
    const tied = plan(
      [
        [note(2), note(1), note(1, { tie: true })],
        [note(1), note(1), note(2)],
      ],
      60,
    )
    const tiedDot = plan(
      [
        [note(2, { dotted: true }), note(1, { tie: true })],
        [note(1, { dotted: true }), note(0.5), note(2)],
      ],
      60,
    )

    // Assert (FACTS 16, 63)
    expect(texts(whole)).toEqual(['4 s'])
    expect(texts(halves)).toEqual(['2 s', '2 s'])
    expect(texts(quarters)).toEqual(['1 s', '1 s', '1 s', '1 s'])
    expect(new Set(texts(eighths))).toEqual(new Set(['0.5 s']))
    expect(new Set(texts(sixteenths))).toEqual(new Set(['0.25 s']))
    expect(texts(dotted)).toEqual(['3 s', '1 s', '1.5 s', '0.5 s', '2 s'])
    // a tied pair is one sound, one cell, one length
    expect(texts(tied)).toEqual(['2 s', '1 s', '2 s', '1 s', '2 s'])
    expect(texts(tiedDot)).toEqual(['3 s', '2.5 s', '0.5 s', '2 s'])
  })

  it('reads the same values at 90, 100 and 120 BPM without rounding them tidier', () => {
    // Arrange
    const bar: Bar = [note(1), note(1), note(2)]

    // Act
    const at = (bpm: number) => texts(plan([bar], bpm))

    // Assert
    expect(at(90)).toEqual(['0.67 s', '0.67 s', '1.33 s'])
    expect(at(100)).toEqual(['0.6 s', '0.6 s', '1.2 s'])
    expect(at(120)).toEqual(['0.5 s', '0.5 s', '1 s'])
    expect(
      texts(plan([[note(1, { dotted: true }), note(0.5), note(2)]], 120)),
    ).toEqual(['0.75 s', '0.25 s', '1 s'])
  })

  it('gives a tied pair one cell across both notes, and a rest a cell of its own', () => {
    // Act
    const p = plan([[note(1), rest(1), note(1, { tie: true }), note(1)]], 60)

    // Assert
    expect(p.cells.map((c) => [c.kind, c.beats])).toEqual([
      ['note', 1],
      ['rest', 1],
      ['note', 2],
    ])
    expect(p.cells[2].first).toBe(2)
    expect(p.cells[2].last).toBe(3)
  })

  it('reads a beat of sixteenths once under it at 390 px, "4 × 0.25 s", and closes it up at 344 px', () => {
    // Arrange: the figure is 356 px wide at 390 x 844 and about 310 at 344
    const bars: Bar[] = [times(16, note(0.25))]

    // Act
    const wide = plan(bars, 60, 356)
    const narrow = plan(bars, 60, 310)

    // Assert
    expect(texts(wide)).toEqual(Array<string>(4).fill('4 × 0.25 s'))
    expect(wide.readings.every((r) => r.row === 0)).toBe(true)
    expect(texts(narrow)).toEqual(Array<string>(4).fill('4×0.25 s'))
    expect(narrow.readings.every((r) => r.row === 0)).toBe(true)
    expect(narrow.readings.map((r) => r.cells)).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [8, 9, 10, 11],
      [12, 13, 14, 15],
    ])
    expect(overlap(wide)).toBe(false)
    expect(overlap(narrow)).toBe(false)
  })

  it('reads a lone note too narrow for its cell on the row under it, centred on its cell', () => {
    // Arrange: Step 5's two bars with Dot, on the staff's narrower room
    const bars: Bar[] = [
      [note(2, { dotted: true }), note(1)],
      [note(1, { dotted: true }), note(0.5), note(2)],
    ]

    // Act
    const p = plan(bars, 60, 310)

    // Assert: the eighth after the dotted quarter
    const eighth = p.readings.find((r) => r.text === '0.5 s')
    const cell = p.cells[3]
    expect(eighth?.row).toBe(1)
    expect(eighth?.x).toBeCloseTo((cell.left + cell.right) / 2, 5)
    expect(p.readings.filter((r) => r.row === 0).map((r) => r.text)).toEqual([
      '3 s',
      '1 s',
      '1.5 s',
      '2 s',
    ])
  })

  it('keeps the second row apart and inside the figure', () => {
    // Arrange: rests too narrow to read in their cells, side by side
    const bars: Bar[] = [[rest(0.25), rest(0.25), rest(0.5), rest(1), rest(2)]]

    // Act
    const p = plan(bars, 60, 310)

    // Assert
    const second = p.readings.filter((r) => r.row === 1)
    expect(second.map((r) => r.text)).toEqual(['0.25 s', '0.25 s', '0.5 s'])
    expect(overlap(p)).toBe(false)
    for (const r of p.readings) {
      expect(r.x - r.width / 2).toBeGreaterThanOrEqual(4)
      expect(r.x + r.width / 2).toBeLessThanOrEqual(306)
    }
  })

  it('packs a full second row both ways, closing its runs up when it must', () => {
    // Arrange: the take's two bars, too narrow to read "1 s" in its cell
    const bars: Bar[] = [
      [note(1), note(1), note(2)],
      [note(0.5), note(0.5), note(1), note(0.5), note(0.5), note(1)],
    ]

    // Act
    const roomy = plan(bars, 60, 266)
    const tight = plan(bars, 60, 250)

    // Assert
    const second = (p: StripPlan) =>
      p.readings.filter((r) => r.row === 1).map((r) => r.text)
    expect(second(roomy)).toEqual([
      '1 s',
      '1 s',
      '2 × 0.5 s',
      '1 s',
      '2 × 0.5 s',
      '1 s',
    ])
    expect(second(tight)).toEqual([
      '1 s',
      '1 s',
      '2×0.5 s',
      '1 s',
      '2×0.5 s',
      '1 s',
    ])
    for (const [p, width] of [
      [roomy, 266],
      [tight, 250],
    ] as const) {
      expect(overlap(p)).toBe(false)
      for (const r of p.readings) {
        expect(r.x - r.width / 2).toBeGreaterThanOrEqual(4)
        expect(r.x + r.width / 2).toBeLessThanOrEqual(width - 4)
      }
    }
  })

  it('reads only the cells it is told to, and the others take no room', () => {
    // Arrange: the sixteenth rest's example, a bar long
    const bars: Bar[] = [[note(1), rest(0.25), note(0.25), note(0.5), note(2)]]

    // Act
    const p = plan(bars, 60, 356, 4, (i) => i === 1)

    // Assert
    expect(p.cells).toHaveLength(5)
    expect(p.readings.map((r) => [r.text, r.cells])).toEqual([['0.25 s', [1]]])
  })

  it('measures a reading by its characters and its room', () => {
    // Assert: 0.6 em of the 12 px mono face a character, and 6 px of room
    expect(readWidth('1 s')).toBeCloseTo(27.6, 5)
    expect(readWidth('4 × 0.25 s')).toBeCloseTo(78, 5)
  })
})
