// ============================================================
// The celebration star's paint: paths, gradients and timings, from its spec
// ============================================================
//
// Art round 3 (CELEBRATION in echo-geometry.ts, from the A0 spec's r3
// block) draws the result's star as three things: a hollow star (two
// outlines over a translucent fill, in a glow), 33 sparkle dots, and a
// starburst. The model is A0's (tools/celebration_r3.py draw):
//
//   glows         light added in linear RGB over whatever lies under it.
//                 CSS cannot add in linear light, so a glow is a radial
//                 gradient screened over the plate, each ring's colour
//                 fitted offline to the plate's own pixels in that ring
//                 (scripts/sync-echo-art.mjs fitLights).
//   Gaussians     a dot's soft glow and crisp core (one colour), the
//                 burst's core, a ray across its width: alpha
//                 exp(-r^2 / 2 sigma^2), sigma = FWHM / 2.3548.
//
// Pure: sizes in px come in, CSS and SVG strings go out.

import { CELEBRATION } from './echo-geometry'

/** A Gaussian's sigma from its full width at half maximum. */
export const sigmaOf = (fwhm: number): number => fwhm / 2.3548

/** How far a Gaussian is drawn, in sigmas: past it the alpha is under 1 %. */
export const GAUSS_REACH = 3

/** Stops along a gradient, enough that the eye sees a smooth fall-off. */
const STOPS = 24

/** A glow's stops: its rings' screen colours, evenly spaced centre to edge. */
export function screenStops(rings: readonly (readonly number[])[]): string[] {
  const last = rings.length - 1
  return rings.map(
    (c, i) => `rgb(${c.join(', ')}) ${((100 * i) / last).toFixed(1)}%`,
  )
}

/** The stops of a disc of one colour, its alpha by radius, out to `reach` px. */
export function alphaStops(
  rgb: readonly number[],
  alphaAt: (r: number) => number,
  reach: number,
): string[] {
  return Array.from({ length: STOPS + 1 }, (_, i) => {
    const r = (reach * i) / STOPS
    const a = Math.max(0, Math.min(1, alphaAt(r)))
    return `rgba(${rgb.join(', ')}, ${a.toFixed(4)}) ${((100 * i) / STOPS).toFixed(1)}%`
  })
}

/** A unit-peak Gaussian of `sigma` px, at `r` px. */
export const gauss = (r: number, sigma: number): number =>
  Math.exp((-r * r) / (2 * sigma * sigma))

/**
 * A five-point star about (0, 0), one tip straight up, `tip` px to a tip
 * and `valley` x that to a valley: the path starts at the top tip and runs
 * clockwise on screen, as the outline is drawn on.
 */
export function starPath(tip: number, valley: number): string {
  const corners = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? tip : tip * valley
    const t = ((90 - 36 * i) * Math.PI) / 180
    return `${(r * Math.cos(t)).toFixed(2)} ${(-r * Math.sin(t)).toFixed(2)}`
  })
  return `M ${corners.join(' L ')} Z`
}

/** The bottom tips' depth below the centre, as a share of the tip radius. */
export const BOTTOM_TIPS = Math.cos((36 * Math.PI) / 180)

/** A seeded random in [0, 1) (mulberry32): the twinkles' periods and phases. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface DotTiming {
  /** When the dot starts to appear, ms from t 0. */
  readonly revealAt: number
  /** Its twinkle's whole period, ms, and when it starts, ms from t 0. */
  readonly periodMs: number
  readonly twinkleAt: number
}

/** Each dot's reveal and twinkle, in the spec's order (by reveal rank). */
export function dotTimings(): DotTiming[] {
  const { dots, idleFromMs, idle } = CELEBRATION.timing
  const random = seeded(idle.dotSeed)
  const [shortest, longest] = idle.dotPeriodMs
  return CELEBRATION.dots.map((dot) => {
    const periodMs = shortest + (longest - shortest) * random()
    const phase = periodMs * random()
    return {
      revealAt: dots.firstMs + dot.rank * dots.staggerMs,
      periodMs,
      twinkleAt: idleFromMs + phase,
    }
  })
}

/**
 * A timeline's keyframes ([ms, value] pairs) as Web Animations offsets
 * over its span.
 */
export function keyframeOffsets(
  points: readonly (readonly number[])[],
): { offset: number; value: number }[] {
  const span = points[points.length - 1][0] - points[0][0]
  return points.map(([ms, value]) => ({
    offset: span > 0 ? (ms - points[0][0]) / span : 0,
    value,
  }))
}
