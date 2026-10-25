// ============================================================
// Band chart rung names tests — which rows are named, and the gutter's room
// ============================================================
//
// Lesson 9's WEB-SPEC, Tests 5: names appear at the rung rows and nowhere
// else, and a chart given no names letters its rows as before (the octave
// toy's recorded picture, band-chart.test.ts, holds that). Each test mounts
// Lesson 9's chart as Step 4 has it for the lower voice, a notes axis from a
// semitone under do (D3) to one over the top do, the four rungs across the
// plot (on canvases that keep every call, band-chart.test-fixtures.ts), and
// reads where each row lies from the chart's own `pointOf`.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { BandScene } from './band-chart'
import type { Call, Figure, Mark } from './band-chart.test-fixtures'
import { capsOf, marksOf, paintCharts, paintFrames, } from './band-chart.test-fixtures'
import type { RungNames } from './band-chart-names'
import { rungNames } from './band-chart-names'
import { paintRungs } from './band-chart-rungs'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

/** Do for the lower voice, D3. */
const DO = 50

/** The four rungs' names, as the page spells them for the lower voice. */
const LADDER: [number, string][] = [
  [DO, 'do · D3'],
  [DO + 4, 'mi · F♯3'],
  [DO + 7, 'so · A3'],
  [DO + 12, 'top do · D4'],
]

/** Step 4's chart with `names` on its axis, and the rest of `scene`. */
const order = (names: RungNames, scene?: (s: BandScene) => void): Figure => ({
  opts: {
    target: DO,
    axis: { notes: [DO - 1, DO + 13], names },
    paintRungs,
  },
  scene: (s) => {
    s.rungs = [0, 400, 700, 1200].map((c) => ({ c, faint: true }))
    scene?.(s)
  },
})

/** The words a mark writes: the text after its colour, alignment, baseline and anchor. */
const wordsOf = (m: Mark): string => m.line.split(' ').slice(5).join(' ')

/** The words the calls wrote. */
const textsOf = (calls: readonly Call[]): Mark[] =>
  marksOf(calls).filter((m) => m.line.startsWith('text '))

describe('rung names on the notes axis', () => {
  it("names each rung's row in its words, and no other row, with no letters", async () => {
    // Arrange
    const figure = order(rungNames(LADDER))

    // Act
    const [{ chart, calls }] = await paintCharts(figure)

    // Assert: each name ending a gutter's room before the plot, at its row
    const x0 = chart.pointOf(0, 0).x
    const named = textsOf(calls).map((m) => [wordsOf(m), m.xs[1], m.ys[0]])
    expect(named).toEqual(
      LADDER.map(([midi, name]) => [
        name,
        x0 - 8,
        chart.pointOf(0, (midi - DO) * 100).y,
      ]),
    )
  })

  it('widens the gutter to the longest name, with room either side of it', async () => {
    // Arrange
    const figure = order(rungNames(LADDER))

    // Act
    const [{ chart, calls }] = await paintCharts(figure)

    // Assert: "top do · D4", 11 characters in the double's 7.2 px font,
    // starts 8 px in from the canvas and ends 8 px before the plot
    const longest = 'top do · D4'.length * 7.2
    expect(chart.pointOf(0, 0).x).toBeCloseTo(longest + 16, 9)
    const starts = textsOf(calls).map((m) => m.xs[0])
    expect(Math.min(...starts)).toBeCloseTo(8, 9)
  })

  it('keeps the 40 px gutter and leaves every row unnamed and unlettered when it is given no names', async () => {
    // Arrange
    const figure = order(rungNames([]))

    // Act
    const [{ chart, calls }] = await paintCharts(figure)

    // Assert: the plot starts where it does without names, and the 15
    // semitone rows are drawn with nothing written beside them
    expect(chart.pointOf(0, 0).x).toBe(40)
    expect(textsOf(calls)).toEqual([])
    const rows = marksOf(calls).filter(
      (m) => m.rgb === '195,204,214' && m.line.startsWith('stroke '),
    )
    expect(rows.map((m) => m.ys[0])).toEqual(
      Array.from({ length: 15 }, (_, i) => chart.pointOf(0, (i - 1) * 100).y),
    )
  })

  it('leaves a name unwritten whose row is outside the window', async () => {
    // Arrange: a name two semitones over the top do, beyond the chart's top
    const figure = order(rungNames([...LADDER, [DO + 14, 're · E4']]))

    // Act
    const [{ calls }] = await paintCharts(figure)

    // Assert
    expect(textsOf(calls).map(wordsOf)).toEqual(LADDER.map(([, name]) => name))
  })

  it('writes the same names in every frame, whatever the marks and readings before them left', async () => {
    // Arrange: a mark, the line and its reading, whose words are aligned
    // and placed otherwise
    const figure = order(rungNames(LADDER), (s) => {
      s.marks = [{ t: 0.4, label: 'try' }]
      s.line = [
        { t: 0.4, c: 380 },
        { t: 1.2, c: 405 },
      ]
      s.label = { t: 1.2, c: 405, text: '5 cents' }
    })

    // Act
    const { calls } = await paintFrames(figure, 2)

    // Assert
    const names = new Set(LADDER.map(([, name]) => name))
    const inFrame = (n: number): string[] =>
      capsOf(marksOf(calls))
        .filter(({ mark, frame }) => frame === n && names.has(wordsOf(mark)))
        .map(({ mark }) => mark.line)
    expect(inFrame(1)).toHaveLength(4)
    expect(inFrame(2)).toEqual(inFrame(1))
  })
})
