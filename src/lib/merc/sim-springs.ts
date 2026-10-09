// ============================================================
// Merc sim springs — the spring table and one step of a spring
// ============================================================
//
// Most of what moves on Merc is a damped spring: squash, lean, sway, melt,
// every eye and mouth shape, his colour, and the root, which a state can
// also script outright. Each step the choreography sets targets for some of
// them; the rest relax to their rest value. The table order is the stepping
// order, as in the study, and the integration is written exactly as the
// study wrote it.

import { TAU } from './sim-math'

// name: [rest value, frequency Hz, damping ratio]
export const SPRINGS = {
  sq: [1, 3.0, 0.24],
  lx: [0, 1.7, 0.5],
  lz: [0, 1.7, 0.5],
  swx: [0, 2.3, 0.2],
  swz: [0, 2.3, 0.2],
  melt: [0, 0.7, 0.95],
  spl: [0, 1.7, 0.32],
  yaw: [0, 1.4, 0.75],
  nub: [0, 2.4, 0.32],
  openL: [1, 7, 0.85],
  openR: [1, 7, 0.85],
  sqL: [0, 5, 0.85],
  sqR: [0, 5, 0.85],
  upL: [0, 6, 0.9],
  upR: [0, 6, 0.9],
  dnL: [0, 3, 0.95],
  dnR: [0, 3, 0.95],
  lookX: [0, 3.2, 0.8],
  lookY: [0, 3.2, 0.8],
  smile: [1, 5, 0.9],
  mouthO: [0, 11, 0.72],
  grin: [0, 5, 0.85],
  hue: [0, 1.3, 0.95],
  emis: [1, 1.1, 0.95],
  glow: [0, 0.8, 1.0],
  ripple: [0, 3, 1.0],
  dangle: [0, 3.5, 0.55],
  rx: [0, 2.2, 0.8],
  ry: [0, 3.5, 0.6],
} as const satisfies Record<string, readonly [number, number, number]>

export type SpringName = keyof typeof SPRINGS
// Insertion order: the springs are stepped in this order, as in the study.
export const SPRING_NAMES = Object.keys(SPRINGS) as SpringName[]

export interface Spring {
  x: number
  v: number
  f: number
  z: number
}

export type Springs = Record<SpringName, Spring>
/** This step's spring targets; a spring left out relaxes to its rest value. */
export type Targets = Partial<Record<SpringName, number>>

export function makeSprings(): Springs {
  const s = {} as Springs
  for (const k of SPRING_NAMES) {
    const [x, fq, z] = SPRINGS[k]
    s[k] = { x, v: 0, f: fq, z }
  }
  return s
}

// One step of every spring but the root's, toward this step's targets.
export function stepSprings(s: Springs, T: Targets, dt: number): void {
  for (const k of SPRING_NAMES) {
    if (k === 'rx' || k === 'ry') continue
    const sp = s[k]
    const target = T[k] ?? SPRINGS[k][0]
    const w = TAU * sp.f
    sp.v += (w * w * (target - sp.x) - 2 * sp.z * w * sp.v) * dt
    sp.x += sp.v * dt
  }
}

// One step of the root's spring, or its scripted position when the state
// drives it kinematically.
export function stepRoot(
  sp: Spring,
  scripted: number | null,
  target: number | undefined,
  dt: number,
): number {
  if (scripted != null) {
    sp.v = (scripted - sp.x) / dt
    sp.x = scripted
  } else {
    const tg = target ?? 0
    const w = TAU * sp.f
    sp.v += (w * w * (tg - sp.x) - 2 * sp.z * w * sp.v) * dt
    sp.x += sp.v * dt
  }
  return sp.x
}
