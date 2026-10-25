// ============================================================
// Band chart arcs tests — where Merc's leaps land, and how they draw
// ============================================================
//
// Lesson 9's WEB-SPEC, Tests 5: arcs land where their times and cents say,
// from the end of one band to the start of the next, the apex above the
// straight line between them and the digit beside it. Each test mounts
// Lesson 9's chart for the lower voice, do D3, with the rungs and arcs the
// page would pass (on canvases that keep every call,
// band-chart.test-fixtures.ts), and reads where each mark should land from
// the chart's own `pointOf`.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { BandScene } from './band-chart'
import type { Call, Figure, Mark } from './band-chart.test-fixtures'
import { capsOf, channels, marksOf, paintCharts, paintFrames, } from './band-chart.test-fixtures'
import type { Arc } from './band-chart-arcs'
import { columnArcs } from './band-chart-arcs'
import { BAND_COLOR } from './band-chart-draw'
import type { Rung } from './band-chart-rungs'
import { paintRungs } from './band-chart-rungs'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

/** Do for the lower voice, D3. */
const DO = 50

/** Steps 1 and 2's window, two semitones under do to two over so. */
const STEP_WINDOW: [number, number] = [DO - 2, DO + 9]

/** Step 4's window, a semitone under do to one over the top do. */
const ORDER_WINDOW: [number, number] = [DO - 1, DO + 13]

/** Steps 1 and 2: do's band and so's, over two slots. */
const DO_SO: Rung[] = [
  { c: 0, from: 0.2, to: 1.6 },
  { c: 700, from: 2.4, to: 3.8 },
]

/** Merc's leap between them, from the end of do's band to the start of so's. */
const LEAP: Arc = { from: { t: 1.6, c: 0 }, to: { t: 2.4, c: 700 } }

/** Lesson 9's chart on `notes`, showing `rungs`, `arcs` and the rest of `scene`. */
const chart = (
  arcs: Arc[],
  rungs: Rung[] = DO_SO,
  notes = STEP_WINDOW,
  scene?: (s: BandScene) => void,
): Figure => ({
  opts: { target: DO, axis: { notes }, paintRungs },
  scene: (s) => {
    s.rungs = rungs
    s.arcs = arcs
    scene?.(s)
  },
})

const AMBER = channels(BAND_COLOR.target).rgb

/** The arcs among the marks: amber strokes of more than one straight piece. */
const arcsIn = (marks: readonly Mark[]): Mark[] =>
  marks.filter(
    (m) => m.rgb === AMBER && m.line.startsWith('stroke ') && m.xs.length > 2,
  )

/** The arcs the calls drew. */
const arcsOf = (calls: readonly Call[]): Mark[] => arcsIn(marksOf(calls))

/** The digits the calls drew: amber words. */
const digitsOf = (calls: readonly Call[]): Mark[] =>
  marksOf(calls).filter((m) => m.rgb === AMBER && m.line.startsWith('text '))

/** A digit's words, and the middle of where they run. */
const digitAt = (m: Mark): { words: string; x: number; y: number } => ({
  words: m.line.slice(m.line.lastIndexOf(' ') + 1),
  x: (m.xs[0] + m.xs[1]) / 2,
  y: m.ys[0],
})

/** A mark's points. */
const pointsOf = (m: Mark): { x: number; y: number }[] =>
  m.xs.map((x, i) => ({ x, y: m.ys[i] }))

/** How far each point stands above the straight line from the first point to the last, px. */
function aboveChord(m: Mark): number[] {
  const points = pointsOf(m)
  const [a, b] = [points[0], points[points.length - 1]]
  return points.map(
    (p) => a.y + ((p.x - a.x) / (b.x - a.x)) * (b.y - a.y) - p.y,
  )
}

/** Where a drawn line stands at `x`, between the points either side. */
function yAt(m: Mark, x: number): number {
  const points = pointsOf(m)
  const i = points.findIndex((p) => p.x >= x)
  const [a, b] = [points[i - 1], points[i]]
  return a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y)
}

describe("Merc's leap as an arc", () => {
  it("leaves from the end of do's band and lands at the start of so's", async () => {
    // Arrange
    const figure = chart([LEAP])

    // Act
    const [{ chart: c, calls }] = await paintCharts(figure)

    // Assert
    const points = pointsOf(arcsOf(calls)[0])
    const [first, last] = [points[0], points[points.length - 1]]
    expect(first).toEqual(c.pointOf(1.6, 0))
    expect(last.x).toBeCloseTo(c.pointOf(2.4, 700).x, 9)
    expect(last.y).toBeCloseTo(c.pointOf(2.4, 700).y, 9)
  })

  it('rises above the straight line between its ends at every point between them', async () => {
    // Arrange
    const figure = chart([LEAP])

    // Act
    const [{ calls }] = await paintCharts(figure)

    // Assert
    const heights = aboveChord(arcsOf(calls)[0]).slice(1, -1)
    for (const h of heights) expect(h).toBeGreaterThan(0)
  })

  it('bows upward for a leap down as well', async () => {
    // Arrange: so's band first, then do's, Merc leaping down between them
    const down: Arc = { from: { t: 1.6, c: 700 }, to: { t: 2.4, c: 0 } }
    const figure = chart(
      [down],
      [
        { c: 700, from: 0.2, to: 1.6 },
        { c: 0, from: 2.4, to: 3.8 },
      ],
    )

    // Act
    const [{ calls }] = await paintCharts(figure)

    // Assert
    const heights = aboveChord(arcsOf(calls)[0]).slice(1, -1)
    for (const h of heights) expect(h).toBeGreaterThan(0)
  })

  it('stands highest above that line at mid-span, its digit beside it and outside the arc', async () => {
    // Arrange
    const figure = chart([{ ...LEAP, digit: 1 }])

    // Act
    const [{ chart: c, calls }] = await paintCharts(figure)

    // Assert: the apex half way across, the digit's middle within 12 px of
    // it and above the arc where it stands, clear of the stroke
    const arc = arcsOf(calls)[0]
    const heights = aboveChord(arc)
    const apex = pointsOf(arc)[heights.indexOf(Math.max(...heights))]
    expect(apex.x).toBeCloseTo(
      (c.pointOf(1.6, 0).x + c.pointOf(2.4, 0).x) / 2,
      9,
    )
    const digit = digitAt(digitsOf(calls)[0])
    expect(digit.words).toBe('1')
    expect(Math.hypot(digit.x - apex.x, digit.y - apex.y)).toBeLessThanOrEqual(
      12,
    )
    expect(yAt(arc, digit.x) - digit.y).toBeGreaterThanOrEqual(6)
  })

  it('draws as far as it is drawn: the whole arc up to that fraction of the way across', async () => {
    // Arrange: the same leap whole, and three tenths drawn
    const whole = chart([LEAP])
    const part = chart([{ ...LEAP, drawn: 0.3 }])

    // Act
    const [full, partial] = await paintCharts(whole, part)

    // Assert: the same points as the whole arc's, then one where it stops
    const all = pointsOf(arcsOf(full.calls)[0])
    const some = pointsOf(arcsOf(partial.calls)[0])
    expect(some.slice(0, -1)).toEqual(all.slice(0, some.length - 1))
    const [start, end] = [all[0].x, all[all.length - 1].x]
    expect(some[some.length - 1].x).toBeCloseTo(start + 0.3 * (end - start), 9)
  })

  it('draws nothing before its second note sounds', async () => {
    // Arrange
    const figure = chart([{ ...LEAP, drawn: 0, digit: 1 }])

    // Act
    const [{ calls }] = await paintCharts(figure)

    // Assert
    expect(arcsOf(calls)).toEqual([])
    expect(digitsOf(calls)).toEqual([])
  })

  it('shows its digit only once it is drawn half way, to its apex', async () => {
    // Arrange
    const short = chart([{ ...LEAP, drawn: 0.45, digit: 3 }])
    const half = chart([{ ...LEAP, drawn: 0.5, digit: 3 }])

    // Act
    const [before, at] = await paintCharts(short, half)

    // Assert
    expect(digitsOf(before.calls)).toEqual([])
    expect(digitsOf(at.calls).map((m) => digitAt(m).words)).toEqual(['3'])
  })

  it("stays inside the plot, digit and all, on a leap up to the plot's top row", async () => {
    // Arrange: Step 4's window, whose top row is a semitone over the top
    // do; a leap from do up to that row, across most of the window
    const figure = chart(
      [{ from: { t: 0.5, c: 0 }, to: { t: 3.5, c: 1300 }, digit: 5 }],
      [{ c: 0 }, { c: 1200 }],
      ORDER_WINDOW,
    )

    // Act
    const [{ chart: c, calls }] = await paintCharts(figure)

    // Assert
    const top = c.pointOf(0, c.hi).y
    for (const p of pointsOf(arcsOf(calls)[0]))
      expect(p.y).toBeGreaterThanOrEqual(top - 1e-9)
    const digit = digitsOf(calls)[0]
    expect(Math.min(...digit.xs)).toBeGreaterThanOrEqual(c.pointOf(0, 0).x)
    expect(Math.max(...digit.xs)).toBeLessThanOrEqual(c.pointOf(c.window, 0).x)
    expect(digit.ys[0]).toBeGreaterThanOrEqual(top)
  })

  it('is drawn over every band and under every lit edge', async () => {
    // Arrange: do's band lit, as the line sits in it, and the leap
    const figure = chart([LEAP], [{ ...DO_SO[0], lit: true }, DO_SO[1]])

    // Act
    const [{ calls }] = await paintCharts(figure)

    // Assert: do's strip, edges and line, so's, the arc, then do's lit
    // edges and words
    const marks = marksOf(calls)
    const arc = marks.indexOf(arcsIn(marks)[0])
    const kinds = marks
      .map((m, i) => (i === arc ? 'arc' : m.rgb))
      .filter(
        (k) =>
          k === 'arc' || k === AMBER || k === channels(BAND_COLOR.mint).rgb,
      )
    expect(kinds).toEqual([
      ...Array(8).fill(AMBER),
      'arc',
      ...Array(3).fill(channels(BAND_COLOR.mint).rgb),
    ])
  })

  it("keeps butt ends in the frame after the singer's line left its caps round", async () => {
    // Arrange
    const figure = chart([LEAP], DO_SO, STEP_WINDOW, (s) => {
      s.line = [
        { t: 0.4, c: -30 },
        { t: 1.4, c: 10 },
      ]
    })

    // Act
    const { calls } = await paintFrames(figure, 2)

    // Assert
    const marks = capsOf(marksOf(calls))
    const arcs = arcsIn(marks.map((m) => m.mark))
    const caps = marks
      .filter((m) => arcs.includes(m.mark))
      .map((m) => [m.frame, m.cap])
    expect(caps).toEqual([
      [1, 'butt'],
      [2, 'butt'],
    ])
  })

  it('draws no arc on a chart whose scene has no rungs', async () => {
    // Arrange: the leap, and a scene that holds no rungs
    const figure: Figure = {
      opts: { target: DO, axis: { notes: STEP_WINDOW }, paintRungs },
      scene: (s) => {
        s.arcs = [{ ...LEAP, digit: 1 }]
      },
    }

    // Act
    const [{ calls }] = await paintCharts(figure)

    // Assert
    expect(arcsOf(calls)).toEqual([])
    expect(digitsOf(calls)).toEqual([])
  })
})

describe('the five leaps in rung mode', () => {
  it("cuts Step 4's window into five columns in play order, each leap inside its own, numbered 1 to 5", async () => {
    // Arrange: the four rungs across the plot, faint, and the syllabus's
    // five leaps (mi to so, do to mi, do to so, so to the top do, do to the
    // top do), whole
    const leaps = columnArcs(
      [
        [400, 700],
        [0, 400],
        [0, 700],
        [700, 1200],
        [0, 1200],
      ],
      4,
    )
    const rungs = [0, 400, 700, 1200].map((c) => ({ c, faint: true }))
    const figure = chart(leaps, rungs, ORDER_WINDOW)

    // Act
    const [{ chart: c, calls }] = await paintCharts(figure)

    // Assert: arc i within the i-th fifth, across three quarters of it at
    // least, from its first note's row to its second's; its digit over it
    const arcs = arcsOf(calls)
    const digits = digitsOf(calls).map(digitAt)
    expect(arcs).toHaveLength(5)
    expect(digits.map((d) => d.words)).toEqual(['1', '2', '3', '4', '5'])
    const fifth = (c.pointOf(4, 0).x - c.pointOf(0, 0).x) / 5
    arcs.forEach((arc, i) => {
      const start = c.pointOf(0, 0).x + i * fifth
      const [lo, hi] = [Math.min(...arc.xs), Math.max(...arc.xs)]
      expect(lo).toBeGreaterThanOrEqual(start)
      expect(hi).toBeLessThanOrEqual(start + fifth)
      expect(hi - lo).toBeGreaterThanOrEqual(0.75 * fifth - 1e-9)
      expect(arc.ys[0]).toBeCloseTo(c.pointOf(0, leaps[i].from.c).y, 9)
      expect(arc.ys[arc.ys.length - 1]).toBeCloseTo(
        c.pointOf(0, leaps[i].to.c).y,
        9,
      )
      expect(digits[i].x).toBeGreaterThanOrEqual(start)
      expect(digits[i].x).toBeLessThanOrEqual(start + fifth)
    })
  })
})
