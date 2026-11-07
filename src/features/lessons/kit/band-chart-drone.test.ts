// ============================================================
// Band chart drone tests — the drone, the band, the beads, the ticks and the beats
// ============================================================
//
// Lesson 24's WEB-SPEC, Look and Toys 1, 2 and 6 (What the kit and the app
// still need, item 9): a chart given the drone painter but no drone paints
// exactly as the kit's band chart does, so no other lesson sees a change; a
// window may sit uneven about the note, and a figure's next state gives it
// another reach and keeps the scene; the drone is a narrow amber band named
// inside it, or above it where it is short, with no line at its centre, or
// a chrome line named at its right end, or a marker pinned to the foot with
// an arrow below the window; Lesson 5's band sits on the note with its
// glow, Merc's line and its lit edge as the chart's own; the top notes are
// thin chrome lines from their schedules, drawn as far as their plays have
// sounded; the piano's tick is named above it and the pure tick below; the
// beads are chrome, the sounding one ink and lit; a beat brightens and dims
// the band and the halos, every swing under 0.1 in relative luminance; and
// the figure's spoken summary has a line for each change of colours. Each
// chart is mounted on a canvas that keeps every call
// (band-chart.test-fixtures.ts) and read back through its own `pointOf`.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { BandScene } from './band-chart'
import type { Call, Figure, Mark } from './band-chart.test-fixtures'
import { channels, marksOf, mountCharts, paintCharts, picture, } from './band-chart.test-fixtures'
import { BAND_COLOR } from './band-chart-draw'
import { bandAlphas, BEAD_R, DRONE_HALF_CENTS, haloAlpha, paintDrone, } from './band-chart-drone'
import type { DroneScene } from './band-chart-drone-scene'
import { centsAbove, colourLine, coloursOf, slideStretches, } from './band-chart-drone-scene'
import { HOLD_5, PUSH_5, SING_3 } from './band-chart-lessons.test-fixtures'
import { centsOn } from './band-chart-wave-scene'
import { HIT_TOLERANCE_CENTS } from './band-words'
import { COLOR } from './notes'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

const A3 = 57
const CS4 = 61
const E4 = 64
const D3 = 50
const AMBER = channels(BAND_COLOR.target).rgb
const MINT = channels(BAND_COLOR.mint).rgb
const CHROME = channels(COLOR.chrome).rgb
const INK = channels(COLOR.ink).rgb

/** The plot's edges on the fixtures' 300 by 190 canvas, with no strip and no seconds under it. */
const PLOT = { x0: 12, x1: 288, top: 14, bottom: 176 } as const

/** The top note at 224 Hz against A3, 31.19 cents up. */
const TOP_224 = centsAbove(224, 220)

/** A drone chart on `target` over the window `span`, 10 s across, no cents ticks, with the drone painter. */
const droneChart = (
  span: readonly [number, number],
  drone: DroneScene,
  more?: (s: BandScene) => void,
  target = A3,
): Figure => ({
  opts: {
    target,
    axis: { span },
    window: 10,
    ticks: [],
    centre: false,
    paintRungs: paintDrone,
  },
  scene: (s) => {
    s.drone = drone
    more?.(s)
  },
})

/** The hero at first paint: the drone's band on A3, the top note's line at 224 Hz, nothing sounding. */
const HERO: DroneScene = {
  drone: { c: 0, as: 'band', label: 'drone · A3' },
  band: null,
  ticks: [],
  beads: [],
  tops: [
    {
      stretches: [{ kind: 'level', from: 0, to: 10, c: TOP_224 }],
      upTo: 10,
    },
  ],
  bright: null,
}
const HERO_SPAN = [-20, 45] as const

/** Step 2's window, from 50 cents under A3 to 60 over E4. */
const STEP_2_SPAN = [-50, 760] as const

const ofColour = (marks: readonly Mark[], rgb: string, kind: string): Mark[] =>
  marks.filter((m) => m.rgb === rgb && m.line.startsWith(`${kind} `))

const words = (marks: readonly Mark[], text: string): Mark[] =>
  marks.filter((m) => m.line.startsWith('text ') && m.line.endsWith(` ${text}`))

describe('a chart with the drone painter and no drone', () => {
  it("paints as the kit's band chart does, figure for figure", async () => {
    for (const fig of [HOLD_5, PUSH_5, SING_3]) {
      // Act
      const [plain, drone] = await paintCharts(fig, {
        ...fig,
        opts: { ...fig.opts, paintRungs: paintDrone },
      })

      // Assert
      expect(picture(drone.calls)).toEqual(picture(plain.calls))
    }
  })
})

describe('the window', () => {
  it('may sit uneven about the note: cents from it to the foot and to the top', async () => {
    // Act
    const [{ chart }] = await paintCharts(droneChart(HERO_SPAN, HERO))

    // Assert
    expect([chart.lo, chart.hi]).toEqual([-20, 45])
    expect(chart.pointOf(0, -20).y).toBeCloseTo(PLOT.bottom, 9)
    expect(chart.pointOf(0, 45).y).toBeCloseTo(PLOT.top, 9)
  })

  it("takes another reach for the figure's next state, keeps the scene and draws again", async () => {
    // Arrange
    const { hand, painted } = await mountCharts([droneChart(HERO_SPAN, HERO)])
    const [{ chart, calls }] = painted
    hand.frame()

    // Act
    chart.setAxis({ span: STEP_2_SPAN })
    hand.frame()

    // Assert: a second frame drew, on the new reach, with the same scene
    const frames = picture(calls).filter((l) => l.startsWith('transform '))
    expect(frames).toHaveLength(2)
    expect([chart.lo, chart.hi]).toEqual([...STEP_2_SPAN])
    expect(chart.scene.drone).toBe(HERO)
  })
})

describe("the drone's band (the hero, Steps 1 and 2)", () => {
  it('draws an amber strip 15 cents either side, its two edges and no line at its centre, as Lesson 5 draws its band at rest', async () => {
    // Act
    const [{ chart, calls }] = await paintCharts(droneChart(HERO_SPAN, HERO))
    const marks = marksOf(calls)

    // Assert
    const yTop = chart.pointOf(0, DRONE_HALF_CENTS).y
    const yBot = chart.pointOf(0, -DRONE_HALF_CENTS).y
    const [strip] = ofColour(marks, AMBER, 'rect')
    expect(strip.ys).toEqual([yTop, yBot])
    expect(strip.opacity).toBeCloseTo(0.13, 9)
    const edges = ofColour(marks, AMBER, 'stroke')
    expect(edges.map((m) => m.ys[0])).toEqual([yTop, yBot])
    expect(edges.map((m) => m.opacity)).toEqual([0.6, 0.6])
  })

  it('names the band inside it, at its lower left, where it is tall enough', async () => {
    // Act
    const [{ chart, calls }] = await paintCharts(droneChart(HERO_SPAN, HERO))

    // Assert
    const [label] = words(marksOf(calls), 'drone · A3')
    expect(label.rgb).toBe(AMBER)
    expect(label.xs[0]).toBe(PLOT.x0 + 6)
    expect(label.ys[0]).toBe(chart.pointOf(0, -DRONE_HALF_CENTS).y - 5)
  })

  it('names a short band above its top edge, clear of the beads and their names', async () => {
    // Arrange: Step 2's window, where the band is 6 px tall
    const beads = [{ c: 0, name: 'do', lit: false }]

    // Act
    const [{ chart, calls }] = await paintCharts(
      droneChart(STEP_2_SPAN, { ...HERO, beads, tops: [] }),
    )

    // Assert
    const [label] = words(marksOf(calls), 'drone · A3')
    expect(label.ys[0]).toBe(chart.pointOf(0, DRONE_HALF_CENTS).y - 4)
    expect(label.xs[0]).toBe(PLOT.x0 + 2 * BEAD_R + 34)
    const [doName] = words(marksOf(calls), 'do')
    expect(doName.xs[1]).toBeLessThan(label.xs[0])
  })

  it('draws a band that sounds from the left as far as it has reached, and nothing, label and all, before it starts', async () => {
    // Act: a band 4 s into a 10 s window, and one not started
    const [part, none] = await paintCharts(
      droneChart(HERO_SPAN, {
        ...HERO,
        drone: { ...HERO.drone, upTo: 4 },
        tops: [],
      }),
      droneChart(HERO_SPAN, {
        ...HERO,
        drone: { ...HERO.drone, upTo: 0 },
        tops: [],
      }),
    )

    // Assert
    const x = part.chart.pointOf(4, 0).x
    const [strip] = ofColour(marksOf(part.calls), AMBER, 'rect')
    expect(strip.xs).toEqual([PLOT.x0, x])
    const edges = ofColour(marksOf(part.calls), AMBER, 'stroke')
    expect(edges.map((m) => m.xs)).toEqual([
      [PLOT.x0, x],
      [PLOT.x0, x],
    ])
    expect(words(marksOf(part.calls), 'drone · A3')).toHaveLength(1)
    expect(marksOf(none.calls).filter((m) => m.rgb === AMBER)).toEqual([])
  })

  it("names the drone's second harmonic in the octave view", async () => {
    // Act
    const [{ calls }] = await paintCharts(
      droneChart(
        [-40, 40],
        {
          ...HERO,
          drone: { c: 0, as: 'band', label: 'drone × 2 · 440 Hz' },
          tops: [],
        },
        undefined,
        A3 + 12,
      ),
    )

    // Assert
    expect(words(marksOf(calls), 'drone × 2 · 440 Hz')).toHaveLength(1)
  })
})

describe('the top notes', () => {
  it('draw a thin chrome line at the true pitch just above the band, with no glow at rest', async () => {
    // Act
    const [{ chart, calls }] = await paintCharts(droneChart(HERO_SPAN, HERO))

    // Assert: one stroke, no halo under it
    const lines = ofColour(marksOf(calls), CHROME, 'stroke')
    expect(lines).toHaveLength(1)
    expect(lines[0].width).toBe(1.6)
    expect(lines[0].opacity).toBeCloseTo(0.9, 9)
    const y = chart.pointOf(0, TOP_224).y
    for (const yy of lines[0].ys) expect(yy).toBeCloseTo(y, 9)
    expect(Math.min(...lines[0].xs)).toBeCloseTo(PLOT.x0, 9)
    expect(Math.max(...lines[0].xs)).toBeCloseTo(PLOT.x1, 9)
  })

  it("draw the slide from its schedule as far as it has sounded, a straight slope in cents from 224 Hz into the band's middle", async () => {
    // Arrange: 4.5 s in, halfway down the glide
    const slide = slideStretches(
      { from: 224, to: 220, hold: 1.5, glide: 6, after: 2.5 },
      220,
    )

    // Act
    const [{ chart, calls }] = await paintCharts(
      droneChart(HERO_SPAN, {
        ...HERO,
        tops: [{ stretches: slide, upTo: 4.5 }],
      }),
    )

    // Assert
    const [line] = ofColour(marksOf(calls), CHROME, 'stroke')
    expect(line.ys[0]).toBeCloseTo(chart.pointOf(0, TOP_224).y, 9)
    expect(Math.max(...line.xs)).toBeCloseTo(chart.pointOf(4.5, 0).x, 9)
    expect(line.ys.at(-1)).toBeCloseTo(chart.pointOf(4.5, TOP_224 / 2).y, 6)
  })

  it('give the slide its parts: 224 Hz held, a glide straight in cents, 220 held, 10 s in all', () => {
    // Arrange
    const [hold, glide, after] = slideStretches(
      { from: 224, to: 220, hold: 1.5, glide: 6, after: 2.5 },
      220,
    )

    // Assert
    expect([hold.from, hold.to, glide.to, after.to]).toEqual([0, 1.5, 7.5, 10])
    expect(centsOn(hold, 1)).toBeCloseTo(TOP_224, 9)
    expect(centsOn(glide, 1.5)).toBeCloseTo(TOP_224, 9)
    expect(centsOn(glide, 4.5)).toBeCloseTo(TOP_224 / 2, 9)
    expect(centsOn(glide, 7.5)).toBeCloseTo(0, 9)
    expect(centsOn(after, 9)).toBe(0)
  })
})

describe('the beats as brightness', () => {
  /** The hero's band and line, sounding at `bright`. */
  async function hero(bright: DroneScene['bright']): Promise<{
    strip: Mark
    edges: Mark[]
    lines: Mark[]
  }> {
    const [{ calls }] = await paintCharts(
      droneChart(HERO_SPAN, { ...HERO, bright }),
    )
    const marks = marksOf(calls)
    return {
      strip: ofColour(marks, AMBER, 'rect')[0],
      edges: ofColour(marks, AMBER, 'stroke'),
      lines: ofColour(marks, CHROME, 'stroke'),
    }
  }

  it('swells the fill and the halo with the slow beats, bright in phase and dim between', async () => {
    // Act
    const bright = await hero({ slow: 1, fast: null })
    const dim = await hero({ slow: 0, fast: null })

    // Assert
    expect(bright.strip.opacity).toBeCloseTo(0.2, 9)
    expect(dim.strip.opacity).toBeCloseTo(0.1, 9)
    for (const m of bright.edges) expect(m.opacity).toBeCloseTo(0.6, 9)
    for (const m of dim.edges) expect(m.opacity).toBeCloseTo(0.5, 9)
    // the halo under the line, then the line itself, which never changes
    expect(bright.lines.map((m) => m.width)).toEqual([7, 1.6])
    expect(bright.lines[0].opacity).toBeCloseTo(0.12, 9)
    expect(dim.lines[0].opacity).toBeCloseTo(0.04, 9)
    for (const run of [bright, dim])
      expect(run.lines[1].opacity).toBeCloseTo(0.9, 9)
  })

  it('shimmers the edges alone with the fast beats, the fill held still', async () => {
    // Act
    const bright = await hero({ slow: null, fast: 1 })
    const dim = await hero({ slow: null, fast: 0 })

    // Assert
    expect(bright.strip.opacity).toBe(dim.strip.opacity)
    expect(bright.edges[0].opacity).toBeCloseTo(0.6, 9)
    expect(dim.edges[0].opacity).toBeCloseTo(0.5, 9)
  })

  it('holds everything still while a still pair sounds, or under reduced motion', async () => {
    // Act
    const still = await hero({ slow: null, fast: null })

    // Assert: steady, between the swings' ends, the halo on
    expect(still.strip.opacity).toBeCloseTo(0.15, 9)
    expect(still.edges[0].opacity).toBeCloseTo(0.55, 9)
    expect(still.lines[0].opacity).toBeCloseTo(0.08, 9)
  })

  it("keeps every swing under 0.1 in relative luminance: the band, its edge and a halo over them, brightest against dimmest, on the page's grounds", () => {
    // Arrange: WCAG's relative luminance of colours laid over a ground
    const lin = (v: number): number => {
      const c = v / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    const rgbOf = (hex: string): number[] =>
      channels(hex).rgb.split(',').map(Number)
    const over = (fg: string, a: number, bg: number[]): number[] =>
      rgbOf(fg).map((v, i) => v * a + bg[i] * (1 - a))
    const lum = (c: number[]): number =>
      0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
    const stack = (b: DroneScene['bright'], ground: string): number => {
      const a = bandAlphas(b)
      let c = over(BAND_COLOR.target, a.fill, rgbOf(ground))
      c = over(BAND_COLOR.target, a.edge, c)
      return lum(over(COLOR.chrome, haloAlpha(b), c))
    }
    const patterns = [
      [0, null],
      [null, 0],
      [0, 0],
    ] as const

    // Assert: each part that beats swung from 0 to 1, on the page and on a card
    for (const ground of [COLOR.bg, COLOR.card])
      for (const [slow, fast] of patterns) {
        const lift = (v: 0 | null): number | null => (v === null ? null : 1)
        const dimmest = stack({ slow, fast }, ground)
        const brightest = stack({ slow: lift(slow), fast: lift(fast) }, ground)
        expect(brightest - dimmest).toBeLessThan(0.1)
      }
  })
})

describe("Lesson 5's band on the note (Step 3, Sing it)", () => {
  /** Step 3 on mi, C sharp 4: its band, the drone's line at A3, the two ticks. */
  const STEP_3: DroneScene = {
    drone: { c: -400, as: 'line', label: 'drone' },
    band: { c: 0, line: false },
    ticks: [
      { c: 0, kind: 'piano' },
      { c: -13.69, kind: 'pure' },
    ],
    beads: [],
    tops: [],
    bright: null,
  }

  it('draws the band 35 cents either side with no line at its centre, and the drone as a chrome line named at its right end', async () => {
    // Act
    const [{ chart, calls }] = await paintCharts(
      droneChart([-440, 60], STEP_3, undefined, CS4),
    )
    const marks = marksOf(calls)

    // Assert
    const [strip] = ofColour(marks, AMBER, 'rect')
    expect(strip.ys).toEqual([
      chart.pointOf(0, HIT_TOLERANCE_CENTS).y,
      chart.pointOf(0, -HIT_TOLERANCE_CENTS).y,
    ])
    expect(ofColour(marks, AMBER, 'stroke')).toHaveLength(2)
    const y = chart.pointOf(0, -400).y
    const drone = ofColour(marks, CHROME, 'stroke').find((m) => m.width === 1.5)
    expect(drone?.ys).toEqual([y, y])
    expect(drone?.xs).toEqual([PLOT.x0, PLOT.x1])
    const [label] = words(marks, 'drone')
    expect(label.xs[1]).toBe(PLOT.x1 - 4)
    expect(label.ys[0]).toBe(y - 3)
  })

  it('names the piano tick above it and the pure tick below it, so 14 cents apart their words never meet', async () => {
    // Act
    const [{ chart, calls }] = await paintCharts(
      droneChart([-440, 60], STEP_3, undefined, CS4),
    )
    const marks = marksOf(calls)

    // Assert: the piano's solid chrome, the pure one dashed ink, at the right edge
    const piano = chart.pointOf(0, 0).y
    const pure = chart.pointOf(0, -13.69).y
    const ticks = marks.filter(
      (m) => m.line.startsWith('stroke ') && m.width === 2,
    )
    expect(ticks.map((m) => [m.rgb, m.ys[0], m.xs[0], m.xs[1]])).toEqual([
      [CHROME, piano, PLOT.x1 - 22, PLOT.x1],
      [INK, pure, PLOT.x1 - 22, PLOT.x1],
    ])
    expect(ticks[1].line).toContain('dash 4 3')
    const [pianoWord] = words(marks, 'piano')
    const [pureWord] = words(marks, 'pure')
    expect(pianoWord.line).toContain(' right bottom ')
    expect(pureWord.line).toContain(' right top ')
    expect(pianoWord.ys[0]).toBe(piano - 1)
    expect(pureWord.ys[0]).toBe(pure + 1)
  })

  it("draws Sing it's band at rest as the chart's own, Merc's line and his glow, then the drone's line through its middle, then the lit edge", async () => {
    // Act: do over a drone on do, the band lit after a reading
    const [{ chart, calls }] = await paintCharts({
      opts: {
        target: D3,
        window: 5,
        timeTicks: true,
        paintRungs: paintDrone,
      },
      scene: (s) => {
        s.drone = {
          ...STEP_3,
          drone: { c: 0, as: 'line', label: 'drone' },
          band: { c: 0, line: true },
          ticks: [],
        }
        s.lit = true
        s.glow = 1
      },
    })
    const marks = marksOf(calls)

    // Assert: Merc's line at the centre, glowing, then the drone's over it
    const y = chart.pointOf(0, 0).y
    const mercLine = marks.findIndex(
      (m) => m.rgb === AMBER && m.line.startsWith('stroke ') && m.ys[0] === y,
    )
    const droneLine = marks.findIndex(
      (m) => m.rgb === CHROME && m.width === 1.5 && m.ys[0] === y,
    )
    expect(mercLine).toBeGreaterThan(-1)
    expect(droneLine).toBeGreaterThan(mercLine)
    expect(marks[mercLine].width).toBe(3)
    expect(ofColour(marks, MINT, 'stroke')).toHaveLength(2)
    expect(words(marks, 'IN THE BAND')).toHaveLength(1)
  })
})

describe('the drone below the window (Step 4, Sing it on so and mi)', () => {
  /** Step 4 on E4: no band, the drone pinned below, the piano's tick, the top note with Lesson 22's wave. */
  const STEP_4: DroneScene = {
    drone: { c: -700, as: 'line', label: 'drone · A3' },
    band: null,
    ticks: [{ c: 0, kind: 'piano' }],
    beads: [],
    tops: [
      {
        stretches: [
          { kind: 'wave', from: 0, to: 4, rate: 6, extent: 50, growIn: 0.3 },
        ],
        upTo: 4,
      },
    ],
    bright: null,
  }

  it("pins a chrome marker to the chart's foot with an arrow pointing down, named beside it, and draws no band", async () => {
    // Act
    const [{ calls }] = await paintCharts(
      droneChart([-80, 80], STEP_4, undefined, E4),
    )
    const marks = marksOf(calls)

    // Assert
    expect(marks.filter((m) => m.rgb === AMBER)).toEqual([])
    const [arrow] = ofColour(marks, CHROME, 'fill')
    expect(Math.max(...arrow.ys)).toBe(PLOT.bottom - 2)
    expect(Math.min(...arrow.ys)).toBe(PLOT.bottom - 11)
    expect(arrow.xs).toEqual([PLOT.x0 + 4, PLOT.x0 + 16, PLOT.x0 + 10])
    const [label] = words(marks, 'drone · A3')
    expect(label.xs[0]).toBe(PLOT.x0 + 22)
  })

  it("draws the top note's wave across the piano tick, swinging above it and below", async () => {
    // Act
    const [{ chart, calls }] = await paintCharts(
      droneChart([-80, 80], STEP_4, undefined, E4),
    )

    // Assert
    const [line] = ofColour(marksOf(calls), CHROME, 'stroke').filter(
      (m) => m.width === 1.6,
    )
    const tick = chart.pointOf(0, 0).y
    expect(Math.min(...line.ys)).toBeLessThan(chart.pointOf(0, 49).y)
    expect(Math.max(...line.ys)).toBeGreaterThan(chart.pointOf(0, -49).y)
    expect(Math.min(...line.ys)).toBeLessThan(tick)
  })
})

describe('the beads', () => {
  it('sit at the left edge on their notes, chrome, the sounding one ink and lit, each named beside it', async () => {
    // Arrange: mi sounding over the drone
    const beads = [
      { c: 0, name: 'do', lit: false },
      { c: 400, name: 'mi', lit: true },
      { c: 700, name: 'so', lit: false },
    ]

    // Act
    const [{ chart, calls }] = await paintCharts(
      droneChart(STEP_2_SPAN, { ...HERO, beads, tops: [] }),
    )

    // Assert: a bead a circle, its tone the gradient's middle stop
    const x = PLOT.x0 + BEAD_R + 2
    const arcs = calls.filter((c) => c[0] === 'arc')
    expect(arcs.map((c) => [c[1], c[2], c[3]])).toEqual(
      beads.map((b) => [x, chart.pointOf(0, b.c).y, BEAD_R]),
    )
    const tones = calls
      .filter((c): c is Call => c[0] === 'addColorStop' && c[1] === 0.45)
      .map((c) => c[2])
    expect(tones).toEqual([COLOR.chrome, COLOR.ink, COLOR.chrome])
    const glows = calls.filter((c) => c[0] === 'shadowBlur=')
    expect(glows).toEqual([['shadowBlur=', 16]])
    const names = beads.map((b) => words(marksOf(calls), b.name)[0])
    expect(names.map((m) => [m.xs[0], m.rgb])).toEqual([
      [x + BEAD_R + 6, channels(COLOR.ink2).rgb],
      [x + BEAD_R + 6, INK],
      [x + BEAD_R + 6, channels(COLOR.ink2).rgb],
    ])
  })
})

describe("the figure's colours, and the line its summary adds when they change", () => {
  it('reads the colours from the scene: the drone as the band, a band on the note, or none', () => {
    // Arrange
    const line = { c: -400, as: 'line', label: 'drone' } as const

    // Assert
    expect(coloursOf(HERO)).toBe('drone-band')
    expect(
      coloursOf({ ...HERO, drone: line, band: { c: 0, line: false } }),
    ).toBe('note-band')
    expect(coloursOf({ ...HERO, drone: line })).toBe('no-band')
  })

  it("says each change in LESSON.md's words, and nothing when the colours stay", () => {
    // Assert: Lesson 24 FACTS 40
    expect(colourLine('drone-band', 'note-band')).toBe(
      "The amber band is now mi's; the drone is the chrome line below.",
    )
    expect(colourLine('note-band', 'no-band')).toBe(
      'No band now: the top note is the chrome line, the drone pinned below.',
    )
    expect(colourLine('no-band', 'drone-band')).toBe(
      'The amber band is the drone again.',
    )
    expect(colourLine('note-band', 'drone-band')).toBe(
      'The amber band is the drone again.',
    )
    expect(colourLine('drone-band', 'drone-band')).toBeNull()
  })
})
