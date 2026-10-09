// ============================================================
// Merc sim — the fixed-step physics behind every pose
// ============================================================
//
// Runs at a fixed 240 Hz step and turns the current state, the voice and
// time into the uniforms the shader draws (pose()). Everything is
// deterministic: the same state, voice and step count give the same pose to
// the last bit, which is what makes capture mode repeatable.
//
// A step smooths the voice, tracks the in-tune lock, asks the state's
// choreography for spring targets (sim-choreo.ts), steps the springs
// (sim-springs.ts), moves the root, ages the particles and advances the
// effect phases, in that order. Reorder them and the replay changes.
//
// Ported operation for operation from the pass 4 study. Floating-point
// results depend on the order of operations, so "tidying" an expression here
// (x ** 2 for x * x, reordered sums) can move a pixel. Leave the arithmetic
// as it is unless you mean to change how Merc moves.

import type { MercState } from './constants'
import { isMercState, SHAPE } from './constants'
import type { Warp } from './rest-space'
import { bendAt, placeEyes, restToWorldExact } from './rest-space'
import type { Arcs, Fx } from './sim-choreo'
import { choreo, DROP_Y0 } from './sim-choreo'
import type { Q3, Q4 } from './sim-math'
import { clamp, smooth } from './sim-math'
import type { Springs, Targets } from './sim-springs'
import { makeSprings, stepRoot, stepSprings } from './sim-springs'

export interface MercVoice {
  voiced: boolean
  /** Distance from the target note, in cents. */
  cents: number
  /** Loudness, 0..1. */
  level: number
  /** How steady the pitch is, 0..1. */
  steady: number
  midi: number
}

/** The voice at t seconds since the last setState. */
export type MercVoiceSource = (t: number) => MercVoice

/** Offsets on top of the choreography, e.g. turn toward a three-quarter camera. */
export interface PoseBias {
  yaw: number
  lookX: number
  lookY: number
}

/** Everything the shader needs for one instant. */
export interface MercPose {
  t: number
  root: Q3
  shape: Q4
  lip: number
  lean: Q4
  feet: Q4
  ripple: Q4
  wave: Q4
  nub: number
  eyeC: number[]
  eyeX: number[]
  eyeZ: number[]
  eyeFrz: [number, number]
  core: Q4
  eyeA: Q4
  eyeB: Q4
  mouth: Q4
  color: Q4
  ring: Q4
  arcs: Q4
  arcs2: Q4
  drops: Q4[]
  sparks: Q4[]
  dots: Q4[]
  stops: Q4
  ghosts: Q4[]
  arrow: Q4
  speed: number
  bound: Q4
}

export const STEP = 1 / 240

interface Drop {
  p: Q3
  v: Q3
  r: number
  age: number
}

interface Spark {
  p: Q3
  size: number
  t0: number
  life: number
  ph: number
}

interface Ring {
  t0: number
  s: number
  sp: number
}

interface Lock {
  acc: number
  on: boolean
  t0: number
  off: number
  lastPulse: number
}

interface VoiceSmooth {
  voiced: number
  level: number
  cents: number
  steady: number
  rate: number
}

/** The whole simulation state, for continuous capture's backward seeks. */
export interface SimSnapshot {
  state: MercState
  stateT0: number
  prevTau: number
  t: number
  n: number
  s: Springs
  rootX: number
  rootY: number
  vx: number
  vy: number
  drops: Drop[]
  sparks: Spark[]
  rings: Ring[]
  wave: { t0: number; amp: number } | null
  ripplePhase: number
  arcPhase: number
  voice: MercVoice
  vs: VoiceSmooth
  lock: Lock
  fx: Fx
  lastArcs: Arcs | null
  arcsK: number
  voiceT0: number
}

const freshLock = (): Lock => ({
  acc: 0,
  on: false,
  t0: 0,
  off: 0,
  lastPulse: 0,
})

export class Sim {
  voiceAt: MercVoiceSource | null = null
  readonly bias: PoseBias = { yaw: 0, lookX: 0, lookY: 0 }

  // Set by reset().
  state!: MercState
  stateT0!: number
  prevTau!: number
  t!: number
  n!: number
  s!: Springs
  rootX!: number
  rootY!: number
  vx!: number
  vy!: number
  drops!: Drop[]
  sparks!: Spark[]
  rings!: Ring[]
  wave!: { t0: number; amp: number } | null
  ripplePhase!: number
  arcPhase!: number
  voice!: MercVoice
  vs!: VoiceSmooth
  lock!: Lock
  fx!: Fx
  // Sound arcs fade out when a state stops drawing them.
  lastArcs!: Arcs | null
  arcsK!: number
  // Continuous capture: the voice clock restarts at each setState.
  voiceT0!: number

  constructor(state: MercState = 'idle') {
    this.reset(state)
  }

  reset(state: MercState): void {
    this.t = 0
    this.n = 0
    this.s = makeSprings()
    this.rootX = 0
    this.rootY = 0
    this.vx = 0
    this.vy = 0
    this.drops = []
    this.sparks = []
    this.rings = []
    this.wave = null
    this.ripplePhase = 0
    this.arcPhase = 0
    this.voice = { voiced: false, cents: 0, level: 0, steady: 0, midi: 57 }
    this.vs = { voiced: 0, level: 0, cents: 0, steady: 0, rate: 0 }
    this.lock = freshLock()
    this.fx = {
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
    this.lastArcs = null
    this.arcsK = 0
    this.voiceT0 = 0
    this.setState(state, true)
  }

  setState(name: MercState, fresh = false): void {
    if (!isMercState(name)) return
    this.state = name
    this.stateT0 = this.t
    this.prevTau = -1e-6
    if (name === 'drop') {
      this.rootX = 0
      this.rootY = DROP_Y0
      this.s.rx.x = 0
      this.s.ry.x = 0
      this.s.sq.x = 1.05
      this.s.sq.v = 0
    }
    if (fresh) this.lock = freshLock()
  }

  snapshot(): SimSnapshot {
    return structuredClone({
      state: this.state,
      stateT0: this.stateT0,
      prevTau: this.prevTau,
      t: this.t,
      n: this.n,
      s: this.s,
      rootX: this.rootX,
      rootY: this.rootY,
      vx: this.vx,
      vy: this.vy,
      drops: this.drops,
      sparks: this.sparks,
      rings: this.rings,
      wave: this.wave,
      ripplePhase: this.ripplePhase,
      arcPhase: this.arcPhase,
      voice: this.voice,
      vs: this.vs,
      lock: this.lock,
      fx: this.fx,
      lastArcs: this.lastArcs,
      arcsK: this.arcsK,
      voiceT0: this.voiceT0,
    })
  }

  // The snapshot stays untouched, so it can be restored again.
  restore(snap: SimSnapshot): void {
    Object.assign(this, structuredClone(snap))
  }

  // Droplets thrown up from the floor just outside the body's edge, so they
  // read as separate beads from the first frame instead of knobs on the flanks.
  // edge: distance from his centre; k scales the throw, kx its sideways part.
  splash(edge = 0.8, k = 1, n = 6, kx = 1): void {
    const R: readonly Q4[] = [
      [-1, 0.25, 2.0, 0.042],
      [1, 0.22, 2.2, 0.038],
      [-1, 0.35, 1.5, 0.03],
      [1, 0.32, 1.6, 0.032],
      [-1, 0.12, 2.6, 0.025],
      [1, 0.14, 2.5, 0.027],
    ]
    for (const [sd, vx, vy, r] of R.slice(0, n)) {
      // Sideways speed kept low enough that every droplet lands inside the frame.
      this.drops.push({
        p: [this.rootX + sd * edge, 0.05, 0.16],
        v: [sd * vx * k * kx, vy * k, 0.12],
        r: r * Math.sqrt(k),
        age: 0,
      })
    }
    this.drops = this.drops.slice(-6)
  }

  sparkle(): void {
    const A: readonly Q4[] = [
      [158, 0.86, 0.075, 0.0],
      [122, 0.92, 0.055, 0.12],
      [52, 0.9, 0.085, 0.05],
      [18, 0.84, 0.06, 0.2],
      [-22, 0.88, 0.07, 0.1],
      [-150, 0.84, 0.065, 0.16],
      [92, 1.0, 0.05, 0.24],
    ]
    this.sparks = A.map(([deg, r, s, delay], i) => {
      const a = (deg * Math.PI) / 180
      return {
        p: [
          this.rootX + Math.cos(a) * r,
          this.rootY + 0.6 + SHAPE.bodyY0 + Math.sin(a) * r * 0.85,
          0.15,
        ],
        size: s * 3.0,
        t0: this.t + delay,
        life: 1.2 + 0.06 * (i % 3),
        ph: i * 1.7,
      }
    })
  }

  ring(strength: number, speed: number): void {
    this.rings.push({ t0: this.t, s: strength, sp: speed })
    this.rings = this.rings.slice(-2)
  }

  step(dt: number): void {
    const raw = this.voiceAt ? this.voiceAt(this.t - this.voiceT0) : this.voice
    smoothVoice(this.vs, raw, dt)
    this.trackLock(raw, dt)

    const tau = this.t - this.stateT0
    const [T, X] = choreo(this, tau, this.prevTau)
    this.prevTau = tau

    stepSprings(this.s, T, dt)
    this.moveRoot(T, X, dt)
    this.ageParticles(dt)
    this.advancePhases(X, dt)
    this.fx = X
    this.t += dt
    this.n += 1
  }

  // Lock detection on the raw voice.
  private trackLock(raw: MercVoice, dt: number): void {
    const L = this.lock
    const inWin = raw.voiced && Math.abs(raw.cents) < 30 && raw.steady > 0.72
    // Capped, so a long hold cannot bank enough time to re-lock the moment the lock drops.
    L.acc = inWin ? Math.min(0.3, L.acc + dt) : Math.max(0, L.acc - dt * 2)
    if (!L.on && L.acc > 0.12) this.engageLock()
    if (L.on) this.holdLock(raw, dt)
  }

  // In the window long enough: lock on. In the lock state he also squashes,
  // and a floor ring and a ripple wave go out.
  private engageLock(): void {
    const L = this.lock
    L.on = true
    L.off = 0
    L.t0 = this.t
    L.lastPulse = this.t
    if (this.state === 'lock') {
      this.s.sq.v -= 3.4
      this.ring(1.0, 1.9)
      this.wave = { t0: this.t, amp: 0.03 }
    }
  }

  // Let go after 0.15 s out of the window. In the lock state a floor ring
  // pulses every 1.15 s while the lock holds.
  private holdLock(raw: MercVoice, dt: number): void {
    const L = this.lock
    if (!raw.voiced || Math.abs(raw.cents) > 50) {
      L.off += dt
      if (L.off > 0.15) {
        // A dropped lock needs a fresh run in the window before it can lock again.
        L.on = false
        L.off = 0
        L.acc = 0
      }
    } else L.off = 0
    if (L.on && this.state === 'lock' && this.t - L.lastPulse > 1.15) {
      L.lastPulse = this.t
      this.ring(0.5, 1.5)
    }
  }

  // Root: kinematic when the state scripts it, sprung back home otherwise.
  private moveRoot(T: Targets, X: Fx, dt: number): void {
    const ox = this.rootX
    const oy = this.rootY
    this.rootX = stepRoot(this.s.rx, X.rootX, T.rx, dt)
    this.rootY = stepRoot(this.s.ry, X.rootY, T.ry, dt)
    const nvx = (this.rootX - ox) / dt
    const nvy = (this.rootY - oy) / dt
    // Inertia: the tip lags behind horizontal changes of speed.
    this.s.swx.v -= (nvx - this.vx) * 0.75
    this.vx = nvx
    this.vy = nvy
  }

  // Particles: droplets fly and land, sparks and floor rings run out.
  private ageParticles(dt: number): void {
    for (const d of this.drops) {
      d.v[1] -= 9.0 * dt
      for (let i = 0; i < 3; i++) d.p[i] += d.v[i] * dt
      d.age += dt
    }
    this.drops = this.drops.filter((d) => d.p[1] > d.r * 0.6 && d.age < 2.5)
    this.sparks = this.sparks.filter((s) => this.t < s.t0 + s.life)
    this.rings = this.rings.filter((r) => this.t - r.t0 < 2.2)
    if (this.wave && this.t - this.wave.t0 > 0.9) this.wave = null
  }

  // The ripple and sound-arc phases, and the arcs' fade once a state stops
  // drawing them.
  private advancePhases(X: Fx, dt: number): void {
    this.ripplePhase += dt * (X.rippleSpeed ?? 9)
    this.arcPhase += dt * (X.arcSpeed ?? 1.2)
    if (X.arcs) {
      this.lastArcs = X.arcs
      this.arcsK = 1
    } else if (this.lastArcs) {
      this.arcsK = Math.max(0, this.arcsK - dt / 0.35)
      if (this.arcsK <= 0) this.lastArcs = null
    }
  }

  // Rest-space point to world, approximately (used to place effects).
  restToWorld(q: readonly number[]): Q3 {
    const s = this.s
    let [x, y, z] = q
    const m =
      1 +
      Math.max(0, s.melt.x + s.spl.x) *
        0.75 *
        (1 - smooth(SHAPE.bodyY0, 0.8 + SHAPE.bodyY0, y))
    x *= m
    z *= m
    const sq = s.sq.x
    y *= sq
    x /= Math.sqrt(sq)
    z /= Math.sqrt(sq)
    const sw = smooth(0.25 + SHAPE.bodyY0, 1.2 + SHAPE.bodyY0, y) ** 2
    x += s.swx.x * sw
    z += s.swz.x * sw
    const hy = clamp(
      (y - SHAPE.bodyY0 + 0.055) / (SHAPE.restH - SHAPE.bodyY0 + 0.055),
      0,
      1.4,
    )
    const ax = -s.lx.x * hy
    ;[x, y] = [
      Math.cos(ax) * x - Math.sin(ax) * y,
      Math.sin(ax) * x + Math.cos(ax) * y,
    ]
    const yw = -s.yaw.x
    ;[x, z] = [
      Math.cos(yw) * x - Math.sin(yw) * z,
      Math.sin(yw) * x + Math.cos(yw) * z,
    ]
    return [x + this.rootX, y + this.rootY, z]
  }

  // Everything the shader needs for this instant.
  pose(): MercPose {
    const s = this.s
    const X = this.fx
    const sq = Math.max(0.3, s.sq.x)
    const melt = Math.max(0, s.melt.x + s.spl.x)
    const blink = X.blink ?? 1
    const eyes = placeEyes(
      s.lookX.x + this.bias.lookX,
      s.lookY.x + this.bias.lookY,
    )
    const yaw = s.yaw.x + this.bias.yaw
    // The warp of this instant, to carry rest-space points into the world.
    const W: Warp = {
      root: [this.rootX, this.rootY, 0],
      shape: [sq, melt, Math.cos(yaw), Math.sin(yaw)],
      lean: [s.lx.x, s.lz.x, s.swx.x, s.swz.x],
    }
    const guessOf = (r: readonly number[]): Q3 => this.restToWorld(r)
    // Freeze the bend at the eyes' height (both eyes, averaged): the shader's
    // hy and sway weight, evaluated at the eye centres carried into the world.
    const eyeFrz: [number, number] = [0, 0]
    for (const e of eyes) {
      const c = restToWorldExact(e.c, W, guessOf(e.c))
      const f = bendAt(c, W)
      eyeFrz[0] += f[0] / 2
      eyeFrz[1] += f[1] / 2
    }
    const coreR: Q3 = [0, SHAPE.coreY, -0.04]
    const core = restToWorldExact(coreR, W, guessOf(coreR))
    // Floor rings slow to a stop well inside the frame and fade before they get there.
    const RING0 = 0.35
    const RING1 = 0.66
    const rings = this.rings.map((r): [number, number] => {
      const age = this.t - r.t0
      const u = 1 - Math.exp((-age * r.sp) / (RING1 - RING0))
      return [
        RING0 + (RING1 - RING0) * u,
        r.s *
          Math.exp(-age * 1.6) *
          smooth(0, 0.04, age) *
          (1 - smooth(0.7, 0.97, u)),
      ]
    })
    const arcsSrc = X.arcs ?? this.lastArcs
    const arcsI = X.arcs ? 1 : this.arcsK
    while (rings.length < 2) rings.unshift([0, 0])
    const wave = this.wave
      ? [
          this.wave.amp * Math.exp(-(this.t - this.wave.t0) * 2.5),
          0.02 + 1.6 * (this.t - this.wave.t0),
        ]
      : [0, 0]
    const drops = this.drops.map(
      (d): Q4 => [
        d.p[0],
        d.p[1],
        d.p[2],
        d.r *
          (1 - smooth(1.6, 2.4, d.age)) *
          (d.v[1] < 0 ? smooth(d.r * 0.6, d.r * 0.6 + 0.07, d.p[1]) : 1),
      ],
    )
    const sparks = this.sparks
      .filter((p) => this.t >= p.t0)
      .map((p): Q4 => {
        const age = this.t - p.t0
        const life = Math.sin((Math.PI * age) / p.life) ** 0.4
        const tw = 0.78 + 0.22 * Math.sin(age * 17 + p.ph)
        return [p.p[0], p.p[1] + age * 0.06, p.p[2], p.size * life * tw]
      })
    // Bounding sphere: body, nub, a pad for the edge anti-aliasing, droplets.
    const cy = this.rootY + (0.58 + SHAPE.bodyY0) * sq
    let br =
      0.72 * Math.max(sq, 1 / Math.sqrt(sq)) * (1 + melt * 0.6) +
      0.12 +
      0.36 * Math.max(0, s.nub.x) +
      0.12
    for (const d of drops) {
      br = Math.max(
        br,
        Math.hypot(d[0] - this.rootX, d[1] - cy, d[2]) + d[3] + 0.12,
      )
    }
    return {
      t: this.t,
      root: [this.rootX, this.rootY, 0],
      shape: [sq, melt, Math.cos(yaw), Math.sin(yaw)],
      lip: (Math.min(sq, 1 / Math.sqrt(sq)) / (1 + melt * 0.75)) * 0.85,
      lean: [s.lx.x, s.lz.x, s.swx.x, s.swz.x],
      feet: [1, Math.max(0, s.dangle.x), 0, 0],
      ripple: [
        Math.max(0, s.ripple.x),
        X.rippleFreq ?? 60,
        this.ripplePhase,
        X.rippleSrc ?? SHAPE.mouthY,
      ],
      wave: [wave[0], wave[1], 0, 0],
      nub: Math.max(0, s.nub.x),
      eyeC: [...eyes[0].c, ...eyes[1].c],
      eyeX: [...eyes[0].x, ...eyes[1].x],
      eyeZ: [...eyes[0].z, ...eyes[1].z],
      eyeFrz,
      core: [core[0], core[1], core[2], 0.24 * Math.sqrt(Math.max(sq, 0.6))],
      // Once a closed-eye arc is mostly drawn, the last sliver of the eye
      // goes, so a squeeze never shows a flat dash under the curved lid.
      eyeA: [
        clamp(s.openL.x, 0, 1.15) * blink * (1 - smooth(0.4, 0.85, s.upL.x)),
        clamp(s.openR.x, 0, 1.15) * blink * (1 - smooth(0.4, 0.85, s.upR.x)),
        clamp(s.sqL.x, 0, 0.6),
        clamp(s.sqR.x, 0, 0.6),
      ],
      eyeB: [
        clamp(s.upL.x, 0, 1),
        clamp(s.upR.x, 0, 1),
        clamp(s.dnL.x, 0, 1),
        clamp(s.dnR.x, 0, 1),
      ],
      mouth: [
        clamp(s.smile.x, 0, 1),
        clamp(s.mouthO.x, 0, 1),
        clamp(s.grin.x, 0, 1),
        0,
      ],
      color: [
        clamp(s.hue.x, -1, 1),
        Math.max(0, s.emis.x),
        Math.max(0, s.glow.x),
        0,
      ],
      ring: [rings[0][0], rings[0][1], rings[1][0], rings[1][1]],
      arcs: arcsSrc
        ? [arcsSrc.c[0], arcsSrc.c[1], arcsSrc.intensity * arcsI, this.arcPhase]
        : [0, 0, 0, 0],
      arcs2: arcsSrc
        ? [arcsSrc.angle, arcsSrc.spread, arcsSrc.both, arcsSrc.base]
        : [0, 1, 0, 0.1],
      drops,
      sparks,
      dots: X.dots ?? [],
      stops: X.stops ?? [0, 0, 0, 0],
      ghosts: X.ghosts ?? [],
      arrow: X.arrow ? [...X.arrow, 0] : [0, 0, 0, 0],
      speed: X.speed || 0,
      bound: [this.rootX, cy, 0, br],
    }
  }
}

// The voice the choreography reads: level, voicing and steadiness eased over
// 45 ms, the pitch over 60 ms, plus how fast the pitch is moving.
function smoothVoice(vs: VoiceSmooth, raw: MercVoice, dt: number): void {
  const a1 = 1 - Math.exp(-dt / 0.045)
  vs.level += ((raw.voiced ? raw.level : 0) - vs.level) * a1
  vs.voiced += ((raw.voiced ? 1 : 0) - vs.voiced) * (1 - Math.exp(-dt / 0.045))
  const pc = vs.cents
  if (raw.voiced) {
    vs.cents += (raw.cents - vs.cents) * (1 - Math.exp(-dt / 0.06))
  }
  // How fast the pitch is moving (cents/s), smoothed: a glide, not a wobble.
  vs.rate += ((vs.cents - pc) / dt - vs.rate) * (1 - Math.exp(-dt / 0.1))
  vs.steady += ((raw.voiced ? raw.steady : 0) - vs.steady) * a1
}
