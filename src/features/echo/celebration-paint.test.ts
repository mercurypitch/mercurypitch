// ============================================================
// The celebration star's paint: the shapes, the light and the timings
// ============================================================

import { describe, expect, it } from 'vitest'
import { catmullRom, dotTimings, easeOut, gaussStops, keyframeOffsets, mistAngle, paintRibbons, pointLight, ribbonField, ribbonFrames, ribbonPlan, screenStops, seeded, sparkleTimings, starPath, } from './celebration-paint'
import { CELEBRATION } from './echo-celebration'
import { CELEBRATION_SPARKLES } from './echo-celebration-sparkles'

/** A path's corners, [x, y]. */
const corners = (path: string): number[][] =>
  path
    .replace(/[MLZ]/gu, ' ')
    .trim()
    .split(/\s+/u)
    .map(Number)
    .reduce<number[][]>((out, n, i) => {
      if (i % 2 === 0) out.push([n])
      else out[out.length - 1].push(n)
      return out
    }, [])

describe("the star's outline", () => {
  it('starts at the top tip and runs clockwise, tips and valleys in turn', () => {
    const points = corners(starPath(10, 0.5))

    expect(points).toHaveLength(10)
    expect(points[0][0]).toBeCloseTo(0, 5)
    expect(points[0][1]).toBeCloseTo(-10, 5)
    // Clockwise on screen: the first valley is to the right of the top tip.
    expect(points[1][0]).toBeGreaterThan(0)
    const radii = points.map(([x, y]) => Math.hypot(x, y))
    expect(
      radii.filter((_, i) => i % 2 === 0).every((r) => Math.abs(r - 10) < 0.01),
    ).toBe(true)
    expect(
      radii.filter((_, i) => i % 2 === 1).every((r) => Math.abs(r - 5) < 0.01),
    ).toBe(true)
  })
})

describe("the inner outline's lumps (round 4)", () => {
  it('scales each corner by its factor, the factors counter-clockwise from the top tip', () => {
    // Factor k belongs to the corner k steps counter-clockwise on screen;
    // the path runs clockwise, so its corner i takes factor (10 - i) % 10.
    const factors = [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 0.5]
    const points = corners(starPath(10, 0.5, factors))
    const radii = points.map(([x, y]) => Math.hypot(x, y))

    expect(radii[0]).toBeCloseTo(15, 2)
    // The first valley clockwise, right of the top tip, is factor 9's.
    expect(points[1][0]).toBeGreaterThan(0)
    expect(radii[1]).toBeCloseTo(2.5, 2)
    expect(radii[9]).toBeCloseTo(5, 2)
  })

  it("keeps the spec's ten factors, and draws a plain star without them", () => {
    expect(CELEBRATION.star.inner.wobbleCcw).toHaveLength(10)
    expect(starPath(10, 0.5, Array(10).fill(1))).toBe(starPath(10, 0.5))
  })
})

describe("the outer outline's lopsided corners (round 5)", () => {
  it('scales and turns each corner, both counter-clockwise from the top tip', () => {
    const radiusCcw = [1.2, 1, 1, 1, 1, 1, 1, 1, 1, 0.5]
    const turnCcwDeg = [10, 0, 0, 0, 0, 0, 0, 0, 0, -20]
    const points = corners(
      starPath(10, 0.5, undefined, { radiusCcw, turnCcwDeg }),
    )
    const angle = ([x, y]: number[]) =>
      ((Math.atan2(-y, x) * 180) / Math.PI + 360) % 360

    expect(Math.hypot(...points[0])).toBeCloseTo(12, 2)
    // Turned counter-clockwise on screen: the top tip leans left.
    expect(points[0][0]).toBeLessThan(0)
    expect(angle(points[0])).toBeCloseTo(100, 1)
    // The first valley clockwise is entry 9: half as far, turned back 20.
    expect(Math.hypot(...points[1])).toBeCloseTo(2.5, 2)
    expect(angle(points[1])).toBeCloseTo(54 - 20, 0)
  })

  it("keeps the spec's ten factors and turns, and draws a plain star with none", () => {
    const { lopsided } = CELEBRATION.star.outer

    expect(lopsided.radiusCcw).toHaveLength(10)
    expect(lopsided.turnCcwDeg).toHaveLength(10)
    expect(
      starPath(10, 0.5, undefined, {
        radiusCcw: Array(10).fill(1),
        turnCcwDeg: Array(10).fill(0),
      }),
    ).toBe(starPath(10, 0.5))
  })
})

describe('a dot or a sparkle (round 5)', () => {
  it('lays its core over its glow, each at its own alpha', () => {
    const light = {
      rgb: [100, 200, 255],
      coreFwhmW: 0.003,
      coreAlpha: 0.3,
      glowFwhmW: 0.006,
      glowAlpha: 0.8,
    }
    const { reach, stops } = pointLight(light, 390)
    const alphaOf = (stop: string) => Number(/,\s*([\d.]+)\)/u.exec(stop)?.[1])

    expect(reach).toBeCloseTo((3 * 0.006 * 390) / 2.3548, 6)
    expect(alphaOf(stops[0])).toBeCloseTo(1 - 0.2 * 0.7, 4)
    expect(alphaOf(stops[stops.length - 1])).toBeLessThan(0.01)
  })

  it('draws a blotch as a Gaussian at its alpha, out to three sigma', () => {
    const stops = gaussStops(0.5)

    expect(stops[0]).toEqual({ offset: 0, opacity: 0.5 })
    expect(stops[stops.length - 1].offset).toBe(1)
    expect(stops[stops.length - 1].opacity).toBeCloseTo(0.5 * Math.exp(-4.5), 6)
  })
})

describe('the ribbons (round 4)', () => {
  it('runs a Catmull-Rom curve through every point it is given', () => {
    const points = [
      [0, 0],
      [10, 5],
      [20, 0],
      [30, 8],
    ] as const
    const curve = catmullRom(points, 10)

    expect(curve[0]).toEqual([0, 0])
    expect(curve[curve.length - 1]).toEqual([30, 8])
    for (const [x, y] of points) {
      expect(
        Math.min(...curve.map(([cx, cy]) => Math.hypot(cx - x, cy - y))),
      ).toBeLessThan(1e-9)
    }
  })

  it('draws the ribbon nearest the starburst first, each from its burst end', () => {
    const { fromMs, staggerMs } = CELEBRATION.timing.ribbons
    const plan = ribbonPlan()

    // Spec order: 12 to 31, 3 to 15, 11 to 2. Their ends nearest the
    // starburst are 31, 15 and 2, the last ribbon's the nearest of them.
    expect(plan.map((p) => p.revealAt)).toEqual([
      fromMs + staggerMs,
      fromMs + 2 * staggerMs,
      fromMs,
    ])
    expect(plan.map((p) => p.fromStart)).toEqual([false, false, false])
  })

  const LINE = [
    [10, 10],
    [70, 10],
  ] as const
  const field = (fromStart: boolean) =>
    ribbonField(
      catmullRom(LINE, 40),
      { fwhm: 2, taper: 6, alpha: 0.3, fromStart },
      { width: 80, height: 20, dpr: 1 },
    )
  const at = (f: ReturnType<typeof field>, x: number, y: number) => {
    const i = f.pixels.indexOf(y * 80 + x)
    return i < 0 ? 0 : f.alpha[i]
  }

  it('is a Gaussian across, at its alpha on the line, tapered to nothing at the ends', () => {
    const f = field(true)

    // Pixel (40, 9) has its centre at (40.5, 9.5): 0.5 px off the line.
    const sigma = 2 / 2.3548
    expect(at(f, 40, 9)).toBeCloseTo(
      0.3 * Math.exp(-(0.5 ** 2) / (2 * sigma ** 2)),
      3,
    )
    // One row further out, 1.5 px from the line, as the Gaussian falls.
    expect(at(f, 40, 8) / at(f, 40, 9)).toBeCloseTo(
      Math.exp(-(1.5 ** 2 - 0.5 ** 2) / (2 * sigma ** 2)),
      3,
    )
    expect(at(f, 10, 9)).toBeLessThan(0.3 * 0.1)
    expect(at(f, 69, 9)).toBeLessThan(0.3 * 0.1)
    expect(f.length).toBeCloseTo(60, 1)
  })

  it('measures the draw from the end nearest the starburst', () => {
    const start = field(true)
    const end = field(false)
    const i = start.pixels.indexOf(9 * 80 + 20)

    const j = end.pixels.indexOf(9 * 80 + 20)

    expect(start.fromBurst[i]).toBeCloseTo(start.along[i], 6)
    expect(start.along[i]).toBeCloseTo(10.5, 4)
    expect(end.fromBurst[j]).toBeCloseTo(end.length - end.along[j], 4)
  })

  it('paints nothing undrawn, half from the burst end at half, all of it drawn', () => {
    const f = field(false)
    const rgba = new Uint8ClampedArray(80 * 20 * 4)
    const wisp = { depth: 0, periodPx: 10 }
    const alphaAt = (x: number) => rgba[(9 * 80 + x) * 4 + 3]

    paintRibbons(rgba, [f], [{ drawn: 0, phase: 0 }], [wisp], [[0, 225, 255]])
    expect(Math.max(...rgba)).toBe(0)

    paintRibbons(rgba, [f], [{ drawn: 0.5, phase: 0 }], [wisp], [[0, 225, 255]])
    expect(alphaAt(25)).toBe(0)
    expect(alphaAt(55)).toBeGreaterThan(0)

    paintRibbons(rgba, [f], [{ drawn: 1, phase: 0 }], [wisp], [[0, 225, 255]])
    expect(alphaAt(25)).toBeGreaterThan(0)
    expect(alphaAt(40)).toBe(Math.round(255 * at(f, 40, 9)))
    expect([...rgba.slice((9 * 80 + 40) * 4, (9 * 80 + 40) * 4 + 3)]).toEqual([
      0, 225, 255,
    ])
  })

  it('lights each link at its own gain, capped at full (round 5)', () => {
    const THREE = [
      [10, 10],
      [40, 10],
      [70, 10],
    ] as const
    const gained = (segmentGain: number[]) =>
      ribbonField(
        catmullRom(THREE),
        { fwhm: 2, taper: 0, alpha: 0.3, fromStart: true, segmentGain },
        { width: 80, height: 20, dpr: 1 },
      )
    const at = (f: ReturnType<typeof gained>, x: number) =>
      f.alpha[f.pixels.indexOf(10 * 80 + x)]
    const plain = gained([1, 1])
    const lit = gained([0.5, 2])

    expect(at(lit, 25) / at(plain, 25)).toBeCloseTo(0.5, 5)
    expect(at(lit, 55) / at(plain, 55)).toBeCloseTo(2, 5)
    expect(Math.max(...gained([1, 10]).alpha)).toBe(1)
  })

  it('dips by the wisp along the curve, moving with its phase', () => {
    const f = field(true)
    const rgba = new Uint8ClampedArray(80 * 20 * 4)
    const wisp = { depth: 0.5, periodPx: 20 }
    const row = () =>
      Array.from({ length: 40 }, (_, k) => rgba[(9 * 80 + 20 + k) * 4 + 3])

    paintRibbons(rgba, [f], [{ drawn: 1, phase: 0 }], [wisp], [[0, 225, 255]])
    const still = row()
    paintRibbons(
      rgba,
      [f],
      [{ drawn: 1, phase: Math.PI }],
      [wisp],
      [[0, 225, 255]],
    )
    const moved = row()

    expect(Math.min(...still)).toBeLessThan(Math.max(...still) * 0.6)
    expect(moved).not.toEqual(still)
  })

  it('stands complete at its end state, each wisp at its own phase', () => {
    const frames = ribbonFrames(null)

    expect(frames.map((f) => f.drawn)).toEqual([1, 1, 1])
    expect(frames.map((f) => f.phase)).toEqual(
      CELEBRATION.ribbons.map((r) => r.wisp.phase),
    )
  })

  it('draws on over its span, eased, then drifts its wisp from the idle', () => {
    const { durationMs } = CELEBRATION.timing.ribbons
    const { idleFromMs, idle } = CELEBRATION.timing
    const plan = ribbonPlan()

    expect(ribbonFrames(0).map((f) => f.drawn)).toEqual([0, 0, 0])
    const mid = ribbonFrames(plan[2].revealAt + durationMs / 2)[2].drawn
    expect(mid).toBeCloseTo(easeOut(0.5), 6)
    expect(mid).toBeGreaterThan(0.5)
    expect(ribbonFrames(idleFromMs).map((f) => f.drawn)).toEqual([1, 1, 1])
    expect(ribbonFrames(idleFromMs + 1000)[0].phase).toBeCloseTo(
      CELEBRATION.ribbons[0].wisp.phase + idle.wispRadPerS,
      6,
    )
  })
})

describe("the starburst's mist (round 4)", () => {
  it('thins toward the right by its cut, full up, left and down', () => {
    const { rightCut } = CELEBRATION.burst.mist

    expect(mistAngle(0)).toBeCloseTo(1, 6)
    expect(mistAngle(90)).toBeCloseTo(1 - rightCut, 6)
    expect(mistAngle(180)).toBeCloseTo(1, 6)
    expect(mistAngle(270)).toBeCloseTo(1, 6)
  })

  it("keeps the starburst's right ray off the lit spire: 2.5 screen 4 px at most", () => {
    expect(CELEBRATION.burst.rays.lengthW.right).toBeLessThanOrEqual(
      2.5 * 0.003436 + 1e-5,
    )
  })
})

describe('ease-out', () => {
  it("is CSS's cubic-bezier(0, 0, 0.58, 1)", () => {
    expect(easeOut(0)).toBe(0)
    expect(easeOut(1)).toBe(1)
    // x(t) = 1.74 t^2 (1 - t) + t^3 is 0.5 at t 0.62575, where
    // y(t) = 3 t^2 (1 - t) + t^3 is 0.68464.
    expect(easeOut(0.5)).toBeCloseTo(0.68464, 4)
  })
})

describe("a glow's stops", () => {
  it('spaces its rings evenly from the centre to the edge', () => {
    expect(
      screenStops([
        [200, 210, 220],
        [100, 110, 120],
        [0, 0, 0],
      ]),
    ).toEqual([
      'rgb(200, 210, 220) 0.0%',
      'rgb(100, 110, 120) 50.0%',
      'rgb(0, 0, 0) 100.0%',
    ])
  })
})

describe("the glows' colours, fitted to the result plate", () => {
  const glows = [
    ['star', CELEBRATION.star.glow],
    ['starburst', CELEBRATION.burst.glow],
  ] as const
  const brightness = (c: readonly number[]): number => c[0] + c[1] + c[2]

  it.each(glows)(
    "fade the %s's glow to black at its edge, where screen adds nothing",
    (_, glow) => {
      expect(glow.screen[glow.screen.length - 1]).toEqual([0, 0, 0])
      expect(
        glow.screen
          .flat()
          .filter((c) => !Number.isInteger(c) || c < 0 || c > 255),
      ).toEqual([])
    },
  )

  it.each(glows)("light the %s's glow most at its centre", (_, glow) => {
    const middle = glow.screen[Math.floor(glow.screen.length / 2)]

    expect(brightness(glow.screen[0])).toBeGreaterThan(brightness(middle))
    expect(brightness(middle)).toBeGreaterThan(0)
  })
})

describe('the timings', () => {
  it('reveals each sparkle its delay after the dot it follows, and twinkles it from its own seed', () => {
    const { dots, sparkles } = CELEBRATION.timing
    const [shortest, longest] = sparkles.idlePeriodMs
    const timings = sparkleTimings()

    expect(timings).toHaveLength(CELEBRATION_SPARKLES.length)
    expect(timings.map((t) => t.revealAt)).toEqual(
      CELEBRATION_SPARKLES.map(
        (sp) => dots.firstMs + sp.afterRank * dots.staggerMs + sparkles.delayMs,
      ),
    )
    expect(sparkleTimings()).toEqual(timings)
    expect(
      timings.every((t) => t.periodMs >= shortest && t.periodMs <= longest),
    ).toBe(true)
    expect(timings[0].periodMs).not.toBe(dotTimings()[0].periodMs)
  })

  it('reveals the dots nearest the starburst first, a stagger apart', () => {
    const { firstMs, staggerMs } = CELEBRATION.timing.dots
    const reveal = dotTimings().map((t) => t.revealAt)

    expect(reveal).toHaveLength(33)
    expect(reveal[0]).toBe(firstMs)
    expect(
      reveal.every((at, i) => i === 0 || at === reveal[i - 1] + staggerMs),
    ).toBe(true)
  })

  it('gives each dot its own twinkle from the seed, the same every time', () => {
    const [shortest, longest] = CELEBRATION.timing.idle.dotPeriodMs
    const first = dotTimings()
    const again = dotTimings()

    expect(again).toEqual(first)
    expect(
      first.every((t) => t.periodMs >= shortest && t.periodMs <= longest),
    ).toBe(true)
    expect(
      first.every((t) => t.twinkleAt >= CELEBRATION.timing.idleFromMs),
    ).toBe(true)
    expect(
      new Set(first.map((t) => t.periodMs.toFixed(3))).size,
    ).toBeGreaterThan(20)
  })

  it('draws a seeded sequence that differs by seed', () => {
    const a = seeded(7)
    const b = seeded(8)

    expect([a(), a()]).not.toEqual([b(), b()])
  })

  it("puts the burst's overshoot where the spec has it", () => {
    const frames = keyframeOffsets(CELEBRATION.timing.burst.coreScale)

    expect(frames.map((f) => f.value)).toEqual([0, 1.25, 1])
    expect(frames[1].offset).toBeCloseTo(220 / 520, 6)
    expect(frames[2].offset).toBe(1)
  })
})
