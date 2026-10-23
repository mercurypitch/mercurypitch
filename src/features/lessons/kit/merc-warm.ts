// ============================================================
// Warm Merc — Tavi's gradient and the light she casts
// ============================================================
//
// Tavi is the shipped Merc with two changes. Her gradient runs gold
// base, orange (#ff7448) belly, rose crown, mirrored from Merc's aqua,
// azure and violet; that is an ordinary setLook. But the shader also bakes in
// a cool light (the floor pool, foot streaks, landing rings, key light, hot
// core, eye crescent, sound arcs), and left alone it would have her cast cyan
// on the floor. `warmFragment` swaps those constants for amber in the GLSL
// text at compile time, through the renderer's `fragmentPatch` hook, so the
// approved shader text in src/lib/merc never changes. Every swap must match
// exactly once: a change to the shader fails merc-warm.test.ts in CI, and at
// runtime the mount fails, so the page shows the still image instead of a
// half-warm Merc.

import type { MercLookPatch } from '@/lib/merc/renderer'

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
}

/** Cool constant in the shader -> its amber replacement. */
export const WARM_SWAPS: readonly (readonly [cool: string, warm: string])[] = [
  // the floor: pool, foot streaks, landing rings, stops
  ['vec3(0.03, 0.42, 0.52) * 0.5', 'vec3(0.55, 0.26, 0.05) * 0.5'],
  ['vec3(0.03, 0.12, 0.5) * 0.06', 'vec3(0.45, 0.1, 0.08) * 0.06'],
  ['vec3(0.08, 0.5, 0.62) * 0.2', 'vec3(0.62, 0.36, 0.08) * 0.2'],
  [
    'c += vec3(0.3, 0.85, 1.0) * 1.1 * uRing.y',
    'c += vec3(1.0, 0.7, 0.32) * 1.1 * uRing.y',
  ],
  [
    'c += vec3(0.3, 0.85, 1.0) * 1.1 * uRing.w',
    'c += vec3(1.0, 0.7, 0.32) * 1.1 * uRing.w',
  ],
  ['vec3(0.3, 0.55, 1.0) * uStops.w', 'vec3(1.0, 0.55, 0.3) * uStops.w'],
  // the eyes' glow and crescent
  ['vec3(0.001, 0.006, 0.022) * low', 'vec3(0.022, 0.006, 0.002) * low'],
  ['vec3(0.04, 0.5, 0.46) * 0.075', 'vec3(0.5, 0.28, 0.06) * 0.075'],
  [
    'vec3(0.006, 0.008, 0.022) * smoothstep',
    'vec3(0.022, 0.01, 0.006) * smoothstep',
  ],
  // droplets, key light, hot core, nub, foot glints
  ['vec3(0.12, 0.72, 0.78) * uColor.y', 'vec3(0.95, 0.6, 0.18) * uColor.y'],
  ['vec3(0.22, 0.55, 1.0) * uColor.y', 'vec3(1.0, 0.62, 0.32) * uColor.y'],
  ['vec3(0.02, 0.34, 0.28) * core', 'vec3(0.36, 0.19, 0.02) * core'],
  ['vec3(0.12, 0.5, 0.62) * uNub', 'vec3(0.62, 0.38, 0.12) * uNub'],
  ['vec3(0.45, 0.85, 1.0) * smoothstep', 'vec3(1.0, 0.84, 0.55) * smoothstep'],
  ['vec3(0.37, 0.65, 0.97)', 'vec3(1.0, 0.7, 0.45)'],
  // sound arcs, motion dots, speed lines, echo trail, climb arrow
  ['vec3(0.62, 0.78, 1.0) * uArcs.z', 'vec3(1.0, 0.8, 0.6) * uArcs.z'],
  ['vec3(0.55, 0.75, 1.0) * dd.w', 'vec3(1.0, 0.78, 0.55) * dd.w'],
  [
    'vec3(0.6, 0.75, 1.0) * exp(-gx * gx)',
    'vec3(1.0, 0.78, 0.58) * exp(-gx * gx)',
  ],
  [
    'mix(gc, vec3(0.8, 0.95, 1.0), 0.45)',
    'mix(gc, vec3(1.0, 0.93, 0.8), 0.45)',
  ],
  [
    'vec3(0.62, 0.78, 1.0) * exp(-dr * dr) * on',
    'vec3(1.0, 0.8, 0.6) * exp(-dr * dr) * on',
  ],
  [
    'vec3(0.62, 0.78, 1.0) * exp(-dd * dd)',
    'vec3(1.0, 0.8, 0.6) * exp(-dd * dd)',
  ],
]

/** How many times `needle` occurs in `haystack`. */
export function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

/** The scene shader with its cool light swapped for amber; throws if any swap does not match exactly once. */
export function warmFragment(source: string): string {
  let out = source
  for (const [cool, warm] of WARM_SWAPS) {
    const n = occurrences(out, cool)
    if (n !== 1) {
      throw new Error(
        `warm Merc: expected one "${cool}" in the shader, found ${n}`,
      )
    }
    out = out.replace(cool, warm)
  }
  return out
}
