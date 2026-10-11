// ============================================================
// Stage layout — where the lantern stands, and how it moves
// ============================================================
//
// The lantern is as big as the stage's height allows, and never so big
// that Merc beside it would leave the screen. While he floats inside the
// glass it stands in the middle of the stage, under the timer. When he
// stands beside it and the stage is too narrow for both centred, it moves
// left just far enough for all of his canvas (a celebration's stars, a
// hop's landing and the drop's splash reach its edge) to end EDGE_PX
// inside the stage. Every move glides, in step with his hop.

import type { Accessor } from 'solid-js'
import { createEffect, createSignal, on, onCleanup, untrack } from 'solid-js'
import { LANTERN_VIEW_H, LANTERN_VIEW_W } from './lantern-geometry'

/** Merc's canvas, square, at full size (standing beside the lantern). */
export const MERC_UNITS = 210
/** Beside the lantern: his centre, in the lantern's view units. */
export const BESIDE_X = 230
/** The gap Merc's canvas keeps from the stage's right edge, px. */
const EDGE_PX = 2
/** The gap the painted lantern keeps from the stage's left edge, px. */
const SIDE_PX = 8
/**
 * How far right of the lantern's middle Merc's canvas beside it ends, in
 * view units.
 */
const MERC_REACH = BESIDE_X + MERC_UNITS / 2 - LANTERN_VIEW_W / 2
/**
 * How far left of its middle the painted lantern reaches, in view units:
 * the glow at its foot, 10 units in from the view box's edge.
 */
const LANTERN_REACH = 90
/** How long a move takes, ms: Merc's hop (the room's .mercHop). */
export const GLIDE_MS = 650

export interface StageLayout {
  /** px per view-box unit. */
  k: number
  /** The lantern box's offset in the stage, px. */
  left: number
  top: number
  /** The stage's size, px. */
  width: number
  height: number
}

/**
 * The lantern's place on a stage of this size. `aside` is 1 while Merc
 * stands beside the lantern, 0 while he is in the glass, and in between
 * while he hops.
 */
export function layoutStage(
  width: number,
  height: number,
  aside: number,
): StageLayout {
  const k = Math.max(
    0.2,
    Math.min(
      (height * 0.96) / LANTERN_VIEW_H,
      (width - EDGE_PX - SIDE_PX) / (LANTERN_REACH + MERC_REACH),
    ),
  )
  const centred = width / 2
  const beside = Math.min(centred, width - EDGE_PX - MERC_REACH * k)
  const middle = centred + (beside - centred) * aside
  const left = middle - (LANTERN_VIEW_W / 2) * k
  const top = height - LANTERN_VIEW_H * k
  return { k, left, top, width, height }
}

/** Part way from one layout to another: 0 is `from`, 1 is `to`. */
export function mixLayouts(
  from: StageLayout,
  to: StageLayout,
  t: number,
): StageLayout {
  const mix = (a: number, b: number): number => a + (b - a) * t
  return {
    k: mix(from.k, to.k),
    left: mix(from.left, to.left),
    top: mix(from.top, to.top),
    width: to.width,
    height: to.height,
  }
}

const sameLayout = (a: StageLayout, b: StageLayout): boolean =>
  a.k === b.k && a.left === b.left && a.top === b.top

const reducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The layout on screen: it follows `target`, easing over GLIDE_MS each
 * time the target moves, so the lantern never jumps. The first layout of
 * a measured stage lands at once, as does every move under reduced motion
 * (Merc's hop is instant there too).
 */
export function createLayoutGlide(
  target: Accessor<StageLayout>,
): Accessor<StageLayout> {
  const [shown, setShown] = createSignal(untrack(target))
  let frame = 0
  const stop = (): void => {
    if (frame !== 0) cancelAnimationFrame(frame)
    frame = 0
  }
  createEffect(
    on(target, (to) => {
      stop()
      const from = untrack(shown)
      if (from.width === 0 || sameLayout(from, to) || reducedMotion()) {
        setShown(to)
        return
      }
      const t0 = performance.now()
      const step = (): void => {
        const t = Math.min(1, (performance.now() - t0) / GLIDE_MS)
        setShown(mixLayouts(from, to, t * t * (3 - 2 * t)))
        frame = t < 1 ? requestAnimationFrame(step) : 0
      }
      frame = requestAnimationFrame(step)
    }),
  )
  onCleanup(stop)
  return shown
}
