// ============================================================
// Band chart wave tests — Merc's line as he sings it, its middle, a ruler
// ============================================================
//
// Lesson 22's WEB-SPEC, Toys 1 and 2: a chart given the wave painter but no
// wave paints exactly as the kit's band chart does, so Lessons 3, 5 and 9's
// figures see no change; `centre: false` leaves the band with no line at
// its centre; Merc's line follows its schedule's sine at its true pitch,
// its depth grown in from 0, only as far as the play has sounded, a level
// note at its height, a drifting middle rising; the middle is dashed, drawn
// left to right as far as its share, amber or violet, and named "middle"
// once whole; the ruler stands from the middle to the top of a swing with
// its reading. Each chart is mounted on a canvas that keeps every call
// (band-chart.test-fixtures.ts) and read back through its own `pointOf`.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { BandScene } from './band-chart'
import type { Figure, Mark } from './band-chart.test-fixtures'
import { channels, marksOf, paintCharts, picture, } from './band-chart.test-fixtures'
import { BAND_COLOR } from './band-chart-draw'
import { HOLD_5, PUSH_5, SING_3 } from './band-chart-lessons.test-fixtures'
import { paintWave } from './band-chart-wave'
import type { WaveLine } from './band-chart-wave-scene'
import { centsOn, middleOf, middleOn } from './band-chart-wave-scene'
import { HIT_TOLERANCE_CENTS } from './band-words'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

const A3 = 57
const AMBER = channels(BAND_COLOR.target).rgb
const VIOLET = channels(BAND_COLOR.singer).rgb

/** The hero's figure: the band on A3, 4.5 s across, no centre and no ticks, with the wave painter; `scene` sets what it shows. */
const hero = (scene?: (s: BandScene) => void): Figure => ({
  opts: {
    target: A3,
    axis: { range: 120 },
    window: 4.5,
    ticks: [],
    centre: false,
    paintOver: paintWave,
  },
  scene,
})

/** The cold open's wave: ±50 at six a second, grown in over 0.3 s, 3.0 s. */
const COLD: WaveLine = {
  stretches: [
    { kind: 'wave', from: 0, to: 3, rate: 6, extent: 50, growIn: 0.3 },
  ],
  upTo: 3,
}

const amberStrokes = (marks: readonly Mark[]): Mark[] =>
  marks.filter((m) => m.rgb === AMBER && m.line.startsWith('stroke '))

describe('the schedule', () => {
  it('grows a wave in from 0 at its start and swings it about its middle at its rate', () => {
    // Arrange
    const s = COLD.stretches[0]

    // Assert
    expect(centsOn(s, 0)).toBe(0)
    // a quarter swing in, still growing in: half its depth at 0.15 s
    expect(centsOn(s, 1 / 24)).toBeCloseTo(50 * (1 / 24 / 0.3), 6)
    expect(centsOn(s, 1 + 1 / 24)).toBeCloseTo(50, 6)
    expect(centsOn(s, 1 + 3 / 24)).toBeCloseTo(-50, 6)
  })

  it("raises a drifting wave's middle by its drift, and holds a level note at its height", () => {
    // Arrange
    const drift = {
      kind: 'wave' as const,
      from: 0.5,
      to: 3.5,
      rate: 6,
      extent: 50,
      growIn: 0.3,
      drift: 50 / 3,
    }

    // Assert
    expect(middleOn(drift, 0.5)).toBe(0)
    expect(middleOn(drift, 3.5)).toBeCloseTo(50, 6)
    expect(centsOn({ kind: 'level', from: 0, to: 2, c: 50 }, 1)).toBe(50)
    expect(middleOf({ stretches: [drift], upTo: 9 })).toEqual([
      { t: 0.5, c: 0 },
      { t: 3.5, c: expect.closeTo(50, 6) as number },
    ])
  })
})

describe('a chart with the wave painter and nothing to paint', () => {
  it("paints as the kit's band chart does, figure for figure", async () => {
    for (const fig of [HOLD_5, PUSH_5, SING_3]) {
      // Act
      const [plain, wave] = await paintCharts(fig, {
        ...fig,
        opts: { ...fig.opts, paintOver: paintWave },
      })

      // Assert
      expect(picture(wave.calls)).toEqual(picture(plain.calls))
    }
  })
})

describe('the band with no centre (`centre: false`)', () => {
  it("draws the band's strip and its two edges, and no line at its centre", async () => {
    // Act
    const [{ chart, calls }] = await paintCharts(hero())

    // Assert: amber strokes only at the two edges
    const ys = amberStrokes(marksOf(calls)).map((m) => m.ys[0])
    expect(ys).toEqual([
      chart.pointOf(0, HIT_TOLERANCE_CENTS).y,
      chart.pointOf(0, -HIT_TOLERANCE_CENTS).y,
    ])
  })
})

describe("Merc's line", () => {
  it('draws the wave at its true pitch, past both edges of the band, whole as a still', async () => {
    // Act
    const [{ chart, calls }] = await paintCharts(
      hero((s) => {
        s.wave = COLD
      }),
    )

    // Assert: one stroke after the band's two edges, from 0 to 3 s, its
    // highest point a swing's top and its lowest a swing's bottom
    const line = amberStrokes(marksOf(calls))[2]
    expect(Math.min(...line.xs)).toBeCloseTo(chart.pointOf(0, 0).x, 6)
    expect(Math.max(...line.xs)).toBeCloseTo(chart.pointOf(3, 0).x, 6)
    expect(Math.min(...line.ys)).toBeLessThan(chart.pointOf(0, 49).y)
    expect(Math.max(...line.ys)).toBeGreaterThan(chart.pointOf(0, -49).y)
  })

  it('draws only as far as the play has sounded', async () => {
    // Act
    const [{ chart, calls }] = await paintCharts(
      hero((s) => {
        s.wave = { ...COLD, upTo: 1.25 }
      }),
    )

    // Assert
    const line = amberStrokes(marksOf(calls))[2]
    expect(Math.max(...line.xs)).toBeCloseTo(chart.pointOf(1.25, 0).x, 6)
  })

  it("draws a straight note's level line at its height after the wave", async () => {
    // Act
    const [{ chart, calls }] = await paintCharts(
      hero((s) => {
        s.wave = {
          stretches: [
            { kind: 'wave', from: 0, to: 2, rate: 6, extent: 50, growIn: 0.3 },
            { kind: 'level', from: 2.3, to: 4.3, c: 50 },
          ],
          upTo: 4.3,
        }
      }),
    )

    // Assert: the top, 15 cents above the band's top edge
    const level = amberStrokes(marksOf(calls))[3]
    expect(new Set(level.ys)).toEqual(new Set([chart.pointOf(3, 50).y]))
    expect(Math.min(...level.xs)).toBeCloseTo(chart.pointOf(2.3, 0).x, 6)
  })
})

describe('the middle line', () => {
  it("draws dashed through the wave's middle, in amber, as far as its share", async () => {
    // Act
    const [{ chart, calls }] = await paintCharts(
      hero((s) => {
        s.wave = COLD
        s.middle = { points: middleOf(COLD), tone: 'merc', share: 0.5 }
      }),
    )

    // Assert
    const middle = amberStrokes(marksOf(calls)).find((m) =>
      m.line.includes('dash'),
    )
    expect(middle?.ys).toEqual([chart.pointOf(0, 0).y, chart.pointOf(1.5, 0).y])
    expect(middle?.xs[1]).toBeCloseTo(chart.pointOf(1.5, 0).x, 6)
    expect(marksOf(calls).some((m) => m.line.includes('MIDDLE'))).toBe(false)
  })

  it('names itself "middle" once whole, and draws violet from the reader', async () => {
    // Act
    const [{ calls }] = await paintCharts(
      hero((s) => {
        s.middle = {
          points: [
            { t: 0, c: 4 },
            { t: 2, c: 6 },
          ],
          tone: 'singer',
          share: 1,
        }
      }),
    )

    // Assert
    const marks = marksOf(calls)
    expect(marks.some((m) => m.rgb === VIOLET && m.line.includes('dash'))).toBe(
      true,
    )
    expect(marks.some((m) => m.line.includes('MIDDLE'))).toBe(true)
  })
})

describe('the ruler', () => {
  it('stands from the middle to the top of a swing, with its reading beside it', async () => {
    // Act
    const [{ chart, calls }] = await paintCharts(
      hero((s) => {
        s.ruler = { t: 0.5, from: 0, to: 30, text: '±30' }
      }),
    )

    // Assert
    const marks = marksOf(calls)
    const upright = marks.find(
      (m) =>
        m.line.startsWith('stroke ') &&
        m.xs.includes(chart.pointOf(0.5, 0).x) &&
        m.ys.includes(chart.pointOf(0.5, 30).y),
    )
    expect(upright).toBeDefined()
    expect(marks.some((m) => m.line.includes('±30'))).toBe(true)
  })
})
