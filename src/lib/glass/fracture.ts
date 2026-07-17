// ============================================================
// Glass — fracture geometry, shard physics and the shatter
// timeline (spec §7 + §17.3). Pure and DETERMINISTIC: the same
// seed reproduces the exact same burst (replays and the Phase-2
// video depend on this). Shared by both renderer backends.
//
// Fracture = recursive biased convex splitting (validated in the
// look-dev prototype): chords through jittered interior points,
// aimed at the impact when nearby — small shards cluster at the
// impact, big slabs survive at the rim, like real glass.
// ============================================================

import type { GlassConfig } from './config'
import { GLASS_CONFIG } from './config'

/** Deterministic PRNG (same generator as the crack field). */
export function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Point = [number, number]

export interface ShardBody {
  /** Polygon in shard-local coordinates (centroid at the origin). */
  local: Point[]
  /** Where this shard's pixels sit in the pane (top-left offset). */
  snapX: number
  snapY: number
  /** World position (starts at the centroid) + depth. */
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  /** In-plane rotation axis angle + current spin. */
  axisAngle: number
  rot: number
  vrot: number
  area: number
}

/** Split a convex polygon by the line through (px,py) at `angle`. */
export function splitPoly(
  poly: Point[],
  px: number,
  py: number,
  angle: number,
): [Point[], Point[]] | null {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const side = (p: Point): number => (p[0] - px) * dy - (p[1] - py) * dx
  const a: Point[] = []
  const b: Point[] = []
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    const sp = side(p)
    const sq = side(q)
    ;(sp >= 0 ? a : b).push(p)
    if (sp >= 0 !== sq >= 0) {
      const t = sp / (sp - sq)
      const ix: Point = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
      a.push(ix)
      b.push(ix)
    }
  }
  return a.length > 2 && b.length > 2 ? [a, b] : null
}

/** Centroid + area of a simple polygon. */
export function polyCentroid(poly: Point[]): {
  cx: number
  cy: number
  area: number
} {
  let x = 0
  let y = 0
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    const cross = p[0] * q[1] - q[0] * p[1]
    a += cross
    x += (p[0] + q[0]) * cross
    y += (p[1] + q[1]) * cross
  }
  a *= 0.5
  if (a === 0) return { cx: poly[0][0], cy: poly[0][1], area: 0 }
  return { cx: x / (6 * a), cy: y / (6 * a), area: Math.abs(a) }
}

/**
 * Fracture the pane rectangle into convex shards around an impact point.
 * `minArea` is in px² of the pane's coordinate space.
 */
export function generateFracture(
  width: number,
  height: number,
  impact: Point,
  seed: number,
  options: { maxShards?: number; minArea?: number } = {},
): Point[][] {
  const maxShards: number = options.maxShards ?? GLASS_CONFIG.shatter.maxShards
  const minArea = options.minArea ?? (width * height) / 900
  const rng = mulberry32(seed)
  const out: Point[][] = []
  const depth = Math.ceil(Math.log2(Math.max(2, maxShards)))
  const rect: Point[] = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ]
  const recurse = (poly: Point[], level: number): void => {
    if (out.length >= maxShards) {
      out.push(poly)
      return
    }
    const { cx, cy, area } = polyCentroid(poly)
    const nearImpact = Math.hypot(cx - impact[0], cy - impact[1]) < width * 0.36
    const done =
      level <= 0 ||
      area < minArea ||
      (level <= 2 && !nearImpact && rng() < 0.35)
    if (done) {
      out.push(poly)
      return
    }
    const jx = cx + (rng() - 0.5) * width * 0.07
    const jy = cy + (rng() - 0.5) * width * 0.07
    const toImpact = Math.atan2(impact[1] - jy, impact[0] - jx)
    const angle =
      nearImpact && rng() < 0.55
        ? toImpact + (rng() - 0.5) * 0.5
        : rng() * Math.PI
    const halves = splitPoly(poly, jx, jy, angle)
    if (halves === null) {
      out.push(poly)
      return
    }
    recurse(halves[0], level - 1)
    recurse(halves[1], level - 1)
  }
  recurse(rect, depth)
  return out
}

/** Turn fracture polygons into rigid bodies bursting from the impact. */
export function buildShardBodies(
  polygons: Point[][],
  impact: Point,
  paneHeight: number,
  seed: number,
  { reduceMotion = false } = {},
): ShardBody[] {
  const rng = mulberry32(seed ^ 0x5f356495)
  return polygons.map((poly) => {
    const { cx, cy, area } = polyCentroid(poly)
    const dx = cx - impact[0]
    const dy = cy - impact[1]
    const dist = Math.hypot(dx, dy) || 1
    const boost = Math.min(1.5, Math.max(0.25, 1.5 - dist / (paneHeight * 0.8)))
    const speed = (120 + rng() * 260) * boost
    return {
      local: poly.map(([x, y]): Point => [x - cx, y - cy]),
      snapX: cx,
      snapY: cy,
      x: cx,
      y: cy,
      z: 0,
      vx: (dx / dist) * speed + (rng() - 0.5) * 60,
      vy: (dy / dist) * speed * 0.7 - 40 - rng() * 90,
      vz: (rng() - 0.5) * 340,
      axisAngle: rng() * Math.PI * 2,
      rot: 0,
      vrot: (rng() - 0.5) * (reduceMotion ? 3 : 7),
      area,
    }
  })
}

/** Advance shard bodies by `dt` seconds (gravity, drag, tumble). */
export function stepShardBodies(bodies: ShardBody[], dt: number): void {
  for (const body of bodies) {
    body.vy += 980 * dt
    body.vx *= 1 - 0.4 * dt
    body.vz *= 1 - 0.3 * dt
    body.x += body.vx * dt
    body.y += body.vy * dt
    body.z += body.vz * dt
    body.rot += body.vrot * dt
  }
}

export interface ShatterTimeline {
  flashSeconds: number
  slowMoFactor: number
  slowMoSeconds: number
  /** Results reveal this long after the slow-mo ends (spec §17.3). */
  resultsDelaySeconds: number
  /** App-facing: seconds from shatter to the results transition. */
  totalSeconds: number
  /** Time-scale multiplier at `t` seconds since the shatter. */
  timeScaleAt: (t: number) => number
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/**
 * The performance-scaled burst timing (decision 16): a clean first-try
 * lock earns the longest, slowest, most cinematic burst; a fatigue-grind
 * collapses quicker and rawer. Deterministic from `epicness`.
 */
export function computeShatterTimeline(
  epicness: number,
  config: GlassConfig = GLASS_CONFIG,
  { reduceMotion = false } = {},
): ShatterTimeline {
  const s = config.shatter
  if (reduceMotion) {
    return {
      flashSeconds: 0,
      slowMoFactor: 1,
      slowMoSeconds: 0.3,
      resultsDelaySeconds: Math.min(0.8, s.resultsDelaySeconds),
      totalSeconds: 0.3 + Math.min(0.8, s.resultsDelaySeconds),
      timeScaleAt: () => 1,
    }
  }
  const e = Math.max(0, Math.min(1, epicness))
  const slowMoFactor = lerp(s.slowMoFactorRaw, s.slowMoFactorEpic, e)
  const slowMoSeconds = lerp(s.slowMoSecondsRaw, s.slowMoSecondsEpic, e)
  const easeBack = 0.6
  return {
    flashSeconds: s.flashSeconds,
    slowMoFactor,
    slowMoSeconds,
    resultsDelaySeconds: s.resultsDelaySeconds,
    totalSeconds: slowMoSeconds + s.resultsDelaySeconds,
    timeScaleAt: (t: number) => {
      if (t < slowMoSeconds) return slowMoFactor
      const back = Math.max(0, Math.min(1, (t - slowMoSeconds) / easeBack))
      return slowMoFactor + (1 - slowMoFactor) * back
    },
  }
}
