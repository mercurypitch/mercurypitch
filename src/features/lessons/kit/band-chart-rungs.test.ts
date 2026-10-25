// ============================================================
// Band chart rungs tests — where each rung lands, and how it lights
// ============================================================
//
// Lesson 9's WEB-SPEC, Tests 5: a scene with one rung at 0 across the plot
// paints exactly as the single band does, so Lessons 3 and 5's charts see no
// change; and rungs over slots and across the plot land where their times
// and cents say, each with its own glow and lit edge. Each test of where
// rungs land mounts Lesson 9's chart as its lower voice's Steps 1, 2 and 5
// have it, a notes axis from two semitones under do (D3) to two over so, 4
// seconds across, with the rungs the page would pass (on canvases that
// keep every call, band-chart.test-fixtures.ts), and reads where each mark
// should land from the chart's own `pointOf`.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { BandScene } from './band-chart'
import type { Call, Figure, Mark } from './band-chart.test-fixtures'
import { capsOf, channels, marksOf, paintCharts, paintFrames, } from './band-chart.test-fixtures'
import { BAND_COLOR } from './band-chart-draw'
import { HOLD_5, PUSH_5, SING_3 } from './band-chart-lessons.test-fixtures'
import type { Rung } from './band-chart-rungs'
import { paintRungs } from './band-chart-rungs'
import { HIT_TOLERANCE_CENTS } from './band-words'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

/** Do for the lower voice, D3. */
const DO = 50

/** Lesson 9's chart on the lower voice's window, two semitones under do to two over so, showing `rungs` and the rest of `scene`. */
const ladder = (rungs: Rung[], scene?: (s: BandScene) => void): Figure => ({
  opts: { target: DO, axis: { notes: [DO - 2, DO + 9] }, paintRungs },
  scene: (s) => {
    s.rungs = rungs
    scene?.(s)
  },
})

/** The singer's line climbing into do's band, its caps round (drawTrace). */
const singing = (s: BandScene): void => {
  s.line = [
    { t: 0.6, c: -40 },
    { t: 1.8, c: 5 },
  ]
}

const AMBER = channels(BAND_COLOR.target).rgb
const MINT = channels(BAND_COLOR.mint).rgb

/** The marks drawn in `rgb`: Merc's bands in amber, their lit edges in mint. */
const inColor = (marks: readonly Mark[], rgb: string): Mark[] =>
  marks.filter((m) => m.rgb === rgb)

/** Where a mark sits, without its style. */
const place = (m: Mark): { xs: readonly number[]; ys: readonly number[] } => ({
  xs: m.xs,
  ys: m.ys,
})

describe('a rung over its time slot', () => {
  it("fills only from its slot's start to its end, at its note, its lit edge and words inside them", async () => {
    // Arrange: so's rung over the second and third seconds, the line in it
    const figure = ladder([{ c: 700, from: 1, to: 3, lit: true }])

    // Act
    const [{ chart, calls }] = await paintCharts(figure)

    // Assert
    const start = chart.pointOf(1, 700).x
    const end = chart.pointOf(3, 700).x
    const marks = marksOf(calls)
    const band = inColor(marks, AMBER)
    const edge = inColor(marks, MINT)
    // the strip, its two edges and Merc's line; the two lit edges and the words
    expect(band).toHaveLength(4)
    expect(edge).toHaveLength(3)
    expect(place(band[0])).toEqual({
      xs: [start, end],
      ys: [
        chart.pointOf(1, 700 + HIT_TOLERANCE_CENTS).y,
        chart.pointOf(1, 700 - HIT_TOLERANCE_CENTS).y,
      ],
    })
    for (const m of [...band, ...edge]) {
      expect(Math.min(...m.xs)).toBeGreaterThanOrEqual(start)
      expect(Math.max(...m.xs)).toBeLessThanOrEqual(end)
    }
  })

  it.each<[string, Rung]>([
    ['a sounding, lit rung', { c: 0, from: 0.5, to: 2, glow: 1, lit: true }],
    ['a faint rung', { c: 700, from: 2, to: 3.5, faint: true }],
  ])(
    'keeps every stroke of %s inside its slot in the frame after a line was drawn',
    async (_name, rung) => {
      // Arrange: the line drawn in the first frame leaves its caps round
      const figure = ladder([rung], singing)

      // Act
      const { chart, calls } = await paintFrames(figure, 2)

      // Assert: each stroke's ends, and half its width past them unless its caps are butt
      const start = chart.pointOf(rung.from ?? 0, rung.c).x
      const end = chart.pointOf(rung.to ?? chart.window, rung.c).x
      const strokes = capsOf(marksOf(calls)).filter(
        ({ mark }) =>
          mark.line.startsWith('stroke ') &&
          (mark.rgb === AMBER || mark.rgb === MINT),
      )
      const second = strokes.filter(({ frame }) => frame === 2)
      expect(second).toHaveLength(strokes.length / 2)
      for (const { mark, cap } of second) {
        const past = cap === 'butt' ? 0 : mark.width / 2
        expect(Math.min(...mark.xs) - past).toBeGreaterThanOrEqual(start)
        expect(Math.max(...mark.xs) + past).toBeLessThanOrEqual(end)
      }
    },
  )

  it('keeps its words inside the plot over a slot too narrow for them', async () => {
    // Arrange: do's rung lit over the window's first eighth, about 31 px
    const figure = ladder([{ c: 0, from: 0, to: 0.5, lit: true }])

    // Act
    const [{ chart, calls }] = await paintCharts(figure)

    // Assert: the words start after the gutter's letters and end in the plot
    const words = marksOf(calls).filter((m) => m.line.endsWith(' IN THE BAND'))
    expect(words).toHaveLength(1)
    expect(Math.min(...words[0].xs)).toBeGreaterThanOrEqual(
      chart.pointOf(0, 0).x + 2,
    )
    expect(Math.max(...words[0].xs)).toBeLessThanOrEqual(
      chart.pointOf(chart.window, 0).x,
    )
  })

  it('stands a staircase: each rung over its own slot, at its own note', async () => {
    // Arrange: the compact chart's do and so, over two slots
    const figure = ladder([
      { c: 0, from: 0.2, to: 1.6 },
      { c: 700, from: 2.4, to: 3.8 },
    ])

    // Act
    const [{ chart, calls }] = await paintCharts(figure)

    // Assert
    const strip = (from: number, to: number, c: number): object => ({
      xs: [chart.pointOf(from, c).x, chart.pointOf(to, c).x],
      ys: [
        chart.pointOf(from, c + HIT_TOLERANCE_CENTS).y,
        chart.pointOf(from, c - HIT_TOLERANCE_CENTS).y,
      ],
    })
    const fills = inColor(marksOf(calls), AMBER).filter((m) =>
      m.line.startsWith('rect '),
    )
    expect(fills.map(place)).toEqual([strip(0.2, 1.6, 0), strip(2.4, 3.8, 700)])
  })
})

describe('rungs across the plot', () => {
  it('spans the plot with each rung that has no slot, each at its own row', async () => {
    // Arrange: do, mi and so as the ladder's rows
    const figure = ladder([{ c: 0 }, { c: 400 }, { c: 700 }])

    // Act
    const [{ chart, calls }] = await paintCharts(figure)

    // Assert
    const row = (c: number): object => ({
      xs: [chart.pointOf(0, c).x, chart.pointOf(chart.window, c).x],
      ys: [
        chart.pointOf(0, c + HIT_TOLERANCE_CENTS).y,
        chart.pointOf(0, c - HIT_TOLERANCE_CENTS).y,
      ],
    })
    const fills = inColor(marksOf(calls), AMBER).filter((m) =>
      m.line.startsWith('rect '),
    )
    expect(fills.map(place)).toEqual([row(0), row(400), row(700)])
  })
})

describe("each rung's own light", () => {
  it('glows only the line of the rung whose note sounds', async () => {
    // Arrange: do sounding, so at rest
    const figure = ladder([{ c: 0, glow: 1 }, { c: 700 }])

    // Act
    const [{ chart, calls }] = await paintCharts(figure)

    // Assert: the wide, soft stroke of a glow, at do's line alone
    const y = chart.pointOf(0, 0).y
    const glows = inColor(marksOf(calls), AMBER).filter((m) => m.width === 12)
    expect(glows.map((m) => m.ys)).toEqual([[y, y]])
  })

  it('draws every band before any lit edge, so that no neighbour covers one', async () => {
    // Arrange: a staircase, do lit, mi after it
    const figure = ladder([
      { c: 0, from: 0, to: 2, lit: true },
      { c: 400, from: 2, to: 4 },
    ])

    // Act
    const [{ calls }] = await paintCharts(figure)

    // Assert: do's strip, edges and line, then mi's, then do's lit edges and words
    const order = marksOf(calls)
      .map((m) => m.rgb)
      .filter((rgb) => rgb === AMBER || rgb === MINT)
    expect(order).toEqual([...Array(8).fill(AMBER), ...Array(3).fill(MINT)])
  })
})

describe('a faint rung', () => {
  it('draws its strip, edges and line where a rung at rest has them, each less opaque', async () => {
    // Arrange
    const atRest = ladder([{ c: 700 }])
    const faint = ladder([{ c: 700, faint: true }])

    // Act
    const [rest, faded] = await paintCharts(atRest, faint)

    // Assert
    const full = inColor(marksOf(rest.calls), AMBER)
    const weak = inColor(marksOf(faded.calls), AMBER)
    expect(full).toHaveLength(4)
    expect(weak.map(place)).toEqual(full.map(place))
    weak.forEach((m, i) => {
      expect(m.opacity).toBeLessThan(full[i].opacity)
    })
  })

  it('draws its strip, edges and line only over its slot', async () => {
    // Arrange: so's rung over the second and third seconds, before its turn
    const figure = ladder([{ c: 700, from: 1, to: 3, faint: true }])

    // Act
    const [{ chart, calls }] = await paintCharts(figure)

    // Assert: each of the four from the slot's start to its end, no further
    const slot = [chart.pointOf(1, 700).x, chart.pointOf(3, 700).x]
    const weak = inColor(marksOf(calls), AMBER)
    expect(weak.map((m) => [Math.min(...m.xs), Math.max(...m.xs)])).toEqual(
      Array(4).fill(slot),
    )
  })

  it('draws in full while its note sounds, as a rung that is not faint does', async () => {
    // Arrange
    const sounding = ladder([{ c: 700, glow: 1 }])
    const faintSounding = ladder([{ c: 700, glow: 1, faint: true }])

    // Act
    const [full, lifted] = await paintCharts(sounding, faintSounding)

    // Assert
    expect(lifted.calls).toEqual(full.calls)
  })
})

/**
 * A chart on a notes axis with no echo, as Lesson 9's will be: Merc's band
 * half lit as his note fades, the singer's line inside it.
 */
const NOTES: Figure = {
  opts: { target: 57, axis: { notes: [53, 72], named: [57, 69] } },
  scene: (s) => {
    s.line = [
      { t: 0.5, c: -60 },
      { t: 1.5, c: -10 },
    ]
    s.head = { t: 1.5, c: -10 }
    s.glow = 0.5
    s.lit = true
  },
}

/**
 * A figure with its band as one rung at 0 across the plot, which
 * carries the scene's glow and lit edge: the scene's own are put out, so
 * only the rung can paint them.
 */
function asOneRung(figure: Figure): Figure {
  return {
    opts: { ...figure.opts, paintRungs },
    scene: (s) => {
      figure.scene?.(s)
      s.rungs = [{ c: 0, glow: s.glow, lit: s.lit }]
      s.glow = 0
      s.lit = false
    },
  }
}

/**
 * The calls without the rung painter's own setting of a line's caps and
 * joins back to the canvas's (butt, miter), which a first frame draws the
 * same without: the rest must be the band's, call for call.
 */
const drawn = (calls: readonly Call[]): Call[] =>
  calls.filter(
    ([name, value]) =>
      !(name === 'lineCap=' && value === 'butt') &&
      !(name === 'lineJoin=' && value === 'miter'),
  )

describe('one rung at 0 across the plot', () => {
  it.each<[string, Figure]>([
    ["Lesson 3's Sing it chart", SING_3],
    ["Lesson 5's hold", HOLD_5],
    ["Lesson 5's push", PUSH_5],
    ['a notes axis with no echo', NOTES],
  ])('paints %s call for call as its band does', async (_name, figure) => {
    // Arrange
    const rung = asOneRung(figure)

    // Act
    const [band, rungs] = await paintCharts(figure, rung)

    // Assert
    expect(drawn(rungs.calls)).toEqual(band.calls)
  })

  it('leaves a chart given the painter on its band while its scene holds no rungs', async () => {
    // Arrange
    const given: Figure = { ...SING_3, opts: { ...SING_3.opts, paintRungs } }

    // Act
    const [band, painter] = await paintCharts(SING_3, given)

    // Assert
    expect(painter.calls).toEqual(band.calls)
  })

  it("paints neither the scene's glow nor its lit edge once a rung takes the band's place", async () => {
    // Arrange: one rung at rest under a scene that glows and is lit
    const rung: Figure = {
      opts: { target: 57, paintRungs },
      scene: (s) => {
        s.rungs = [{ c: 0 }]
        s.glow = 1
        s.lit = true
      },
    }
    const atRest: Figure = { opts: { target: 57 } }

    // Act
    const [rungs, band] = await paintCharts(rung, atRest)

    // Assert
    expect(drawn(rungs.calls)).toEqual(band.calls)
  })
})
