// ============================================================
// The bay's scroll: where the camera is, and how close, at each moment
// ============================================================
//
// The glide rooms' scroll (room-kit glide/glide-scroll.ts) on the bay
// (DESIGN-lip-roll.md 1): the playhead stays at PLAYHEAD_X of the screen
// and the waves move under it. The camera is the world X under the
// playhead, in W units of wave B; wave k's crest is at k * PERIOD_W.
// During a wave the camera moves at one constant speed, so x is linear in
// time wherever the voice is judged (L0 5.2); a landing and its rest cover
// LANDING_W. The intro shows screen 1: the first crest at INTRO.crestX,
// the world squeezed to wave A's size; the count-in zooms in to wave B's
// (`zoom`, 0 to 1, eased, flat at both ends) while it rolls the bay back a
// little and in.
//
// `at` is where in the bay a moment is sung; `camera` is what the screen
// shows, the same unless a hold stops it (holdCamera: the demo's one wave,
// kept in view while its tooltips are read). Under a held camera the
// voice and Merc ride on past the playhead, across the screen.
//
// Pure arithmetic on the glide path's own times (src/lib/glide), so the
// wave under the playhead is always the wave the engine judges.

import type { GlideScrollGeometry } from '@/components/room-kit/glide/glide-scroll'
import { createGlideScroll } from '@/components/room-kit/glide/glide-scroll'
import { easedDistance as eased } from '@/components/room-kit/glide-gap'
import type { GlidePath } from '@/lib/glide/glide-path'
import { INTRO, LANDING_W, PERIOD_W, PLAYHEAD_X, WAVE } from './bay-geometry'

/** Wave k's crest, world X (W): the first wave's crest is 0. */
export function crestX(k: number): number {
  return k * PERIOD_W
}

/** The camera on the intro: screen 1's first crest at INTRO.crestX. */
export const INTRO_CAMERA = -(INTRO.crestX - PLAYHEAD_X) / INTRO.sx

/** The bay, as its scroll reads it. */
const BAY: GlideScrollGeometry = {
  a: WAVE.a,
  period: PERIOD_W,
  landingW: LANDING_W,
  introCamera: INTRO_CAMERA,
}

const smoothstep = (x: number): number => {
  const s = x <= 0 ? 0 : x >= 1 ? 1 : x
  return s * s * (3 - 2 * s)
}

export interface BayScroll {
  /**
   * Where time `t` on the path's clock is sung, world X (s; the count-in
   * is t < 0): the camera, while it follows the voice.
   */
  at: (t: number) => number
  /** The camera at `t`: `at`, unless a hold stopped it (holdCamera). */
  camera: (t: number) => number
  /** The zoom at `t`: 0 at the intro's (wave A), 1 from the first wave on. */
  zoom: (t: number) => number
  /** The camera's speed during every wave, W/s. */
  readonly waveSpeed: number
  /** The camera's lowest and highest X over the run. */
  readonly min: number
  readonly max: number
  /** The count-in, s: the run starts at t = -countIn. */
  readonly countIn: number
}

export function createBayScroll(
  path: GlidePath,
  countInSec: number,
): BayScroll {
  const scroll = createGlideScroll(path, countInSec, BAY)
  const lead = scroll.lead
  const zoom = (t: number): number =>
    lead <= 0 ? 1 : smoothstep((t + countInSec) / lead)
  return {
    at: scroll.at,
    camera: scroll.camera,
    zoom,
    waveSpeed: scroll.speed,
    min: scroll.min,
    max: scroll.max,
    countIn: scroll.countIn,
  }
}

/** A stop of the camera: it slows from `from` and stands from `to`, path s. */
export interface CameraHold {
  readonly from: number
  readonly to: number
}

/**
 * `scroll` with its camera brought to rest: at the wave speed until
 * `from`, slowing on a smoothstep to a stand at `to`, still from then on.
 * Where each moment is sung (`at`) does not move. The hold must lie inside
 * a wave, where the camera moves at the wave speed.
 */
export function holdCamera(scroll: BayScroll, hold: CameraHold): BayScroll {
  const span = Math.max(1e-3, hold.to - hold.from)
  const base = scroll.camera(hold.from)
  const v = scroll.waveSpeed
  const camera = (t: number): number => {
    if (t <= hold.from) return scroll.camera(t)
    const s = Math.min(1, (t - hold.from) / span)
    return base + v * span * (s - eased(s))
  }
  return { ...scroll, camera, max: camera(hold.to) }
}
