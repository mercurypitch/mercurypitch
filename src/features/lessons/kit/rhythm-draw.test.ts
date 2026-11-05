// ============================================================
// Rhythm drawing tests — the writing, as it sounds, on a line and on a staff
// ============================================================
//
// Lesson 17 WEB-SPEC, Tests 2 and 3: the checkpoint's bars written as the
// Ear Lab reads their onsets (FACTS 37); Step 4's rests where 4/4 puts
// them (FACTS 26a); beams joining only the flagged notes of one beat, once
// the beat's last note is written; the 4/4 with the first note; on the
// bass staff A3's stems down, its tie above and its dot over the top line,
// and on the treble A4's stems up, its tie below and its dot in its space
// (FACTS 29); a sounding note's whole tied run lit; the pitch-line view's
// bands and gaps; the counts; no reading before its cells are read; and
// every state's bars at 390 x 844 and at 344 px with no two readings
// overlapping and none cut off.

import { describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import { readRhythm } from '@/lib/ear/rhythm-notation'
import type { RhythmFigure, RhythmScene, RowState } from './rhythm-draw'
import { drawRhythm, layoutRhythm, xOf } from './rhythm-draw'
import type { Bar, NoteValue, Written } from './rhythm-model'
import { FOUR_QUARTERS, placeBars, toggleRest, writeGrid } from './rhythm-model'

/** The figure at 390 x 844 (the card's inner width) and at 344 px. */
const PHONE = { w: 356, h: 250 }
const NARROW = { w: 310, h: 250 }

const note = (value: NoteValue, more: Partial<Written> = {}): Written => ({
  kind: 'note',
  value,
  ...more,
})
const rest = (value: NoteValue): Written => ({ kind: 'rest', value })
const times = (n: number, w: Written): Written[] =>
  Array.from({ length: n }, () => w)

function figure(): SVGSVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  document.body.replaceChildren(el)
  return el
}

/** One row of `bars` on `staff`, drawn at `size`. */
function draw(
  bars: readonly Bar[],
  over: Partial<RhythmScene> = {},
  size = PHONE,
): { el: SVGSVGElement; fig: RhythmFigure } {
  const el = figure()
  const fig = drawRhythm(
    el,
    { staff: 'line', rows: [{ bars, bpm: 60 }], ...over },
    size,
  )
  return { el, fig }
}

/** A row's state with every symbol written, or the first `n`. */
const written = (
  fig: RhythmFigure,
  n?: number,
  more: Partial<RowState> = {},
): RowState => ({
  written: fig.rows[0].placed.map((_, i) => n === undefined || i < n),
  metre: true,
  ...more,
})

const all = (el: Element, sel: string): Element[] =>
  Array.from(el.querySelectorAll(sel))
const num = (el: Element | null | undefined, attr: string): number =>
  Number(el?.getAttribute(attr))
const sym = (el: Element, i: number): Element | null =>
  el.querySelector(`.rb-sym[data-i="${i}"]`)

/** A tie's curve: the control point's height, and the ends'. */
function tieBow(path: Element | null): { end: number; bow: number } {
  const d = path?.getAttribute('d') ?? ''
  const m = /M [\d.-]+ ([\d.-]+) Q [\d.-]+ ([\d.-]+)/.exec(d)
  return { end: Number(m?.[1]), bow: Number(m?.[2]) }
}

describe('drawRhythm', () => {
  it("writes the checkpoint's two bars as the Ear Lab reads their nine onsets (FACTS 37)", () => {
    // Arrange: "1, 2, 3 (4), 1 and 2, 3 and 4"
    const bars: Bar[] = [
      [note(1), note(1), note(2)],
      [note(0.5), note(0.5), note(1), note(0.5), note(0.5), note(1)],
    ]
    const onsets = [0, 1, 2, 4, 4.5, 5, 6, 6.5, 7]

    // Act
    const { el, fig } = draw(bars)
    const ear = readRhythm(onsets, 8)

    // Assert
    const shape = (s: {
      kind: string
      beat: number
      beats: number
      value: number
      dotted: boolean
      flags: number
    }) => [s.kind, s.beat, s.beats, s.value, s.dotted, s.flags]
    expect(fig.rows[0].placed.map(shape)).toEqual(ear.map(shape))
    expect(all(el, '.rb-note')).toHaveLength(9)
    expect(all(el, '.rb-note .rb-open')).toHaveLength(1)
  })

  it('writes every stem up on the one line, a whole note with none, and open heads for halves and wholes', () => {
    // Act
    const { el } = draw([[note(2), note(1), note(1)], [note(4)]])

    // Assert
    const heads = all(el, '.rb-head')
    expect(heads.map((h) => h.classList.contains('rb-open'))).toEqual([
      true,
      false,
      false,
      true,
    ])
    const stems = all(el, '.rb-stem')
    expect(stems).toHaveLength(3)
    for (const [i, s] of stems.entries()) {
      expect(num(s, 'y2')).toBeLessThan(num(heads[i], 'cy'))
      expect(num(s, 'x1')).toBeGreaterThan(num(heads[i], 'cx'))
    }
  })

  it('shows a symbol, its bar line and the 4/4 only once written, and the 4/4 with the first note', () => {
    // Arrange
    const { el, fig } = draw([times(4, note(1))])

    // Act: before any sound, then with the first note heard
    fig.set([{ written: [false, false, false, false], metre: false }])
    const before = {
      shown: all(el, '.rb-sym:not(.is-hidden)').length,
      metre: el.querySelector('.rb-metre')?.classList.contains('is-hidden'),
      bar: el.querySelector('.rb-barline')?.classList.contains('is-hidden'),
    }
    fig.set([written(fig, 1)])

    // Assert
    expect(before).toEqual({ shown: 0, metre: true, bar: true })
    expect(all(el, '.rb-sym:not(.is-hidden)')).toHaveLength(1)
    expect(el.querySelector('.rb-metre')?.classList.contains('is-hidden')).toBe(
      false,
    )
    expect(
      el.querySelector('.rb-barline')?.classList.contains('is-hidden'),
    ).toBe(true)
    fig.set([written(fig)])
    expect(
      el.querySelector('.rb-barline')?.classList.contains('is-hidden'),
    ).toBe(false)
  })

  it("beams only the flagged notes of one beat, and joins a beat's flags once its last note is written", () => {
    // Arrange: a quarter, two eighths, four sixteenths and a quarter
    const { el, fig } = draw([
      [note(1), note(0.5), note(0.5), ...times(4, note(0.25)), note(1)],
    ])
    const beams = all(el, '.rb-beam')

    // Act: the bar written as far as the first eighth, then through beat 2
    fig.set([written(fig, 2)])
    const flagged = {
      beam: beams[0].classList.contains('is-hidden'),
      beamed: sym(el, 1)?.classList.contains('is-beamed'),
    }
    fig.set([written(fig, 3)])

    // Assert: one beam per beat of flagged notes, the quarters in none
    expect(beams).toHaveLength(2)
    expect(all(el, '.rb-beam')[1].querySelectorAll('rect')).toHaveLength(2)
    expect(flagged).toEqual({ beam: true, beamed: false })
    expect(beams[0].classList.contains('is-hidden')).toBe(false)
    expect(sym(el, 1)?.classList.contains('is-beamed')).toBe(true)
    expect(sym(el, 2)?.classList.contains('is-beamed')).toBe(true)
    expect(beams[1].classList.contains('is-hidden')).toBe(true)
    expect(sym(el, 0)?.querySelector('.rb-flag')).toBeNull()
  })

  it("keeps Step 4's rests where 4/4 puts them: beats 2 and 3 silent are two quarter rests, beats 3 and 4 one half rest (FACTS 26a)", () => {
    // Arrange
    const middle = writeGrid(toggleRest(toggleRest(FOUR_QUARTERS, 1), 2))
    const end = writeGrid(toggleRest(toggleRest(FOUR_QUARTERS, 2), 3))

    // Act
    const a = draw([middle]).el
    const b = draw([end]).el

    // Assert
    expect(all(a, '.rb-rest').map((r) => r.getAttribute('data-value'))).toEqual(
      ['1', '1'],
    )
    expect(all(a, '.rb-rest').map((r) => r.getAttribute('data-i'))).toEqual([
      '1',
      '2',
    ])
    expect(all(b, '.rb-rest').map((r) => r.getAttribute('data-value'))).toEqual(
      ['2'],
    )
    expect(all(b, '.rb-rest').map((r) => r.getAttribute('data-i'))).toEqual([
      '2',
    ])
  })

  it('writes A3 on the bass staff stems down on the left, tied above, its dot over the top line (FACTS 29)', () => {
    // Arrange: Step 5's bars with Dot and Tie
    const bars: Bar[] = [
      [note(2, { dotted: true }), note(1, { tie: true })],
      [note(1, { dotted: true }), note(0.5), note(2)],
    ]

    // Act
    const { el, fig } = draw(bars, { staff: 'bass' })

    // Assert
    const row = fig.layout.rows[0]
    const top = row.y - 2 * row.space
    const heads = all(el, '.rb-head')
    expect(heads.every((h) => Math.abs(num(h, 'cy') - top) < 0.01)).toBe(true)
    for (const g of all(el, '.rb-note')) {
      const head = g.querySelector('.rb-head')
      const stem = g.querySelector('.rb-stem')
      if (stem === null) continue
      expect(num(stem, 'y2')).toBeGreaterThan(num(head, 'cy'))
      expect(num(stem, 'x1')).toBeLessThan(num(head, 'cx'))
    }
    const tie = tieBow(el.querySelector('.rb-tie'))
    expect(tie.bow).toBeLessThan(tie.end)
    expect(tie.end).toBeLessThan(top)
    const dots = all(el, '[data-part="dot"]')
    expect(dots).toHaveLength(2)
    for (const d of dots)
      expect(num(d, 'cy')).toBeCloseTo(top - row.space / 2, 2)
    expect(all(el, '.rb-staff')).toHaveLength(5)
    expect(all(el, '.rb-clef')).toHaveLength(1)
  })

  it('writes A4 on the treble staff stems up on the right, tied below, its dot in its own space (FACTS 29)', () => {
    // Arrange
    const bars: Bar[] = [
      [note(2, { dotted: true }), note(1, { tie: true })],
      [note(1, { dotted: true }), note(0.5), note(2)],
    ]

    // Act
    const { el, fig } = draw(bars, { staff: 'treble' })

    // Assert: A4 is the second space, half a space under the middle line
    const row = fig.layout.rows[0]
    const space = row.y + row.space / 2
    for (const g of all(el, '.rb-note')) {
      const head = g.querySelector('.rb-head')
      expect(num(head, 'cy')).toBeCloseTo(space, 2)
      const stem = g.querySelector('.rb-stem')
      if (stem === null) continue
      expect(num(stem, 'y2')).toBeLessThan(num(head, 'cy'))
      expect(num(stem, 'x1')).toBeGreaterThan(num(head, 'cx'))
    }
    const tie = tieBow(el.querySelector('.rb-tie'))
    expect(tie.bow).toBeGreaterThan(tie.end)
    expect(tie.end).toBeGreaterThan(space)
    for (const d of all(el, '[data-part="dot"]'))
      expect(num(d, 'cy')).toBeCloseTo(space, 2)
  })

  it('writes a note the row names on the staff at its place, with its ledger lines', () => {
    // Arrange: D4 over the bass staff, a ledger line under it
    const D4 = { letter: 'D' as const, alter: 0, octave: 4 }

    // Act
    const { el, fig } = draw([[note(4)]], {
      staff: 'bass',
      rows: [{ bars: [[note(4)]], bpm: 60, notes: [D4] }],
    })

    // Assert: D4 is place 11 on the bass staff, three and a half spaces over the middle line
    const row = fig.layout.rows[0]
    expect(num(el.querySelector('.rb-head'), 'cy')).toBeCloseTo(
      row.y - 3.5 * row.space,
      2,
    )
    expect(all(el, '.rb-note .rb-staff')).toHaveLength(1)
  })

  it("lights a sounding note's whole tied run, its tie too", () => {
    // Arrange
    const { el, fig } = draw([
      [note(2), note(1), note(1, { tie: true })],
      [note(1), note(1), note(2)],
    ])

    // Act
    fig.set([written(fig, undefined, { sounding: 3 })])

    // Assert
    expect(
      all(el, '.rb-sym.is-sounding').map((g) => g.getAttribute('data-i')),
    ).toEqual(['2', '3'])
    expect(el.querySelector('.rb-tie')?.classList.contains('is-sounding')).toBe(
      true,
    )
  })

  it('draws the pitch line: a band per sound as long as it is held, a dashed gap per rest, and no notation', () => {
    // Act
    const { el, fig } = draw(
      [[note(1), rest(1), note(1, { tie: true }), note(1)]],
      { lanes: true },
    )

    // Assert
    expect(all(el, '.rb-band')).toHaveLength(2)
    expect(all(el, '.rb-gap')).toHaveLength(1)
    expect(all(el, '.rb-head')).toHaveLength(0)
    expect(el.querySelector('.rb-metre')).toBeNull()
    const row = fig.layout.rows[0]
    const tied = all(el, '.rb-band')[1]
    // held for two beats less the gap before its end (FACTS 63)
    expect(num(tied, 'width')).toBeLessThan(xOf(row, 4) - xOf(row, 2))
    expect(num(tied, 'width')).toBeGreaterThan(xOf(row, 3.8) - xOf(row, 2))
  })

  it('counts each note under it, the unsaid in brackets, shown with its note, lit in turn and faint on its own', () => {
    // Arrange
    const { el, fig } = draw(
      [
        [
          note(1),
          note(0.5),
          note(0.5),
          ...times(4, note(0.25)),
          note(1, { dotted: false }),
        ],
      ],
      { counts: true },
    )

    // Act
    fig.set([written(fig, 3, { countLit: 1 })])
    const lit = all(el, '.rb-count.is-lit').map((c) => c.textContent)
    const shown = all(el, '.rb-count:not(.is-hidden)').length
    fig.set([written(fig, undefined, { faint: true, countLit: 1 })])

    // Assert (FACTS 20 to 22)
    expect(all(el, '.rb-count').map((c) => c.textContent)).toEqual([
      '1',
      '2',
      'and',
      '3',
      'e',
      'and',
      'a',
      '4',
    ])
    expect(lit).toEqual(['2'])
    expect(shown).toBe(3)
    expect(all(el, '.rb-count.is-lit')).toHaveLength(0)
    expect(all(el, '.rb-count.is-faint')).toHaveLength(8)
  })

  it('holds each beat the count does not say in brackets, a half note on beat 3 counting "3 (4)"', () => {
    // Act
    const { el } = draw([[note(1), note(1), note(2)]], { counts: true })

    // Assert
    expect(all(el, '.rb-count').map((c) => c.textContent)).toEqual([
      '1',
      '2',
      '3',
      '(4)',
    ])
    expect(all(el, '.rb-count.is-held')).toHaveLength(1)
  })

  it('shows no reading before its cells are read, and fills the cell sounding now over its length', () => {
    // Arrange
    const { el, fig } = draw([[note(1), note(1), note(2)]])

    // Act
    fig.set([
      written(fig, 2, {
        read: [true, false, false],
        filling: { cell: 1, seconds: 1 },
      }),
    ])

    // Assert
    const reads = all(el, '.rb-read')
    expect(reads.map((r) => r.classList.contains('is-hidden'))).toEqual([
      false,
      true,
      true,
    ])
    const cells = all(el, '.rb-cell')
    expect(cells[0].classList.contains('is-full')).toBe(true)
    expect(cells[1].classList.contains('is-filling')).toBe(true)
    expect((cells[1] as SVGGElement).style.getPropertyValue('--fill-s')).toBe(
      '1s',
    )
    expect(cells[2].classList.contains('is-filling')).toBe(false)
  })

  it("dashes a rest's cell in the strip", () => {
    // Act
    const { el } = draw([[note(1), rest(1), note(2)]])

    // Assert
    expect(
      all(el, '.rb-cell').map((c) => c.classList.contains('is-rest')),
    ).toEqual([false, true, false])
  })

  it("hangs a whole rest under its line and sets a half rest on it, a whole rest under the staff's fourth line", () => {
    // Act
    const line = draw([[rest(2), note(2)], [rest(4)]])
    const staff = draw([[rest(4)]], { staff: 'bass' })

    // Assert
    const y = line.fig.layout.rows[0].y
    const [half, whole] = all(line.el, '.rb-rest rect')
    expect(num(half, 'y') + num(half, 'height')).toBeCloseTo(y, 2)
    expect(num(whole, 'y')).toBeCloseTo(y, 2)
    const row = staff.fig.layout.rows[0]
    expect(num(staff.el.querySelector('.rb-rest rect'), 'y')).toBeCloseTo(
      row.y - row.space,
      2,
    )
  })

  it("sets each count under its note, and a held beat's under its beat", () => {
    // Act
    const { el, fig } = draw([[note(1), note(0.5), note(0.5), note(2)]], {
      counts: true,
    })

    // Assert: "1, 2 and, 3 (4)"
    const heads = all(el, '.rb-head').map((h) => num(h, 'cx'))
    const counts = all(el, '.rb-count').map((c) => num(c, 'x'))
    expect(counts.slice(0, 4)).toEqual(heads.map((x) => Number(x.toFixed(2))))
    const row = fig.layout.rows[0]
    expect(counts[4]).toBeGreaterThan(xOf(row, 3))
    expect(counts[4]).toBeLessThan(xOf(row, 3.5))
  })

  it("lays a one-bar figure's pads the width of their beats, 44 px or more from 344 px up (FACTS 70)", () => {
    // Act
    const { fig } = draw([times(4, note(1))], {}, NARROW)

    // Assert
    for (let b = 0; b < 4; b++) {
      const box = fig.padBox(0, b)
      expect(box.w).toBeGreaterThanOrEqual(44)
      expect(box.h).toBeGreaterThanOrEqual(44)
    }
  })

  it("shares one time axis across Play both's two rows, so each eighth at 60 sits over a quarter at 120", () => {
    // Arrange
    const sixty: Bar = [
      note(0.5),
      note(0.5),
      note(1),
      note(0.5),
      note(0.5),
      note(1),
    ]
    const twice: Bar = [note(1), note(1), note(2)]

    // Act
    const L = layoutRhythm(PHONE.w, PHONE.h, {
      staff: 'line',
      rows: [
        { bars: [sixty], bpm: 60 },
        { bars: [twice, twice], bpm: 120 },
      ],
    })

    // Assert
    const [a, b] = L.rows
    expect(xOf(a, 0.5)).toBeCloseTo(xOf(b, 1), 5)
    expect(xOf(a, 1)).toBeCloseTo(xOf(b, 2), 5)
    expect(b.top).toBeGreaterThan(a.bottom)
  })
})

describe("every state's bars, at 390 x 844 and at 344 px", () => {
  const halvings: Bar[][] = [
    [[note(4)]],
    [[note(2), note(2)]],
    [times(4, note(1))],
    [times(8, note(0.5))],
    [times(16, note(0.25))],
  ]
  const steps: { name: string; scene: RhythmScene }[] = [
    ...halvings.map((bars, i) => ({
      name: `halving ${i + 1}`,
      scene: { staff: 'line' as const, rows: [{ bars, bpm: 60 }] },
    })),
    ...[60, 90, 100, 120].map((bpm) => ({
      name: `Step 2 at ${bpm}`,
      scene: {
        staff: 'line' as const,
        rows: [{ bars: [[note(1), note(1), note(2)]], bpm }],
      },
    })),
    {
      name: 'Play both',
      scene: {
        staff: 'line',
        rows: [
          {
            bars: [
              [note(0.5), note(0.5), note(1), note(0.5), note(0.5), note(1)],
            ],
            bpm: 60,
          },
          {
            bars: [
              [note(1), note(1), note(2)],
              [note(1), note(1), note(2)],
            ],
            bpm: 120,
          },
        ],
      },
    },
    {
      name: "Step 3's second bar, counted",
      scene: {
        staff: 'line',
        counts: true,
        rows: [
          {
            bars: [
              [note(1), note(0.5), note(0.5), ...times(4, note(0.25)), note(1)],
            ],
            bpm: 60,
          },
        ],
      },
    },
    ...(
      [
        ['half rest', [[note(1), note(1), rest(2)], [note(1)]], 5, 2],
        ['quarter rest', [[note(1), rest(1), note(2)]], 4, 1],
        ['eighth rest', [[note(1), rest(0.5), note(0.5), note(2)]], 4, 1],
        [
          'sixteenth rest',
          [[note(1), rest(0.25), note(0.25), note(0.5), note(2)]],
          4,
          1,
        ],
        ['whole rest', [times(4, note(1)), [rest(4)], [note(1)]], 9, 4],
      ] as const
    ).map(([name, bars, beats, cell]) => ({
      name: `the ${name}'s example`,
      scene: {
        staff: 'line' as const,
        rows: [{ bars, bpm: 60, beats, reads: (i: number) => i === cell }],
      },
    })),
    ...(['bass', 'treble'] as const).flatMap((staff) =>
      [
        [
          [note(2), note(1), note(1)],
          [note(1), note(1), note(2)],
        ],
        [
          [note(2, { dotted: true }), note(1)],
          [note(1, { dotted: true }), note(0.5), note(2)],
        ],
        [
          [note(2), note(1), note(1, { tie: true })],
          [note(1), note(1), note(2)],
        ],
        [
          [note(2, { dotted: true }), note(1, { tie: true })],
          [note(1, { dotted: true }), note(0.5), note(2)],
        ],
      ].map((bars, i) => ({
        name: `Step 5 on the ${staff} staff, state ${i + 1}`,
        scene: { staff, rows: [{ bars, bpm: 60 }] },
      })),
    ),
    {
      name: 'free play, halved and joined',
      scene: {
        staff: 'line',
        counts: true,
        rows: [
          {
            bars: [[note(0.5), note(0.5), ...times(4, note(0.25)), note(2)]],
            bpm: 120,
          },
        ],
      },
    },
  ]

  for (const size of [PHONE, NARROW])
    for (const { name, scene } of steps)
      it(`${name} at ${size.w} px: no two readings overlap and none is cut off`, () => {
        // Act
        const { fig } = draw([], scene, size)

        // Assert
        for (const row of fig.rows) {
          const r = row.strip.readings
          for (const a of r) {
            expect(a.x - a.width / 2).toBeGreaterThanOrEqual(0)
            expect(a.x + a.width / 2).toBeLessThanOrEqual(size.w)
            for (const b of r)
              if (b !== a && a.row === b.row)
                expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(
                  (a.width + b.width) / 2,
                )
          }
          // a reading in the cells' row stays inside its cells
          for (const a of r.filter((x) => x.row === 0)) {
            const first = row.strip.cells[a.cells[0]]
            const last = row.strip.cells[a.cells[a.cells.length - 1]]
            expect(a.x - a.width / 2).toBeGreaterThanOrEqual(first.left - 0.01)
            expect(a.x + a.width / 2).toBeLessThanOrEqual(last.right + 0.01)
          }
        }
      })

  it('reads a beat of sixteenths "4 × 0.25 s" at 390 x 844', () => {
    // Act
    const { fig } = draw([times(16, note(0.25))])

    // Assert
    expect(fig.rows[0].strip.readings.map((r) => r.text)).toEqual(
      Array<string>(4).fill('4 × 0.25 s'),
    )
  })
})

// the placed symbols the toy books are the model's
describe('the placed symbols', () => {
  it("are the model's, in order", () => {
    // Arrange
    const bars: Bar[] = [[note(1), rest(1), note(2)]]

    // Act
    const { fig } = draw(bars)

    // Assert
    expect(fig.rows[0].placed).toEqual(placeBars(bars))
  })
})
