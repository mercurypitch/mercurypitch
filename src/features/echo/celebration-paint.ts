// ============================================================
// The celebration star's paint: paths, gradients and timings, from its spec
// ============================================================
//
// Art round 4 (CELEBRATION in echo-celebration.ts, from the A0 spec's r3
// block) draws the result's star as four things: a hollow star (two
// outlines over a translucent fill, in a glow, the inner outline lumpy),
// 33 sparkle dots, three thin wispy ribbons along the dots' chains, and a
// starburst (a cyan mist, a glow, rays and a core). The model is A0's
// (tools/celebration_r3.py draw):
//
//   glows         light added in linear RGB over whatever lies under it.
//                 CSS cannot add in linear light, so a glow is a radial
//                 gradient screened over the plate, each ring's colour
//                 fitted offline to the plate's own pixels in that ring
//                 (scripts/sync-echo-art.mjs fitLights).
//   Gaussians     a dot's soft glow and crisp core (one colour), the
//                 burst's core, a ray across its width, a ribbon across
//                 its curve, the mist: alpha exp(-r^2 / 2 sigma^2),
//                 sigma = FWHM / 2.3548.
//   ribbons       laid over at alpha x the Gaussian across x the wisp
//                 along (1 - depth (0.5 + 0.5 sin(2 pi s / period +
//                 phase))) x the tapers at both ends. No CSS or SVG stroke
//                 varies its alpha along a curve, so they are painted
//                 pixel by pixel into a canvas (ribbonField, paintRibbons).
//
// Pure: sizes in px come in, CSS and SVG strings go out.

import { CELEBRATION } from './echo-celebration'
import { PLATE_BASE } from './echo-geometry'

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
 * clockwise on screen, as the outline is drawn on. `wobbleCcw` (the inner
 * outline's lumps) scales each corner's radius; the spec lists its factors
 * counter-clockwise on screen from the top tip, so the path's corner i
 * takes factor (10 - i) % 10.
 */
export function starPath(
  tip: number,
  valley: number,
  wobbleCcw?: readonly number[],
): string {
  const corners = Array.from({ length: 10 }, (_, i) => {
    const r =
      (i % 2 === 0 ? tip : tip * valley) * (wobbleCcw?.[(10 - i) % 10] ?? 1)
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

// ── Round 4: the ribbons and the mist ─────────────────────────

export type Pt = readonly [number, number]

/**
 * A uniform Catmull-Rom curve through `points`, its ends extended by
 * reflection (A0's catmull()): `perSegment` samples per pair of points,
 * each pair's first and last included.
 */
export function catmullRom(
  points: readonly Pt[],
  perSegment = 40,
): [number, number][] {
  const out: [number, number][] = []
  const n = perSegment
  if (points.length < 2) return points.map(([x, y]) => [x, y])
  const reflect = (a: Pt, b: Pt): Pt => [2 * a[0] - b[0], 2 * a[1] - b[1]]
  const ext: Pt[] = [
    reflect(points[0], points[1]),
    ...points,
    reflect(points[points.length - 1], points[points.length - 2]),
  ]
  for (let i = 1; i < ext.length - 2; i++) {
    const [p0, p1, p2, p3] = [ext[i - 1], ext[i], ext[i + 1], ext[i + 2]]
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1)
      const at = (c: 0 | 1): number =>
        0.5 *
        (2 * p1[c] +
          (-p0[c] + p2[c]) * t +
          (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t * t +
          (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t * t * t)
      out.push(points.length === 2 ? lerp(p1, p2, t) : [at(0), at(1)])
    }
  }
  return out
}

const lerp = (a: Pt, b: Pt, t: number): [number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
]

/** CSS's ease-out, cubic-bezier(0, 0, 0.58, 1), at progress `x`. */
export function easeOut(x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bx = (t: number) => 1.74 * t * t * (1 - t) + t * t * t
  let lo = 0
  let hi = 1
  for (let i = 0; i < 40; i++) {
    const t = (lo + hi) / 2
    if (bx(t) < x) lo = t
    else hi = t
  }
  const t = (lo + hi) / 2
  return 3 * t * t * (1 - t) + t * t * t
}

export interface RibbonPlan {
  /** When it starts to draw on, ms from t 0. */
  readonly revealAt: number
  /** It draws on from its first point (else from its last). */
  readonly fromStart: boolean
}

/**
 * Each ribbon's draw, in the spec's order. The spec draws each "from the
 * end nearest the starburst", a stagger apart; it does not say which goes
 * first, so they go as the dots do: the one whose burst end is nearest
 * the starburst first.
 */
export function ribbonPlan(): RibbonPlan[] {
  const { burst, ribbons } = CELEBRATION
  const { fromMs, staggerMs } = CELEBRATION.timing.ribbons
  // In the base frame's px, so u and v weigh as on screen.
  const away = ([u, v]: Pt): number =>
    Math.hypot(
      (u - burst.u) * PLATE_BASE.width,
      (v - burst.v) * PLATE_BASE.height,
    )
  const ends = ribbons.map((r) => {
    const first = away(r.points[0])
    const last = away(r.points[r.points.length - 1])
    return { near: Math.min(first, last), fromStart: first <= last }
  })
  const order = ends
    .map((e, i) => ({ i, near: e.near }))
    .sort((a, b) => a.near - b.near)
    .map((e) => e.i)
  return ends.map((e, i) => ({
    revealAt: fromMs + order.indexOf(i) * staggerMs,
    fromStart: e.fromStart,
  }))
}

/** A ribbon's pixels in a canvas, each's light and place along the curve. */
export interface RibbonField {
  /** Indices into the canvas's pixels (row-major). */
  readonly pixels: Int32Array
  /** Alpha before the wisp: the ribbon's alpha x the Gaussian x the tapers. */
  readonly alpha: Float32Array
  /** px along the curve from its first point, at its nearest point. */
  readonly along: Float32Array
  /** px along the curve from the end it draws on from. */
  readonly fromBurst: Float32Array
  /** The curve's length, px. */
  readonly length: number
}

/** Out to 4 sigma across a ribbon (A0's patch): past it, under 0.04 %. */
const RIBBON_REACH = 4

/** Each sample's distance along the curve from its first, px. */
function lengthsAlong(curve: readonly Pt[]): number[] {
  const along = [0]
  for (let k = 1; k < curve.length; k++) {
    const [x0, y0] = curve[k - 1]
    const [x1, y1] = curve[k]
    along.push(along[k - 1] + Math.hypot(x1 - x0, y1 - y0))
  }
  return along
}

/** A canvas's pixels: each one's squared distance to the curve, and where along it. */
interface Nearest {
  readonly d2: Float32Array
  /** px along the curve, or -1 out of reach. */
  readonly place: Float32Array
}

/**
 * Each piece of the curve between two samples, to the device pixels within
 * `reach` of it: the distance to the piece itself, so a sparse sampling
 * does not ripple the Gaussian.
 */
function nearestOnCurve(
  curve: readonly Pt[],
  along: readonly number[],
  reach: number,
  canvas: { width: number; height: number; dpr: number },
): Nearest {
  const { width, height, dpr } = canvas
  const d2 = new Float32Array(width * height).fill(Infinity)
  const place = new Float32Array(width * height).fill(-1)
  for (let k = 1; k < curve.length; k++) {
    const ax = curve[k - 1][0] * dpr
    const ay = curve[k - 1][1] * dpr
    const vx = curve[k][0] * dpr - ax
    const vy = curve[k][1] * dpr - ay
    const v2 = Math.max(vx * vx + vy * vy, 1e-12)
    const x0 = Math.max(0, Math.floor(Math.min(ax, ax + vx) - reach))
    const x1 = Math.min(width - 1, Math.ceil(Math.max(ax, ax + vx) + reach))
    const y0 = Math.max(0, Math.floor(Math.min(ay, ay + vy) - reach))
    const y1 = Math.min(height - 1, Math.ceil(Math.max(ay, ay + vy) + reach))
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const wx = px + 0.5 - ax
        const wy = py + 0.5 - ay
        const t = Math.min(1, Math.max(0, (wx * vx + wy * vy) / v2))
        const dx = wx - t * vx
        const dy = wy - t * vy
        const i = py * width + px
        if (dx * dx + dy * dy < d2[i]) {
          d2[i] = dx * dx + dy * dy
          place[i] = along[k - 1] + t * (along[k] - along[k - 1])
        }
      }
    }
  }
  return { d2, place }
}

/** A ribbon's tapers at `s` px along a curve `length` px long. */
const taperAt = (s: number, length: number, taper: number): number =>
  taper > 0
    ? Math.min(1, Math.max(0, s / taper)) *
      Math.min(1, Math.max(0, (length - s) / taper))
    : 1

/**
 * A ribbon's field: for each device pixel within reach of `curve` (px in
 * the canvas's CSS box), its nearest point on the sampled curve (A0's
 * draw_ribbons takes the nearest sample), the Gaussian across at that
 * distance (`fwhm` px), the tapers over `taper` px at both ends, and where
 * along the curve it is.
 */
export function ribbonField(
  curve: readonly Pt[],
  o: { fwhm: number; taper: number; alpha: number; fromStart: boolean },
  canvas: { width: number; height: number; dpr: number },
): RibbonField {
  const along = lengthsAlong(curve)
  const length = along[along.length - 1]
  const sigma = sigmaOf(o.fwhm) * canvas.dpr
  const { d2, place } = nearestOnCurve(
    curve,
    along,
    Math.ceil(RIBBON_REACH * sigma) + 1,
    canvas,
  )
  const limit = (RIBBON_REACH * sigma) ** 2
  const pixels: number[] = []
  const alpha: number[] = []
  const at: number[] = []
  for (let i = 0; i < place.length; i++) {
    const s = place[i]
    if (s < 0 || d2[i] > limit) continue
    const a =
      o.alpha *
      Math.exp(-d2[i] / (2 * sigma * sigma)) *
      taperAt(s, length, o.taper)
    if (a <= 0) continue
    pixels.push(i)
    alpha.push(a)
    at.push(s)
  }
  return {
    pixels: Int32Array.from(pixels),
    alpha: Float32Array.from(alpha),
    along: Float32Array.from(at),
    fromBurst: Float32Array.from(at, (s) => (o.fromStart ? s : length - s)),
    length,
  }
}

export interface RibbonFrame {
  /** How much of it is drawn on, 0 to 1. */
  readonly drawn: number
  /** Its wisp's phase, rad. */
  readonly phase: number
}

/**
 * Each ribbon's state `elapsed` ms from t 0, in the spec's order; null is
 * the end state (reduced motion, a fixture): whole, its wisp at its own
 * phase. From the idle the wisps drift (timing.idle.wispRadPerS).
 */
export function ribbonFrames(elapsed: number | null): RibbonFrame[] {
  const { durationMs } = CELEBRATION.timing.ribbons
  const { idleFromMs, idle } = CELEBRATION.timing
  const plan = ribbonPlan()
  return CELEBRATION.ribbons.map((r, i) => {
    if (elapsed === null) return { drawn: 1, phase: r.wisp.phase }
    const drift =
      elapsed > idleFromMs
        ? (idle.wispRadPerS * (elapsed - idleFromMs)) / 1000
        : 0
    return {
      drawn: easeOut((elapsed - plan[i].revealAt) / durationMs),
      phase: r.wisp.phase + drift,
    }
  })
}

/**
 * Paint the ribbons into a canvas's RGBA pixels (every pixel rewritten),
 * each laid over the ones before it in its own colour, at its frame.
 */
export function paintRibbons(
  rgba: Uint8ClampedArray,
  fields: readonly RibbonField[],
  frames: readonly RibbonFrame[],
  wisps: readonly { depth: number; periodPx: number }[],
  colours: readonly (readonly number[])[],
): void {
  rgba.fill(0)
  const n = rgba.length / 4
  // Premultiplied colour and alpha, laid over ribbon by ribbon.
  const acc = new Float32Array(n * 4)
  fields.forEach((f, j) => {
    const { drawn, phase } = frames[j]
    if (drawn <= 0) return
    const shown = drawn * f.length
    const { depth, periodPx } = wisps[j]
    const k = (2 * Math.PI) / periodPx
    const [r, g, b] = colours[j]
    for (let m = 0; m < f.pixels.length; m++) {
      if (f.fromBurst[m] > shown) continue
      const a =
        f.alpha[m] *
        (1 - depth * (0.5 + 0.5 * Math.sin(k * f.along[m] + phase)))
      const p = f.pixels[m] * 4
      const keep = 1 - a
      acc[p] = r * a + acc[p] * keep
      acc[p + 1] = g * a + acc[p + 1] * keep
      acc[p + 2] = b * a + acc[p + 2] * keep
      acc[p + 3] = a + acc[p + 3] * keep
    }
  })
  for (let p = 0; p < acc.length; p += 4) {
    const a = acc[p + 3]
    if (a <= 0) continue
    rgba[p] = acc[p] / a
    rgba[p + 1] = acc[p + 1] / a
    rgba[p + 2] = acc[p + 2] / a
    rgba[p + 3] = Math.round(255 * a)
  }
}

/** Out to 4 sigma about the mist's centre: at alpha 0.95, 3 still steps. */
export const MIST_REACH = 4

/**
 * The mist's alpha by direction, `deg` clockwise from straight up (CSS
 * conic-gradient's angle): cut toward the right, and streaked (spec model:
 * t counter-clockwise from screen right).
 */
export function mistAngle(deg: number): number {
  const { rightCut, streaks } = CELEBRATION.burst.mist
  const t = ((90 - deg) * Math.PI) / 180
  return (
    (1 - rightCut * Math.max(Math.cos(t), 0) ** 2) *
    (1 - streaks.depth * (0.5 + 0.5 * Math.cos(streaks.n * t + 0.6)))
  )
}

/** The mist's mask: its alpha by direction, as conic-gradient stops. */
export function mistAngleStops(step = 5): string[] {
  return Array.from({ length: 360 / step + 1 }, (_, i) => {
    const deg = i * step
    return `rgba(0, 0, 0, ${mistAngle(deg).toFixed(4)}) ${deg}deg`
  })
}
