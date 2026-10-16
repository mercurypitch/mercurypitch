// ============================================================
// The bay's scroll: where the camera is, and how close, at each moment
// ============================================================
//
// Time is the distance along the bay (DESIGN-lip-roll.md 1): the playhead
// stays at PLAYHEAD_X of the screen and the waves move under it. The
// camera is the world X under the playhead, in W units of wave B; wave
// k's crest is at k * PERIOD_W.
//
//   wave k      up, top and down: the camera moves at one constant speed,
//               the wave's span over its time, so x is linear in time
//               wherever the voice is judged (L0 5.2)
//   landing     the landing and the rest after it cover the landing
//   + rest      (LANDING_W) in their time: the scroll slows to a stand
//               over the landing, stands through the pause and the next
//               root's tone, and eases back up before the next wave
//               (room-kit glide-gap.ts)
//   count-in    from the intro at rest to the first wave's foot at the
//               wave speed. The intro shows screen 1: the first crest at
//               INTRO.crestX, the world squeezed to wave A's size; the
//               count-in zooms in to wave B's (`zoom`, 0 to 1, eased, flat
//               at both ends) while it rolls the bay back a little and in
//   end         after the last wave, the scroll comes to rest over its
//               landing
//
// `at` is where in the bay a moment is sung; `camera` is what the screen
// shows, the same unless a hold stops it (holdCamera: the demo's one wave,
// kept in view while its tooltips are read). Under a held camera the
// voice and Merc ride on past the playhead, across the screen.
//
// Ng slides' bridge-scroll.ts with the bay's period and the zoom. Pure
// arithmetic on the glide path's own times (src/lib/glide), so the wave
// under the playhead is always the wave the engine judges.

import type { ArchGap } from '@/components/room-kit/glide-gap'
import { archGapAt, easedDistance as eased, planArchGap, } from '@/components/room-kit/glide-gap'
import type { GlidePath } from '@/lib/glide/glide-path'
import { INTRO, LANDING_W, PERIOD_W, PLAYHEAD_X, WAVE } from './bay-geometry'

/** Wave k's crest, world X (W): the first wave's crest is 0. */
export function crestX(k: number): number {
  return k * PERIOD_W
}

/** The camera on the intro: screen 1's first crest at INTRO.crestX. */
export const INTRO_CAMERA = -(INTRO.crestX - PLAYHEAD_X) / INTRO.sx

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

/** The count-in: a cubic from rest at the intro to the foot at speed v. */
function countInAt(s: number, from: number, to: number, slope: number): number {
  const s2 = s * s
  const s3 = s2 * s
  return (
    from * (2 * s3 - 3 * s2 + 1) + to * (3 * s2 - 2 * s3) + slope * (s3 - s2)
  )
}

export function createBayScroll(
  path: GlidePath,
  countInSec: number,
): BayScroll {
  const waves = path.arches
  const first = waves[0]
  const sung = first.end - first.start
  const v = (2 * WAVE.a) / sung
  const gaps: ArchGap[] = []
  for (let k = 0; k + 1 < waves.length; k++) {
    const wave = waves[k]
    gaps.push(
      planArchGap(
        wave.end,
        wave.landingEnd,
        waves[k + 1].start,
        crestX(k) + WAVE.a,
        LANDING_W,
        v,
      ),
    )
  }
  const last = waves[waves.length - 1]
  const settle = Math.max(1e-3, last.landingEnd - last.end)
  const finalX = crestX(waves.length - 1) + WAVE.a
  const restX = finalX + (v * settle) / 2
  const footX = crestX(0) - WAVE.a
  const lead = countInSec + first.start

  const at = (t: number): number => {
    if (t <= -countInSec) return INTRO_CAMERA
    if (t < first.start) {
      const s = (t + countInSec) / lead
      return countInAt(s, INTRO_CAMERA, footX, v * lead)
    }
    for (let k = 0; k < waves.length; k++) {
      const wave = waves[k]
      if (t <= wave.end) {
        return crestX(k) - WAVE.a + v * Math.max(0, t - wave.start)
      }
      const gap = gaps[k] as ArchGap | undefined
      if (gap !== undefined && t < gap.to) return archGapAt(gap, t)
    }
    const tau = Math.min(settle, t - last.end)
    return finalX + v * (tau - settle * eased(tau / settle))
  }

  const zoom = (t: number): number =>
    lead <= 0 ? 1 : smoothstep((t + countInSec) / lead)

  // The count-in's dip below the foot: its lowest point, sampled.
  let min = Math.min(INTRO_CAMERA, footX)
  for (let i = 1; i < 64; i++) {
    min = Math.min(min, at(-countInSec + (i / 64) * lead))
  }
  return {
    at,
    camera: at,
    zoom,
    waveSpeed: v,
    min,
    max: restX,
    countIn: countInSec,
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
