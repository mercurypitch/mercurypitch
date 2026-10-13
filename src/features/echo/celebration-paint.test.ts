// ============================================================
// The celebration star's paint: the shapes, the light and the timings
// ============================================================

import { describe, expect, it } from 'vitest'
import { dotTimings, keyframeOffsets, screenStops, seeded, starPath, } from './celebration-paint'
import { CELEBRATION } from './echo-geometry'

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
