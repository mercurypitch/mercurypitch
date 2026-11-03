// ============================================================
// TV stage trail spline — the singer's pitch as one smooth curve
// ============================================================
//
// The microphone's readings arrive many times a second, each a little off
// the last: joined with straight lines they draw a jagged scribble, which
// from the sofa reads as noise rather than a voice. So a stroke is first
// smoothed (each reading averaged with its neighbours over 80 ms, shorter
// than a vibrato's swing, so the vibrato stays), thinned to a knot every
// 30 ms, and then drawn as a centripetal Catmull-Rom spline: a curve through
// every knot, with no loops or overshoot where the knots bunch up (Yuksel,
// Schaefer and Keyser, "On the parameterization of Catmull-Rom curves",
// 2009). Each piece goes to the canvas as one cubic Bezier, which every
// canvas draws natively; the conversion is d3-shape's curveCatmullRom.
//
// Tests: src/lib/tv-stage/trail-spline.test.ts.

import type { TrailPoint } from './lane-judge'

/** A point the curve passes through, in pixels. */
export interface Knot {
  readonly x: number
  readonly y: number
}

/** One piece of the curve: a cubic Bezier from the knot before it to `to`. */
export interface CurvePiece {
  readonly c1: Knot
  readonly c2: Knot
  readonly to: Knot
}

/** Half the smoothing window, and the least time between two knots, in seconds. */
const SMOOTH_HALF_SEC = 0.04
export const KNOT_STEP_SEC = 0.03

/**
 * A stroke smoothed and thinned: each point's height averaged over its
 * neighbours within `halfSec`, a point kept every `stepSec`, and the first
 * and last always kept, so the curve starts and ends where the singer did.
 */
export function smoothStroke(
  stroke: readonly TrailPoint[],
  halfSec = SMOOTH_HALF_SEC,
  stepSec = KNOT_STEP_SEC,
): TrailPoint[] {
  const kept: TrailPoint[] = []
  let from = 0
  let to = 0
  let sum = 0
  stroke.forEach((point, index) => {
    while (to < stroke.length && stroke[to].time <= point.time + halfSec) {
      sum += stroke[to].midi
      to += 1
    }
    while (stroke[from].time < point.time - halfSec) {
      sum -= stroke[from].midi
      from += 1
    }
    const last = kept.at(-1)
    const isEnd = index === 0 || index === stroke.length - 1
    if (isEnd || last === undefined || point.time - last.time >= stepSec) {
      kept.push({ ...point, midi: sum / (to - from) })
    }
  })
  return kept
}

/** The knot spacing of the centripetal curve: the square root of the distance. */
const spacing = (a: Knot, b: Knot): number =>
  Math.sqrt(Math.hypot(b.x - a.x, b.y - a.y))

/** A weighted sum of three knots, over `n`. */
const blend = (
  terms: readonly (readonly [Knot, number])[],
  n: number,
): Knot => ({
  x: terms.reduce((sum, [knot, w]) => sum + knot.x * w, 0) / n,
  y: terms.reduce((sum, [knot, w]) => sum + knot.y * w, 0) / n,
})

/**
 * The Bezier for the stretch from p1 to p2, with p0 before it and p3 after;
 * at a free end the end knot stands in for the missing one.
 */
function piece(p0: Knot, p1: Knot, p2: Knot, p3: Knot): CurvePiece {
  const l01 = spacing(p0, p1)
  const l12 = spacing(p1, p2)
  const l23 = spacing(p2, p3)
  // With alpha one half, a spacing squared is the distance itself.
  const [d01, d12, d23] = [l01 * l01, l12 * l12, l23 * l23]
  let c1 = p1
  if (l01 > 1e-6) {
    const a = 2 * d01 + 3 * l01 * l12 + d12
    c1 = blend(
      [
        [p1, a],
        [p0, -d12],
        [p2, d01],
      ],
      3 * l01 * (l01 + l12),
    )
  }
  let c2 = p2
  if (l23 > 1e-6) {
    const b = 2 * d23 + 3 * l23 * l12 + d12
    c2 = blend(
      [
        [p2, b],
        [p1, d23],
        [p3, -d12],
      ],
      3 * l23 * (l23 + l12),
    )
  }
  return { c1, c2, to: p2 }
}

/**
 * The centripetal Catmull-Rom curve through `knots`, as Bezier pieces: it
 * starts on the first knot, and each piece ends on the next. Fewer than two
 * knots make no curve.
 */
export function catmullRom(knots: readonly Knot[]): CurvePiece[] {
  const pieces: CurvePiece[] = []
  for (let index = 0; index + 1 < knots.length; index += 1) {
    const p1 = knots[index]
    const p2 = knots[index + 1]
    const p0 = index > 0 ? knots[index - 1] : p1
    const p3 = index + 2 < knots.length ? knots[index + 2] : p2
    pieces.push(piece(p0, p1, p2, p3))
  }
  return pieces
}
