// ============================================================
// The lit instruments' arithmetic: easing, and SVG paths for lines,
// circles, polylines, smooth curves, part of a polyline and a sine wave.
// Pure, so each lit instrument draws from props and time alone.
// ============================================================

export const clamp = (value: number, lo: number, hi: number): number =>
  value < lo ? lo : value > hi ? hi : value

export const lerp = (from: number, to: number, t: number): number =>
  from + (to - from) * t

/** How far `t` has come from `from` to `to`, held to 0..1. */
export const progress = (t: number, from: number, to: number): number =>
  clamp((t - from) / (to - from), 0, 1)

/** Ease out: fast, then settling. */
export const easeOut = (t: number): number =>
  1 - Math.pow(1 - clamp(t, 0, 1), 3)

/** Ease in and out. */
export function easeInOut(t: number): number {
  const x = clamp(t, 0, 1)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/** Ease out with a little overshoot: a thing dropped into place. */
export function easeOutBack(t: number): number {
  const x = clamp(t, 0, 1)
  const c1 = 1.5
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

/** A number to a tenth, for an attribute. */
export const tenth = (value: number): number => Math.round(value * 10) / 10

export type Point = readonly [number, number]

export function lineD(x1: number, y1: number, x2: number, y2: number): string {
  return `M${tenth(x1)} ${tenth(y1)}L${tenth(x2)} ${tenth(y2)}`
}

export function circleD(cx: number, cy: number, r: number): string {
  return `M${tenth(cx - r)} ${tenth(cy)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`
}

export function polyD(points: readonly Point[]): string {
  return points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${tenth(x)} ${tenth(y)}`)
    .join('')
}

/** A curve through every point (Catmull-Rom as cubic Béziers). */
export function smoothD(points: readonly Point[]): string {
  if (points.length < 2) return ''
  let d = `M${tenth(points[0][0])} ${tenth(points[0][1])}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    d += `C${tenth(p1[0] + (p2[0] - p0[0]) / 6)} ${tenth(p1[1] + (p2[1] - p0[1]) / 6)} ${tenth(p2[0] - (p3[0] - p1[0]) / 6)} ${tenth(p2[1] - (p3[1] - p1[1]) / 6)} ${tenth(p2[0])} ${tenth(p2[1])}`
  }
  return d
}

/** The first `fraction` of a polyline: its path, its tip, and the last
 *  whole point reached. */
export function partialD(
  points: readonly Point[],
  fraction: number,
): { d: string; tip: Point; reached: number } {
  const last = points.length - 1
  if (last < 1) return { d: '', tip: points[0] ?? [0, 0], reached: 0 }
  const at = clamp(fraction, 0, 1) * last
  const reached = Math.min(last, Math.floor(at))
  const drawn: Point[] = points.slice(0, reached + 1)
  let tip = points[reached]
  if (reached < last) {
    const u = at - reached
    tip = [
      lerp(points[reached][0], points[reached + 1][0], u),
      lerp(points[reached][1], points[reached + 1][1], u),
    ]
    drawn.push(tip)
  }
  return { d: polyD(drawn), tip, reached }
}

/**
 * A sine wave from `x0` to `x1` about `y`: `amplitude` px high, one swing
 * every `wavelength` px, shifted by `phase` radians, its height shaped
 * along the way by `envelope` (1 throughout when none).
 */
export function sineD(
  x0: number,
  x1: number,
  y: number,
  amplitude: number,
  wavelength: number,
  phase: number,
  envelope?: (x: number) => number,
): string {
  const steps = Math.max(8, Math.round((x1 - x0) / 3))
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps
    const a = amplitude * (envelope ? envelope(x) : 1)
    const v = y + a * Math.sin(((x - x0) / wavelength) * Math.PI * 2 + phase)
    d += `${i === 0 ? 'M' : 'L'}${tenth(x)} ${tenth(v)}`
  }
  return d
}
