// ============================================================
// Merc's hop, held in place in his canvas while the path carries him
// ============================================================
//
// His 'hop' (src/lib/merc/sim-choreo.ts) is the rooms' hop: in Echo and
// Long note his canvas stands still and he hops 0.38 units to his right
// inside it, then springs back to its middle once he is idle again. On the
// path his canvas itself carries him from spot to spot (PathColumn.tsx), so
// that drift moved his body as much as 0.17 of his canvas right of where
// the path put him (42 px on a phone), onto the light of the stop on his
// right, for about 0.3 s after each hop. Measured per frame in 13g.
//
// The path cancels it: as he hops, his canvas slides left by exactly what
// the simulation moves him right, and back as he springs home, so his body
// stays where path-layout.ts places it on every frame. His jump and his
// squash stay his own. The curve below is the simulation's, sampled at
// HOP_MS (merc-moves.ts) with 'idle' or 'celebrate' after it, and
// hop-drift.test.ts runs the real simulation against it.

import { VIEWS } from '@/lib/merc/constants'

/**
 * How far the front view sees across his canvas, in the simulation's units:
 * the camera's field of view at its distance, his root's plane.
 */
const VISIBLE =
  2 * VIEWS.front.dist * Math.tan((VIEWS.front.fov * Math.PI) / 360)

/**
 * His root's drift right through a hop and back, [ms from the hop, units]:
 * crouched to 124 ms, carried evenly to 0.38 by 534 ms, held there until
 * the hop ends (HOP_MS), then the root's spring brings him home by 950 ms
 * (its last 0.004 units of overshoot, under half a pixel, are left out).
 */
export const HOP_DRIFT: readonly (readonly [number, number])[] = [
  [0, 0],
  [124, 0],
  [534, 0.38],
  [650, 0.38],
  [675, 0.3575],
  [700, 0.3113],
  [725, 0.2561],
  [750, 0.2011],
  [775, 0.1514],
  [800, 0.1093],
  [825, 0.0755],
  [850, 0.0494],
  [875, 0.0302],
  [900, 0.0166],
  [925, 0.0074],
  [950, 0],
]

/** The drift's length, ms: from the hop to his root at rest. */
export const HOP_DRIFT_MS = HOP_DRIFT[HOP_DRIFT.length - 1][0]

/** The drift at `ms` into a hop, units: the curve's straight-line reading. */
export function hopDriftAt(ms: number): number {
  for (let i = 1; i < HOP_DRIFT.length; i += 1) {
    const [t1, x1] = HOP_DRIFT[i]
    if (ms <= t1) {
      const [t0, x0] = HOP_DRIFT[i - 1]
      return x0 + ((x1 - x0) * (ms - t0)) / (t1 - t0)
    }
  }
  return 0
}

/**
 * The canvas's slide against the drift, as Web Animations keyframes: a
 * share of the canvas's own width, so it holds at any size, and on the
 * song's smaller scale too (the canvas sits inside the scaled view).
 */
export function hopDriftKeyframes(): Keyframe[] {
  return HOP_DRIFT.map(([ms, units]) => ({
    offset: ms / HOP_DRIFT_MS,
    transform: `translateX(${(-canvasShare(units) * 100).toFixed(3)}%)`,
  }))
}

/** A share of his canvas's width, for `units` of the simulation's. */
export function canvasShare(units: number): number {
  return units / VISIBLE
}

/**
 * Slide his canvas against the hop's drift, from now. Null without a
 * canvas (no WebGL: nothing drifts) or without Web Animations.
 */
export function holdHopInPlace(
  canvas: HTMLCanvasElement | null,
): Animation | null {
  if (canvas === null || typeof canvas.animate !== 'function') return null
  return canvas.animate(hopDriftKeyframes(), {
    duration: HOP_DRIFT_MS,
    easing: 'linear',
  })
}
