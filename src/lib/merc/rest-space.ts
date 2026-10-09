// ============================================================
// Merc rest space — the JS mirror of the shader's body and warp
// ============================================================
//
// The physics places the eyes on the body's surface and carries rest-space
// points (eye centres, the hot core) into the world through the same warp the
// shader undoes per pixel. These functions mirror the GLSL operation for
// operation; a drift here moves the eyes off the body, so keep the two in
// step (toRest and sdBodyQ in scene-shader-sdf.ts).

import { SHAPE } from './constants'

export type V3 = [number, number, number]

/** The warp of one instant (the shader's uRoot, uShape and uLean). */
export interface Warp {
  readonly root: readonly [number, number, number]
  /** squash, melt, cos(yaw), sin(yaw) */
  readonly shape: readonly [number, number, number, number]
  /** leanX, leanZ, swayX, swayZ */
  readonly lean: readonly [number, number, number, number]
}

export interface EyeFrame {
  /** Centre, in rest space. */
  readonly c: V3
  /** The eye's own x axis (its up axis is cross(z, x)). */
  readonly x: V3
  /** Surface normal at the centre. */
  readonly z: V3
}

export const norm3 = (v: readonly number[]): [number, number, number] => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

export const cross3 = (
  a: readonly number[],
  b: readonly number[],
): [number, number, number] => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

export const smoothJ = (a: number, b: number, x: number): number => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

function sminJ(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

function ellipsoidJ(
  x: number,
  y: number,
  z: number,
  r: readonly number[],
): number {
  const k0 = Math.hypot(x / r[0], y / r[1], z / r[2])
  const k1 = Math.hypot(x / (r[0] * r[0]), y / (r[1] * r[1]), z / (r[2] * r[2]))
  return (k0 * (k0 - 1)) / Math.max(k1, 1e-6)
}

// The rest body's distance (no feet, nub, eyes or displacement).
export function restBody(x: number, y: number, z: number): number {
  const S = SHAPE
  const e = ellipsoidJ(x, y - S.bulbY, z, S.bulbR)
  const r1 = S.coneR1
  const r2 = S.coneR2
  const h = S.coneH
  const b = (r1 - r2) / h
  const a = Math.sqrt(1 - b * b)
  const dt = S.restH - y
  const pn =
    S.tipPinch * smoothJ(0.01, 0.045, dt) * (1 - smoothJ(0.05, 0.14, dt))
  const qx = Math.hypot(x, z) / (1 - pn)
  const qy = y - S.coneY
  const kk = -b * qx + a * qy
  let c
  if (kk < 0) c = Math.hypot(qx, qy) - r1
  else if (kk > a * h) c = Math.hypot(qx, qy - h) - r2
  else c = qx * a + qy * b - r1
  c *= 1 - pn
  return -sminJ(-sminJ(e, c, S.bodyK), y - S.flatY, S.flatK)
}

// Both eyes for a gaze (lookX, lookY): each centre found on the rest surface
// by bisection, then sunk by eyeEmbed along the normal.
export function placeEyes(lookX: number, lookY: number): [EyeFrame, EyeFrame] {
  const out: EyeFrame[] = []
  for (const side of [-1, 1]) {
    const x0 = side * SHAPE.eyeX + lookX * 0.035
    const y0 = SHAPE.eyeY + lookY * 0.03
    let lo = 0
    let hi = 0.8
    for (let i = 0; i < 28; i++) {
      const m = (lo + hi) / 2
      if (restBody(x0, y0, m) < 0) lo = m
      else hi = m
    }
    const z = (lo + hi) / 2
    const e = 1e-3
    const n = norm3([
      restBody(x0 + e, y0, z) - restBody(x0 - e, y0, z),
      restBody(x0, y0 + e, z) - restBody(x0, y0 - e, z),
      restBody(x0, y0, z + e) - restBody(x0, y0, z - e),
    ])
    const em = SHAPE.eyeEmbed
    // The eye's up axis lies in the surface, its top leaning in by eyeTilt
    // (seen from the front); x completes the frame so the shader's
    // cross(z, x) gives that up axis back.
    const t = -side * Math.tan((SHAPE.eyeTilt * Math.PI) / 180)
    const up = norm3([t, 1, -(t * n[0] + n[1]) / n[2]])
    out.push({
      c: [x0 - n[0] * em, y0 - n[1] * em, z - n[2] * em],
      x: norm3(cross3(up, n)),
      z: n,
    })
  }
  return [out[0], out[1]]
}

// Exact JS mirror of the shader's toRest (world -> rest), for one pose.
export function toRestJS(p: readonly number[], P: Warp): V3 {
  let x = p[0] - P.root[0]
  let y = p[1] - P.root[1]
  let z = p[2] - P.root[2]
  const [s, melt, cy, sy] = P.shape
  ;[x, z] = [cy * x - sy * z, sy * x + cy * z]
  const hy = Math.min(
    1.4,
    Math.max(
      0,
      (y - SHAPE.bodyY0 + 0.055) / (SHAPE.restH - SHAPE.bodyY0 + 0.055),
    ),
  )
  let a = P.lean[0] * hy
  ;[x, y] = [
    Math.cos(a) * x - Math.sin(a) * y,
    Math.sin(a) * x + Math.cos(a) * y,
  ]
  a = P.lean[1] * hy
  ;[z, y] = [
    Math.cos(a) * z - Math.sin(a) * y,
    Math.sin(a) * z + Math.cos(a) * y,
  ]
  const sw = smoothJ(0.25 + SHAPE.bodyY0, 1.2 + SHAPE.bodyY0, y) ** 2
  x -= P.lean[2] * sw
  z -= P.lean[3] * sw
  const yw = y
  y = yw / s
  if (s < 0.999) {
    const st = s + (1 - s) * 0.65
    const y1 = (0.72 + SHAPE.bodyY0) * s
    y -= (1 / s - 1 / st) * 0.07 * Math.log(1 + Math.exp((yw - y1) / 0.07))
  }
  x *= Math.sqrt(s)
  z *= Math.sqrt(s)
  const m = 1 + melt * 0.75 * (1 - smoothJ(SHAPE.bodyY0, 0.8 + SHAPE.bodyY0, y))
  return [x / m, y, z / m]
}

function jacobian(p: readonly number[], P: Warp): number[][] {
  const e = 1e-4
  const J = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  for (let j = 0; j < 3; j++) {
    const a = p.slice()
    const b = p.slice()
    a[j] += e
    b[j] -= e
    const fa = toRestJS(a, P)
    const fb = toRestJS(b, P)
    for (let i = 0; i < 3; i++) J[i][j] = (fa[i] - fb[i]) / (2 * e)
  }
  return J
}

function solve3(J: readonly (readonly number[])[], r: readonly number[]): V3 {
  const [[a, b, c], [d, e, f], [g, h, i]] = J
  const A = e * i - f * h
  const B = -(d * i - f * g)
  const C = d * h - e * g
  const det = a * A + b * B + c * C
  if (Math.abs(det) < 1e-12) return [0, 0, 0]
  const inv = [
    [A, -(b * i - c * h), b * f - c * e],
    [B, a * i - c * g, -(a * f - c * d)],
    [C, -(a * h - b * g), a * e - b * d],
  ]
  const row = (k: number): number =>
    (inv[k][0] * r[0] + inv[k][1] * r[1] + inv[k][2] * r[2]) / det
  return [row(0), row(1), row(2)]
}

// Rest -> world by Newton on toRestJS, starting from an approximate guess.
export function restToWorldExact(
  r: readonly number[],
  P: Warp,
  guess: readonly number[],
): number[] {
  let p = guess.slice()
  for (let it = 0; it < 8; it++) {
    const f = toRestJS(p, P)
    const e = [r[0] - f[0], r[1] - f[1], r[2] - f[2]]
    if (Math.hypot(e[0], e[1], e[2]) < 1e-7) break
    const dp = solve3(jacobian(p, P), e)
    p = [p[0] + dp[0], p[1] + dp[1], p[2] + dp[2]]
  }
  return p
}

// The shader's bend height and sway weight at a world point.
export function bendAt(p: readonly number[], P: Warp): [number, number] {
  let x = p[0] - P.root[0]
  let y = p[1] - P.root[1]
  let z = p[2] - P.root[2]
  const [, , cy, sy] = P.shape
  ;[x, z] = [cy * x - sy * z, sy * x + cy * z]
  const hy = Math.min(
    1.4,
    Math.max(
      0,
      (y - SHAPE.bodyY0 + 0.055) / (SHAPE.restH - SHAPE.bodyY0 + 0.055),
    ),
  )
  let a = P.lean[0] * hy
  ;[x, y] = [
    Math.cos(a) * x - Math.sin(a) * y,
    Math.sin(a) * x + Math.cos(a) * y,
  ]
  a = P.lean[1] * hy
  ;[z, y] = [
    Math.cos(a) * z - Math.sin(a) * y,
    Math.sin(a) * z + Math.cos(a) * y,
  ]
  return [hy, smoothJ(0.25 + SHAPE.bodyY0, 1.2 + SHAPE.bodyY0, y) ** 2]
}
