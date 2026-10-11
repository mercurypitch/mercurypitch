// ============================================================
// Merc choreography — what each state asks of his springs, step by step
// ============================================================
//
// One function per state. Each reads the time in the state, the smoothed
// voice and the lock, and writes this step's spring targets (T) and effects
// (X): ghosts, sound arcs, hop dots, the climb arrow, blinks, and the root
// position when the state scripts it. Some also kick a spring or throw a
// splash on a cue, in the order the study's switch did.
//
// Ported operation for operation from the pass 4 study, like sim.ts:
// floating-point results depend on the order of operations, so leave the
// arithmetic as it is unless you mean to change how Merc moves.

import type { MercState } from './constants'
import { SHAPE } from './constants'
import type { Q3, Q4 } from './sim-math'
import { clamp, lerp, smooth, TAU } from './sim-math'
import type { Springs, Targets } from './sim-springs'

// The sound arcs a state draws beside him.
export interface Arcs {
  c: [number, number]
  intensity: number
  angle: number
  spread: number
  both: number
  base: number
}

// The choreography's per-step effects and kinematic overrides.
export interface Fx {
  speed: number
  ghosts: Q4[] | null
  arcs: Arcs | null
  dots: Q4[] | null
  stops: Q4 | null
  arrow: Q3 | null
  blink: number
  rootX: number | null
  rootY: number | null
  arcSpeed?: number
  rippleSpeed?: number
  rippleFreq?: number
  rippleSrc?: number
}

/**
 * What the choreography reads from the sim and does to it. Sim satisfies it
 * as it is; naming the shape here, instead of importing Sim, keeps sim.ts and
 * this module out of an import cycle.
 */
export interface ChoreoHost {
  readonly state: MercState
  /** Sim time, seconds. */
  readonly t: number
  readonly rootX: number
  readonly rootY: number
  readonly s: Springs
  /** The voice, smoothed. */
  readonly vs: Readonly<{
    voiced: number
    level: number
    cents: number
    steady: number
    rate: number
  }>
  readonly lock: Readonly<{ on: boolean; t0: number }>
  splash(edge?: number, k?: number, n?: number, kx?: number): void
  sparkle(): void
  ring(strength: number, speed: number): void
  restToWorld(q: readonly number[]): Q3
}

// One step of one state: its clock, what it writes, and the sim it moves.
interface Cue {
  /** Seconds since the state began. */
  readonly tau: number
  /** tau at the previous step, so a cue fires once as tau crosses it. */
  readonly prev: number
  readonly T: Targets
  readonly X: Fx
  readonly sim: ChoreoHost
}

// One hop's slot: where he is in it, and the arc from xa to xb.
interface HopArc {
  u: number
  xa: number
  xb: number
  dir: number
  v0: number
  apex: number
  u0: number
  u1: number
}

const HOP_X = 0.38
const HOPS: readonly (readonly [number, number])[] = [
  [0, HOP_X],
  [HOP_X, 0],
  [0, -HOP_X],
  [-HOP_X, 0],
]
const DROP_T = 0.55
export const DROP_Y0 = 1.75
// Jumps follow the SVG build's timing. Its gravity (4300 units/s^2 on a 530
// unit body) is 8.1 body heights/s^2, which is this body's 1.19 x 8.1.
const GRAV = 9.6
// Celebrate: crouch, a ballistic jump (0.43 s in the air, apex 0.22, about a
// fifth of his height), then a settle; the cycle repeats every 0.8 s.
const CEL = { crouch: 0.15, air: 0.43, period: 0.8 } as const
// Hop: crouch, 0.41 s in the air (apex 0.2), settle, in a 0.75 s slot.
const HOP = { crouch: 0.12, air: 0.41, slot: 0.75 } as const
// The drop-in lands as a splat: held flat, then released into a rebound.
const SPLAT = { sq: 0.58, hold: 0.24 } as const

function crossed(prev: number, now: number, x: number, period = 0): boolean {
  if (!period) return prev < x && now >= x
  const k = Math.floor((now - x) / period)
  return k >= 0 && k * period + x > prev
}

// Eye-open multiplier for blinks at the given times (seconds, optionally looping).
function blinkMul(tau: number, times: readonly number[], period = 0): number {
  const t = period ? tau % period : tau
  let m = 1
  for (const b of times) {
    const d = t - b
    if (d >= 0 && d < 0.22) {
      const k = d < 0.07 ? d / 0.07 : d < 0.1 ? 1 : 1 - (d - 0.1) / 0.12
      m = Math.min(m, 1 - 0.93 * k)
    }
  }
  return m
}

// Did tau cross x on this step (every period seconds, when period > 0)?
const hit = (c: Cue, x: number, period = 0): boolean =>
  crossed(c.prev, c.tau, x, period)

// The idle breath on the squash, from the time in the state.
const breathe = (c: Cue, amp = 0.02, per = 2.8): number =>
  amp * Math.sin((TAU * c.tau) / per)

// Breathes, sways a little, blinks, glances left and right.
function idle(c: Cue): void {
  const { tau, T, X } = c
  T.sq = 1 + breathe(c)
  T.lx = 0.025 * Math.sin((TAU * tau) / 5.6)
  X.blink = blinkMul(tau, [1.1, 3.9, 4.18, 6.6], 8)
  const lt = tau % 8
  if (lt > 2.2 && lt < 3.1) {
    T.lookX = -0.7
    T.lookY = 0.1
  } else if (lt > 5.0 && lt < 5.9) {
    T.lookX = 0.6
    T.lookY = 0.25
  }
}

// Falls in from above, lands as a splat and rebounds into the idle breath.
function drop(c: Cue): void {
  const { tau, T, X, sim } = c
  const s = sim.s
  const g = (2 * DROP_Y0) / (DROP_T * DROP_T)
  if (tau < DROP_T) {
    const vy = g * tau
    const y = DROP_Y0 - 0.5 * g * tau * tau
    X.rootY = y
    s.sq.x = 1.05 + Math.min(0.27, vy * 0.042)
    s.sq.v = 0
    X.speed = clamp(vy / 3, 0, 1)
    const gk = smooth(0.05, 0.25, tau)
    X.ghosts = [
      [0, y + 0.22 + vy * 0.03, 0.92, 0.42 * gk],
      [0, y + 0.45 + vy * 0.06, 0.82, 0.2 * gk],
    ]
    T.lookY = -0.35
    T.smile = 0.7
    T.dangle = 0.015
  } else {
    X.rootY = 0
    if (hit(c, DROP_T)) {
      s.spl.v = 2.5
      sim.splash(0.86, 1, 4, 0.5)
      sim.ring(0.8, 1.8)
    }
    const a = tau - DROP_T
    X.speed = clamp(1 - a / 0.12, 0, 1)
    // Splat: driven flat and wide within 0.06 s, held, then handed back
    // to the spring, which rebounds through a stretch.
    if (a < SPLAT.hold) {
      const sq0 = 1.05 + Math.min(0.27, g * DROP_T * 0.042)
      s.sq.x = lerp(sq0, SPLAT.sq, 1 - (1 - smooth(0, 0.06, a)) ** 2)
      s.sq.v = 0
      T.sq = s.sq.x
    }
    if (a < 0.4) {
      T.openL = 0
      T.openR = 0
      T.upL = 1
      T.upR = 1
      T.grin = 0.75
    }
    X.blink = blinkMul(tau, [2.2, 4.4], 0)
    if (a > 1.2) T.sq = 1 + breathe(c)
  }
}

// Leans in with one eye closed, sound arcs coming in at his side.
function listen(c: Cue): void {
  const { tau, T, X, sim } = c
  const v = sim.vs
  const k = smooth(0, 0.5, tau)
  T.lx = 0.24 * k
  T.lz = 0.06 * k
  T.yaw = -0.2 * k
  T.sq = 1 + breathe(c, 0.015)
  T.openR = tau > 0.25 ? 0 : 1
  T.upR = tau > 0.25 ? 1 : 0
  T.openL = 1.06
  T.lookX = 0.45
  T.lookY = 0.05
  T.smile = 0.75
  X.blink = blinkMul(tau, [3.3], 6)
  X.arcs = {
    c: [sim.rootX + 0.6, sim.rootY + 0.84 + SHAPE.bodyY0],
    intensity: (0.75 + 0.8 * v.level) * smooth(0.15, 0.55, tau),
    angle: 0,
    spread: 0.72,
    both: 0,
    base: 0.1,
  }
  X.arcSpeed = -1.1
}

// Follows the voice: higher stretches him up, louder opens the mouth.
function sing(c: Cue): void {
  const { tau, T, X, sim } = c
  const v = sim.vs
  const vo = v.voiced
  const pn = clamp(v.cents / 700, -0.35, 1.25)
  const near = v.cents > 350 ? 700 : 0
  const dev = clamp((v.cents - near) / 60, -1, 1)
  T.mouthO = vo * clamp(0.2 + v.level * 1.0, 0, 1)
  T.smile = 1 - 0.7 * vo
  T.sq = 1 + vo * (0.12 * pn - 0.08 * v.level) + breathe(c, 0.012)
  T.ry = vo * 0.05 * Math.max(0, pn)
  T.lz = -0.06 * pn * vo
  T.lx = 0.11 * dev * vo
  T.hue = vo * clamp(pn * 1.5 - 0.2, -1, 1)
  T.ripple = vo * (0.0012 + 0.002 * v.level + 0.002 * (1 - v.steady))
  T.lookY = 0.35 * pn * vo
  T.glow = 0.25 * v.level
  T.sqL = 0.12 * v.level
  T.sqR = 0.12 * v.level
  // Reaching up a glide, he squeezes his eyes shut into curved lids.
  const gu = vo * clamp((v.rate - 220) / 230, 0, 1)
  if (gu > 0) {
    T.openL = 1 - gu
    T.openR = 1 - gu
    T.upL = gu
    T.upR = gu
  }
  X.rippleSpeed = 8 + 5 * Math.max(0, pn)
  X.blink = blinkMul(tau, [2.7, 6.9], 9)
  X.arcs = {
    c: [sim.rootX + 0.5, sim.rootY + 0.62 + SHAPE.bodyY0],
    intensity: clamp(v.level * 1.2, 0, 1),
    angle: 0,
    spread: 0.7,
    both: 1,
    base: 0.1,
  }
  X.arcSpeed = 1.0 + 0.9 * Math.max(0, pn)
}

// In tune: the glow builds while the lock holds, and the eyes close happily.
function lock(c: Cue): void {
  const { tau, T, X, sim } = c
  const v = sim.vs
  const L = sim.lock
  const lockedFor = L.on ? sim.t - L.t0 : 0
  const vo = v.voiced
  const near = v.cents > 350 ? 700 : 0
  const dev = clamp((v.cents - near) / 60, -1, 1)
  const build = L.on ? 1 - Math.exp(-lockedFor / 1.4) : 0
  T.mouthO = vo * clamp(0.15 + v.level * 0.7, 0, 1)
  T.smile = 1 - 0.6 * vo
  T.lx = 0.08 * dev * vo * (L.on ? 0.3 : 1)
  T.sq = 1 + breathe(c, 0.012) - 0.04 * v.level
  T.glow = 1.15 * build
  T.emis = 1 + 0.3 * build
  if (L.on && lockedFor > 0.45) {
    T.openL = 0
    T.openR = 0
    T.upL = 1
    T.upR = 1
  }
  T.ripple = vo * 0.0008
  T.hue = 0.1 * build
  X.blink = blinkMul(tau, [0.6], 0)
}

// A 3.2 s loop: a crouch, a rise to a hover, and a settle back down.
function climb(c: Cue): void {
  const { tau, T, X, sim } = c
  const s = sim.s
  const P = 3.2
  const t = tau % P
  let y = 0
  if (t < 0.25) {
    T.sq = 0.84
    T.lookY = 0.3
  } else if (t < 2.4) {
    // Rises off the floor and hovers, stretched, with the motion sheet's
    // ghost trail below him and an arrow curving up at his side.
    const k = smooth(0.25, 1.05, t)
    y = 0.2 * k + (t > 1.05 ? 0.012 * Math.sin((TAU * (t - 1.05)) / 1.3) : 0)
    T.sq = 1.1 + breathe(c, 0.012)
    T.lookY = 0.85
    T.hue = 0.6 * k
    T.mouthO = t < 1.1 ? 0.3 : 0
    T.smile = t < 1.1 ? 0.4 : 1
    T.dangle = 0.015 * k
    const gk = smooth(0.3, 0.6, t) * (1 - smooth(1.9, 2.4, t))
    X.ghosts = [0, 1, 2].map((i): Q4 => {
      const sc = 0.88 - 0.13 * i
      // Each echo scaled about his lower body, so they narrow as they trail.
      return [
        sim.rootX,
        y + 0.4 * (1 - sc) - 0.1 * (i + 1) * k,
        sc,
        [0.8, 0.52, 0.28][i] * gk,
      ]
    })
    X.arrow = [
      sim.rootX - 0.74,
      y + 0.42 + SHAPE.bodyY0,
      0.85 * smooth(0.35, 0.7, t) * (1 - smooth(1.9, 2.4, t)),
    ]
  } else {
    const k = smooth(2.4, 3.0, t)
    y = 0.2 * (1 - k)
    T.sq = 1.1 - 0.1 * k
  }
  if (hit(c, 0.25, P)) s.sq.v += 3
  if (hit(c, 2.4, P)) s.sq.v -= 1.5
  X.rootY = y
  X.blink = blinkMul(t, [1.8], 0)
}

// The SVG build's jump: crouch, launch, a ballistic flight, a landing
// squash with a splash at his feet, a short settle, and again.
function celebrate(c: Cue): void {
  const { tau, T, X, sim } = c
  const s = sim.s
  const P = CEL.period
  const t = tau % P
  const v0 = (GRAV * CEL.air) / 2
  T.openL = 0
  T.openR = 0
  T.upL = 1
  T.upR = 1
  T.grin = 1
  T.smile = 0
  T.glow = 0.35
  T.emis = 1.1
  let y = 0
  if (t < CEL.crouch) T.sq = 0.84
  else if (t < CEL.crouch + CEL.air) {
    const ta = t - CEL.crouch
    y = v0 * ta - 0.5 * GRAV * ta * ta
    T.sq = 1
    T.dangle = 0.025
  }
  if (hit(c, CEL.crouch + CEL.air, P)) {
    s.sq.v -= 3.9
    sim.splash(0.62, 0.55, 4)
  }
  if (hit(c, CEL.crouch + 0.02, 2 * P)) sim.sparkle()
  T.lx = 0.05 * Math.sin((TAU * tau) / 1.4)
  X.rootY = y
}

// Points with the nub, sound arcs leaving its tip.
function point(c: Cue): void {
  const { tau, T, X, sim } = c
  const s = sim.s
  const on = tau > 0.28
  T.lx = on ? 0.06 : -0.05
  T.sq = on ? 1 + breathe(c, 0.012) : 0.95
  T.nub = on ? (tau % 2.4 > 1.9 && tau % 2.4 < 2.1 ? 1.1 : 1) : 0
  T.lookX = on ? 0.75 : 0
  T.lookY = on ? 0.12 : 0
  T.yaw = on ? 0.16 : 0
  T.smile = 1
  X.blink = blinkMul(tau, [1.6, 3.9], 5)
  if (on) {
    const tip = sim.restToWorld([
      SHAPE.nub[0] + 0.34 * 0.957 + 0.1,
      SHAPE.nub[1] + 0.34 * 0.287,
      0.0,
    ])
    X.arcs = {
      c: [tip[0], tip[1]],
      intensity: smooth(0.55, 0.85, tau) * 0.8 * clamp(s.nub.x, 0, 1),
      angle: 0.15,
      spread: 0.6,
      both: 0,
      base: 0.04,
    }
    X.arcSpeed = 0.9
  }
}

// Melts low, eyes closed, a slow ripple in the resin.
function sleep(c: Cue): void {
  const { tau, T, X } = c
  const dz = smooth(0.0, 1.3, tau)
  T.melt = 0.14 * dz
  T.sq = 1 - 0.34 * dz + breathe(c, 0.02, 3.6) * dz
  T.openL = 1 - smooth(0.05, 0.6, tau)
  T.openR = T.openL
  T.dnL = smooth(0.3, 0.7, tau)
  T.dnR = T.dnL
  T.smile = 0.5
  T.emis = 0.92
  T.ripple = 0.0012
  X.rippleSpeed = 2.0
  X.rippleFreq = 30
  X.rippleSrc = 1.05
}

// The SVG build's hop: crouch, a ballistic arc to the next stop, a
// landing squash and a settle, in a 0.75 s slot.
function hop(c: Cue): void {
  const { tau, T, X, sim } = c
  const s = sim.s
  const S = HOP.slot
  const P = 4 * S
  const t = tau % P
  const slot = Math.min(3, Math.floor(t / S))
  const u = t - slot * S
  const [xa, xb] = HOPS[slot]
  const dir = Math.sign(xb - xa)
  const v0 = (GRAV * HOP.air) / 2
  const apex = (v0 * v0) / (2 * GRAV)
  const u0 = HOP.crouch
  const u1 = HOP.crouch + HOP.air
  const arc: HopArc = { u, xa, xb, dir, v0, apex, u0, u1 }
  const [x, y] = hopFlight(T, arc)
  if (hit(c, u1, S)) s.sq.v -= 3.5
  T.lookX = 0.6 * dir
  X.rootX = x
  X.rootY = y
  X.dots = hopDots(arc)
  X.stops = [-HOP_X, 0, HOP_X, 1]
  if (u > u0 + 0.06 && u < u1) X.ghosts = hopGhosts(arc)
}

// Where this hop's slot has him: crouched, in the air, or landed.
function hopFlight(T: Targets, a: HopArc): [number, number] {
  const { u, xa, xb, dir, v0, u0, u1 } = a
  let x = xa
  let y = 0
  if (u < u0) {
    T.sq = 0.84
    T.lx = -0.06 * dir
  } else if (u < u1) {
    const ta = u - u0
    const vy = v0 - GRAV * ta
    x = lerp(xa, xb, ta / HOP.air)
    y = v0 * ta - 0.5 * GRAV * ta * ta
    T.sq = vy < -0.67 ? 1.03 : 1.0
    T.lx = 0.14 * dir
    T.dangle = 0.025
  } else {
    x = xb
  }
  return [x, y]
}

// The dotted arc to the next stop, brightest while he is in the air.
function hopDots(a: HopArc): Q4[] {
  const { u, xa, xb, apex, u0, u1 } = a
  const S = HOP.slot
  const da = u < u0 ? smooth(0, u0, u) : u < u1 ? 1 : 1 - smooth(u1, S, u)
  const dots: Q4[] = []
  for (let i = 0; i <= 10; i++) {
    const k = i / 10
    dots.push([
      lerp(xa, xb, k),
      0.03 + 4 * apex * k * (1 - k),
      0.25,
      0.7 * da * (0.45 + 0.55 * Math.sin(Math.PI * k)),
    ])
  }
  return dots
}

// Two echoes trailing him along the arc.
function hopGhosts(a: HopArc): Q4[] {
  const { u, xa, xb, apex, u0, u1 } = a
  const gk = smooth(u0 + 0.06, u0 + 0.16, u) * (1 - smooth(u1 - 0.11, u1, u))
  const k1 = (u - u0 - 0.06) / HOP.air
  const k2 = (u - u0 - 0.12) / HOP.air
  return [
    [
      lerp(xa, xb, k1),
      4 * apex * k1 * (1 - k1),
      0.94,
      0.4 * gk * (k1 > 0 ? 1 : 0),
    ],
    [
      lerp(xa, xb, k2),
      4 * apex * k2 * (1 - k2),
      0.86,
      0.2 * gk * (k2 > 0 ? 1 : 0),
    ],
  ]
}

const MOVES: Record<MercState, (c: Cue) => void> = {
  drop,
  idle,
  listen,
  sing,
  lock,
  climb,
  celebrate,
  point,
  sleep,
  hop,
}

/** This step's spring targets and effects for the sim's current state. */
export function choreo(
  sim: ChoreoHost,
  tau: number,
  prev: number,
): [Targets, Fx] {
  const T: Targets = {}
  const X: Fx = {
    speed: 0,
    ghosts: null,
    arcs: null,
    dots: null,
    stops: null,
    arrow: null,
    blink: 1,
    rootX: null,
    rootY: null,
  }
  MOVES[sim.state]({ tau, prev, T, X, sim })
  return [T, X]
}
