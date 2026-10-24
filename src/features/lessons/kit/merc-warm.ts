// ============================================================
// Warm Merc — Tavi's gradient and the light she casts
// ============================================================
//
// Tavi is the shipped Merc with two changes, both through setLook. Her
// gradient runs gold base, orange (#ff7448) belly, rose crown, mirrored from
// Merc's aqua, azure and violet. And the light the shader casts around him
// (the floor pool, foot streaks, landing rings, key light, hot core, eye
// crescent, sound arcs), cool blue in its light set (LIGHT in
// src/lib/merc/constants.ts), is amber around her: WARM_LIGHT is the whole
// set. Both draw with one shader text, so a browser compiles it once for the
// two of them; a first visit's compile can take long
// (src/lib/merc/programs.ts). merc-warm.test.ts holds her to the amber the
// warm swaps of the shader text drew her in before the set existed.

import type { MercLight } from '@/lib/merc/constants'
import type { MercLookPatch } from '@/lib/merc/renderer'

/** Merc's light, in amber: each slot the warm twin of LIGHT's. */
export const WARM_LIGHT: MercLight = {
  pool: [0.55, 0.26, 0.05],
  wash: [0.45, 0.1, 0.08],
  footStreak: [0.62, 0.36, 0.08],
  ring: [1.0, 0.7, 0.32],
  stops: [1.0, 0.55, 0.3],
  eyeGlow: [0.022, 0.006, 0.002],
  eyeCrescent: [0.5, 0.28, 0.06],
  eyeEdge: [0.022, 0.01, 0.006],
  drops: [0.95, 0.6, 0.18],
  key: [1.0, 0.62, 0.32],
  core: [0.36, 0.19, 0.02],
  nub: [0.62, 0.38, 0.12],
  glintSheen: [1.0, 0.84, 0.55],
  glint: [1.0, 0.7, 0.45],
  arcs: [1.0, 0.8, 0.6],
  dots: [1.0, 0.78, 0.55],
  speed: [1.0, 0.78, 0.58],
  trail: [1.0, 0.93, 0.8],
}

export const WARM_LOOK: MercLookPatch = {
  stops: [
    [0.0, '#ffd84d'],
    [0.136, '#ffd84d'],
    [0.232, '#f6ad2a'],
    [0.328, '#f3901f'],
    [0.424, '#ff7448'],
    [0.52, '#f45f2e'],
    [0.616, '#ea4a2b'],
    [0.712, '#e0363e'],
    [0.808, '#d42a5c'],
    [0.904, '#e24c8c'],
    [1.0, '#ff86b8'],
  ],
  bead: ['#b8401a', '#ffb36b'],
  tint: '#fff3ea',
  tint2: '#ffcf8a',
  light: WARM_LIGHT,
}
