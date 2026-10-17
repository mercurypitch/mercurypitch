// ============================================================
// The bridge's scroll: where the camera is at each moment of a run
// ============================================================
//
// The glide rooms' scroll (room-kit glide/glide-scroll.ts) on the bridge
// (DESIGN-ng-slides.md 1): the playhead stays at PLAYHEAD_X of the screen
// and the bridge moves under it. The camera is the world X under the
// playhead, in W units; arch k's apex is at k * PERIOD_W (ng-geometry:
// X_k). During a slide the camera moves at one constant speed, so x is
// linear in time wherever the voice is judged (N0 option B); a landing
// and its rest cover the landing's stone (LANDING_W). The intro (screen 1:
// the first apex at INTRO_APEX_X) has the playhead a little inside the
// first ramp, so the bridge rolls back a short way before it comes in.

import type { GlideScrollGeometry } from '@/components/room-kit/glide/glide-scroll'
import { createGlideScroll } from '@/components/room-kit/glide/glide-scroll'
import type { GlidePath } from '@/lib/glide/glide-path'
import { ARCH, INTRO_APEX_X, LANDING_W, PERIOD_W, PLAYHEAD_X, } from './bridge-geometry'

/** Arch k's apex, world X (W): the first arch's apex is 0. */
export function apexX(k: number): number {
  return k * PERIOD_W
}

/** The camera on the intro: screen 1's first apex at INTRO_APEX_X. */
export const INTRO_CAMERA = PLAYHEAD_X - INTRO_APEX_X

/** The bridge, as its scroll reads it. */
const BRIDGE: GlideScrollGeometry = {
  a: ARCH.a,
  period: PERIOD_W,
  landingW: LANDING_W,
  introCamera: INTRO_CAMERA,
}

export interface BridgeScroll {
  /** The camera at time `t` on the path's clock (s; the count-in is t < 0). */
  at: (t: number) => number
  /** The camera at `t`: `at`, as the glide rooms' take reads it. */
  camera: (t: number) => number
  /** The camera's speed during every slide, W/s. */
  readonly slideSpeed: number
  /** The camera's lowest and highest X over the run. */
  readonly min: number
  readonly max: number
  /** The count-in, s: the run starts at t = -countIn. */
  readonly countIn: number
}

export function createBridgeScroll(
  path: GlidePath,
  countInSec: number,
): BridgeScroll {
  const scroll = createGlideScroll(path, countInSec, BRIDGE)
  return {
    at: scroll.at,
    camera: scroll.camera,
    slideSpeed: scroll.speed,
    min: scroll.min,
    max: scroll.max,
    countIn: scroll.countIn,
  }
}
